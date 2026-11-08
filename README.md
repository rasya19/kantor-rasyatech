# Kantor AI Rasyatech

Kantor AI membantu admin mencatat laporan klien, menyusun laporan untuk pimpinan, dan menyiapkan ide konten. Baca [Panduan Workflow](WORKFLOW.md) untuk peran dan langkah operasional.

## Batasan penting

- Aplikasi **tidak terhubung ke WhatsApp Business atau GitHub** dan tidak memperbaiki bug, mengirim pesan, menjalankan query, atau mempublikasikan konten. Persetujuan berarti siap untuk tindak lanjut manual, bukan bukti tindakan telah terjadi.
- Gemini maupun Copilot pada integrasi ini tidak mengakses repository, data aplikasi, shell, atau tren terbaru. Semua fakta, fitur, naskah, saran teknis, dan klaim produk harus diverifikasi manusia.
- Divisi Cyber Security hanya menyusun usulan dari informasi yang diberikan. Belum ada koneksi ke audit log, pemantauan keamanan, atau pemindai kerentanan; draf bukan bukti audit atau mitigasi telah dilakukan.
- Jangan masukkan nama, nomor telepon, token, kata sandi, data anak, data kesehatan, atau data pribadi lainnya. Teks laporan, catatan dan mandat dikirim ke Gemini atau Copilot sesuai konfigurasi divisi. Aplikasi tidak menyamarkan data otomatis.
- Tidak ada autentikasi pengguna. Secara default server hanya mendengarkan `127.0.0.1`. Jangan membuka akses jaringan/internet atau menggunakannya bersama banyak orang sebelum menambahkan autentikasi, otorisasi, perlindungan data, dan pengamanan hosting.
- Jadwal bukan jaminan layanan 24/7: server harus hidup, dan koneksi database serta penyedia AI yang dipilih harus tersedia.

## Video AI opsional

