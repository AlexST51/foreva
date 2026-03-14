import { useRef, useCallback, useState } from 'react';
import { ClientWsMessage } from '../types';

// STUN + TURN servers for NAT traversal.
// TURN relays traffic for restrictive/symmetric NATs (e.g., mobile 5G ↔ home WiFi).
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Metered STUN
    { urls: 'stun:stun.relay.metered.ca:80' },
    // Metered TURN servers (static credential)
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: '191a9d987f189a53cf4f1ed9',
      credential: 'gltGSb5xFw4BBP/f',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: '191a9d987f189a53cf4f1ed9',
      credential: 'gltGSb5xFw4BBP/f',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: '191a9d987f189a53cf4f1ed9',
      credential: 'gltGSb5xFw4BBP/f',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: '191a9d987f189a53cf4f1ed9',
      credential: 'gltGSb5xFw4BBP/f',
    },
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCOptions {
  roomId: string;
  send: (msg: ClientWsMessage) => void;
  onRemoteStream: (stream: MediaStream) => void;
}

export function useWebRTC({ roomId, send, onRemoteStream }: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const iceRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isNegotiating = useRef(false);

  /**
   * Attempt an ICE restart to recover a failed/disconnected connection.
   */
  const attemptIceRestart = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || pc.connectionState === 'closed') return;

    console.log('[WebRTC] Attempting ICE restart...');
    try {
      pc.createOffer({ iceRestart: true }).then((offer) => {
        if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
          pc.setLocalDescription(offer).then(() => {
            send({
              type: 'webrtc:offer',
              roomId,
              offer: pc.localDescription!,
            });
            console.log('[WebRTC] ICE restart offer sent');
          });
        }
      }).catch((err) => {
        console.warn('[WebRTC] ICE restart failed:', err);
      });
    } catch (err) {
      console.warn('[WebRTC] ICE restart error:', err);
    }
  }, [roomId, send]);

  /**
   * Create and configure a new RTCPeerConnection.
   */
  const createPeerConnection = useCallback(
    (localStream: MediaStream) => {
      // Close existing connection if any
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (iceRestartTimerRef.current) {
        clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = null;
      }

      localStreamRef.current = localStream;
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      // Add local tracks to the connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          const stream = event.streams[0];
          onRemoteStream(stream);

          // Monitor each track for ended/mute state
          event.track.onended = () => {
            console.warn('[WebRTC] Remote track ended:', event.track.kind);
          };

          event.track.onmute = () => {
            console.warn('[WebRTC] Remote track muted:', event.track.kind);
          };

          event.track.onunmute = () => {
            console.log('[WebRTC] Remote track unmuted:', event.track.kind);
            // Re-emit the stream to force React to re-render the video element
            onRemoteStream(stream);
          };
        }
      };

      // Send ICE candidates to the peer via signalling server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: 'webrtc:iceCandidate',
            roomId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Track connection state — auto-recover on failure
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setConnectionState(state);
        console.log('[WebRTC] Connection state:', state);

        if (state === 'disconnected') {
          // Wait 3 seconds then try ICE restart (connection may self-recover)
          if (!iceRestartTimerRef.current) {
            iceRestartTimerRef.current = setTimeout(() => {
              iceRestartTimerRef.current = null;
              if (pcRef.current?.connectionState === 'disconnected' ||
                  pcRef.current?.connectionState === 'failed') {
                attemptIceRestart();
              }
            }, 3000);
          }
        } else if (state === 'failed') {
          // Immediate ICE restart on failure
          attemptIceRestart();
        } else if (state === 'connected') {
          // Clear any pending restart timer
          if (iceRestartTimerRef.current) {
            clearTimeout(iceRestartTimerRef.current);
            iceRestartTimerRef.current = null;
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log('[WebRTC] ICE connection state:', iceState);

        if (iceState === 'failed') {
          // Try ICE restart
          attemptIceRestart();
        }
      };

      // Handle negotiation needed (e.g., after track changes)
      // Guard against renegotiation loops — replaceTrack() should NOT trigger this,
      // but some browsers fire it anyway.
      pc.onnegotiationneeded = async () => {
        if (isNegotiating.current) {
          console.log('[WebRTC] Negotiation already in progress, skipping');
          return;
        }
        console.log('[WebRTC] Negotiation needed');
        isNegotiating.current = true;
        try {
          if (pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            send({
              type: 'webrtc:offer',
              roomId,
              offer: pc.localDescription!,
            });
          }
        } catch (err) {
          console.warn('[WebRTC] Renegotiation failed:', err);
        } finally {
          isNegotiating.current = false;
        }
      };

      return pc;
    },
    [roomId, send, onRemoteStream, attemptIceRestart]
  );

  /**
   * Create an offer (caller/creator side).
   */
  const createOffer = useCallback(
    async (localStream: MediaStream) => {
      try {
        const pc = createPeerConnection(localStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        send({
          type: 'webrtc:offer',
          roomId,
          offer: pc.localDescription!,
        });

        console.log('[WebRTC] Offer created and sent');
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
      }
    },
    [createPeerConnection, roomId, send]
  );

  /**
   * Handle an incoming offer (callee/receiver side).
   */
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, localStream: MediaStream) => {
      try {
        // If we already have a connection and it's an ICE restart, handle it
        const existingPc = pcRef.current;
        if (existingPc && existingPc.connectionState !== 'closed') {
          // This might be an ICE restart offer — handle on existing connection
          if (existingPc.signalingState === 'stable' || existingPc.signalingState === 'have-remote-offer') {
            await existingPc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await existingPc.createAnswer();
            await existingPc.setLocalDescription(answer);
            send({
              type: 'webrtc:answer',
              roomId,
              answer: existingPc.localDescription!,
            });
            console.log('[WebRTC] ICE restart answer sent on existing connection');
            return;
          }
        }

        // New connection
        const pc = createPeerConnection(localStream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        send({
          type: 'webrtc:answer',
          roomId,
          answer: pc.localDescription!,
        });

        console.log('[WebRTC] Answer created and sent');
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    },
    [createPeerConnection, roomId, send]
  );

  /**
   * Handle an incoming answer (caller side).
   */
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (pcRef.current) {
      try {
        // Only set remote description if we're in the right state
        if (pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('[WebRTC] Remote description set (answer)');
        } else {
          console.warn('[WebRTC] Ignoring answer in state:', pcRef.current.signalingState);
        }
      } catch (err) {
        console.error('[WebRTC] Error setting remote description:', err);
      }
    }
  }, []);

  /**
   * Handle an incoming ICE candidate.
   */
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current && pcRef.current.remoteDescription) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Silently ignore ICE candidate errors (common during renegotiation)
        console.debug('[WebRTC] ICE candidate error (non-fatal):', err);
      }
    } else {
      // Queue candidate — will be added when remote description is set
      console.debug('[WebRTC] ICE candidate received before remote description, ignoring');
    }
  }, []);

  /**
   * Close the peer connection.
   */
  const closePeerConnection = useCallback(() => {
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
      setConnectionState('closed');
    }
  }, []);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeerConnection,
    connectionState,
    pcRef,
  };
}
