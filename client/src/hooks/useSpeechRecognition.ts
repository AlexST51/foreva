import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Map our short language codes to BCP-47 locale codes for speech recognition.
 */
const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
  tr: 'tr-TR',
  uk: 'uk-UA',
  pl: 'pl-PL',
};

// Extend Window for vendor-prefixed SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as SpeechRecognitionConstructor | null;
}

export function useSpeechRecognition(language: string) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(() => !!getSpeechRecognition());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const shouldBeListeningRef = useRef(false); // Track user intent vs browser auto-stop

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback((onFinal: (text: string) => void) => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = LANG_TO_BCP47[language] || language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    onFinalRef.current = onFinal;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setInterimText('');
        onFinalRef.current?.(final.trim());
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event) => {
      console.warn('[SpeechRecognition] Error:', event.error);
      // Don't stop on 'no-speech' or 'aborted' — just keep listening
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // Fatal errors: 'not-allowed', 'service-not-allowed', 'network', etc.
        shouldBeListeningRef.current = false;
        setIsListening(false);
        setInterimText('');
      }
    };

    recognition.onend = () => {
      // Browser may auto-stop speech recognition (e.g., after silence, or on mobile
      // when switching apps). If the user didn't explicitly stop, auto-restart.
      if (shouldBeListeningRef.current) {
        console.log('[SpeechRecognition] Auto-restarting after browser ended session');
        try {
          recognition.start();
          return; // Don't update state — we're restarting
        } catch (err) {
          console.warn('[SpeechRecognition] Auto-restart failed:', err);
        }
      }
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
      shouldBeListeningRef.current = false;
    };

    shouldBeListeningRef.current = true;
    try {
      recognition.start();
    } catch (err) {
      console.warn('[SpeechRecognition] Failed to start:', err);
      setIsListening(false);
      shouldBeListeningRef.current = false;
    }
  }, [language]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false; // User explicitly stopped
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  const toggleListening = useCallback((onFinal: (text: string) => void) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(onFinal);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    interimText,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
