import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { ChatMessage, ServerWsMessage, ParticipantRole } from '../types';
import { t, tReplace } from '../i18n';
import { useScreenCaptureDetection } from '../hooks/useScreenCaptureDetection';
import ChatOverlay from './ChatOverlay';
import VideoControls from './VideoControls';
import Logo from './Logo';

/* ─── Draggable PiP Component ────────────────────────────────────────────── */

interface DraggablePipProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

function DraggablePip({ localVideoRef }: DraggablePipProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const clampPosition = (x: number, y: number) => {
      const parentW = window.innerWidth;
      const parentH = window.innerHeight;
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;
      return {
        x: Math.max(0, Math.min(x, parentW - elW)),
        y: Math.max(0, Math.min(y, parentH - elH)),
      };
    };

    // --- Mouse events ---
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      el.classList.add('dragging');
      const rect = el.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const pos = clampPosition(
        e.clientX - dragOffset.current.x,
        e.clientY - dragOffset.current.y
      );
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.right = 'auto';
    };

    const onMouseUp = () => {
      isDragging.current = false;
      el.classList.remove('dragging');
    };

    // --- Touch events ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging.current = true;
      el.classList.add('dragging');
      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      dragOffset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const pos = clampPosition(
        touch.clientX - dragOffset.current.x,
        touch.clientY - dragOffset.current.y
      );
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      el.style.right = 'auto';
      e.preventDefault();
    };

    const onTouchEnd = () => {
      isDragging.current = false;
      el.classList.remove('dragging');
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div ref={containerRef} className="local-video-container">
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="local-video"
      />
    </div>
  );
}

/* ─── VideoCall Component ────────────────────────────────────────────────── */

interface VideoCallProps {
  roomId: string;
  joinToken: string;
  userId: string;
  nickname: string;
  language: string;
  role: ParticipantRole;
  callUrl?: string;
  onCopyLink?: () => void;
  copied?: boolean;
}

