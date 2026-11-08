import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
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

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void install()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-700/70 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/20">
        {prompt ? <Download size={17} /> : <Smartphone size={17} />}
        {prompt ? 'Pasang aplikasi' : 'Cara pasang di HP'}
      </button>
      {showIosHint && <div className="relative rounded-lg bg-slate-950 p-3 pr-9 text-xs leading-relaxed text-slate-300">
        <button type="button" onClick={() => setShowIosHint(false)} className="absolute right-2 top-2 p-1" aria-label="Tutup petunjuk"><X size={15} /></button>
        iPhone: buka di Safari, pilih Bagikan, lalu Tambah ke Layar Utama. Android: buka menu browser dan pilih Instal aplikasi atau Tambahkan ke layar utama.
      </div>}
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
