import { useRef, useState, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface CaptionLine {
  id: number;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface UseSpeechCaptionsOptions {
  lang?: string;
  onLog?: (source: 'pc', message: string) => void;
  autoStart?: boolean;
}

const SpeechRecognitionClass =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

export function useSpeechCaptions({
  lang = 'zh-CN',
  onLog,
  autoStart = true,
}: UseSpeechCaptionsOptions = {}) {
  const [enabled, setEnabled] = useState(autoStart);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const isSupported = !!SpeechRecognitionClass;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const enabledRef = useRef(autoStart);
  const idCounter = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear old finalized captions after 6s
  useEffect(() => {
    if (captions.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setCaptions(prev => prev.filter(c => !c.isFinal || now - c.timestamp < 6000));
    }, 1000);
    return () => clearInterval(timer);
  }, [captions.length]);

  // Create a fresh recognition instance and start it
  const createAndStart = useCallback(() => {
    if (!SpeechRecognitionClass || !enabledRef.current) return;

    // Dispose previous instance
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try { recognitionRef.current.abort(); } catch { /* ok */ }
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const newCaptions: CaptionLine[] = [];

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        newCaptions.push({
          id: idCounter.current++,
          text,
          isFinal: result.isFinal,
          timestamp: Date.now(),
        });
      }

      if (newCaptions.length > 0) {
        setCaptions(prev => {
          // Keep last 2 finalized lines + all new results
          const finalized = prev.filter(c => c.isFinal).slice(-2);
          return [...finalized, ...newCaptions];
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onLog?.('pc', `speech recognition error: ${event.error}`);
      }
      // On network error or service-not-allowed, don't auto-restart immediately
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        // Delay restart by 2s
        if (enabledRef.current) {
          restartTimerRef.current = setTimeout(() => createAndStart(), 2000);
        }
      }
    };

    recognition.onend = () => {
      // Chrome fires onend after silence, errors, or internal limits.
      // Create a brand new instance to restart (reusing the old one fails).
      if (enabledRef.current) {
        // Restart quickly to minimize latency gap
        restartTimerRef.current = setTimeout(() => createAndStart(), 50);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // If start fails, retry after delay
      if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => createAndStart(), 1000);
      }
    }
  }, [lang, onLog]);

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try { recognitionRef.current.abort(); } catch { /* ok */ }
      recognitionRef.current = null;
    }
    setCaptions([]);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    if (next) {
      createAndStart();
      onLog?.('pc', 'speech captions started');
    } else {
      stopRecognition();
      onLog?.('pc', 'speech captions stopped');
    }
  }, [createAndStart, stopRecognition, onLog]);

  // Auto-start on mount if autoStart is true
  useEffect(() => {
    if (autoStart && isSupported) {
      enabledRef.current = true;
      createAndStart();
      onLog?.('pc', 'speech captions auto-started');
    }
    return () => {
      enabledRef.current = false;
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    enabled,
    captions,
    isSupported,
    toggle,
  };
}
