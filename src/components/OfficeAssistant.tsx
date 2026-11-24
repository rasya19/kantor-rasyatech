import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { workflowClient } from '../api/workflowClient';
import { useVoiceDictation } from '../hooks/useVoiceDictation';

type Message = { role: 'user' | 'assistant'; content: string };

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 shadow-sm';
const buttonClass = 'min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50';
const femaleVoiceLabel = /(female|woman|women|girl|gadis|perempuan|wanita|feminine|femme|feminina|weiblich)/i;

const STARTER_PROMPTS = [
  'Ringkas status pekerjaan & draf hari ini',
  'Cek sisa limit bulanan & pemakaian AI',
  'Apa prioritas tugas yang paling mendesak?',
];

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

  const isListening = dictation.isListening || (handsFree && !busy);
  const orbStateLabel = busy
    ? 'Membaca snapshot kantor…'
    : isListening
      ? 'Mendengarkan suara Bos Ismanto…'
      : 'Siap diajak berdiskusi';

  return (
    <div className="space-y-5">
      {/* Voice Orb Studio Banner */}
      <section className="studio-hero-dark p-6 sm:p-7">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              {isListening && (
                <>
                  <motion.span
                    className="absolute inset-0 rounded-full bg-emerald-400/30"
                    animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.span
                    className="absolute inset-2 rounded-full bg-violet-400/30"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
                  />
                </>
              )}
              <motion.div
                animate={
                  busy
                    ? { rotate: 360, scale: [1, 1.06, 1] }
                    : isListening
                      ? { scale: [1, 1.09, 1] }
                      : { scale: [1, 1.03, 1] }
                }
                transition={
                  busy
                    ? { rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.2, repeat: Infinity } }
                    : { duration: isListening ? 1.1 : 3.2, repeat: Infinity, ease: 'easeInOut' }
                }
                className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-2xl ${
                  isListening
                    ? 'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 shadow-emerald-500/40'
                    : busy
                      ? 'bg-gradient-to-br from-violet-400 via-fuchsia-500 to-teal-400 shadow-violet-500/40'
                      : 'bg-gradient-to-br from-violet-500 via-indigo-500 to-emerald-400 shadow-indigo-500/30'
                }`}
              >
                {isListening ? (
                  <div className="flex items-end gap-1" aria-hidden="true">
                    {[0.6, 1, 0.75, 0.95, 0.55].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 rounded-full bg-white"
                        animate={{ height: ['8px', `${Math.round(h * 28)}px`, '10px'] }}
                        transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                ) : (
                  <Mic size={28} className="text-white" />
                )}
              </motion.div>
            </div>

            <div className="text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-200 backdrop-blur-sm">
                <span className={`h-2 w-2 rounded-full ${busy ? 'animate-pulse bg-violet-300' : isListening ? 'animate-pulse bg-emerald-400' : 'bg-emerald-300'}`} />
                {orbStateLabel}
              </span>
              <h2 className="mt-2.5 text-xl font-extrabold tracking-tight text-white sm:text-2xl">Manajer Kantor AI — Studio Suara</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Bicara langsung atau ketik untuk mengecek progres draf, antrean 7 divisi, tiket klien, dan sisa limit OpenRouter.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
            {dictation.isSupported && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-emerald-50 disabled:opacity-50"
                disabled={busy || handsFree}
                onClick={() => {
                  if (dictation.isListening) dictation.stop();
                  else dictation.start();
                }}
              >
                {dictation.isListening ? <MicOff size={17} className="text-rose-600" /> : <Mic size={17} className="text-teal-700" />}
                {dictation.isListening ? 'Selesai bicara' : 'Bicara sekali'}
              </button>
            )}
            {dictation.isSupported && (
              <button
                type="button"
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
                  handsFree
                    ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                }`}
                disabled={busy && !handsFree}
                onClick={() => {
                  if (handsFree) {
                    stopHandsFree();
                  } else {
                    handsFreeRef.current = true;
                    setHandsFree(true);
                    phaseRef.current = 'listening';
                    startListening();
                  }
                }}
              >
                {handsFree ? <MicOff size={17} /> : <Mic size={17} />}
                {handsFree ? 'Matikan Hands-Free' : 'Hands-Free'}
              </button>
            )}
            {speechOutput && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                onClick={() => window.speechSynthesis.cancel()}
              >
                <VolumeX size={17} /> Hentikan
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Conversational Thread Card */}
      <section className="studio-bento-card space-y-4 p-5 sm:p-6">
        <div ref={listRef} aria-live="polite" className="max-h-[26rem] min-h-52 space-y-3 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          {messages.length === 0 && (
            <div className="space-y-3 py-4 text-center sm:text-left">
              <p className="text-sm font-medium text-slate-500">Pilih pertanyaan cepat atau mulai bicara lewat mikrofon di atas:</p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {STARTER_PROMPTS.map((prompt) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={busy || handsFree}
                    onClick={() => void sendMessage(prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-900 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
                  >
                    <Sparkles size={13} className="text-violet-600" />
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <motion.article
              key={`${index}-${message.role}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl p-4 text-sm shadow-sm ${
                message.role === 'assistant'
                  ? 'mr-6 border border-slate-200 bg-white text-slate-800'
                  : 'ml-8 bg-gradient-to-br from-teal-600 to-emerald-600 text-white'
              }`}
            >
              <p className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${message.role === 'assistant' ? 'text-violet-700' : 'text-emerald-100'}`}>
                {message.role === 'assistant' ? 'Asisten Kantor' : 'Bos Ismanto'}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.role === 'assistant' && speechOutput && (
                <button type="button" className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100" onClick={() => speak(message.content, false)}>
                  <Volume2 size={14} /> Bacakan lagi
                </button>
              )}
            </motion.article>
          ))}
          {busy && <p role="status" className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">Asisten sedang membaca snapshot &amp; menjawab…</p>}
        </div>

        {dictation.interimTranscript && <p className="rounded-xl bg-teal-50 px-3.5 py-2 text-sm font-medium text-teal-800">Mendengar: {dictation.interimTranscript}</p>}
        {(dictation.error || error) && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{dictation.error || error}</p>}
        {!dictation.isSupported && <p className="text-xs font-medium text-amber-700">Pengenalan suara tidak tersedia di browser ini. Kamu tetap dapat mengetik di bawah.</p>}

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
        >
          <label className="block flex-1 text-sm font-semibold text-slate-700">Pesan untuk asisten
            <textarea className={`${inputClass} mt-1.5`} rows={2} maxLength={2000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ketik pesan atau pertanyaan operasional…" />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
            disabled={busy || handsFree || !input.trim()}
          >
            <Send size={17} /> Kirim ke AI
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2">
          {speechOutput && speechVoices.length > 0 && (
            <details className="office-info-box">
              <summary>Pengaturan suara balasan ({speechVoices.length} suara)</summary>
              <div className="mt-3 space-y-3">
                <label className="block text-sm font-semibold text-slate-700">Cari suara
                  <input className={`${inputClass} mt-1`} type="search" value={voiceSearch} onChange={(event) => setVoiceSearch(event.target.value)} placeholder="Cari nama atau bahasa, mis. Indonesian" />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={femaleVoicesOnly} onChange={(event) => setFemaleVoicesOnly(event.target.checked)} />
                  Cari suara yang berlabel perempuan
                </label>
                <label className="block text-sm font-semibold text-slate-700">Suara balasan
                  <select className={`${inputClass} mt-1`} value={selectedVoiceURI} onChange={(event) => {
                    voiceSelectedByUserRef.current = true;
                    setSelectedVoiceURI(event.target.value);
                  }}>
                    {filteredSpeechVoices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                    {filteredSpeechVoices.length === 0 && <option value="" disabled>Tidak ada suara yang cocok di perangkat ini</option>}
                  </select>
                </label>
                <span className="block text-xs text-slate-500">Filter perempuan mencari label seperti “Female” atau “Woman”.</span>
              </div>
            </details>
          )}
          <details className="office-info-box">
            <summary>Privasi, snapshot &amp; biaya OpenRouter</summary>
            <p className="mt-2 leading-relaxed text-slate-600">
              Asisten memakai ringkasan baca-saja dari pekerjaan, tiket, draf, pengetahuan produk, prospek, transaksi, pemakaian AI, dan sisa limit key OpenRouter. Limit key bukan saldo akun atau kredit/top-up. Jangan kirim password atau data pribadi.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
