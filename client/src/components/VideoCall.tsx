import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { ChatMessage, ServerWsMessage, ParticipantRole } from '../types';
import ChatOverlay from './ChatOverlay';
import VideoControls from './VideoControls';

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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { localStream, isMuted, isCameraOff, error: mediaError, startMedia, stopMedia, toggleMute, toggleCamera } = useMediaDevices();
  const { connect, disconnect, send, addMessageHandler } = useWebSocket();

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
            }
          }
          break;

        case 'peer:joined':
          setPeerName(msg.peerName);
          setStatus('connected');
          // Creator creates the offer when peer joins
          if (role === 'creator' && localStreamRef.current) {
            createOffer(localStreamRef.current);
          }
          break;

        case 'webrtc:offer':
          if (localStreamRef.current) {
            handleOffer(msg.offer as RTCSessionDescriptionInit, localStreamRef.current);
          }
          break;

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

  // Initialize: start media, connect WS, join room
  useEffect(() => {
    let mounted = true;

    async function init() {
      const stream = await startMedia();
      if (!mounted) return;

      // Even if media fails, still connect to the room
      // (user can still chat and see the peer's video)
      if (stream) {
        localStreamRef.current = stream;
      }

      // Connect WebSocket
      connect();

      // Wait a bit for WS to connect, then join
      setTimeout(() => {
        if (!mounted) return;
        send({
          type: 'join',
          joinToken,
          userId,
          name: nickname,
          language,
        });
      }, 500);
    }

    init();

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

  // Ended state
  if (status === 'ended') {
    return (
      <div className="page">
        <div className="card">
          <div className="logo">📞</div>
          <h1>Call ended</h1>
          <p className="subtitle">
            {peerName ? `Your call with ${peerName} has ended.` : 'The call has ended.'}
          </p>
          <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '1rem' }}>
            Start a new call
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
          <div className="logo">📞</div>
          <h1>Error</h1>
          <div className="error-message">{errorMsg}</div>
          <a href="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '1rem' }}>
            Go back
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
                <h2>Waiting for the other person…</h2>
                {callUrl && (
                  <div className="share-link-box">
                    <p>Share this link:</p>
                    <div className="link-row">
                      <code className="call-url">{callUrl}</code>
                      {onCopyLink && (
                        <button className="btn btn-small" onClick={onCopyLink}>
                          {copied ? '✓ Copied!' : '📋 Copy'}
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
                <h2>Connecting…</h2>
              </div>
            )}
            {status === 'connected' && peerName && (
              <div className="waiting-overlay">
                <h2>Connected with {peerName}</h2>
                <p>Setting up video…</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local video (small, corner) */}
      <div className="local-video-container">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="local-video"
        />
        {localStream && (
          <div className="media-indicator">
            {!isMuted && <span className="indicator-dot active" title="Microphone active">🎤</span>}
            {isMuted && <span className="indicator-dot muted" title="Microphone muted">🔇</span>}
            {!isCameraOff && <span className="indicator-dot active" title="Camera active">📹</span>}
            {isCameraOff && <span className="indicator-dot muted" title="Camera off">📷</span>}
          </div>
        )}
      </div>

      {/* Connection status banner */}
      {status === 'connected' && peerName && (
        <div className="connection-banner">
          Connected with <strong>{peerName}</strong>
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
      />
    </div>
  );
}
