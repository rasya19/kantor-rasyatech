# Panduan Workflow Kantor AI

## Prinsip kerja

**Laporan dahulu → pemeriksaan dan persetujuan pimpinan → tindakan manual → catatan tindak lanjut.** Tidak ada pengiriman pesan, perubahan repository, atau publikasi otomatis. Gunakan hanya data yang telah disamarkan; OpenRouter dan penyedia model menerima teks yang dikirim untuk dibuat atau direvisi menjadi draf. Aplikasi tidak menyamarkan data otomatis.

Menu **Asisten Suara** berperan sebagai manajer baca-saja yang menggunakan snapshot pekerjaan, tiket, draf, pengetahuan produk, prospek, video, transaksi manual, pemakaian AI tercatat, dan sisa limit bulanan key OpenRouter. Limit key berbeda dari saldo kredit akun; `OPENROUTER_API_KEY` biasa hanya membaca limit key. Untuk menampilkan kredit akun, isi opsional `OPENROUTER_MANAGEMENT_KEY` dengan Management API Key—key ini tetap di server dan tidak dikirim ke model. Jika tidak disetel, asisten menyatakan saldo akun tidak tersedia. Snapshot dan percakapan dikirim ke OpenRouter dan dapat menimbulkan biaya; jangan sertakan password atau data sensitif. Isi percakapan tidak disimpan sebagai riwayat, tetapi pemakaian AI dicatat. Mode hands-free memerlukan satu klik **Mulai ngobrol otomatis** untuk izin mikrofon; suara balasan dipilih dari suara browser/perangkat dan suara perempuan hanya tersedia jika disediakan perangkat. Asisten tidak menjalankan tugas atau mengubah data.

## Arah usaha bersama

Tujuan pemilik adalah membangun beberapa sumber penghasilan digital yang realistis, tidak hanya mengandalkan aplikasi: konten yang dapat dimonetisasi, panduan/ebook/template untuk Lynk.id atau kanal lain, tutorial aplikasi untuk YouTube, serta aplikasi Siput PAUD/Posyandu dan produk lain. Semua staf AI menerima arah ini, tetapi tetap mengutamakan mandat divisinya. Untuk sementara, Kreator menguji peluang produk digital non-aplikasi; Riset Produk/Engineer menangani validasi aplikasi untuk tahap jangka menengah. Engineer menilai kelayakan dan rencana teknis; Cyber menjaga privasi/keamanan; staf PAUD/Posyandu mendukung layanan dan operasional produk yang sudah diverifikasi. Setiap staf menyebut langkah manusia berikutnya dan bukti/asumsi penting bila relevan. Prioritaskan eksperimen murah dan cepat; jangan mengarang permintaan atau menjanjikan penghasilan. Penawaran, publikasi, perubahan produk, dan transaksi tetap dilakukan manusia setelah pemeriksaan.

## Manajer dan tanggung jawab operasional

**Manajer Keuangan & Pelaporan · Delegasi Tepercaya Pimpinan** menerima mandat melalui denah dan membuat satu draf berisi rekap harian, mingguan (Senin–Minggu), dan bulanan dari transaksi serta pemakaian AI yang tersimpan. Perhitungan dilakukan lokal dari database; data transaksi tidak dikirim ke model. Pemasukan aktual, estimasi, pengeluaran, biaya AI terukur, biaya AI tanpa harga, dan data pemakaian tidak lengkap dipisahkan. Saldo bank/e-wallet, transaksi belum dicatat, pembayaran Lynk.id/QRIS, dan biaya luar yang belum dimasukkan tidak tersedia. Manajer ini tidak menambah atau mengubah transaksi; pimpinan tetap mencatat dan memeriksa sumber angka.

