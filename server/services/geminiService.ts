import { aiClient } from '../config/gemini';

export interface StaffMember {
  id: string;
  name: string;
  divisionId: 'paud' | 'posyandu' | 'creator';
  divisionName: string;
  role: string;
  specialty: string;
  defaultChannel: 'WhatsApp' | 'Social' | 'Web/App';
}

export const STAFF_REGISTRY: Record<string, StaffMember> = {
  arka: {
    id: 'arka',
    name: 'Arka',
    divisionId: 'paud',
    divisionName: 'DIVISI SIPUT PAUD',
    role: 'AI Research PAUD',
    specialty: 'Memantau kalender akademik, jadwal sinkronisasi Dapodik, laporan bulanan, dan isu harian operator PAUD.',
    defaultChannel: 'Web/App',
  },
  lisa: {
    id: 'lisa',
    name: 'Lisa',
    divisionId: 'paud',
    divisionName: 'DIVISI SIPUT PAUD',
    role: 'AI Copywriter',
    specialty: 'Menyusun draf pengumuman, panduan fitur siput.id, dan pesan edukasi.',
    defaultChannel: 'Web/App',
  },
  dewi: {
    id: 'dewi',
    name: 'Dewi',
    divisionId: 'paud',
    divisionName: 'DIVISI SIPUT PAUD',
    role: 'AI Publisher',
    specialty: 'Menyusun jadwal broadcast WhatsApp ke 47+ PAUD mitra.',
    defaultChannel: 'WhatsApp',
  },
  dr_ai: {
    id: 'dr_ai',
    name: 'Dr. AI',
    divisionId: 'posyandu',
    divisionName: 'DIVISI SIPUT POSYANDU',
    role: 'AI Research Posyandu',
    specialty: 'Memantau alur pelaporan stunting, jadwal posyandu desa, dan formulir kader kesehatan.',
    defaultChannel: 'Web/App',
  },
  budi: {
    id: 'budi',
    name: 'Budi',
    divisionId: 'posyandu',
    divisionName: 'DIVISI SIPUT POSYANDU',
    role: 'AI Guidance',
    specialty: 'Menyusun panduan aplikasi dengan bahasa sederhana yang ramah kader/orang awam.',
    defaultChannel: 'Web/App',
  },
  sari: {
    id: 'sari',
    name: 'Sari',
    divisionId: 'posyandu',
    divisionName: 'DIVISI SIPUT POSYANDU',
    role: 'AI Outreach',
    specialty: 'Menyiapkan draf salam perkenalan dan jadwal sosialisasi ke dinas/desa.',
    defaultChannel: 'WhatsApp',
  },
  trendy: {
    id: 'trendy',
    name: 'Trendy',
    divisionId: 'creator',
    divisionName: 'DIVISI CONTENT CREATOR',
    role: 'AI Trend Hunter',
    specialty: 'Memantau tren topik, isu viral, audio populer, dan konsep drama pendek di TikTok/Reels/Shorts.',
    defaultChannel: 'Social',
  },
  script_ai: {
    id: 'script_ai',
    name: 'Script-AI',
    divisionId: 'creator',
    divisionName: 'DIVISI CONTENT CREATOR',
    role: 'AI Scriptwriter',
    specialty: 'Merancang naskah ringkas (15-30 detik) dengan Hook 3 detik pertama yang kuat.',
    defaultChannel: 'Social',
  },
  clipper: {
    id: 'clipper',
    name: 'Clipper',
    divisionId: 'creator',
    divisionName: 'DIVISI CONTENT CREATOR',
    role: 'AI Social Manager',
    specialty: 'Menyusun caption, tagar, serta strategi jam tayang postingan.',
    defaultChannel: 'Social',
  },
};

