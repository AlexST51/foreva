import { useState, useRef, useCallback } from 'react';

/**
 * Hook to manage camera and microphone access.
 * Only requests permissions when explicitly called (not on page load).
 */
export function useMediaDevices() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Request camera and microphone access.
   * Called only when user initiates a call (not on page load).
   */
  const startMedia = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera/microphone';
      setError(message);
      console.error('[Media] Error accessing devices:', err);
      return null;
    }
  }, []);

  /**
   * Stop all media tracks and release devices.
   */
  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
    }
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  /**
   * Toggle microphone mute.
   */
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  /**
   * Toggle camera on/off.
   */
  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  return {
    localStream,
    isMuted,
    isCameraOff,
    error,
    startMedia,
    stopMedia,
    toggleMute,
    toggleCamera,
  };
}
