import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && navigator.standalone === true)
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) {
      setShowIosHint(true);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch (reason) {
      console.error('[PWA] Instalasi gagal:', reason);
      setError('Pemasangan gagal. Coba gunakan menu browser untuk menambahkan aplikasi ke layar utama.');
      setPrompt(null);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void install()}
        className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
          isDark
            ? 'border-white/15 bg-white/8 text-emerald-200 hover:bg-white/14'
            : 'border-teal-200 bg-teal-50/70 text-teal-800 hover:bg-teal-100/70'
        }`}
      >
        {prompt ? <Download size={15} /> : <Smartphone size={15} />}
        {prompt ? 'Pasang aplikasi' : 'Cara pasang di HP'}
      </button>
      {showIosHint && (
        <div
          className={`relative rounded-xl border p-3 pr-9 text-xs leading-relaxed ${
            isDark
              ? 'border-white/15 bg-white/10 text-slate-200'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <button
            type="button"
            onClick={() => setShowIosHint(false)}
            className={`absolute right-2 top-2 rounded-md p-1 ${isDark ? 'text-slate-300 hover:bg-white/15' : 'text-slate-500 hover:bg-slate-200'}`}
            aria-label="Tutup petunjuk"
          >
            <X size={15} />
          </button>
          iPhone: buka di Safari, pilih Bagikan, lalu Tambah ke Layar Utama. Android: buka menu browser dan pilih Instal aplikasi atau Tambahkan ke layar utama.
        </div>
      )}
      {error && <p role="alert" className={`text-xs font-medium ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{error}</p>}
    </div>
  );
}
