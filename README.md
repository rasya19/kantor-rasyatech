# Kantor AI Rasyatech

Kantor AI membantu admin mencatat laporan klien, menyusun laporan untuk pimpinan, dan menyiapkan ide konten. Baca [Panduan Workflow](WORKFLOW.md) untuk peran dan langkah operasional.

## Batasan penting

- Menu **Peluang & Keuangan** menyediakan riset produk menggunakan OpenRouter web search, alur mingguan lintas divisi, dan catatan transaksi manual. Token dan pencarian web dapat dikenakan biaya bahkan jika permintaan gagal. Hasil dan sumber harus diverifikasi, dan tidak ada penghasilan yang dijamin.
- Catatan transaksi disimpan dalam database yang dikonfigurasi (termasuk Neon jika digunakan), bukan dikirim ke AI. Jangan memasukkan informasi pribadi atau rahasia. Ringkasan hanya menghitung pemasukan dikurangi pengeluaran yang dicatat, bukan akuntansi lengkap, bukti pembayaran, atau rekonsiliasi bank. Transaksi yang salah dapat dibatalkan dan dicatat ulang; riwayat pembatalan tetap tersimpan.
- Aplikasi **tidak terhubung ke WhatsApp Business atau GitHub** dan tidak memperbaiki bug, mengirim pesan, menjalankan query, atau mempublikasikan konten. Persetujuan berarti siap untuk tindak lanjut manual, bukan bukti tindakan telah terjadi.
- Selain riset web pada menu **Peluang & Keuangan**, integrasi AI tidak mengakses web, repository, data aplikasi, atau shell. Semua fakta, fitur, naskah, saran teknis, dan klaim produk harus diverifikasi manusia.
- Divisi Cyber Security hanya menyusun usulan dari informasi yang diberikan. Belum ada koneksi ke audit log, pemantauan keamanan, atau pemindai kerentanan; draf bukan bukti audit atau mitigasi telah dilakukan.
- Jangan masukkan nama, nomor telepon, token, kata sandi, data anak, data kesehatan, atau data pribadi lainnya. Teks laporan, catatan dan mandat dikirim ke OpenRouter dan penyedia model atau pencarian yang dipilih. Aplikasi tidak menyamarkan data otomatis.
- Tidak ada autentikasi pengguna. Secara default server hanya mendengarkan `127.0.0.1`. Jangan membuka akses jaringan/internet atau menggunakannya bersama banyak orang sebelum menambahkan autentikasi, otorisasi, perlindungan data, dan pengamanan hosting.
- Jadwal bukan jaminan layanan 24/7: server harus hidup, dan koneksi database serta penyedia AI yang dipilih harus tersedia.

## Video AI

Pembuatan video baru dinonaktifkan selama migrasi ke OpenRouter, termasuk jika `VIDEO_ENABLED=true`. Persetujuan tidak mengantrekan video. Durasi dinamis dan batas US$0,10 per video belum diterapkan. Video lama tetap tersimpan di folder lokal `video-storage`, bukan di Neon; cadangkan dan lindungi folder tersebut. Publikasi tetap manual.

## Persiapan

1. Gunakan Node.js yang didukung oleh Vite 8 (Node.js 20.19+ atau 22.12+).
2. Jalankan `npm install`. `package-lock.json` adalah lockfile npm yang digunakan proyek.
3. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` PostgreSQL/Neon dan `OPENROUTER_API_KEY`. Jangan mengirimkan kredensial ke chat atau melakukan commit file `.env`. Atur limit kunci OpenRouter maksimal US$5 dan reset bulanan di dashboard OpenRouter.
4. Jalankan `npm run db:generate` dan `npm run db:migrate`.
5. Jalankan `npm run dev`, lalu buka `http://127.0.0.1:3000`.

Setelah mengubah `.env`, hentikan dan mulai ulang server agar konfigurasi baru digunakan. Jika menerima 402 atau 429, periksa saldo, batas dan kuota OpenRouter serta biaya sebelum mencoba ulang. Setelah diperbaiki, gunakan **Coba lagi** pada tugas yang gagal di denah.

## Provider AI dan batas biaya

Semua draf baru dan riset aktif menggunakan OpenRouter. Default `OPENROUTER_MODEL` adalah `google/gemini-2.5-flash`; opsional atur `OPENROUTER_MODEL_ENGINEER`, `OPENROUTER_MODEL_CYBER`, `OPENROUTER_MODEL_PAUD`, `OPENROUTER_MODEL_POSYANDU`, atau `OPENROUTER_MODEL_CREATOR`. `OPENROUTER_BASE_URL`, jika diisi, harus `https://openrouter.ai/api/v1`. Metadata provider lama tetap ditampilkan untuk draf historis.

Sebelum setiap permintaan AI, aplikasi memeriksa bahwa limit kunci maksimal US$5, reset bulanan, dan masih tersedia. Pemeriksaan ini tidak memasang limit di OpenRouter; operator harus mengaturnya sendiri. Ini juga bukan jaminan batas total tagihan: permintaan paralel, keterlambatan pencatatan, biaya lain, atau kunci lain dapat memengaruhi total. Periksa harga model dan biaya pencarian web serta penggunaan akun sebelum mencoba lagi.

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

Jadwal harian konten lama diganti dengan siklus peluang mingguan. Mulai Senin pukul 06.00 WIB, atau saat server pertama kali aktif setelahnya dalam minggu yang sama, scheduler mengantrekan satu riset peluang aplikasi di Indonesia menggunakan OpenRouter web search. Tidak ada pengejaran minggu-minggu yang terlewat. Setelah riset berhasil, satu tugas draf masing-masing dibuat untuk divisi PAUD, Posyandu, engineer, konten dan cyber; semua hasil menunggu persetujuan. ID tugas mencegah siklus ganda. Tugas yang gagal ditampilkan di menu Peluang & Keuangan dan dicoba ulang hanya atas permintaan; percobaan ulang dapat berbiaya. Server, database dan provider harus tersedia.

Satu siklus menggunakan satu permintaan pencarian dan maksimal lima permintaan AI lanjutan; kegagalan pun dapat ditagih. Periksa harga model, biaya pencarian web, limit dan billing OpenRouter sebelum menjalankan server. Untuk menghentikan penjadwalan siklus baru, atur `OPPORTUNITY_SCHEDULE_ENABLED=false` di `.env` dan mulai ulang server; tugas yang sudah masuk antrean tetap akan diproses. Matikan server bila perlu menghentikan pemrosesan antrean. Hasil draf bukan bukti penjualan, pengujian, perubahan kode, audit, publikasi, atau pendapatan.

Topik konten baru dan mandat baru kepada Trendy diteruskan otomatis ke Script-AI lalu Clipper. Hasil dua tahap awal tersimpan sebagai tahap perantara; hanya hasil akhir Clipper menunggu persetujuan. Jika suatu tahap gagal, tugas berikutnya tidak dibuat sampai tahap tersebut berhasil dicoba lagi. Laporan Trendy lama yang telah disetujui dapat diteruskan sekali secara manual dari halaman laporan. Mandat langsung ke Script-AI atau Clipper tetap tugas mandiri. [Panduan workflow](WORKFLOW.md) menjelaskan langkah operasional.
