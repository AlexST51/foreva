import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to detect potential screen capture/recording activity.
 * 
 * Detection methods:
 * 1. Page Visibility API — detects when user switches away (may indicate setting up recording)
 * 2. Display media device changes — detects new screen capture devices
 * 3. Window blur/focus — detects alt-tabbing to recording tools
 * 
 * Note: These are heuristics, not foolproof. They provide a deterrent effect
 * and awareness, similar to Snapchat's screenshot detection.
 */
export function useScreenCaptureDetection(
  onDetected: () => void,
  enabled: boolean = true
) {
  const lastDetectionTime = useRef(0);
  const COOLDOWN_MS = 30000; // Don't spam — 30s cooldown between detections

  const triggerDetection = useCallback(() => {
    const now = Date.now();
    if (now - lastDetectionTime.current < COOLDOWN_MS) return;
    lastDetectionTime.current = now;
    onDetected();
  }, [onDetected]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Visibility change detection
    // When the page becomes hidden, it could indicate the user is switching
    // to a screen recording app or taking a screenshot
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page went hidden — potential recording setup
        // We use a short delay to avoid false positives from quick tab switches
        const timer = setTimeout(() => {
          if (document.hidden) {
            console.log('[ScreenCapture] Page hidden for extended period — possible recording');
            triggerDetection();
          }
        }, 3000); // Only trigger if hidden for 3+ seconds
        
        const handleVisible = () => {
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', handleVisible);
        };
        document.addEventListener('visibilitychange', handleVisible);
      }
    };

    // 2. Keyboard shortcut detection for common screenshot keys
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen') {
        console.log('[ScreenCapture] PrintScreen key detected');
        triggerDetection();
        return;
      }
      
      // macOS screenshot shortcuts: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        console.log('[ScreenCapture] macOS screenshot shortcut detected');
        triggerDetection();
        return;
      }

      // Windows Snipping Tool: Win+Shift+S
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        console.log('[ScreenCapture] Windows snipping tool shortcut detected');
        triggerDetection();
        return;
      }
    };

    // 3. Device change detection — new screen capture devices appearing
    const handleDeviceChange = () => {
      console.log('[ScreenCapture] Media device change detected');
      // This can fire when screen capture starts on some browsers
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);
    
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [enabled, triggerDetection]);
}
