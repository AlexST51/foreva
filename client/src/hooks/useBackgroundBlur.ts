import { useRef, useCallback, useState } from 'react';
import { SelfieSegmentation, Results } from '@mediapipe/selfie_segmentation';

/**
 * Hook to apply real-time background blur to a camera video stream.
 * Uses MediaPipe Selfie Segmentation to separate person from background.
 * Returns a processed MediaStream from a canvas that can replace the raw camera stream.
 */
export function useBackgroundBlur() {
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const segmentationRef = useRef<SelfieSegmentation | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const blurStreamRef = useRef<MediaStream | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);
  const isBlurEnabledRef = useRef(false);

  /**
   * Initialize the segmentation model (lazy-loaded on first use).
   */
  const initSegmentation = useCallback(async () => {
    if (segmentationRef.current) return segmentationRef.current;

    setIsLoading(true);
    try {
      const segmentation = new SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      segmentation.setOptions({
        modelSelection: 1, // 1 = landscape model (better quality), 0 = general
        selfieMode: false, // CSS scaleX(-1) already mirrors the local video preview
      });

      // Set up the results callback
      segmentation.onResults((results: Results) => {
        drawBlurredFrame(results);
      });

      // Initialize the model
      await segmentation.initialize();

      segmentationRef.current = segmentation;
      setIsLoading(false);
      return segmentation;
    } catch (err) {
      console.error('[BackgroundBlur] Failed to initialize:', err);
      setIsLoading(false);
      return null;
    }
  }, []);

  /**
   * Draw a frame with blurred background and sharp foreground.
   * Uses canvas compositing: sharp person (masked) over blurred full frame.
   */
  const drawBlurredFrame = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const { width, height } = canvas;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw the original sharp image (person will be kept from this)
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(results.image, 0, 0, width, height);

    // 2. Mask: keep only the person (segmentation mask is white where person is)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(results.segmentationMask, 0, 0, width, height);

    // 3. Draw blurred full image behind the sharp person
    ctx.globalCompositeOperation = 'destination-over';
    ctx.filter = 'blur(10px)';
    ctx.drawImage(results.image, 0, 0, width, height);
    ctx.filter = 'none';

    // Reset
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    isProcessingRef.current = false;
  }, []);

  /**
   * Process frames in a loop.
   * Uses isBlurEnabledRef to avoid stale closure issues.
   */
  const processFrame = useCallback(async () => {
    if (!isBlurEnabledRef.current) return; // Stop loop if blur was disabled

    const video = videoElRef.current;
    const segmentation = segmentationRef.current;

    if (!video || !segmentation || video.paused || video.ended) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (!isProcessingRef.current) {
      isProcessingRef.current = true;
      try {
        await segmentation.send({ image: video });
      } catch {
        isProcessingRef.current = false;
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  /**
   * Enable background blur on a given raw camera stream.
   * Returns a new MediaStream with blurred background.
   */
  const enableBlur = useCallback(async (rawStream: MediaStream): Promise<MediaStream | null> => {
    rawStreamRef.current = rawStream;

    const segmentation = await initSegmentation();
    if (!segmentation) return null;

    // Create hidden video element to feed frames
    const video = document.createElement('video');
    video.srcObject = rawStream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    videoElRef.current = video;

    // Create canvas matching video dimensions
    const canvas = document.createElement('canvas');
    const videoTrack = rawStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    canvas.width = settings.width || 640;
    canvas.height = settings.height || 480;
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext('2d')!;

    // Capture stream from canvas at 30fps
    const canvasStream = canvas.captureStream(30);

    // Add audio tracks from the raw stream
    rawStream.getAudioTracks().forEach((track) => {
      canvasStream.addTrack(track);
    });

    blurStreamRef.current = canvasStream;
    isBlurEnabledRef.current = true;
    setIsBlurEnabled(true);

    // Start processing loop
    animFrameRef.current = requestAnimationFrame(processFrame);

    return canvasStream;
  }, [initSegmentation, processFrame]);

  /**
   * Disable background blur and return the raw stream.
   */
  const disableBlur = useCallback((): MediaStream | null => {
    // Stop processing loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    // Clean up video element
    if (videoElRef.current) {
      videoElRef.current.pause();
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }

    isBlurEnabledRef.current = false;
    setIsBlurEnabled(false);
    blurStreamRef.current = null;

    return rawStreamRef.current;
  }, []);

  /**
   * Clean up all resources.
   */
  const cleanup = useCallback(() => {
    disableBlur();
    if (segmentationRef.current) {
      segmentationRef.current.close();
      segmentationRef.current = null;
    }
  }, [disableBlur]);

  return {
    isBlurEnabled,
    isLoading,
    enableBlur,
    disableBlur,
    cleanup,
  };
}