**Manajer Pemasaran & Distribusi Digital · Delegasi Tepercaya Pimpinan** memakai Gemini 2.5 Flash melalui OpenRouter secara default untuk menyiapkan draf listing, caption per kanal, hashtag, dan checklist distribusi dari fakta produk yang disediakan. Harga, fitur, tautan, testimoni, hasil, tren, dan angka penjualan yang belum diverifikasi harus ditandai sebagai perlu konfirmasi, bukan dikarang. Setelah laporan disetujui, laporan otomatis diteruskan ke antrean divisi Content Creator: Trendy → Script-AI → Clipper. Status dan kegagalan tiap tahap terlihat pada laporan; tahap yang gagal bisa dicoba lagi. Laporan lama yang sudah disetujui dapat diteruskan lewat tombol **Teruskan ke Content Creator**, termasuk jika tautan ke job sumbernya hilang—dalam kasus itu Creator hanya boleh memakai isi laporan yang disetujui. Hasil akhir tetap draf untuk persetujuan. Handoff ini tidak memublikasikan konten, membuat video, mengaktifkan tautan, membalas calon pelanggan, atau memproses pembayaran. Semua pelaksanaan dan pencatatan hasil tetap manual. Tidak ada jaminan pendapatan.

## 1. Layanan klien Siput PAUD dan Posyandu

1. Admin menerima keluhan, bug, atau pertanyaan lewat WhatsApp Business.
2. Buka **Layanan Klien**, pilih produk dan kategori, lalu masukkan judul dan kronologi yang sudah disamarkan. Cantumkan langkah reproduksi, hasil yang diharapkan, dan pesan error yang relevan tanpa data pribadi atau rahasia.
3. Simpan laporan. Tiket dan tugas staf tersimpan bersama; laporan yang disamarkan otomatis masuk antrean dan dikirim ke provider AI yang dipilih saat diproses. Jika informasi belum cukup, ubah status menjadi **Menunggu** dan catat informasi yang perlu diminta.
4. Buka **Denah** untuk melihat staf dan status tugas. Bila gagal, baca penyebab dan pilih **Coba lagi**. AI mengusulkan ringkasan, langkah investigasi, dan draf jawaban; ini bukan bukti bug sudah diperiksa. Untuk laporan tambahan setelah memperbarui catatan, gunakan tombol **Antrekan laporan tambahan**.
5. Di **Daftar Persetujuan**, pimpinan memeriksa isi, mengedit atau meminta revisi, lalu menyetujui. Riwayat versi tersedia pada laporan.
6. Setelah disetujui, admin berkoordinasi dengan pengembang, menguji solusi, dan mengirim jawaban melalui WhatsApp Business secara manual. Catat tindak lanjut dan ubah status tiket sesuai kenyataan.

