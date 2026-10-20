# 🧾 SmartInvoice - Aplikasi Invoice Profesional & WhatsApp Gateway (OpenWA & Fonnte)

Aplikasi pembuatan, pengeditan, dan pemantauan invoice lengkap dengan fitur cetak/unduh PDF, **Kwitansi Resmi Lunas**, pengiriman otomatis berkas PDF ke customer via **WhatsApp Gateway (OpenWA & Fonnte)**, dukungan **Tiga Real Database Server (SQLite Lokal via Bun, MariaDB/MySQL Server, dan Supabase Cloud PostgreSQL)**, serta webhook pesanan toko online.

---

## 🚀 Fitur Utama

- **Dashboard Real-Time:** Memantau total omset, piutang belum bayar, tagihan jatuh tempo, dan bilah progres persentase dana lunas secara instan.
- **Pembuatan Invoice Cepat:** Penomoran otomatis (`INV-202610-001`), baris barang/jasa dinamis, kalkulasi PPN (11%/0%), diskon, ongkir, serta *Terbilang otomatis*.
- **Auto-Fill Pelanggan Berulang:** Deteksi otomatis pelanggan dari transaksi sebelumnya untuk mengisi nama, alamat, dan nomor WhatsApp customer dalam 1 klik.
- **Pengeditan Invoice & Popup Pasca-Simpan:** Setelah invoice diedit dan disimpan, muncul popup pilihan instan: *Kirim PDF ke WhatsApp Customer*, *Download PDF Salinan*, atau *Kembali ke Dashboard*.
- **Mode Kwitansi Pembayaran Resmi:** Khusus invoice berstatus Lunas, tersedia format resmi Kwitansi Tanda Terima Sah yang dapat diunduh sebagai PDF terpisah.
- **Dukungan Dual WhatsApp Gateway (OpenWA & Fonnte):**
  - **OpenWA (rmyndharis/OpenWA):** Kompatibel dengan API OpenWA REST API server (dukungan UUID session, API key, dan pengiriman dokumen PDF base64).
  - **Fonnte (fonnte.com):** Cukup masukkan Device Token Fonnte untuk pengiriman otomatis berbasis cloud.
- **Penyimpanan Gambar Server Lokal Ringan (`/uploads`):**
  - Gambar logo usaha dan barcode QRIS disimpan langsung ke folder server `data/uploads/` sehingga ukuran database (SQLite / MariaDB) tetap ringan dan cepat.
- **Real Working Database Server (Bukan LocalStorage):**
  - **SQLite Lokal Server (Bawaan Bun `bun:sqlite`):** File database server `data/smartinvoice.db` zero-config, berkecepatan tinggi, dan 100% offline.
  - **MariaDB / MySQL Server (`mysql2`):** Mendukung koneksi ke server database lokal atau remote (XAMPP, Laragon, Docker, VPS).
  - **Supabase Cloud (PostgreSQL):** Sinkronisasi cloud multi-perangkat real-time.
  - **Migrasi Sekali Klik:** Fasilitas transfer dan migrasi seluruh invoice dan profil usaha antar database engine secara fleksibel.
- **Halaman Khusus Riwayat Transaksi:** Pencatatan audit log penerbitan tagihan, status pelunasan, log pengiriman WhatsApp, serta tombol ekspor ke **CSV / Excel**.
- **Integrasi API Toko Online & Webhook:** Endpoint otomatis (`/api/orders/webhook`) untuk menerima pesanan dari toko online (WooCommerce, Shopify, atau platform custom) dan langsung dikonversi menjadi invoice resmi di database aktif.
- **UI/UX Pengaturan Terstruktur:**
  - Pemisahan jelas antara **Konfigurasi Toko** (Profil Usaha, Rekening, Webhook Toko) dan **Konfigurasi Sensitif & Sistem** (WhatsApp Gateway, Database Server, Backup).

---

## 📋 Prasyarat Sistem (Prerequisites)

Sebelum memulai instalasi, pastikan Anda telah menginstal:
1. **Bun** versi 1.0 atau lebih baru ([Download Bun](https://bun.sh/)) *(Sangat Direkomendasikan)*, atau **Node.js** versi 18+.
2. (Opsional) Server **OpenWA** aktif ([rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)) atau akun **Fonnte**.
3. (Opsional) Server **MariaDB / MySQL** jika ingin menggunakan driver MariaDB lokal.
4. (Opsional) Akun **Supabase** gratis jika ingin menggunakan database cloud PostgreSQL.

---

## 🛠️ Langkah-Langkah Instalasi & Menjalankan (Step-by-Step)

### 1. Masuk ke Direktori Proyek
Buka terminal (PowerShell, Command Prompt, atau Terminal Linux/macOS):
```bash
cd /path/ke/SmartInvoice
```

### 2. Instal Dependensi
Jalankan perintah berikut:
```bash
bun install
```

### 3. Jalankan Aplikasi di Mode Development
```bash
bun run dev
```

Aplikasi akan berjalan di:
👉 **`http://localhost:3000`**

---

## 📱 Panduan Integrasi WhatsApp Gateway

Buka menu **Pengaturan > WhatsApp Gateway** di aplikasi SmartInvoice:

### Opsi A: Menggunakan OpenWA (rmyndharis/OpenWA)
1. Jalankan server OpenWA Anda (misal di port 8080).
2. Di SmartInvoice:
   - Pilih tab **OpenWA (rmyndharis/OpenWA)**.
   - **URL Server OpenWA:** `http://localhost:8080` (atau URL VPS Anda).
   - **Session ID:** Masukkan UUID sesi Anda.
   - **API Key:** Masukkan API key server OpenWA Anda.
3. Klik tombol **"Tes Koneksi OpenWA Sekarang"**.

### Opsi B: Menggunakan Fonnte (fonnte.com)
1. Daftarkan nomor WhatsApp Anda di dashboard [Fonnte](https://fonnte.com).
2. Salin Device Token Anda dari dashboard Fonnte.
3. Di SmartInvoice:
   - Pilih tab **Fonnte (fonnte.com)**.
   - Masukkan **Device API Token Fonnte**.
4. Klik tombol **"Tes Koneksi Fonnte Sekarang"**.

---

## 🗄️ Panduan Database Server

Di menu **Pengaturan > Database Server**, Anda dapat memilih database aktif:
1. **SQLite (Lokal File):** Bawaan Bun, tersimpan otomatis di `data/smartinvoice.db`. Tanpa perlu konfigurasi server tambahan.
2. **MariaDB / MySQL Server:** Masukkan Host (`localhost`), Port (`3306`), User (`root`), Password, dan Nama Database (`smartinvoice`).
3. **Supabase Cloud (PostgreSQL):** Masukkan Project URL dan Anon Key untuk sinkronisasi cloud.
4. **Alat Migrasi Database:** Ingin pindah dari SQLite ke MariaDB atau Supabase? Cukup pilih Sumber dan Tujuan, lalu klik **"Jalankan Migrasi Database"**. Seluruh data invoice dan profil otomatis dipindahkan!
