import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { workflowClient } from '../api/workflowClient';
import { useVoiceDictation } from '../hooks/useVoiceDictation';

type Message = { role: 'user' | 'assistant'; content: string };

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-base text-white';
const buttonClass = 'min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 disabled:opacity-50';
const femaleVoiceLabel = /(female|woman|women|girl|gadis|perempuan|wanita|feminine|femme|feminina|weiblich)/i;

export function OfficeAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handsFree, setHandsFree] = useState(false);
  const [speechOutput, setSpeechOutput] = useState(typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [femaleVoicesOnly, setFemaleVoicesOnly] = useState(false);
  const voiceSelectedByUserRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const handsFreeRef = useRef(false);
  const busyRef = useRef(false);
  const phaseRef = useRef<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'>('idle');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRecognizedRef = useRef<(transcript: string) => void>(() => {});

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(voices);
      if (voiceSelectedByUserRef.current) return;
      const femaleVoice = voices.find((voice) =>
        /^id(-|$)/i.test(voice.lang) &&
        femaleVoiceLabel.test(voice.name),
      );
      const indonesianVoice = voices.find((voice) => /^id(-|$)/i.test(voice.lang));
      setSelectedVoiceURI((femaleVoice ?? indonesianVoice ?? voices.find((voice) => voice.default) ?? voices[0])?.voiceURI ?? '');
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);
  const dictation = useVoiceDictation((transcript) => {
    if (handsFreeRef.current) sendRecognizedRef.current(transcript);
    else setInput((current) => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript);
  }, {
    onError: (recognitionError) => {
      if (recognitionError !== 'no-speech') {
        handsFreeRef.current = false;
        setHandsFree(false);
        phaseRef.current = 'error';
      }
    },
    onEnd: () => {
      if (!handsFreeRef.current || phaseRef.current !== 'listening') return;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (handsFreeRef.current && phaseRef.current === 'listening') dictation.start();
      }, 350);
    },
  });

  const filteredSpeechVoices = speechVoices.filter((voice) => {
    const matchesSearch = `${voice.name} ${voice.lang}`.toLocaleLowerCase().includes(voiceSearch.trim().toLocaleLowerCase());
    return matchesSearch && (!femaleVoicesOnly || femaleVoiceLabel.test(voice.name));
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, dictation.interimTranscript]);

  useEffect(() => () => {
    handsFreeRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    dictation.stop();
    window.speechSynthesis?.cancel();
  }, [dictation.stop]);

  function startListening(): void {
    setError('');
    phaseRef.current = 'listening';
    dictation.start();
  }

  function stopHandsFree(): void {
    handsFreeRef.current = false;
    phaseRef.current = 'idle';
    setHandsFree(false);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    dictation.stop();
    window.speechSynthesis?.cancel();
  }

  function speak(content: string, continueConversation: boolean): void {
    if (!('speechSynthesis' in window)) {
      setSpeechOutput(false);
      if (continueConversation && handsFreeRef.current) {
        phaseRef.current = 'listening';
        startListening();
      } else {
        setError('Browser ini belum mendukung suara balasan. Jawaban tetap tersedia sebagai teks.');
      }
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'id-ID';
    utterance.voice = speechVoices.find((voice) => voice.voiceURI === selectedVoiceURI) ?? null;
    utterance.onerror = () => {
      setError('Suara balasan gagal diputar. Jawaban tetap tersedia sebagai teks.');
      if (continueConversation && handsFreeRef.current) {
        phaseRef.current = 'listening';
        startListening();
      }
    };
    utterance.onend = () => {
      if (continueConversation && handsFreeRef.current) {
        phaseRef.current = 'listening';
        startListening();
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(content: string, continueConversation = false): Promise<void> {
    const question = content.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    setError('');
    phaseRef.current = 'thinking';
    if (dictation.isListening) dictation.stop();
    const nextMessages = [...messages, { role: 'user' as const, content: question }].slice(-12);
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const response = await workflowClient.officeAssistant(nextMessages);
      const next = [...nextMessages, { role: 'assistant' as const, content: response.reply }].slice(-12);
      setMessages(next);
      if (continueConversation && handsFreeRef.current) phaseRef.current = 'speaking';
      speak(response.reply, continueConversation);
    } catch (sendError) {
      setMessages(messages);
      setInput(question);
      setError(sendError instanceof Error ? sendError.message : 'Pesan belum dapat diproses.');
      if (continueConversation && handsFreeRef.current) {
        phaseRef.current = 'listening';
        startListening();
      } else {
        phaseRef.current = 'idle';
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  sendRecognizedRef.current = (transcript) => { void sendMessage(transcript, true); };

  return <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
    <div>
      <h2 className="text-xl font-bold">Manajer kantor — percakapan suara</h2>
      <p className="mt-1 text-sm text-slate-300">Pilih mode tekan-untuk-bicara atau percakapan hands-free. Mode otomatis mendengarkan setelah kamu mulai, mengirim ucapan setelah jeda, membacakan jawaban, lalu mendengarkan lagi.</p>
      <p className="mt-2 text-xs text-amber-300">Asisten memakai ringkasan baca-saja dari pekerjaan, tiket, draf, pengetahuan produk, prospek, transaksi, pemakaian AI, dan sisa limit key OpenRouter. Limit key bukan saldo akun atau kredit/top-up. Ringkasan dan percakapan dikirim ke OpenRouter dan dapat menimbulkan biaya. Pengenalan suara memakai layanan browser; percakapan tidak disimpan sebagai riwayat. Jangan kirim password, data pribadi, data anak/kesehatan, atau rahasia.</p>
    </div>
    {speechOutput && speechVoices.length > 0 && <div className="space-y-2">
      <label className="block text-sm">Cari suara
        <input className={`${inputClass} mt-1`} type="search" value={voiceSearch} onChange={(event) => setVoiceSearch(event.target.value)} placeholder="Cari nama atau bahasa, mis. Indonesian" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={femaleVoicesOnly} onChange={(event) => setFemaleVoicesOnly(event.target.checked)} />
        Cari suara yang berlabel perempuan
      </label>
      <label className="block text-sm">Suara balasan
        <select className={`${inputClass} mt-1`} value={selectedVoiceURI} onChange={(event) => {
          voiceSelectedByUserRef.current = true;
          setSelectedVoiceURI(event.target.value);
        }}>
          {filteredSpeechVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
          {filteredSpeechVoices.length === 0 && <option value="" disabled>Tidak ada suara yang cocok di perangkat ini</option>}
        </select>
      </label>
      <span className="block text-xs text-slate-400">Filter perempuan mencari label seperti “Female” atau “Woman”. Browser tidak memberi data gender; jika tak ada hasil, perangkat belum menyediakan suara dengan label itu. Matikan filter untuk melihat semua suara yang tersedia.</span>
    </div>}
    <div ref={listRef} aria-live="polite" className="max-h-96 min-h-36 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3">
      {messages.length === 0 && <p className="text-sm text-slate-400">Mulai dengan bertanya tentang pekerjaan kantor atau minta bantuan menyusun langkah berikutnya.</p>}
      {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`rounded-lg p-3 text-sm ${message.role === 'assistant' ? 'bg-slate-800 text-slate-100' : 'ml-6 bg-teal-950 text-teal-100'}`}>
        <p className="mb-1 text-xs font-semibold text-slate-400">{message.role === 'assistant' ? 'Asisten' : 'Kamu'}</p>
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.role === 'assistant' && speechOutput && <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-teal-300 underline" onClick={() => speak(message.content, false)}>
          <Volume2 size={14} /> Bacakan lagi
        </button>}
      </article>)}
      {busy && <p role="status" className="text-sm text-teal-300">Asisten sedang menjawab…</p>}
    </div>
    {dictation.interimTranscript && <p className="text-sm text-slate-300">Mendengar: {dictation.interimTranscript}</p>}
    {(dictation.error || error) && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{dictation.error || error}</p>}
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      void sendMessage(input);
    }}>
      <label className="block text-sm">Pesan untuk asisten
        <textarea className={`${inputClass} mt-1`} rows={3} maxLength={2000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ketik pesan atau gunakan mikrofon…" />
      </label>
      <div className="flex flex-wrap gap-2">
        {dictation.isSupported && <button type="button" className={`${buttonClass} inline-flex items-center gap-2`} disabled={busy || handsFree} onClick={() => {
          if (dictation.isListening) dictation.stop();
          else dictation.start();
        }}>
          {dictation.isListening ? <MicOff size={18} /> : <Mic size={18} />}
          {dictation.isListening ? 'Selesai bicara' : 'Mulai bicara'}
        </button>}
        {dictation.isSupported && <button type="button" className={`${buttonClass} inline-flex items-center gap-2`} disabled={busy && !handsFree} onClick={() => {
          if (handsFree) {
            stopHandsFree();
          } else {
            handsFreeRef.current = true;
            setHandsFree(true);
            phaseRef.current = 'listening';
            startListening();
          }
        }}>
          {handsFree ? <MicOff size={18} /> : <Mic size={18} />}
          {handsFree ? 'Matikan percakapan otomatis' : 'Mulai ngobrol otomatis'}
        </button>}
        {!dictation.isSupported && <p className="self-center text-xs text-amber-300">Pengenalan suara tidak tersedia di browser ini. Kamu tetap dapat mengetik.</p>}
        {speechOutput && <button type="button" className={`${buttonClass} inline-flex items-center gap-2`} onClick={() => window.speechSynthesis.cancel()}>
          <VolumeX size={18} /> Hentikan suara
        </button>}
        <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50" disabled={busy || handsFree || !input.trim()}>
          <Send size={17} /> Kirim ke AI
        </button>
      </div>
    </form>
  </section>;
}
