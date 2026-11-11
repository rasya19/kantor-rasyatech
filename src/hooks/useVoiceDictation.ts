import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  readonly error: string;
}

interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function recognitionErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    'audio-capture': 'Mikrofon tidak tersedia. Periksa perangkat dan izin mikrofon.',
    'not-allowed': 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.',
    'service-not-allowed': 'Layanan pengenal suara tidak diizinkan oleh browser.',
    network: 'Layanan pengenal suara gagal dihubungi. Periksa koneksi internet.',
    'no-speech': 'Suara belum terdeteksi. Coba bicara lebih dekat ke mikrofon.',
  };
  return messages[error] ?? `Pengenalan suara gagal (${error}). Silakan coba lagi.`;
}

export function useVoiceDictation(
  onTranscript: (transcript: string) => void,
  options: { onEnd?: () => void; onError?: (error: string) => void } = {},
) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onEndRef = useRef(options.onEnd);
  const onErrorRef = useRef(options.onError);
  onTranscriptRef.current = onTranscript;
  onEndRef.current = options.onEnd;
  onErrorRef.current = options.onError;

  useEffect(() => {
    setIsSupported(Boolean(recognitionConstructor()));
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError('Browser ini belum mendukung pengenalan suara. Coba browser lain.');
      return;
    }

    setError('');
    setInterimTranscript('');
    const recognition = new Constructor();
    recognition.lang = 'id-ID';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) onTranscriptRef.current(finalText.trim());
      setInterimTranscript(interimText.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setError(recognitionErrorMessage(event.error));
        onErrorRef.current?.(event.error);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript('');
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      setError(error instanceof Error ? `Mikrofon tidak dapat dimulai: ${error.message}` : 'Mikrofon tidak dapat dimulai.');
      onErrorRef.current?.('start-failed');
    }
  }, []);

  return { isSupported, isListening, interimTranscript, error, start, stop };
}
