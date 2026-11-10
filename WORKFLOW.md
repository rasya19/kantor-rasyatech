# Panduan Workflow Kantor AI

## Prinsip kerja

**Laporan dahulu → pemeriksaan dan persetujuan pimpinan → tindakan manual → catatan tindak lanjut.** Tidak ada pengiriman pesan, perubahan repository, atau publikasi otomatis. Gunakan hanya data yang telah disamarkan; OpenRouter dan penyedia model menerima teks yang dikirim untuk dibuat atau direvisi menjadi draf. Aplikasi tidak menyamarkan data otomatis.

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

Paket baru harus memuat Judul Tren, Konsep, Hook 3 Detik, Naskah Narasi, Caption (termasuk tagar), Target Platform, Tata Letak Visual, serta Hal yang Perlu Diverifikasi. Pemeriksaan otomatis hanya memastikan bagian terisi dan target menyebut TikTok, Reels, atau Shorts; pemeriksaan ini tidak menjamin kualitas, kebenaran, tagar, atau kecocokan visual. Bila respons AI tidak lengkap, tugas gagal dan dapat dicoba lagi. Pertahankan judul bagian tersebut ketika mengedit atau meminta revisi.

Tugas diproses hanya ketika server hidup. Kegagalan menghentikan alur pada staf terkait; periksa pesan di denah dan pilih **Coba lagi**. Untuk laporan Trendy lama yang sudah disetujui, buka laporan dan pilih **Teruskan laporan Trendy lama** jika tombol tersedia. Satu laporan lama hanya dapat diteruskan sekali; laporan yang sudah berasal dari alur baru atau dibuat staf lain tidak dapat diteruskan melalui tombol tersebut.

Pimpinan memeriksa fakta produk, kualitas naskah, hak cipta dan izin penggunaan aset, serta kesesuaian platform, lalu memilih **Setujui** atau memberi arahan dan memilih **Revisi**. Pembuatan video baru dinonaktifkan selama migrasi; persetujuan tidak mengantrekan video.

Periksa video lama di **Siap Publikasi** dan tinjau sebelum publikasi manual. Aplikasi tidak mengunggah video atau mencatat apakah telah diterbitkan. File disimpan di `video-storage` pada server yang membuatnya, bukan di Neon; cadangkan dan lindungi folder tersebut. Paket yang sudah memiliki tugas video tidak dapat diedit atau direvisi: buat paket baru untuk perubahan. Catat metrik di sistem Anda; aplikasi belum mengukur metrik atau menjamin penghasilan.

## 3. Web App Engineer

Di **Ruang Web Engineer**, tuliskan tujuan dan batasan untuk Dev-Ops, Code-AI, dan Architect. Mereka menyiapkan usulan arsitektur, database atau rencana teknis untuk ditinjau. Minta contoh kode secara eksplisit bila memang diperlukan. Aplikasi tidak membaca repository atau menjalankan perubahan, migrasi, maupun deployment dari mandat.

Di **Peluang & Keuangan**, riset manual tersedia untuk Siput PAUD, Siput Posyandu, dan peluang aplikasi baru. Riset manual tidak memulai alur lima divisi. Siklus mingguan secara otomatis mengantrekan riset peluang aplikasi baru tiap Senin setelah 06.00 WIB; jika server baru aktif kemudian, siklus minggu berjalan dijadwalkan saat startup. Setelah riset berhasil, divisi PAUD dan Posyandu menyiapkan strategi penjualan dan onboarding produk masing-masing; QA Produk menyusun rencana produk dan pengujian ide baru; Strategi Konten menyiapkan paket pemasaran ide itu; Guard-AI menyusun rencana perlindungan. Semua berupa draf dan menunggu persetujuan. Draf turunan memiliki tautan ke riset dan sumbernya; periksa semua klaim karena tidak semua draf turunan bersumber langsung.

Riset menggunakan OpenRouter web search. Setiap siklus memakai satu permintaan pencarian dan hingga lima permintaan AI lanjutan, yang dapat ditagih bahkan jika gagal. Atur limit kunci di OpenRouter seperti dijelaskan di README; pemeriksaan lokal bukan jaminan batas total tagihan. Lihat README untuk cara menonaktifkan jadwal dan keterbatasan antrean. Periksa sumber, tanggal, fitur produk, harga dan hak penggunaan sebelum menyetujui. Untuk menjaga hubungan antara teks dan sumber, laporan riset tidak dapat diedit atau direvisi; buat riset baru jika diperlukan. Tugas gagal tidak diulang otomatis; periksa tagihan dan gunakan **Coba lagi**.

Pada menu yang sama, catat pemasukan dan pengeluaran sebenarnya per produk dalam rupiah bulat; aplikasi baru dikelompokkan di **Aplikasi lain**. Ringkasan adalah seluruh transaksi yang dicatat, dikurangi transaksi yang dibatalkan. Jika salah, batalkan dan masukkan ulang; catatan lama tetap terlihat. Database yang dikonfigurasi menyimpan transaksi, termasuk pada Neon bila dipakai. Jangan cantumkan nama pelanggan, nomor rekening atau data pribadi. Ini bukan pembukuan lengkap, laporan laba-rugi, rekonsiliasi bank, atau bukti transaksi. Tidak ada penjualan, komunikasi pelanggan, publikasi, atau pembayaran otomatis.

## 4. Cyber Security

Sentinel menyiapkan usulan pemantauan, Guard-AI menyiapkan rekomendasi perlindungan data dan mitigasi, dan Audit menyiapkan rencana peninjauan log serta daftar bukti yang dibutuhkan. Buka **Cyber Security**, berikan mandat tanpa kredensial, data pribadi, atau log mentah sensitif, lalu tinjau dan setujui laporannya sebelum tindakan manual.

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

Penugasan tiket otomatis: PAUD bug ke Arka, pertanyaan ke Lisa, keluhan ke Dewi; Posyandu bug ke Dr. AI, pertanyaan ke Budi, keluhan ke Sari. Mandat dapat diberikan ke staf mana pun melalui denah. Animasi menandakan tugas antrean yang benar-benar sedang diproses, bukan aktivitas di sistem luar. Revisi AI langsung belum ditugaskan ke staf individu, sehingga tidak menggerakkan avatar.

OpenRouter adalah gateway untuk semua draf baru dan riset. Operator dapat memilih model per divisi sebagaimana dijelaskan di [README](README.md). Laporan baru mencatat provider/model; kegagalan tidak memicu perpindahan otomatis ke provider lain. AI belum membaca repository dan tidak menjalankan alat atau tindakan eksternal.
