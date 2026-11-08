# Kantor AI PT Rasyatech Digital Zenith — Executive Command & Multi-Agent Dispatch

Sistem "Kantor AI" mandiri dan interaktif untuk PT Rasyatech Digital Zenith milik Bos Ismanto. Mengelola 3 divisi virtual (Siput PAUD, Siput Posyandu, dan Content Creator) secara terpadu melalui blueprint kantor isometrik interaktif, modul instruksi berbasis Gemini 3.8 Flash, serta sistem persetujuan draf berstandar eksekutif lengkap dengan fitur eksekusi (Copy, Export, Broadcast WhatsApp & Publish Media Sosial).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan preferensi yang telah dikonfirmasi oleh Bos Ismanto pada Phase 1 Clarification:
> - **Mode Interaksi**: Interactive AI Command Center yang didukung langsung oleh server-side engine Gemini (`gemini-3.8-flash`) untuk menganalisis instruksi bos, otomatis mendeteksi divisi serta staf penanggung jawab, dan menyusun draf matang berstandar tinggi.
> - **Gaya Antarmuka**: Interactive Isometric Office Map yang mengintegrasikan blueprint visual asli (`/public/assets/aistudio/divisi_866b3848.webp`) dengan hotspot interaktif per divisi dan staf, dipadukan dengan Executive Desk Bos Ismanto di bagian tengah.
> - **Fitur Aksi Persetujuan**: Dilengkapi tombol aksi persetujuan resmi `[APPROVE & DEPLOY]` dan `[REVISI]`, tombol cepat `Copy to Clipboard`, `Export Draf (.txt / Markdown / JSON)`, serta simulasi pengiriman nyata 1-klik untuk broadcast WhatsApp (PAUD & Posyandu) dan penerbitan klip/skrip ke media sosial (TikTok, Reels, Shorts).

---

## 1. Overview & Core Concept

### What It Does
Aplikasi ini adalah kantor pusat virtual otonom untuk Bos Ismanto selaku pemilik PT Rasyatech Digital Zenith. Setiap kali Bos memberikan mandat atau tugas, sistem secara cerdas:
1. Menentukan divisi yang tepat:
   - **Divisi Siput PAUD (SaaS Pendidikan)**: Arka (Research), Lisa (Copywriter), Dewi (Publisher)
   - **Divisi Siput Posyandu (SaaS Kesehatan)**: Dr. AI (Research), Budi (Guidance), Sari (Outreach)
   - **Divisi Content Creator (Clipper / Drama Pendek)**: Trendy (Trend Hunter), Script-AI (Scriptwriter), Clipper (Social Manager)
2. Menghasilkan draf siap pakai berkualitas tinggi melalui AI reasoning.
3. Menampilkan draf dalam format baku wajib:
   ```text
   ---
   [LAPORAN DRAFT KANTOR AI]
   Divisi: ...
   Staf Penanggung Jawab: ...
   Hasil Draf: ...
   [AKSI BOS: APPROVE / REVISI]
   ---
   ```
4. Memberikan kontrol penuh kepada Bos untuk Approve & Deploy (dengan simulasi pengiriman) atau meminta revisi langsung kepada staf virtual.

### Target Persona
- **Bos Ismanto**: Pemimpin visioner PT Rasyatech Digital Zenith yang membutuhkan sistem kendali cepat, ringkas, dan dapat mengeksekusi operasional SaaS pendidikan, kesehatan desa, serta konten viral tanpa friksi.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **The Executive Arrival**: Bos Ismanto disambut di Executive Floor PT Rasyatech Digital Zenith dengan denah isometrik interaktif yang menampilkan staf aktif di meja kerja masing-masing.
2. **Dispatching Tasks**:
   - Bos mengetik perintah bebas di *Command Box* (misal: *"Tolong siapkan broadcast WA untuk guru PAUD tentang sinkronisasi Dapodik"* atau *"Cari ide drama pendek tentang anak kosan yang relate buat TikTok"*).
   - *Atau* Bos bisa memilih divisi secara langsung di peta isometrik atau klik profil staf virtual (misal klik Dr. AI atau Trendy) untuk memberikan instruksi spesifik.
3. **Draft Production**: AI memproses perintah secara live melalui backend `/api/ai-office/dispatch`. Status staf berubah ke status aktif/bekerja dengan visual indicator interaktif.
4. **Executive Approval Gate**:
   - Laporan draf disajikan dalam format standar PT Rasyatech Digital Zenith.
   - Bos dapat meninjau, mengedit teks langsung, memilih `[APPROVE & DEPLOY]`, atau menekan `[REVISI]` dengan catatan tambahan.
5. **Simulated Deployment**:
   - Saat Approve: Menampilkan modal deployment simulasi (preview pesan WhatsApp blast yang siap kirim, preview postingan medsos dengan tagar dan thumbnail, serta tombol copy & download format lengkap).
   - Arsip tersimpan di log persetujuan (Executive Approval Archive) dengan status `Approved` atau `Revised`.

