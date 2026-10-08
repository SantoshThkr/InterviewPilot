'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

function getRecognitionCtor() {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/** Hydration-safe feature detection (false on the server, real value on the client). */
function useBrowserSupport(check: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, check, () => false);
}

const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to answer by voice.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser settings to answer by voice.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice recognition needs a network connection.',
};

/**
 * Browser speech-to-text. Dictation is appended to whatever was already
 * typed, and the recognizer is always released on stop or unmount so the
 * microphone never stays on after leaving the page.
 */
export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const supported = useBrowserSupport(() => getRecognitionCtor() !== undefined);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((existingText: string) => {
    const Recognition = getRecognitionCtor();
    if (!Recognition) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    recognitionRef.current?.abort();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const prefix = existingText.trim() ? `${existingText.trimEnd()} ` : '';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      onTranscriptRef.current(prefix + transcript);
    };
    recognition.onerror = (event) => {
      // "aborted" and "no-speech" are routine, not worth surfacing.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(RECOGNITION_ERRORS[event.error] ?? 'Voice input stopped unexpectedly.');
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError('Could not start the microphone.');
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}

/** Text-to-speech for interviewer messages, cancelled when disabled or unmounted. */
export function useSpeechSynthesis(enabled: boolean) {
  const supported = useBrowserSupport(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, supported],
  );

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  useEffect(() => cancel, [cancel]);

  return { supported, speak, cancel };
}