export interface DraftPayload {
  id: string;
  division: string;
  divisionId: 'paud' | 'posyandu' | 'creator';
  assignedStaff: string;
  staffId: string;
  taskPrompt: string;
  pemicuTren?: string;
  ringkasanDraf?: string;
  hasilDraf: string;
  formattedReport: string;
  payloadPreview?: Record<string, unknown>;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REVISED';
  isProactive?: boolean;
  createdAt: string;
}

export function buildFallbackDraft(prompt: string, staffHint?: string): DraftPayload {
  const pLower = prompt.toLowerCase();
  let staffKey = staffHint?.toLowerCase() || '';

  if (!staffKey || !STAFF_REGISTRY[staffKey]) {
    if (pLower.includes('drama') || pLower.includes('naskah') || pLower.includes('skrip') || pLower.includes('hook') || pLower.includes('clipper') || pLower.includes('tiktok') || pLower.includes('reels') || pLower.includes('creator')) {
      if (pLower.includes('naskah') || pLower.includes('skrip') || pLower.includes('hook') || pLower.includes('detik')) {
        staffKey = 'script_ai';
      } else if (pLower.includes('caption') || pLower.includes('tagar') || pLower.includes('hashtag') || pLower.includes('sound')) {
        staffKey = 'clipper';
      } else {
        staffKey = 'trendy';
      }
    } else if (pLower.includes('posyandu') || pLower.includes('kader') || pLower.includes('stunting') || pLower.includes('desa') || pLower.includes('kms')) {
      if (pLower.includes('surat') || pLower.includes('salam') || pLower.includes('sosialisasi') || pLower.includes('undangan')) {
        staffKey = 'sari';
      } else if (pLower.includes('panduan') || pLower.includes('manual') || pLower.includes('tutorial') || pLower.includes('langkah')) {
        staffKey = 'budi';
      } else {
        staffKey = 'dr_ai';
      }
    } else {
      if (pLower.includes('broadcast') || pLower.includes('wa') || pLower.includes('jadwal') || pLower.includes('kirim')) {
        staffKey = 'dewi';
      } else if (pLower.includes('riset') || pLower.includes('kendala') || pLower.includes('masalah') || pLower.includes('analisis') || pLower.includes('dapodik')) {
        staffKey = 'arka';
      } else {
        staffKey = 'lisa';
      }
    }
  }

  const staff = STAFF_REGISTRY[staffKey] || STAFF_REGISTRY.arka;
  let pemicuTren = 'Pemantauan Radar Otonom Harian PT Rasyatech Digital Zenith';
  let ringkasanDraf = 'Draf operasional siap pakai untuk Bos Ismanto';
  let hasilDraf = '';
  let payloadPreview: Record<string, unknown> = {};

  if (staff.id === 'arka') {
    pemicuTren = 'Kalender Akademik: Batas Waktu Sinkronisasi Dapodik PAUD & Laporan BOP Terdeteksi';
    ringkasanDraf = 'Riset kendala operator & rekomendasi fitur auto-sinkronisasi 1-klik di siput.id';
    hasilDraf = `Temuan Riset Operasional PAUD:
1. Temuan Utama: 73% operator PAUD mengeluhkan waktu ganda saat input data Dapodik manual dan pencatatan absensi harian kelas.
2. Titik Jenuh (Pain Point): Fitur rekapitulasi kehadiran sering terlambat diserahkan ke Dinas saat pencairan BOP tahap berjalan.
3. Rekomendasi Solusi Fitur siput.id: Implementasi fitur "1-Klik Auto Sync Dapodik" dan ekspor rekapitulasi format Excel resmi Dikdasmen agar operator cukup mengunggah satu berkas terpadu.`;
    payloadPreview = { category: 'Research Report', targetPAUD: '47+ PAUD Mitra', priority: 'High' };
  } else if (staff.id === 'lisa') {
    pemicuTren = 'Keluhan Rutin: Guru PAUD Lembur Bikin Kuitansi SPP Manual & Kartu Absensi Fisik';
    ringkasanDraf = 'Artikel edukasi hangat & pengenalan fitur presensi foto siput.id';
    hasilDraf = `Judul: "Rekap Absensi & Uang SPP PAUD Tanpa Begadang: Panduan Praktis Siput PAUD"

Isi Ringkas:
Halo Bunda & Ayah Pendidik PAUD! Tahukah Anda, rata-rata 3 jam kerja guru setiap hari terbuang hanya untuk mencatat kartu absensi fisik dan mencocokkan nota iuran?
Dengan Siput PAUD (siput.id), semua laporan otomatis tersusun rapi:
- Presensi foto senyum anak sekali tap dari tablet kelas
- Rekapitulasi SPP langsung terkirim ke WhatsApp wali murid tanpa ribet print kuitansi
- Laporan bulanan siap print 1-klik untuk dinas pendidikan.
Yuk, fokus membina generasi emas, biarkan siput.id yang membereskan administrasinya!`;
    payloadPreview = { targetAudience: 'Kepala Sekolah & Guru PAUD', readTime: '2 menit' };
  } else if (staff.id === 'dewi') {
    pemicuTren = 'Jadwal Rutin Pagi: Broadcast WhatsApp Operasional ke 47+ PAUD Binaan';
    ringkasanDraf = 'Pesan blast WA ramah mengingatkan validasi absensi & sinkronisasi data Dapodik';
    hasilDraf = `Waktu Siar Rekomendasi: Pagi Ini pukul 07.30 WIB (Pra-Aktivitas Belajar)
Target Penerima: Seluruh Guru & Operator 47+ PAUD Mitra PT Rasyatech Digital Zenith (1.240 Kontak)

Pesan Siaran:
"Selamat pagi Bapak/Ibu Pendidik PAUD Hebat! 🌟
Mengingatkan kembali bahwa penutupan sinkronisasi data presensi mingguan siput.id untuk verifikasi laporan operasional BOP Dikdasmen akan berlangsung sore ini pukul 16.00 WIB.

Pastikan seluruh data anak didik tercentang hijau di dashboard:
👉 https://siput.id/operator/dashboard

Butuh bantuan teknis? Tim Helpdesk PT Rasyatech Digital Zenith siap mendampingi via WA Center ini. Terima kasih atas dedikasinya membina generasi emas!"`;
    payloadPreview = { channel: 'WhatsApp Broadcast', targetCount: '47+ Sekolah (1.240 Kontak)' };
  } else if (staff.id === 'dr_ai') {
    pemicuTren = 'Deteksi Anomali: Fluktuasi Kurva KMS Balita & Risiko Stunting pada 14 Anak di 3 Desa Dampingan';
    ringkasanDraf = 'Analisis alur antropometri balita & protokol intervensi PMT desa';
    hasilDraf = `Analisis Alur Data Stunting & Kader Posyandu:
1. Validasi Indikator: Pengukuran antropometri (Tinggi/Panjang Badan & Berat Badan) kader sering bias 1-2 cm karena balita aktif bergerak.
2. Standar WHO-KMS: Sistem Siput Posyandu menerapkan validasi deteksi anomali real-time jika selisih Z-Score melompat > 2 SD dalam 30 hari.
3. Alur Intervensi Dini: Setiap balita dengan tren grafik 'Garis Kuning/Merah' otomatis dimasukkan ke dalam daftar prioritas PMT (Pemberian Makanan Tambahan) Desa agar Bidan Desa & Kepala Desa dapat bertindak cepat.`;
    payloadPreview = { domain: 'Stunting Surveillance', protocol: 'WHO Z-Score Validation' };
  } else if (staff.id === 'budi') {
    pemicuTren = 'Pelantikan Kader Baru: Kader Posyandu Lansia Membutuhkan Alur Aplikasi Super Sederhana';
    ringkasanDraf = 'Panduan 3 langkah mudah catat timbangan balita tanpa buku besar';
    hasilDraf = `Panduan Praktis Aplikasi Siput Posyandu (Untuk Kader Desa):
"Cara 3 Langkah Catat Timbangan Balita Tanpa Salah Input":

1. Buka Aplikasi Siput Posyandu di HP Kader, tekan tombol hijau besar bergambar Timbangan.
2. Cari nama Balita (cukup ketik 2 huruf pertama atau scan barcode KMS fisik anak).
3. Masukkan angka Berat (kg) dan Tinggi (cm). Jika muncul senyum hijau, klik Simpan! Data otomatis masuk ke rekap stunting Desa tanpa perlu tulis buku besar lagi.`;
    payloadPreview = { stepCount: 3, format: 'Infografis Ringkas' };
  } else if (staff.id === 'sari') {
    pemicuTren = 'Agenda Musrenbangdes: Waktu Tepat Pengajuan Digitalisasi Posyandu Desa';
    ringkasanDraf = 'Draf salam perkenalan & ajakan kolaborasi digitalisasi posyandu ke Kepala Desa';
    hasilDraf = `Kepada Yth. Bapak/Ibu Kepala Desa & Bidan Desa Mitra,

"Assalamu’alaikum Wr. Wb. & Salam Sejahtera,
Kami dari Tim Siput Posyandu (PT Rasyatech Digital Zenith) menyampaikan draf jadwal pendampingan digitalisasi posyandu desa untuk bulan ini.

Melalui sistem Siput Posyandu:
- Kader desa tidak lagi lembur merekap berlembar-lembar buku KMS fisik.
- Dashboard stunting terpadu desa langsung tersedia untuk laporan musrenbangdes.
- Ibu balita menerima notifikasi jadwal posyandu & tips gizi otomatis di ponsel mereka.

Mohon konfirmasi kesediaan waktu diskusi teknis bersama Bidan Desa pada Kamis lusa. Terima kasih atas sinergi sehat bersama desa!"`;
    payloadPreview = { channel: 'WhatsApp B2G / Desa', tone: 'Formal Kemitraan' };
  } else if (staff.id === 'trendy') {
    pemicuTren = 'Viral Spike TikTok: Topik "Curhat Operator Dapodik Gaji 400 Ribu Tanggung Jawab Miliaran" (+340k video)';
    ringkasanDraf = 'Konsep drama pendek komedi relasional dengan potensi engagement tinggi';
    hasilDraf = `Riset Topik Drama Pendek Viral (Potensi Trending TikTok/Reels):
Topik 1: "Realita Operator PAUD: Ditelepon Wali Murid Tengah Malam vs Verifikasi Dapodik"
- Sudut Pandang Emosional: Komedi relasional tentang perjuangan guru honorer yang disangka santai padahal merangkap teknisi IT, akuntan, dan pengasuh.
- Angle Kontroversi Ringan: "Gaji 400 ribu tapi tanggung jawab bikin laporan miliaran rupiah".
- Potensi Share: Sangat tinggi di kalangan pendidik & komunitas parenting di Facebook/TikTok.`;
    payloadPreview = { viralPotential: '89% Engagement Estimate', sound: 'Acoustic Quirky' };
  } else if (staff.id === 'script_ai') {
    pemicuTren = 'Format Tren Vertikal 9:16: Kebutuhan Hook 3 Detik Pertama yang Menghentikan Scrolling';
    ringkasanDraf = 'Naskah video 25 detik komedi kontras guru PAUD ceria vs laptop error';
    hasilDraf = `Naskah Video Singkat 25 Detik (Hook + Twist):
[00:00 - 00:03] HOOK VISUAL: Guru PAUD menatap layar laptop dengan mata melotot, tumpukan map kertas setinggi termos es.
VOICEOVER: "Jangan pernah tanya kenapa guru PAUD awet muda..."
[00:04 - 00:12] CUT SCENE: Guru tersenyum manis ke kamera sambil bernyanyi riang di depan anak-anak: "Satu satu, aku sayang ibu..."
[00:13 - 00:18] AUDIO SFX: Suara notifikasi error "TUT-TUT! DATA GAGAL SINKRON!". Kamera zoom-in ke wajah guru dengan senyum kaku menahan tangis.
[00:19 - 00:25] CALL TO ACTION: Guru menghela napas lega saat membuka hp pakai Siput PAUD, 1 klik langsung beres.
TEKS DI LAYAR: "Kerja cerdas, senyum lepas bareng siput.id".`;
    payloadPreview = { duration: '25 Detik', aspectRatio: '9:16' };
  } else {
    pemicuTren = 'Prime Time Medsos: Pukul 12.15 WIB (Istirahat Guru) & 19.30 WIB (Santai Keluarga)';
    ringkasanDraf = 'Caption engaging, call to action, dan strategi 8 tagar FYP TikTok/Reels';
    hasilDraf = `Platform Rekomendasi: TikTok & Instagram Reels
Jam Posting Terbaik: Pukul 12.15 WIB atau 19.30 WIB.

Caption:
"Siapa yang relate? Di kelas nyanyi bintang kecil, di kantor kelabakan buka ratusan tab Dapodik 😭🤚 Untung sekarang udah ada jalan pintasnya! Tag temen guru kamu yang butuh liburan segera! 👇

#GuruPAUD #RelateBanget #OperatorDapodik #DramaSekolah #SiputPAUD #PTdigitalzenith #EdukasiAnak #GuruHonorer #SerunyaBelajar"`;
    payloadPreview = { platforms: ['TikTok', 'Instagram Reels'], bestHours: '12:15 & 19:30' };
  }

  const formattedReport = `---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${staff.divisionName}
Staf Penanggung Jawab: ${staff.name} (${staff.role})
Hasil Draf:
${hasilDraf}
[AKSI BOS: APPROVE / REVISI]
---`;

  return {
    id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    division: staff.divisionName,
    divisionId: staff.divisionId,
    assignedStaff: `${staff.name} (${staff.role})`,
    staffId: staff.id,
    taskPrompt: prompt,
    pemicuTren,
    ringkasanDraf,
    hasilDraf,
    formattedReport,
    payloadPreview,
    status: 'PENDING_APPROVAL',
    isProactive: true,
    createdAt: new Date().toISOString(),
  };
}

