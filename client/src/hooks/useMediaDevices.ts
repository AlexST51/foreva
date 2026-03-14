import { useState, useRef, useCallback } from 'react';

/**
 * Hook to manage camera and microphone access.
 * Only requests permissions when explicitly called (not on page load).
 */
export function useMediaDevices() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Request camera and microphone access.
   * Called only when user initiates a call (not on page load).
   */
  const startMedia = useCallback(async () => {
    try {
      setError(null);

      // Try video + audio first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        streamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (videoErr) {
        console.warn('[Media] Video+audio failed, trying audio only:', videoErr);

        // Fall back to audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          streamRef.current = audioStream;
          setLocalStream(audioStream);
          setError('Camera not available — audio only');
          return audioStream;
        } catch (audioErr) {
          console.warn('[Media] Audio only also failed:', audioErr);
          throw videoErr; // Throw the original error
        }
      }
    } catch (err) {
      let message = 'Failed to access camera/microphone';
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            message = 'No camera or microphone found on this device';
            break;
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            message = 'Camera/microphone permission denied. Please allow access in your browser settings.';
            break;
          case 'NotReadableError':
          case 'TrackStartError':
            message = 'Camera or microphone is in use by another app';
            break;
          case 'OverconstrainedError':
            message = 'Camera does not meet the required constraints';
            break;
          default:
            message = err.message || message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
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

  /**
   * Flip between front and rear camera.
   * Returns the new stream so the caller can update WebRTC tracks.
   */
  const flipCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const newFacing = isFrontCamera ? 'environment' : 'user';

      // Get new video stream with the other camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      // Stop old tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = newStream;
      setLocalStream(newStream);
      setIsFrontCamera(!isFrontCamera);
      setIsCameraOff(false);
      return newStream;
    } catch (err) {
      console.warn('[Media] Failed to flip camera:', err);
      setError('Could not switch camera');
      return null;
    }
  }, [isFrontCamera]);

  return {
    localStream,
    isMuted,
    isCameraOff,
    isFrontCamera,
    error,
    startMedia,
    stopMedia,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