Video dinonaktifkan secara default. Untuk mengaktifkannya, verifikasi akses `gemini-omni-1.2-flash`, billing dan kuota di Google, lalu tambahkan `VIDEO_ENABLED=true` pada `.env` lokal dan mulai ulang server. Jangan bagikan kunci. Setiap persetujuan paket konten baru kemudian mengantrekan satu video generatif 10 detik, 720p, 9:16, dengan audio. Google menyatakan harga 720p US$0,07 per detik (sekitar US$0,70 untuk 10 detik), belum termasuk biaya lain atau pajak; [periksa harga terbaru](https://aistudio.google.com/docs/pricing) sebelum mengaktifkan. Tidak ada batas biaya harian otomatis.

Paket konten dikirim ke Google dan tidak disamarkan otomatis. Hasil MP4 disimpan di folder lokal `video-storage`; Neon hanya menyimpan antrean dan metadata. Folder tidak disinkronkan antarserver dan harus dicadangkan serta dilindungi. File tidak diunggah atau dipublikasikan otomatis. Periksa video, suara, klaim, hak cipta dan teks sebelum digunakan. Jika server berhenti, hasil gagal, atau permintaan habis waktu, biaya mungkin sudah terjadi; sistem tidak mengulang generasi otomatis. Periksa billing sebelum membuat paket baru. Untuk mematikan video set `VIDEO_ENABLED=false` dan mulai ulang server; tugas yang masih dalam antrean berhenti diproses sampai diaktifkan kembali.

## Persiapan

1. Gunakan Node.js yang didukung oleh Vite 8 (Node.js 20.19+ atau 22.12+).
2. Jalankan `npm install`. `package-lock.json` adalah lockfile npm yang digunakan proyek.
3. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` PostgreSQL/Neon dan `GEMINI_API_KEY`. Jangan mengirimkan kredensial ke chat atau melakukan commit file `.env`. Opsional: atur `GEMINI_MODEL` sesuai model yang tersedia di akun Anda.
4. Jalankan `npm run db:generate` dan `npm run db:migrate`.
5. Jalankan `npm run dev`, lalu buka `http://127.0.0.1:3000`.

Setelah mengubah `.env`, hentikan dan mulai ulang server agar konfigurasi baru digunakan. Jika Gemini mengembalikan 404, periksa `GEMINI_MODEL` dan pilih model yang tersedia untuk proyek Google AI Anda; model pada daftar dapat berubah atau tidak tersedia untuk pembuatan konten. Periksa juga kuota bila menerima 429. Setelah diperbaiki, gunakan **Coba lagi** pada tugas yang gagal di denah.

## Provider AI dan Copilot opsional

Secara default semua divisi tetap memakai Gemini. Copilot SDK tidak memerlukan perubahan database dan hanya digunakan bila divisi dipilih secara eksplisit di konfigurasi server. Konfigurasi ini tidak menghubungkan repository atau alat kerja: semua alat bawaan, MCP dan alat kustom diblokir, dan permintaan izin ditolak. Tidak ada perubahan kode, audit keamanan nyata, atau deployment.

Untuk mengaktifkan Copilot pada divisi tertentu:

1. Pastikan akun/organisasi dan token GitHub memang berhak menggunakan Copilot SDK; lihat [autentikasi resmi](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate). Jangan bagikan token dalam chat atau commit.
2. Pada `.env` isi `COPILOT_GITHUB_TOKEN` secara lokal, `COPILOT_MAX_AI_CREDITS` dengan angka positif, dan `COPILOT_MODEL` dengan ID model yang benar-benar tersedia bagi akun. Batas kredit per sesi bersifat **soft limit**, bukan batas biaya yang pasti.
3. Isi `AI_COPILOT_DIVISIONS`, misalnya `engineer,cyber`. Nilai yang didukung: `paud`, `posyandu`, `creator`, `engineer`, `cyber`. Divisi lain tetap memakai Gemini. Model per divisi dapat ditentukan dengan `COPILOT_MODEL_ENGINEER`, `COPILOT_MODEL_CYBER`, `COPILOT_MODEL_PAUD`, `COPILOT_MODEL_POSYANDU`, atau `COPILOT_MODEL_CREATOR`; bila kosong dipakai `COPILOT_MODEL`.
4. Restart server. Uji menggunakan instruksi sintetis yang tidak sensitif. Provider/model ditampilkan di laporan dan riwayat versi baru. Draf lama tidak memiliki informasi ini.

Jika model, token, runtime, kredit, atau penyedia gagal, tugas ditandai gagal dan bisa dicoba ulang manual; aplikasi tidak diam-diam mengalihkan data atau biaya ke provider lain. Pilihan model berdasarkan divisi, **bukan** penilaian otomatis tingkat kesulitan atau review model kedua. Model, kuota, penggunaan dan biayanya bergantung pada akun GitHub; periksa sebelum mengaktifkan. Sesi Copilot menggunakan direktori sementara terpisah yang dibersihkan setelah runtime berhenti; proses yang berhenti paksa dapat meninggalkan data sesi sementara dan perlu diperiksa operator.

Untuk database baru, migrasi membuat tabel skema lama dan tabel workflow baru. Untuk database lama yang **sudah memiliki** tabel `knowledge_base`, `draft_tasks`, dan enum `DraftStatus` sesuai skema awal proyek, cadangkan database terlebih dahulu, verifikasi kesamaan skema, lalu tandai migrasi awal sebagai sudah diterapkan dengan `npx prisma migrate resolve --applied 20261107000000_existing_schema` sebelum `npm run db:migrate`. Jangan menandai migrasi sebagai diterapkan jika skemanya tidak cocok. Untuk database yang sudah berisi tabel lain atau punya riwayat migrasi berbeda, tinjau dan lakukan baseline bersama administrator database sebelum deploy; jangan gunakan reset atau `db push --force-reset`.

`npm run build` membuat aset frontend; untuk menjalankan server production, set `NODE_ENV=production` dan jalankan `npm start` setelah build. `PORT` dan `HOST` opsional. `HOST` selain loopback tidak aman tanpa proteksi akses tambahan.

## Memasang di HP (PWA)

Aplikasi memiliki menu bawah dan laci navigasi untuk layar kecil. Untuk memasangnya di HP, jalankan versi production di alamat **HTTPS** yang bisa dijangkau HP dan sudah dilindungi autentikasi/otorisasi. Server saat ini hanya mendengarkan loopback dan **belum memiliki autentikasi**; jangan mengeksposnya ke Wi-Fi atau internet begitu saja. `localhost` pada HP adalah HP itu sendiri, bukan komputer server. PWA memerlukan secure context (HTTPS, atau localhost untuk pengujian di perangkat yang sama); akses IP lokal melalui HTTP biasanya tidak dapat dipasang.

- Android: buka alamat HTTPS di Chrome, pilih **Pasang aplikasi** di menu kantor atau pilih opsi instal/tambah ke layar utama di menu browser.
- iPhone: buka alamat HTTPS di Safari, pilih **Bagikan → Tambah ke Layar Utama**.
- Pilihan instalasi dan tampilannya bergantung pada browser dan sistem operasi. Service worker hanya didaftarkan pada build production, bukan `npm run dev`.

PWA membutuhkan jaringan dan server untuk melihat data atau menyimpan perubahan. Jika koneksi terputus saat halaman dibuka, aplikasi menampilkan pemberitahuan; saat dibuka ulang dalam keadaan offline, halaman offline menjelaskan keterbatasannya. Laporan, respons API, dan perubahan belum tersimpan **tidak** disimpan atau disinkronkan secara offline. Simpan pekerjaan saat koneksi tersedia.

## Kantor dan antrean staf

Dashboard menyajikan ringkasan operasional; buka **Denah Isometrik** untuk melihat dunia kantor interaktif dengan 15 staf dalam lima divisi. Di HP, geser denah ke samping atau pilih nama divisi di atas denah untuk menjelajah; pilih staf untuk melihat tugas atau memberi mandat. Karakter mengetik ketika tugas antreannya sedang diproses; antrean dan tugas yang gagal tetap tersimpan di PostgreSQL. Ruangan dan gerakan adalah visualisasi, bukan rekaman kantor fisik. Status diperbarui sekitar setiap 3 detik; proses yang sangat cepat bisa tidak terlihat. Jika koneksi gagal, status menjadi tidak tersedia. Pengaturan reduced motion menghentikan animasi tanpa menyembunyikan status teks.

Tiket baru otomatis diberikan ke staf sesuai produk dan kategori; mandat dan konten juga masuk antrean. Worker hanya berjalan saat server aktif. Bila tugas gagal, periksa penyebab di denah lalu pilih **Coba lagi**. Tugas yang terputus ditandai gagal setelah masa klaim berakhir, bukan otomatis dianggap berhasil. Denah menampilkan semua tugas aktif dan 100 tugas terakhir yang selesai atau gagal; panel staf membatasi 10 tugas terbaru. Revisi AI langsung dan endpoint workflow lama tidak masuk antrean staf dan tidak ditampilkan sebagai aktivitas individu. Status bukan pemantauan WhatsApp, GitHub, keamanan, atau perbaikan di sistem luar.

## Pemeriksaan

- `npm run lint` memeriksa TypeScript.
- `npm test` menjalankan tes workflow.
- `npm run build` membangun frontend.
- `npx prisma validate` memerlukan `DATABASE_URL` yang disetel, meskipun validasi skema tidak terhubung ke database.

## Jadwal konten

Scheduler memeriksa waktu Asia/Jakarta pada setiap awal menit. Mulai pukul 06.00 WIB, ia memasukkan satu tugas konten harian untuk Trendy ke antrean; jika server baru aktif setelahnya, ia mencoba saat startup. Kegagalan menjadwalkan dicatat dan dicoba kembali sekitar 10 menit kemudian. Jika pemrosesan tugas gagal, gunakan **Coba lagi** di denah. ID harian mencegah tugas ganda pada beberapa instance. Hasil tetap menunggu persetujuan. Scheduler tidak mencari tren aktual dan tidak menerbitkan konten.

Topik konten baru dan mandat baru kepada Trendy diteruskan otomatis ke Script-AI lalu Clipper. Hasil dua tahap awal tersimpan sebagai tahap perantara; hanya hasil akhir Clipper menunggu persetujuan. Jika suatu tahap gagal, tugas berikutnya tidak dibuat sampai tahap tersebut berhasil dicoba lagi. Laporan Trendy lama yang telah disetujui dapat diteruskan sekali secara manual dari halaman laporan. Mandat langsung ke Script-AI atau Clipper tetap tugas mandiri. [Panduan workflow](WORKFLOW.md) menjelaskan langkah operasional.
