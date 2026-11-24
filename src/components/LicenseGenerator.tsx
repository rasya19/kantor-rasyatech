import { useEffect, useState, type FormEvent } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { licenseYears } from '../lib/licenseCode';
import { normalizeWarungName, type WarungRecord } from '../lib/warungLicense';
import { warungClient } from '../api/warungClient';

export function LicenseGenerator() {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [years] = useState(() => licenseYears(new Date().getFullYear()));
  const [year, setYear] = useState(() => years[0]);
  const [copyStatus, setCopyStatus] = useState('');
  const [warungs, setWarungs] = useState<WarungRecord[] | null>(null);
  const [listError, setListError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; name: string; isNew: boolean } | null>(null);

  async function loadWarungs() {
    try {
      const data = await warungClient.list();
      setWarungs(data.warungs);
      setListError('');
    } catch (error) {
      setWarungs(null);
      setListError(error instanceof Error ? error.message : 'Daftar warung gagal dimuat.');
    }
  }

  useEffect(() => {
    void loadWarungs();
  }, []);

  const yearValue = year % 100;
  const parsedDeviceId = /^\d+$/.test(deviceId) ? Number(deviceId) : Number.NaN;
  const isPositiveInteger = Number.isSafeInteger(parsedDeviceId) && parsedDeviceId > 0;
  const resultIsSafe = isPositiveInteger && Number.isSafeInteger(parsedDeviceId * 7 + yearValue);
  const existingWarung = warungs?.find((warung) => normalizeWarungName(warung.name) === normalizeWarungName(name));
  const inputError = deviceId && !isPositiveInteger
    ? 'Masukkan Device ID berupa bilangan bulat positif.'
    : isPositiveInteger && !resultIsSafe
      ? 'Device ID terlalu besar untuk dihitung dengan aman.'
      : '';

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopyStatus('Kode lisensi berhasil disalin.');
    } catch {
      setCopyStatus('Kode tidak dapat disalin otomatis. Pilih dan salin kode secara manual.');
    }
  }

  function clearResult() {
    setResult(null);
    setCopyStatus('');
    setSaveError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !name.trim() || !resultIsSafe) return;
    setBusy(true);
    clearResult();
    try {
      const saved = await warungClient.generate({ name, deviceId, year });
      setResult({ code: saved.license.code, name: saved.warung.name, isNew: saved.isNew });
      await loadWarungs();
    } catch (error) {
      setSaveError(`${error instanceof Error ? error.message : 'Gagal menyimpan lisensi.'} Jika koneksi terputus, periksa daftar sebelum mencoba lagi.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="license-generator space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <header className="license-heading">
        <div className="license-icon"><KeyRound size={23} aria-hidden="true" /></div>
        <div>
          <p className="app-eyebrow">ALAT BANTU AKTIVASI</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Generator Lisensi Aplikasi Warung</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Masukkan nama warung dan Device ID, lalu simpan hasilnya agar riwayat lisensi tercatat.
          </p>
        </div>
      </header>

      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700" htmlFor="warung-name">
        Nama warung
        <input id="warung-name" className="license-field mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base shadow-sm"
          value={name} required maxLength={120} autoComplete="off" placeholder="Contoh: Warung Berkah"
          onChange={(event) => { setName(event.currentTarget.value); clearResult(); }} />
        {name.trim() && <span className="mt-2 block text-xs font-normal text-slate-500">
          {warungs === null ? 'Status pendaftaran belum tersedia.' : existingWarung
            ? `Sudah terdaftar sebagai ${existingWarung.name}. Periksa kecocokan sebelum melanjutkan.`
            : 'Nama belum ditemukan dalam daftar warung.'}
        </span>}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="license-device-id">
          Device ID
          <input
            id="license-device-id"
            className="license-field mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base shadow-sm"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={deviceId}
            onChange={(event) => {
              setDeviceId(event.currentTarget.value);
              clearResult();
            }}
            placeholder="Contoh: 20013"
            aria-describedby="license-device-hint license-device-error"
            aria-invalid={Boolean(inputError)}
          />
          <span id="license-device-hint" className="mt-1 block text-xs font-normal text-slate-500">
            Gunakan angka yang ditampilkan aplikasi warung.
          </span>
          <span id="license-device-error" className="mt-1 block text-xs text-red-600" role="alert">
            {inputError}
          </span>
        </label>

        <label className="block text-sm font-semibold text-slate-700" htmlFor="license-year">
          Tahun lisensi
          <select
            id="license-year"
            className="license-field mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base shadow-sm"
            value={year}
            onChange={(event) => {
              setYear(Number(event.currentTarget.value));
              clearResult();
            }}
          >
            {years.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear} ({String(optionYear % 100).padStart(2, '0')})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Dua digit terakhir tahun ditambahkan ke hasil perhitungan.
          </span>
        </label>
      </div>
      <button type="submit" disabled={busy || !name.trim() || !resultIsSafe}
        className="license-generate-button">
        {busy ? 'Menyimpan...' : 'Generate dan simpan lisensi'}
      </button>
      </fieldset>
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      </form>

      <div className="license-result" aria-live="polite">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kode lisensi</p>
          <output className="license-code" aria-label="Kode lisensi yang dihasilkan">{result?.code || '—'}</output>
          <p className="mt-2 break-all text-xs text-slate-500">
            Rumus: {result ? `${parsedDeviceId} × 7 + ${yearValue} = ${result.code}` : 'Device ID × 7 + dua digit terakhir tahun'}
          </p>
          {result && <p className="mt-2 text-sm text-teal-700">
            {result.isNew ? 'Warung baru dicatat' : 'Warung sudah terdaftar; lisensi baru dicatat'}: {result.name}.
          </p>}
        </div>
        <button
          type="button"
          className="license-copy-button"
          onClick={() => void copyCode()}
          disabled={!result}
        >
          <Copy size={16} aria-hidden="true" />
          Salin kode
        </button>
      </div>
      <p className="min-h-5 text-sm text-teal-700" role="status">{copyStatus}</p>

      <section aria-labelledby="warung-recap-title" className="space-y-3 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="warung-recap-title" className="text-lg font-bold">Rekap warung terdaftar</h3>
            <p className="mt-1 text-xs text-slate-500">Pencocokan berdasarkan nama, bukan bukti pembelian. Pastikan warung yang namanya sama memang pelanggan yang sama.</p>
          </div>
          <button type="button" className="license-copy-button" onClick={() => void loadWarungs()}>Muat ulang daftar</button>
        </div>
        {listError && <p role="alert" className="text-sm text-red-600">Daftar tidak tersedia: {listError}</p>}
        {warungs === null && !listError && <p className="text-sm text-slate-500">Memuat daftar warung...</p>}
        {warungs && warungs.length === 0 && <p className="text-sm text-slate-500">Belum ada warung terdaftar.</p>}
        {warungs && warungs.length > 0 && <>
          <p className="text-sm text-slate-500">{warungs.length} warung terdaftar</p>
          <div className="space-y-2.5">
            {warungs.map((warung) => <details key={warung.id} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-200">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">{warung.name} <span className="font-normal text-slate-500">· {warung.licenses.length} lisensi tercatat</span></summary>
              <div className="mt-3 space-y-2">
                {warung.licenses.map((license) => <div key={license.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  <p><strong>{license.year}</strong> · Device ID: <span className="font-mono">{license.deviceId}</span> · Kode: <strong className="font-mono text-teal-700">{license.code}</strong></p>
                  <p className="mt-1 text-xs text-slate-500">Dicatat {new Date(license.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
                </div>)}
              </div>
            </details>)}
          </div>
        </>}
      </section>

      <aside className="license-note">
        <strong>Catatan keamanan:</strong> rumus ini sederhana dan mudah ditebak. Gunakan hanya untuk aplikasi yang kamu kelola; validasi rumus yang sama pada aplikasi warung. Generator ini hanya menghitung dan menyalin kode—tidak mengaktifkan aplikasi secara langsung.
      </aside>
      <p className="text-xs text-slate-500">Contoh: Device ID 20013 menghasilkan 140117 untuk tahun 2026 dan 140118 untuk tahun 2027.</p>
    </section>
  );
}