Repository rujukan yang diberikan pemilik: [Siput PAUD](https://github.com/rasya19/siputv1) dan [Siput Posyandu](https://github.com/rasya19/Posyandu). Aplikasi kantor belum mempunyai integrasi repository atau akses kode; inspeksi dan perubahan dilakukan terpisah setelah arahan dan persetujuan.

## 2. Konten kreator

Trendy menyusun ide, Script-AI menyusun hook dan naskah video 9:16, dan Clipper menyiapkan caption, tagar, dan usulan distribusi. Pilih **Konten Kreator** untuk memberi topik. Jadwal harian lama diganti dengan draf strategi konten dari riset mingguan.

Mandat ke Trendy memulai alur **Trendy → Script-AI → Clipper**. Hasil Trendy otomatis diberikan ke Script-AI; naskahnya otomatis diberikan ke Clipper. Dua hasil awal tersimpan sebagai tahap perantara dan tidak memerlukan persetujuan. Hanya hasil akhir Clipper masuk daftar persetujuan Bos. Semua hasil tahap dikirim ke provider AI yang dikonfigurasi untuk tugas berikutnya, jadi jangan masukkan data pribadi atau rahasia.

Persetujuan laporan riset produk digital non-aplikasi tidak otomatis memilih ide atau membuat produk. Pada laporan yang disetujui, pilih satu atau beberapa ide secara terpisah; setiap pilihan membuat satu tugas Script-AI untuk menghasilkan MVP dan listing yang khusus mengikuti ide tersebut. Laporan lama tanpa format ide terstruktur menyediakan pilihan dengan menyalin bagian ide dari laporan. Draf produk dapat diunduh sebagai PDF. Setelah setiap produk disetujui, alur promosi berjalan Trendy → Script-AI → Clipper dan hasil akhirnya menunggu persetujuan terpisah. Untuk paket konten pemasaran yang memuat beberapa bagian bernomor Video, pilih video mana yang dibuat di bagian **Video AI**; tiap percobaan hanya memakai naskah dan visual dari ide pilihan, satu video pada satu waktu. Paket lama tanpa bagian bernomor tetap muncul sebagai satu pilihan. Pembuatan video berbayar tidak otomatis berjalan saat paket disetujui. Tanpa tautan/cara pemesanan resmi, ajakan membeli atau link di bio harus ditandai perlu konfirmasi. Sistem tidak mengirim penawaran, memproses pembayaran, mengunggah produk, atau memublikasikan.

Di **Peluang & Keuangan**, setelah pukul 06.00 WIB server menyiapkan satu tugas riset produk digital harian dalam status menunggu pilihan. Fokus tema berganti di antara kebutuhan UMKM, kreator, pekerja, pencari kerja, pendidikan, rumah tangga, dan komunitas. Riset membandingkan konsep dari kelompok pengguna/kategori berbeda; guru atau prompt bukan fokus tetap. Tugas tidak memanggil AI dan tidak berbiaya sampai pimpinan menekan **Mulai riset ini**; setiap permintaan AI tetap tunduk pada limit OpenRouter dan dapat menimbulkan biaya. Setujui laporan riset, lalu pilih ide satu per satu untuk membuat MVP terpisah; persetujuan produk memulai draf pemasaran. Setelah draf pemasaran disetujui, video dapat diminta secara terpisah dan berbayar jika kontrol admin aktif. Unggah Lynk.id, komunikasi pelanggan, dan publikasi tetap manual.

**Ruang Pimpinan** menyajikan laporan harian, mingguan (Senin–Minggu), dan bulanan berdasarkan WIB, dari transaksi, pemakaian OpenRouter, tugas, dan draf yang tersimpan. Biaya AI untuk tahapan produk digital baru diatribusikan ke produk; pemakaian historis/tidak terkait produk diberi label belum teratribusikan. Lynk.id belum terhubung, sehingga pemasukan nyata harus dicatat setelah pembayaran diterima. VPS, domain, dan biaya layanan luar juga perlu dicatat manual. Selisih yang tampil bukan laporan akuntansi lengkap dan dapat belum mencakup transaksi yang belum dicatat.

Persetujuan mandat PAUD/Posyandu tidak otomatis memulai divisi lain. Untuk mandat yang memang meminta konten, pemilik dapat memulai satu tugas Creator dari draf yang disetujui. Tugas itu hanya boleh berjalan setelah pemilik mengisi fitur produk yang sudah diverifikasi; isi draf AI sebelumnya adalah konteks, bukan bukti. Hasilnya tetap draf untuk ditinjau, tidak dikirim ke klien atau dipublikasikan. Jangan masukkan data pribadi atau rahasia.

Paket baru harus memuat Judul Tren, Konsep, Hook 3 Detik, Naskah Narasi, Caption (termasuk tagar), Target Platform, Tata Letak Visual, serta Hal yang Perlu Diverifikasi. Instruksi paket menghindari Script to Video, aset/fitur Pro, dan mendorong perakitan manual dengan opsi dasar, rekaman sendiri, teks, dan voiceover. Pembuatan video Gemini Omni dan publikasi masih nonaktif; batas biaya video yang ditetapkan untuk uji coba adalah Rp0. JSON yang diunduh adalah panduan edit, bukan file proyek CapCut. Pemeriksaan otomatis hanya memastikan bagian terisi dan target menyebut TikTok, Reels, atau Shorts; pemeriksaan ini tidak menjamin kualitas, kebenaran, tagar, atau kecocokan visual. Bila respons AI tidak lengkap, tugas gagal dan dapat dicoba lagi. Pertahankan judul bagian tersebut ketika mengedit atau meminta revisi.

Tugas diproses hanya ketika server hidup. Kegagalan menghentikan alur pada staf terkait; periksa pesan di denah dan pilih **Coba lagi**. Untuk laporan Trendy lama yang sudah disetujui, buka laporan dan pilih **Teruskan laporan Trendy lama** jika tombol tersedia. Satu laporan lama hanya dapat diteruskan sekali; laporan yang sudah berasal dari alur baru atau dibuat staf lain tidak dapat diteruskan melalui tombol tersebut.

Pimpinan memeriksa fakta produk, kualitas naskah, hak cipta dan izin penggunaan aset, serta kesesuaian platform, lalu memilih **Setujui** atau memberi arahan dan memilih **Revisi**. Pembuatan video AI baru dinonaktifkan karena batas biaya saat ini Rp0; persetujuan tidak mengantrekan video.

Periksa video lama di **Siap Publikasi** dan tinjau sebelum publikasi manual. Aplikasi tidak mengunggah video atau mencatat apakah telah diterbitkan. File disimpan di `video-storage` pada server yang membuatnya, bukan di Neon; cadangkan dan lindungi folder tersebut. Paket yang sudah memiliki tugas video tidak dapat diedit atau direvisi: buat paket baru untuk perubahan. Catat metrik di sistem Anda; aplikasi belum mengukur metrik atau menjamin penghasilan.

## 3. Web App Engineer

Di **Denah & Operasional**, pilih staf Web App Engineer lalu berikan mandat. Dev-Ops, Code-AI, Architect, Riset Produk, atau QA Produk menyiapkan usulan arsitektur, database, riset, atau rencana teknis untuk ditinjau. Minta contoh kode secara eksplisit bila memang diperlukan. Aplikasi tidak membaca repository atau menjalankan perubahan, migrasi, maupun deployment dari mandat.

Di **Peluang & Keuangan**, riset peluang produk digital non-aplikasi ditugaskan kepada Strategi Konten di divisi Kreator dan memakai konfigurasi model Kreator (DeepSeek Chat sebagai default, dengan fallback yang berlaku). Riset mengeksplorasi kebutuhan berbagai kelompok dan kategori produk; harga hanya boleh disebut dengan bukti atau sebagai hipotesis uji yang jelas. Tugas memakai pencarian web eksternal, mencari bukti permintaan/pesaing, serta memerlukan sedikitnya tiga sumber web sebelum menyimpan draf. Setiap klaim spesifik tentang pasar, harga, statistik, komisi, biaya, dan aturan platform harus didukung sumber relevan dan tanggal tepat di dekat klaim; angka tanpa bukti tidak boleh disajikan sebagai benchmark. Setelah laporan disetujui, pemilik memilih konsep satu per satu; tiap pilihan mengantrekan satu MVP tersendiri yang dapat diunduh sebagai PDF. Persetujuan tiap produk memulai alur materi promosi melalui Trendy, Script-AI, dan Clipper. Video hanya dapat diminta dari paket promosi yang disetujui melalui aksi berbayar tersendiri. Integrasi upload akun media sosial belum tersedia; perlu OAuth/API platform dan persetujuan untuk tiap publikasi. Upload produk Lynk.id belum tersedia karena API seller publik belum terverifikasi; gunakan PDF untuk unggah manual. Riset aplikasi PAUD/Posyandu serta ScanBite, Konter +62, dan Lorisan Warung tetap di Riset Produk/Engineer untuk tahap jangka menengah.

Siklus mingguan yang terpisah masih mengantrekan riset untuk ScanBite, Konter +62, dan Manajemen Lorisan Warung tiap Senin setelah 06.00 WIB; jika server baru aktif kemudian, siklus minggu berjalan dijadwalkan saat startup. Setelah riset berhasil, Engineer menyiapkan satu backlog/QA per proyek, Cyber Security menyiapkan satu checklist defensif per proyek, Kreator membuat materi validasi pasar per proyek, dan PAUD/Posyandu menyiapkan checklist operasional administratif siput.id/SIP Posyandu. Totalnya 11 tugas AI lanjutan di lima divisi. Ini draf rencana untuk sprint 7 hari, bukan jaminan proyek, pelanggan, atau pendapatan, serta bukan bukti kode telah dibaca/diubah/diuji. Semua draf menunggu persetujuan. Pemilik tetap harus memeriksa sumber, kemampuan produk, biaya dan kapasitas, menghubungi calon pelanggan secara manual, dan mencatat hanya transaksi nyata.

Laporan AI memakai tanggal referensi WIB saat ini. Tugas lanjutan menerima daftar sumber riset yang tersedia; jika sumber atau tanggal publikasinya tidak mendukung kebaruan klaim, hasil harus menyebut bahwa informasi belum terverifikasi. Tanggal yang ditulis AI bukan bukti riset terkini.

Riset menggunakan OpenRouter web search. Setiap siklus memakai satu permintaan pencarian dan hingga 11 permintaan AI lanjutan, yang dapat ditagih bahkan jika gagal. Atur limit kunci di OpenRouter seperti dijelaskan di README; pemeriksaan lokal bukan jaminan batas total tagihan. Lihat README untuk cara menonaktifkan jadwal dan keterbatasan antrean. Periksa sumber, tanggal, fitur produk, harga dan hak penggunaan sebelum menyetujui. Untuk menjaga hubungan antara teks dan sumber, laporan riset tidak dapat diedit atau direvisi; buat riset baru jika diperlukan. Tugas gagal tidak diulang otomatis; periksa tagihan dan gunakan **Coba lagi**.

Pada menu yang sama, catat pemasukan dan pengeluaran sebenarnya per produk/kategori dalam rupiah bulat; produk digital saat ini diringkas bersama sebagai **Produk digital (portofolio)** dan aplikasi baru dikelompokkan di **Aplikasi lain**. Ringkasan adalah seluruh transaksi yang dicatat, dikurangi transaksi yang dibatalkan. Jika salah, batalkan dan masukkan ulang; catatan lama tetap terlihat. Database yang dikonfigurasi menyimpan transaksi, termasuk pada Neon bila dipakai. Jangan cantumkan nama pelanggan, nomor rekening atau data pribadi. Ini bukan pembukuan lengkap, laporan laba-rugi, rekonsiliasi bank, atau bukti transaksi. Tidak ada penjualan, komunikasi pelanggan, publikasi, atau pembayaran otomatis.

## 4. Cyber Security

Sentinel menyiapkan usulan pemantauan, Guard-AI menyiapkan rekomendasi perlindungan data dan mitigasi, dan Audit menyiapkan rencana peninjauan log serta daftar bukti yang dibutuhkan. Dari **Denah & Operasional**, pilih staf Cyber Security dan berikan mandat tanpa kredensial, data pribadi, atau log mentah sensitif, lalu tinjau dan setujui laporannya sebelum tindakan manual.

Saat ini divisi belum terhubung ke log database, sistem monitoring, pemindai keamanan, atau produk lain. Draf AI bukan hasil audit, bukti kerentanan, pemantauan 24/7, atau mitigasi yang telah diterapkan. Akses dan integrasi nyata perlu dirancang serta disetujui secara terpisah.

## 5. Pengetahuan produk dan pengecekan

Pernyataan pemilik mengenai Siput PAUD meliputi sinkronisasi Dapodik 1-klik, rekap presensi otomatis, manajemen SPP, dan pendaftaran PSE Komdigi. Sebelum digunakan dalam jawaban atau pemasaran, periksa kebenaran, status saat ini, serta lingkup fitur pada sumber resmi. Jangan menyimpulkan bahwa fitur serupa ada pada produk lain. Untuk Posyandu, verifikasi alur pencatatan KIA, grafik dan pelaporan pada produk yang sebenarnya; AI tidak boleh membuat diagnosis medis.

## 6. Peran dan status

| Peran | Tanggung jawab |
|---|---|
| Admin | Mencatat laporan, menyamarkan data, dan memperbarui status serta tindak lanjut. |
| Staf AI | Menyiapkan draf laporan dan usulan, bukan bertindak di sistem eksternal. |
| Pimpinan | Memeriksa dan menyetujui atau meminta revisi sebelum tindak lanjut. |
| Pengembang/operator | Menyelidiki, mengubah, menguji, mengirim, atau mempublikasikan secara manual sesuai kewenangan. |

Status tiket: **Baru**, **Sedang ditangani**, **Menunggu**, dan **Selesai**. Status draf: **Tahap perantara**, **Menunggu persetujuan**, atau **Disetujui**. Persetujuan draf tidak otomatis menyelesaikan tiket.

Penugasan tiket otomatis: PAUD bug ke Arka, pertanyaan ke Lisa, keluhan ke Dewi; Posyandu bug ke Dr. AI, pertanyaan ke Budi, keluhan ke Sari. Mandat dapat diberikan ke staf mana pun melalui denah. Avatar 3D bergaya manusia memiliki penampilan beragam, kedipan, arah pandang, gestur mengetik/presentasi, dan dialog dekoratif berjadwal; dialog bukan percakapan AI aktual. Animasi menandakan tugas antrean yang benar-benar sedang diproses, bukan aktivitas di sistem luar. Revisi AI langsung belum ditugaskan ke staf individu, sehingga tidak menggerakkan avatar.

OpenRouter adalah gateway untuk semua draf baru dan riset. Operator dapat memilih model per divisi sebagaimana dijelaskan di [README](README.md). Laporan baru mencatat provider/model; kegagalan tidak memicu perpindahan otomatis ke provider lain. AI belum membaca repository dan tidak menjalankan alat atau tindakan eksternal.

Mandat Engineer dari Market Research yang meminta konten akan mengantrekan alur Trendy → Script-AI → Clipper setelah disetujui. Mandat lama yang sudah disetujui perlu diteruskan manual dari draf yang memenuhi syarat; hasilnya tetap draf untuk ditinjau, bukan publikasi otomatis.

## Menghapus draf uji

Buka **Laporan dan draf**, pilih item yang ingin dihapus, lalu tekan **Hapus draf** pada kartu atau detailnya dan konfirmasi. Penghapusan permanen mencakup riwayat versi serta tugas/alur turunan yang terkait. Server menolak penghapusan jika masih ada tugas antre/berjalan, keterkaitan tiket, atau artefak video; data tersebut harus ditangani lewat alurnya masing-masing. Tidak ada aksi reset seluruh riwayat.

## Menjalankan tugas sprint satu per satu

Setelah riset sprint utama selesai, tugas spesialis ditahan dalam status **Menunggu pilihan**. Pada **Peluang & Keuangan → Antrean siklus mingguan**, pilih **Jalankan tugas ini saja** pada satu tugas. Tugas berikutnya baru dapat dipilih setelah tugas aktif selesai atau gagal; server juga menahan sisa antrean agar tidak berjalan otomatis. Tugas yang gagal dapat dicoba lagi (berpotensi berbiaya) atau disisihkan; riwayat tugas yang disisihkan tetap tersimpan di database. Saat server pertama kali memakai alur manual ini, tugas sprint lama yang masih antre otomatis ditahan.
