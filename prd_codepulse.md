# Product Requirements Document (PRD)

**Nama Produk:** CodePulse (Developer Project Monitoring & Deployment Hub)

**Versi:** 1.0 (MVP)

**Status:** Draft Perencanaan

## 1. Ringkasan Eksekutif & Latar Belakang

Mahasiswa IT sering mengalami kendala saat mengerjakan proyek pengembangan perangkat lunak secara berkelompok, antara lain:

* Pembagian tugas yang tidak sinkron dengan progres kode.

* Terjadinya konflik kode (*merge conflict*) akibat anggota tim langsung melakukan `git push` ke *branch* utama (`main`).

* Kesulitan memantau kontribusi kerja tim secara *real-time*.

* Proses *deployment* aplikasi yang rumit bagi pemula.

**CodePulse** adalah platform manajemen proyek berbasis web yang mengintegrasikan papan Kanban, kontrol akses *repository* GitHub (*Gatekeeper*), pemantauan layar langsung (*Live Screen Monitor*), dan *one-click deployment* ke Vercel dalam satu ekosistem terpadu tanpa memerlukan instalasi perangkat lunak tambahan di sisi klien.

## 2. Target Pengguna (*User Personas*)

* **Project Leader (Ketua Tim / Dosen Pembimbing / Asisten):** Bertanggung jawab membuat proyek, membagi *task*, me-review perubahan kode sebelum masuk ke *branch* produksi, memantau layar kerja anggota secara langsung, dan memicu *deployment* ke Vercel.

* **Team Member (Anggota / Developer):** Bertanggung jawab mengerjakan *task* pada papan Kanban, menulis kode di IDE masing-masing (seperti Antigravity/VS Code), melakukan `git push` ke *branch* fitur, dan membagikan layar kerja saat sesi kolaborasi berlangsung.

## 3. Fitur Utama & Spesifikasi Fungsional

| Kode | Nama Fitur | Deskripsi Fungsional | Aktor | 
| ----- | ----- | ----- | ----- | 
| **F-01** | **Autentikasi & Integrasi OAuth** | Pengguna dapat login menggunakan akun GitHub (via GitHub OAuth) dan menautkan akun Vercel mereka (via Vercel OAuth) untuk mendapatkan hak akses manajemen *repository* dan *deployment*. | Leader, Member | 
| **F-02** | **Manajemen Workspace & Kanban Board** | Papan Kanban interaktif (*To Do, In Progress, In Review, Done*) dengan fitur *drag-and-drop*. Setiap kartu tugas memiliki ID unik (misal: `#CP-01`). | Leader, Member | 
| **F-03** | **Otomatisasi Status via GitHub Webhook** | Sistem menangkap *event* `push` dan `pull_request` dari GitHub. Jika pesan *commit* menyertakan ID tugas (contoh: `feat: login page #CP-01`), kartu di Kanban otomatis berpindah ke kolom *In Review*. | Sistem | 
| **F-04** | **Branch Protection & Approval Gatekeeper** | Saat proyek dihubungkan, sistem otomatis mengunci *branch* `main` via GitHub API. Anggota hanya bisa *push* ke *branch* fitur. Penggabungan (*merge*) ke `main` hanya bisa dieksekusi jika Leader menekan tombol **Approve & Merge** setelah melihat *code diff*. | Leader | 
| **F-05** | **One-Click Vercel Deployment** | Leader dapat memilih *repository* proyek dan men-deploy-nya langsung ke Vercel dari dashboard. Sistem menampilkan status *build* (`Building`, `Ready`, `Error`) serta URL *live preview* secara *real-time*. | Leader | 
| **F-06** | **Live Screen Monitor (WebRTC)** | Anggota dapat menekan tombol *Start Live Session* di browser untuk membagikan jendela IDE mereka. Leader dapat memantau *grid* layar seluruh anggota yang sedang aktif bekerja secara *real-time*. | Leader, Member | 

## 4. Alur Kerja Sistem (*User Flow*)

1. **Inisialisasi Proyek:** Leader membuat *workspace* baru, menghubungkan *repository* GitHub, dan menautkan akun Vercel. Sistem otomatis mengaktifkan *Branch Protection* pada *branch* `main`.

2. **Eksekusi Tugas:** Anggota memilih kartu tugas di Kanban, pindah ke IDE (Antigravity/VS Code), membuat *branch* fitur (misal: `feat/auth`), lalu menjalankan `git push origin feat/auth`.

3. **Review & Gatekeeping:** GitHub Webhook mengirim data *push* ke server CodePulse. Status kartu di Kanban berubah menjadi *In Review*. Leader membuka detail kartu, memeriksa perubahan kode (*diff*), dan menekan **Approve & Merge**.

4. **Auto-Deploy:** Setelah kode tergabung ke `main`, sistem memicu *deployment* ke Vercel (atau Leader menekan tombol *Deploy Now*) hingga menghasilkan tautan aplikasi yang siap diakses publik.

5. **Live Monitoring (Opsional saat sesi kerja):** Anggota mengaktifkan *Share Screen* di tab browser; Leader memantau progres langsung dari ruang *Live Monitor*.

## 5. Kebutuhan Non-Fungsional & Arsitektur Teknis

* **Frontend:** React, TypeScript, Tailwind CSS, `@dnd-kit/core` (Kanban), Browser MediaDevices API (`getDisplayMedia`).

* **Backend:** Node.js + Express (atau Hono) untuk menangani *GitHub Webhooks*, *OAuth Callback*, dan komunikasi REST API ke GitHub (`@octokit/rest`) & Vercel.

* **Database & Realtime:** Supabase (PostgreSQL untuk penyimpanan data relasional & enkripsi token OAuth; Supabase Realtime untuk sinkronisasi papan Kanban dan *signaling* WebRTC).

* **Real-Time Streaming:** WebRTC (Peer-to-Peer) didukung layanan STUN/TURN server untuk menembus pembatasan jaringan Wi-Fi/hotspot.

* **Keamanan & Hosting:** Platform wajib di-deploy menggunakan protokol **HTTPS** penuh agar memenuhi syarat keamanan *GitHub Webhooks*, *OAuth Redirect URI*, dan izin akses *WebRTC Screen Capture*.

## 6. Batasan & Ruang Lingkup MVP (*Out of Scope*)

Untuk menjaga fokus pengembangan versi awal (MVP), fitur berikut tidak disertakan dalam rilis pertama:

* Aplikasi desktop (*native client*) atau ekstensi IDE khusus.

* Perekaman video layar jangka panjang (*cloud recording*) ke penyimpanan server (siaran layar bersifat *live/ephemeral* saja).

* Integrasi *repository* selain GitHub (seperti GitLab atau Bitbucket).

## 7. Metrik Keberhasilan (*Success Metrics*)

* **Zero Direct Push:** 100% percobaan `git push` langsung ke *branch* `main` oleh anggota berhasil ditolak oleh sistem.

* **Latensi Webhook:** Pembaruan status kartu Kanban setelah `git push` terjadi dalam waktu kurang dari **3 detik**.

* **Stabilitas WebRTC:** Sesi *live screen share* berjalan lancar (minimal 15–30 FPS) antar perangkat yang berbeda jaringan internet.