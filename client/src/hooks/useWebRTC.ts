import { useRef, useCallback, useState } from 'react';
import { ClientWsMessage } from '../types';

// STUN + TURN servers for NAT traversal.
// STUN handles ~85% of connections. TURN relays traffic for restrictive NATs.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers from Open Relay Project
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
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

  /**
   * Create and configure a new RTCPeerConnection.
   */
  const createPeerConnection = useCallback(
    (localStream: MediaStream) => {
      // Close existing connection if any
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add local tracks to the connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          onRemoteStream(event.streams[0]);
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

      // Track connection state
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        console.log('[WebRTC] Connection state:', pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      };

      return pc;
    },
    [roomId, send, onRemoteStream]
  );

  /**
   * Create an offer (caller/creator side).
   */
  const createOffer = useCallback(
    async (localStream: MediaStream) => {
      const pc = createPeerConnection(localStream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      send({
        type: 'webrtc:offer',
        roomId,
        offer: pc.localDescription!,
      });

      console.log('[WebRTC] Offer created and sent');
    },
    [createPeerConnection, roomId, send]
  );

  /**
   * Handle an incoming offer (callee/receiver side).
   */
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, localStream: MediaStream) => {
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
    },
    [createPeerConnection, roomId, send]
  );

  /**
   * Handle an incoming answer (caller side).
   */
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Remote description set (answer)');
    }
  }, []);

  /**
   * Handle an incoming ICE candidate.
   */
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    }
  }, []);

  /**
   * Close the peer connection.
   */
  const closePeerConnection = useCallback(() => {
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