### Visual Identity & Theme
- **Aesthetic Direction**: Sleek Modern Executive Command Center. Nuansa profesional korporat teknologi dengan perpaduan warna Navy/Slate (`#0F172A`), Teal/Emerald Zenith Accent (`#0D9488` / `#10B981`), dan Warm Gold untuk status Bos Ismanto.
- **Isometric Map Viewport**: Frame interaktif responsif yang menempatkan denah kantor asli dengan zoom/pan, tooltip interaktif tiap staf virtual, serta status aktivitas real-time.
- **Typography**: `Plus Jakarta Sans` untuk tampilan editorial korporat dan navigasi, dipadukan dengan `JetBrains Mono` / monospace tabular untuk format laporan draf dan payload data broadcast.

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Side Gemini 3.8 Flash**:
  - *Pendekatan*: Seluruh prompt engineering dan parsing draf ditangani oleh server Express (`server.ts`) menggunakan `@google/genai` dengan model `gemini-3.8-flash`.
  - *Alasan*: Menjamin keamanan API key, kecepatan respons tinggi, dan output terstruktur dalam format baku PT Rasyatech Digital Zenith.
- **Fallback Cerdas Otomatis**:
  - *Pendekatan*: Jika kunci API sedang tidak tersedia di environment lokal, sistem otomatis menyediakan intelligent heuristic generator untuk kesembilan staf virtual tanpa merusak alur aplikasi.
- **Dual Perspective Interface**:
  - *Mode 1 - Isometric Office Map*: Memvisualisasikan tata letak kantor sesuai gambar blueprint resmi, lengkap dengan zona Divisi PAUD, Posyandu, Content Creator, dan Meja Bos Ismanto.
  - *Mode 2 - Executive Table & Approval Feed*: Tampilan fokus untuk membaca, menyaring, dan mengeksekusi draf laporan secara cepat.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Tailwind)                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: PT Rasyatech Digital Zenith | Bos Ismanto Command       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                       │
│          ┌─────────────────────┴─────────────────────┐                 │
│          ▼                                           ▼                 │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │ Isometric Floor Plan    │               │ Executive Command Bar  │  │
│  │ (Interactive Blueprint, │               │ (Prompt Box, Division  │  │
│  │  Staff Hotspots, Rooms) │               │  Filters, Preset Task) │  │
│  └───────────┬─────────────┘               └───────────┬────────────┘  │
│              │                                         │               │
│              └─────────────────────┬───────────────────┘               │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Executive Approval List (Approval Gate, Draf Editor, Logs)       │  │
│  │ ├─ [APPROVE & DEPLOY] -> WA Dispatcher / Social Post Preview     │  │
│  │ └─ [REVISI]           -> Feedback Loop ke Staf Terkait           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ POST /api/ai-office/dispatch
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND SERVER (server.ts)                      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Express Engine & API Endpoints:                                  │  │
│  │  - POST /api/ai-office/dispatch                                  │  │
│  │  - POST /api/ai-office/revise                                    │  │
│  │  - GET  /api/ai-office/preset-tasks                              │  │
│  └───────────────────┬──────────────────────────────────────────────┘  │
│                      │                                                 │
│                      ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Google GenAI SDK (@google/genai)                                 │  │
│  │ Model: 'gemini-3.8-flash'                                        │  │
│  │ Structured System Instructions for PT Rasyatech Digital Zenith    │  │
│  │ Standard Output Contract & Draft Parser                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Entities
- **Staff**: ID, Name, Division, Role, Avatar/Badge, Focus Areas, Sample Prompts.
- **DraftReport**:
  - `id`: string
  - `division`: "DIVISI SIPUT PAUD" | "DIVISI SIPUT POSYANDU" | "DIVISI CONTENT CREATOR"
  - `assignedStaff`: string (e.g. "Arka (AI Research PAUD)", "Lisa (AI Copywriter)", etc.)
  - `taskPrompt`: string (instruksi asli Bos Ismanto)
  - `rawDraft`: string
  - `formattedReport`: string (sesuai format baku wajib)
  - `status`: "PENDING_APPROVAL" | "APPROVED" | "REVISION_REQUESTED"
  - `revisionNotes`?: string
  - `executionResult`?: { platform: string, status: string, timestamp: string }
  - `createdAt`: string

---

## 5. Execution Steps
1. **Server Setup**: Bangun `server.ts` dengan Express dan middleware Vite, endpoint `/api/ai-office/dispatch` dan `/api/ai-office/revise` terhubung ke GoogleGenAI SDK (`gemini-3.8-flash`).
2. **Metadata & HTML**: Konfigurasi `metadata.json` dan `index.html` dengan judul resmi "PT Rasyatech Digital Zenith - Kantor AI Bos Ismanto".
3. **UI Components**:
   - `OfficeBlueprintView`: Render interaktif denah isometrik kantor (`/public/assets/aistudio/divisi_866b3848.webp`) dengan pin staf yang bisa diklik, status kerja, dan zoom modal.
   - `ExecutiveCommandPanel`: Bar input perintah untuk Bos Ismanto, pemilih divisi, dan tombol tugas kilat (quick-dispatch presets).
   - `ApprovalList`: Kartu draf dengan format wajib `[LAPORAN DRAFT KANTOR AI]`, tombol Approve & Revisi, serta tab riwayat arsip.
   - `DispatchModal`: Modal simulasi pengiriman nyata pesan WhatsApp Blast & posting media sosial (TikTok/IG/YT Shorts) serta copy/export draf.
4. **Verification**: Jalankan lint dan compile untuk memastikan keandalan 100% tanpa error.