export default function VideoCall({
  roomId: initialRoomId,
  joinToken,
  userId,
  nickname,
  language,
  role,
  callUrl,
  onCopyLink,
  copied,
}: VideoCallProps) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'connected' | 'ended'>('connecting');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingWarning, setRecordingWarning] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { localStream, isMuted, isCameraOff, error: mediaError, startMedia, stopMedia, toggleMute, toggleCamera } = useMediaDevices();
  const { connect, disconnect, send, addMessageHandler, wsRef } = useWebSocket();

  const localStreamRef = useRef<MediaStream | null>(null);

  const onRemoteStream = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
  }, []);

  const {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
  } = useWebRTC({
    roomId,
    send,
    onRemoteStream,
  });

  // Set local video element source
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video element source
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle WebSocket messages
  useEffect(() => {
    const removeHandler = addMessageHandler((msg: ServerWsMessage) => {
      switch (msg.type) {
        case 'joined':
          setRoomId(msg.roomId);
          setStatus('waiting');
          // If there's already a peer in the room, we're connecting
          if (msg.participants.length > 1) {
            const peer = msg.participants.find((p) => p.userId !== userId);
            if (peer) {
              setPeerName(peer.name);
              setStatus('connected');
              // If we're the receiver and the creator is already here,
              // we need to create the offer (since the creator's peer:joined already fired)
              if (role === 'receiver') {
                const tryCreateOffer = () => {
                  if (localStreamRef.current) {
                    console.log('[VideoCall] Receiver creating offer (joined late)');
                    createOffer(localStreamRef.current);
                  } else {
                    console.log('[VideoCall] Receiver waiting for local stream...');
                    setTimeout(tryCreateOffer, 500);
                  }
                };
                tryCreateOffer();
              }
            }
          }
          break;

        case 'peer:joined':
          setPeerName(msg.peerName);
          setStatus('connected');
          // Creator creates the offer when peer joins
          if (role === 'creator') {
            const tryCreateOffer = () => {
              if (localStreamRef.current) {
                console.log('[VideoCall] Creating offer with local stream');
                createOffer(localStreamRef.current);
              } else {
                console.log('[VideoCall] Waiting for local stream before creating offer...');
                setTimeout(tryCreateOffer, 500);
              }
            };
            tryCreateOffer();
          }
          break;

        case 'webrtc:offer': {
          const tryHandleOffer = () => {
            if (localStreamRef.current) {
              console.log('[VideoCall] Handling incoming offer');
              handleOffer(msg.offer as RTCSessionDescriptionInit, localStreamRef.current);
            } else {
              console.log('[VideoCall] Waiting for local stream to handle offer...');
              setTimeout(tryHandleOffer, 500);
            }
          };
          tryHandleOffer();
          break;
        }

        case 'webrtc:answer':
          handleAnswer(msg.answer as RTCSessionDescriptionInit);
          break;

        case 'webrtc:iceCandidate':
          handleIceCandidate(msg.candidate as RTCIceCandidateInit);
          break;

        case 'chat:message':
          setMessages((prev) => [...prev, {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            originalText: msg.originalText,
            originalLanguage: msg.originalLanguage,
            translatedText: msg.translatedText,
            translatedLanguage: msg.translatedLanguage,
            timestamp: msg.timestamp,
          }]);
          break;

        case 'peer:left':
          setPeerName(null);
          setRemoteStream(null);
          setStatus('ended');
          break;

        case 'recording:warning':
          setRecordingWarning(tReplace(t(language).recordingWarning, { name: msg.peerName }));
          setTimeout(() => setRecordingWarning(null), 8000);
          break;

        case 'room:closed':
          setStatus('ended');
          break;

        case 'error':
          setErrorMsg(msg.message);
          break;
      }
    });

    return removeHandler;
  }, [addMessageHandler, userId, role, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // Initialize: start media AND connect WS in parallel, then join room
  useEffect(() => {
    let mounted = true;

    // Start media in parallel (don't block WS connection)
    startMedia().then((stream) => {
      if (!mounted) return;
      if (stream) {
        localStreamRef.current = stream;
        console.log('[VideoCall] Local media stream ready');
      } else {
        console.warn('[VideoCall] No local media stream (camera denied or unavailable)');
      }
    });

    // Connect WebSocket immediately (don't wait for media)
    connect();

    // Wait for WS to actually open, then send join
    const joinMsg = {
      type: 'join' as const,
      joinToken,
      userId,
      name: nickname,
      language,
    };

    const trySendJoin = (attempt: number) => {
      if (!mounted) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[VideoCall] WS open, sending join (attempt', attempt, ')');
        send(joinMsg);
      } else if (attempt < 20) {
        // Retry every 500ms for up to 10 seconds
        setTimeout(() => trySendJoin(attempt + 1), 500);
      } else {
        console.error('[VideoCall] Failed to connect WebSocket after 10s');
        if (mounted) setErrorMsg(t(language).failedToConnect);
      }
    };

    trySendJoin(1);

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle end call
  const handleEndCall = useCallback(() => {
    if (roomId) {
      send({ type: 'leave', roomId });
    }
    closePeerConnection();
    stopMedia();
    disconnect();
    setStatus('ended');
  }, [roomId, send, closePeerConnection, stopMedia, disconnect]);

  // Handle end & expire (creator only)
  const handleEndAndExpire = useCallback(() => {
    if (roomId) {
      send({ type: 'endAndExpire', roomId });
    }
    closePeerConnection();
    stopMedia();
    disconnect();
    setStatus('ended');
  }, [roomId, send, closePeerConnection, stopMedia, disconnect]);

  // Screen capture detection — notify peer via server
  const handleRecordingDetected = useCallback(() => {
    if (!roomId) return;
    send({ type: 'recording:detected', roomId });
    // Show self-notification
    setRecordingWarning(t(language).recordingDetectedSelf);
    setTimeout(() => setRecordingWarning(null), 8000);
  }, [roomId, send, language]);

  // Enable detection only when connected
  useScreenCaptureDetection(handleRecordingDetected, status === 'connected');

  // Handle send chat message
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!roomId || !text.trim()) return;
      send({
        type: 'chat:send',
        roomId,
        senderId: userId,
        senderName: nickname,
        originalText: text.trim(),
        originalLanguage: language,
      });
    },
    [roomId, userId, nickname, language, send]
  );

  const i18n = t(language);

  // Ended state
  if (status === 'ended') {
    return (
      <div className="page">
        <div className="card">
          <div className="logo"><Logo /></div>
          <h1>{i18n.callEnded}</h1>
          <p className="subtitle">
            {peerName ? tReplace(i18n.callEndedWith, { name: peerName }) : i18n.theCallHasEnded}
          </p>
          <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '1rem' }}>
            {i18n.startNewCall}
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (errorMsg) {
    return (
      <div className="page">
        <div className="card">
          <div className="logo"><Logo /></div>
          <h1>{i18n.error}</h1>
          <div className="error-message">{errorMsg}</div>
          <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '1rem' }}>
            {i18n.goBack}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="call-container">
      {/* Remote video (large) */}
      <div className="remote-video-container">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
        ) : (
          <div className="remote-video-placeholder">
            {status === 'waiting' && (
              <div className="waiting-overlay">
                <div className="spinner" />
                <h2>{i18n.waitingForOther}</h2>
                {callUrl && (
                  <div className="share-link-box">
                    <p>{i18n.shareThisLink}</p>
                    <div className="link-row">
                      <code className="call-url">{callUrl}</code>
                      {onCopyLink && (
                        <button className="btn btn-small" onClick={onCopyLink}>
                          {copied ? i18n.copied : i18n.copy}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {status === 'connecting' && (
              <div className="waiting-overlay">
                <div className="spinner" />
                <h2>{i18n.connecting}</h2>
              </div>
            )}
            {status === 'connected' && peerName && (
              <div className="waiting-overlay">
                <h2>{i18n.connectedWith} {peerName}</h2>
                <p>{i18n.settingUpVideo}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local video (small, corner, draggable) */}
      <DraggablePip localVideoRef={localVideoRef} />

      {/* Connection status banner */}
      {status === 'connected' && peerName && (
        <div className="connection-banner">
          {i18n.connectedWith} <strong>{peerName}</strong>
        </div>
      )}

      {/* Recording warning */}
      {recordingWarning && (
        <div className="recording-warning">
          {recordingWarning}
        </div>
      )}

      {/* Media error */}
      {mediaError && (
        <div className="media-error">
          ⚠️ {mediaError}
        </div>
      )}

      {/* Chat overlay */}
      <ChatOverlay
        messages={messages}
        myLanguage={language}
        userId={userId}
        onSendMessage={handleSendMessage}
        i18n={i18n}
      />

      {/* Controls */}
      <VideoControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isCreator={role === 'creator'}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onEndCall={handleEndCall}
        onEndAndExpire={handleEndAndExpire}
        i18n={i18n}
      />
    </div>
  );
}