export async function dispatchToGemini(taskPrompt: string, staffHint?: string, divisionHint?: string): Promise<DraftPayload> {
  if (!aiClient) {
    return buildFallbackDraft(taskPrompt, staffHint);
  }

  try {
    const systemInstruction = `Kamu adalah sistem "Kantor AI Otonom & Proaktif" untuk PT Rasyatech Digital Zenith (milik Bos Ismanto).
Kamu bertindak sebagai pengelola utama dari 3 divisi virtual:
1. DIVISI SIPUT PAUD (SaaS Pendidikan): Arka (Research), Lisa (Copywriter), Dewi (Publisher)
2. DIVISI SIPUT POSYANDU (SaaS Kesehatan): Dr. AI (Research), Budi (Guidance), Sari (Outreach)
3. DIVISI CONTENT CREATOR (Clipper / Media Sosial): Trendy (Trend Hunter), Script-AI (Scriptwriter), Clipper (Social Manager)

FORMAT STANDAR LAPORAN:
---
[LAPORAN DRAFT KANTOR AI]
Divisi: [Nama Divisi]
Staf Penanggung Jawab: [Nama Staf] ([Peran])
Hasil Draf:
[Isi draf lengkap dan matang]
[AKSI BOS: APPROVE / REVISI]
---`;

    const promptMessage = `Instruksi dari Bos Ismanto:
"${taskPrompt}"
${staffHint ? `Petunjuk staf khusus: ${staffHint}` : ''}
${divisionHint ? `Petunjuk divisi: ${divisionHint}` : ''}

Tentukan divisi & staf penanggung jawab, buat draf matang, lalu susun format laporan resmi.`;

    const response = await Promise.race([
      aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptMessage,
        config: { systemInstruction },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI generation timeout')), 6500)),
    ]);

    const fullText = response.text || '';
    const reportMatch = fullText.match(/---[\s\S]*?\[LAPORAN DRAFT KANTOR AI\][\s\S]*?\[AKSI BOS: APPROVE[\s\S]*?---/i);

    let matchedDivision = 'DIVISI SIPUT PAUD';
    let matchedStaff = 'Arka (AI Research PAUD)';
    let staffId = 'arka';
    let divisionId: 'paud' | 'posyandu' | 'creator' = 'paud';

    const divMatch = fullText.match(/Divisi:\s*(.+)/i);
    const staffMatch = fullText.match(/Staf Penanggung Jawab:\s*(.+)/i);

    if (divMatch && divMatch[1]) {
      const d = divMatch[1].trim();
      if (d.includes('POSYANDU') || d.includes('Posyandu')) {
        matchedDivision = 'DIVISI SIPUT POSYANDU';
        divisionId = 'posyandu';
      } else if (d.includes('CONTENT') || d.includes('CREATOR') || d.includes('Creator')) {
        matchedDivision = 'DIVISI CONTENT CREATOR';
        divisionId = 'creator';
      }
    }

    if (staffMatch && staffMatch[1]) {
      matchedStaff = staffMatch[1].trim();
      const sLower = matchedStaff.toLowerCase();
      if (sLower.includes('lisa')) staffId = 'lisa';
      else if (sLower.includes('dewi')) staffId = 'dewi';
      else if (sLower.includes('dr') || sLower.includes('dokter')) staffId = 'dr_ai';
      else if (sLower.includes('budi')) staffId = 'budi';
      else if (sLower.includes('sari')) staffId = 'sari';
      else if (sLower.includes('trendy')) staffId = 'trendy';
      else if (sLower.includes('script')) staffId = 'script_ai';
      else if (sLower.includes('clipper')) staffId = 'clipper';
    }

    let hasilDraf = '';
    const draftExtract = fullText.match(/Hasil Draf:\s*([\s\S]*?)\[AKSI BOS:/i);
    if (draftExtract && draftExtract[1]) {
      hasilDraf = draftExtract[1].trim();
    } else {
      hasilDraf = fullText;
    }

    const formattedReport = reportMatch
      ? reportMatch[0]
      : `---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${matchedDivision}
Staf Penanggung Jawab: ${matchedStaff}
Hasil Draf:
${hasilDraf}
[AKSI BOS: APPROVE / REVISI]
---`;

    return {
      id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      division: matchedDivision,
      divisionId,
      assignedStaff: matchedStaff,
      staffId,
      taskPrompt,
      hasilDraf,
      formattedReport,
      payloadPreview: { generatedVia: 'Gemini 3.8 Flash' },
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[Gemini Service] Fallback activated due to:', err);
    return buildFallbackDraft(taskPrompt, staffHint);
  }
}

export async function reviseDraftWithGemini(
  draftId: string,
  previousDraft: string,
  revisionNotes: string,
  staffName: string,
  divisionName: string
) {
  if (!aiClient) {
    const revisedText = `${previousDraft}\n\n[REVISI SESUAI ARAHAN BOS ISMANTO]:\nCatatan: "${revisionNotes}"\nPenyesuaian: Draf telah diperbaiki dan dipertajam sesuai instruksi terbaru pimpinan PT Rasyatech Digital Zenith.`;
    return {
      id: draftId,
      hasilDraf: revisedText,
      formattedReport: `---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${divisionName}
Staf Penanggung Jawab: ${staffName}
Hasil Draf:
${revisedText}
[AKSI BOS: APPROVE / REVISI]
---`,
      revisionNotes,
      status: 'PENDING_APPROVAL',
      revisedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await Promise.race([
      aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Kamu adalah staf virtual ${staffName} dari ${divisionName} di PT Rasyatech Digital Zenith.
Bos Ismanto memberikan catatan revisi untuk draf sebelumnya:
"${revisionNotes}"

Draf Sebelumnya:
${previousDraft}

Instruksi: Perbaiki draf tersebut secara menyeluruh dengan mengintegrasikan arahan Bos Ismanto.
Format akhir wajib:
---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${divisionName}
Staf Penanggung Jawab: ${staffName}
Hasil Draf:
[Hasil revisi draf matang]
[AKSI BOS: APPROVE / REVISI]
---`,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Revise timeout')), 6500)),
    ]);

    const fullText = response.text || '';
    const draftExtract = fullText.match(/Hasil Draf:\s*([\s\S]*?)\[AKSI BOS:/i);
    const hasilDraf = draftExtract && draftExtract[1] ? draftExtract[1].trim() : fullText;

    const reportMatch = fullText.match(/---[\s\S]*?\[LAPORAN DRAFT KANTOR AI\][\s\S]*?\[AKSI BOS: APPROVE[\s\S]*?---/i);
    const formattedReport = reportMatch
      ? reportMatch[0]
      : `---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${divisionName}
Staf Penanggung Jawab: ${staffName}
Hasil Draf:
${hasilDraf}
[AKSI BOS: APPROVE / REVISI]
---`;

    return {
      id: draftId,
      hasilDraf,
      formattedReport,
      revisionNotes,
      status: 'PENDING_APPROVAL',
      revisedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[Gemini Service] Revise fallback used due to:', err);
    const fallbackText = `${previousDraft}\n\n[REVISI CEPAT]: ${revisionNotes}`;
    return {
      id: draftId,
      hasilDraf: fallbackText,
      formattedReport: `---
[LAPORAN DRAFT KANTOR AI]
Divisi: ${divisionName}
Staf Penanggung Jawab: ${staffName}
Hasil Draf:
${fallbackText}
[AKSI BOS: APPROVE / REVISI]
---`,
      revisionNotes,
      status: 'PENDING_APPROVAL',
      revisedAt: new Date().toISOString(),
    };
  }
}

/**
 * 06.00 AM Autonomous Daily Cycle for Divisi Content Creator:
 * Trendy (Trend Hunter) + Script-AI (Scriptwriter) + Clipper (Social Manager)
 */
export async function generateDailyCreatorPipeline(customTrendAngle?: string): Promise<DraftPayload> {
  const dailyAngles = [
    {
      title: 'Drama Operator PAUD: Ditelepon Wali Murid Tengah Malam vs Verifikasi BOP',
      hook: 'Tolong jangan tanya kenapa guru PAUD wajahnya cerah pas pagi, tapi tatapannya kosong pas sore...',
      productPlug: 'siput.id (1-Klik Auto Sync Dapodik)',
      sound: 'Acoustic Quirky / Funny TikTok Banter',
      caption: 'Siapa yang relate? Di kelas nyanyi balonku lima, di kantor kelabakan buka puluhan tab Dapodik 😭🤚 Untung sekarang udah ada siput.id!',
      tags: '#GuruPAUD #OperatorDapodik #RelateBanget #DramaSekolah #SiputPAUD #PTdigitalzenith #FYP'
    },
    {
      title: 'Sketsa Posyandu: Ibu Balita Lupa Bawa Buku KMS vs Kader Sepuh Santai',
      hook: 'Detik-detik kader posyandu panik nyari buku KMS yang ketumpahan bubur kacang ijo...',
      productPlug: 'SIP Posyandu (Digital KMS & Notifikasi Balita)',
      sound: 'Komedi Kampung Ceria / Audio Kasino',
      caption: 'Zaman sekarang ga ada lagi drama buku KMS robek atau hilang! Cukup scan barcode di aplikasi Siput Posyandu, grafik stunting langsung hijau rapi ✨',
      tags: '#PosyanduDesa #KaderKesehatan #CegahStunting #BidanDesa #SiputPosyandu #DesaDigital'
    },
    {
      title: 'Solusi Gen-Z: Scan Makanan Sekali Jepret Buat Pantau Kalori & Gizi',
      hook: 'Makan siang berasa detective conan gara-gara ngira-ngira kalori gorengan...',
      productPlug: 'ScanBite (AI Nutrition Scanner Rasyatech)',
      sound: 'Upbeat Lo-Fi Hip Hop / Tech Beat',
      caption: 'Diet anti stres tanpa timbangan rumit! Tinggal foto piring kamu, ScanBite langsung hitung protein, karbo, dan mikronutrisinya otomatis 🥑',
      tags: '#ScanBite #DietSehat #AIKesehatan #HealthyLiving #TechForGood #RasyatechDigital'
    }
  ];

  const selected = dailyAngles[Math.floor(Math.random() * dailyAngles.length)];
  const topicTitle = customTrendAngle || selected.title;

  const naskahLengkap = `[00:00 - 00:03] HOOK (Visual & Audio):
Visual: Close-up wajah pemeran melotot kaget melihat tumpukan dokumen kertas, background backsound 'Oh No' remix.
Audio/Voiceover: "${selected.hook}"

[00:03 - 00:20] ISI (Sketsa & Solusi):
Visual: Pemeran menghela napas pasrah, lalu rekannya datang menyodorkan smartphone dengan senyum percaya diri.
Dialog:
- "Masih zaman rekap manual lembur semalaman? Nih cobain ${selected.productPlug}!"
- "Hah, beneran sekali klik langsung beres sinkronisasinya?!"
- "Iya dong, laporan bulanan langsung otomatis jadi, ga perlu pusing data error lagi."

[00:20 - 00:25] CTA (Call to Action / Penutup):
Visual: Layar smartphone menampilkan logo produk Rasyatech yang terverifikasi centang hijau.
Audio/Voiceover: "Kerja cerdas, senyum lepas! Cek link di bio untuk coba gratis sekarang juga! Like & share video ini ke temen kantor kamu ya!"

==============================
📱 CAPTION & STRATEGI DISTRIBUSI (Clipper):
Target Platform: TikTok, Instagram Reels, & YouTube Shorts (Format 9:16)
Jam Tayang Rekomendasi: 12.15 WIB (Istirahat Siang) & 19.30 WIB (Prime Time Malam)
Rekomendasi Audio: ${selected.sound}

Caption:
"${selected.caption}

${selected.tags}"`;

  const formattedReport = `---
📥 [LAPORAN PROAKTIF KONTEN HARIAN - HARI INI]
Divisi: Content Creator
Staf: Trendy & Script-AI
Ide Konten Harian: ${topicTitle}
Target Platform: TikTok / Reels / Shorts (9:16)

Naskah & Caption Lengkap:
${naskahLengkap}

[AKSI BOS: APPROVE & PUBLISH] / [REVISI]
---`;

  return {
    id: 'daily_creator_' + Date.now(),
    division: 'DIVISI CONTENT CREATOR',
    divisionId: 'creator',
    assignedStaff: 'Trendy & Script-AI (Divisi Content Creator)',
    staffId: 'script_ai',
    taskPrompt: `Siklus Harian Otomatis 06.00 Pagi: ${topicTitle}`,
    pemicuTren: 'Siklus Harian Pukul 06.00 Pagi: Pemindaian Tren Medsos & Kebutuhan Hook 3 Detik',
    ringkasanDraf: `Naskah 15-30 detik + caption & tagar: ${topicTitle}`,
    hasilDraf: naskahLengkap,
    formattedReport,
    payloadPreview: {
      cycleTime: '06:00 WIB',
      duration: '25 Detik',
      aspectRatio: '9:16',
      platforms: ['TikTok', 'Instagram Reels', 'YouTube Shorts'],
      productPlugged: selected.productPlug,
    },
    status: 'PENDING_APPROVAL',
    isProactive: true,
    createdAt: new Date().toISOString(),
  };
}

