# 🧾 KirimInvoice - Aplikasi Invoice Profesional & WhatsApp OpenWA Gateway

Aplikasi pembuatan, pengeditan, dan pemantauan invoice lengkap dengan fitur cetak/unduh PDF, **Kwitansi Resmi Lunas**, pengiriman otomatis berkas PDF ke customer via **WhatsApp OpenWA API**, dukungan **Dual Database (Supabase Cloud + Database Lokal Offline)**, serta siap dideploy di **Cloudflare Workers**.

---

## 🚀 Fitur Utama

- **Dashboard Real-Time:** Memantau total omset, piutang belum bayar, tagihan jatuh tempo, dan bilah progres persentase dana lunas secara instan.
- **Pembuatan Invoice Cepat:** Penomoran otomatis (`INV-202610-001`), baris barang/jasa dinamis, kalkulasi PPN (11%/0%), diskon, ongkir, serta *Terbilang otomatis*.
- **Auto-Fill Pelanggan Berulang:** Deteksi otomatis pelanggan dari transaksi sebelumnya untuk mengisi nama, alamat, dan nomor WhatsApp customer dalam 1 klik.
- **Pengeditan Invoice & Popup Pasca-Simpan:** Setelah invoice diedit dan disimpan, muncul popup pilihan instan: *Kirim PDF ke WhatsApp Customer*, *Download PDF Salinan*, atau *Kembali ke Dashboard*.
- **Mode Kwitansi Pembayaran Resmi:** Khusus invoice berstatus Lunas, tersedia format resmi Kwitansi Tanda Terima Sah yang dapat diunduh sebagai PDF terpisah.
- **Integrasi Otomatis WhatsApp OpenWA:** Mengonversi PDF menjadi berkas Base64 dan mengirimkannya langsung ke nomor WhatsApp customer (`628xxx@c.us`) via OpenWA API.
- **Halaman Khusus Riwayat Transaksi:** Pencatatan audit log penerbitan tagihan, status pelunasan, log pengiriman WhatsApp, serta tombol ekspor ke **CSV / Excel**.
- **Integrasi API Toko Online & Webhook:** Endpoint otomatis (`/api/orders/webhook`) untuk menerima pesanan dari toko online (WooCommerce, Shopify, atau platform custom) dan langsung dikonversi menjadi invoice resmi.
- **Dual-Database (Supabase & Lokal):** Gunakan Supabase Cloud untuk sinkronisasi multi-device atau Database Lokal untuk penggunaan offline. Dilengkapi alat migrasi data dua arah sekali klik.
- **Desain Bersih & 100% Responsif:** Tampilan optimal di perangkat desktop, tablet, dan smartphone (dengan mobile bottom navigation bar).

---

## 📋 Prasyarat Sistem (Prerequisites)

Sebelum memulai instalasi, pastikan Anda telah menginstal:
1. **Node.js** versi 18.0.0 atau lebih baru ([Download Node.js](https://nodejs.org/)).
2. **NPM** (terbawa otomatis dengan Node.js) atau **Bun** / **Yarn** / **pnpm**.
3. (Opsional) Proyek **OpenWA** aktif (bisa di komputer lokal atau VPS).
4. (Opsional) Akun **Supabase** gratis jika ingin menggunakan database cloud PostgreSQL.

---

## 🛠️ Langkah-Langkah Instalasi Lokal (Step-by-Step)

### 1. Ekstrak atau Buka Direktori Proyek
Buka terminal (Command Prompt, PowerShell, atau Terminal macOS/Linux) di dalam folder proyek ini:
```bash
cd /path/ke/kiriminvoice
```

### 2. Instal Seluruh Dependensi (Dependencies)
Jalankan perintah berikut untuk mengunduh modul yang diperlukan:
```bash
npm install
```

### 3. Konfigurasi Environment Variables (Opsional)
Salin berkas `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
*(Catatan: Konfigurasi Supabase, OpenWA, dan Webhook Toko juga dapat langsung diisi melalui menu Pengaturan di aplikasi tanpa perlu mengedit file `.env`)*

### 4. Jalankan Aplikasi di Mode Development
Jalankan server pengembangan:
```bash
npm run dev
```

Aplikasi akan berjalan di:
👉 **`http://localhost:3000`**

Buka tautan di atas melalui browser Anda (Google Chrome, Edge, Safari, atau Firefox).

---

## 📱 Panduan Integrasi OpenWA API (Kirim PDF ke Customer)

Aplikasi ini menggunakan nomor telepon customer yang diinput di formulir invoice untuk mengirimkan dokumen PDF secara otomatis.

### Cara Menjalankan OpenWA di Komputer / VPS Anda:
1. Jalankan OpenWA CLI (misalnya di port `8080`):
   ```bash
   npx @open-wa/wa-automate --port=8080 --api-key=rahasia123
   ```
2. Scan QR Code yang muncul di terminal menggunakan aplikasi WhatsApp di HP Anda.
3. Buka menu **Pengaturan > OpenWA API** di aplikasi KirimInvoice:
   - **URL Server OpenWA:** `http://localhost:8080` (atau IP VPS Anda).
   - **API Key:** `rahasia123` (sesuai yang Anda jalankan).
   - **Metode:** `POST /sendPdf`.
4. Klik tombol **"Tes Koneksi OpenWA Sekarang"**. Jika indikator berubah menjadi hijau (*Terhubung*), pengiriman otomatis sudah siap digunakan!
5. Buka invoice apa saja, klik **Kirim WA**, lalu klik **Kirim Otomatis (OpenWA API)**. Dokumen PDF akan langsung terkirim ke chat WhatsApp customer!

---

## 🗄️ Panduan Setup Supabase Cloud & Migrasi Data

Aplikasi secara default menggunakan **Database Lokal (Offline)** sehingga langsung dapat dipakai tanpa konfigurasi awal. Jika Anda ingin menyinkronkan data ke cloud Supabase:

### 1. Buat Tabel di Supabase SQL Editor
1. Masuk ke [Supabase Dashboard](https://supabase.com).
2. Buat proyek baru (*New Project*).
3. Buka menu **SQL Editor** di panel kiri Supabase, lalu salin dan jalankan skrip DDL berikut:

```sql
-- 1. Tabel Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid',
    client_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    items_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_type TEXT DEFAULT 'fixed',
    discount_value NUMERIC(15, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    shipping_fee NUMERIC(15, 2) DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    terms TEXT,
    payment_instructions TEXT,
    paid_at TIMESTAMPTZ,
    paid_method TEXT,
    whatsapp_status TEXT DEFAULT 'not_sent',
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_recipient TEXT,
    whatsapp_last_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index Pencarian Cepat
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 2. Tabel Profil Usaha
CREATE TABLE IF NOT EXISTS business_profile (
    id TEXT PRIMARY KEY,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row Level Security (Akses Public / Anon)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Profile" ON business_profile FOR ALL USING (true) WITH CHECK (true);
```

### 2. Hubungkan di Menu Pengaturan Aplikasi:
1. Buka menu **Pengaturan > Supabase & DB**.
2. Masukkan **Project URL** dan **Anon Key** dari menu *Settings > API* di dashboard Supabase Anda.
3. Klik **"Tes Koneksi Supabase"**.
4. Pilih mode **"Supabase Cloud"**, lalu klik tombol **"Migrasikan Lokal > Supabase Cloud"**. Seluruh invoice yang ada di lokal akan otomatis terunggah ke Supabase!
5. Kapan saja Anda ingin beralih kembali ke offline, cukup pilih mode **"Database Lokal"** atau klik **"Tarik Supabase Cloud > Database Lokal"**.

---

## 🛒 Panduan Integrasi Store API & Webhook (Pesanan Otomatis Masuk)

Aplikasi KirimInvoice menyediakan endpoint REST API Webhook berkinerja tinggi yang siap dihubungkan ke **WooCommerce, Shopify, Toko Online Custom, atau Checkout Landing Page**. Setiap pesanan baru di toko Anda akan langsung dibuatkan Invoice resmi, masuk ke Dashboard & Riwayat, dan siap dikirim via WhatsApp!

### 1. Endpoint & Spesifikasi API

- **Method:** `POST`
- **URL Endpoint:** 
  - `http://localhost:3000/api/orders/webhook` *(Lokal)*
  - `https://your-domain.workers.dev/api/orders/webhook` *(Cloudflare Workers)*
  - *(Alias)* `/api/invoices/create-from-order`
- **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <WEBHOOK_SECRET_ANDA>
  ```
  *(Secret key dapat diatur dan dibuat baru di menu **Pengaturan > API Toko & Webhook**)*

### 2. Format JSON Payload (Body)

Kirimkan data pesanan dari toko Anda dengan format JSON berikut:

```json
{
  "orderId": "ORD-89214",
  "customer": {
    "name": "Budi Santoso",
    "phone": "081234567890",
    "email": "budi@email.com",
    "address": "Jl. Sudirman No. 45, Jakarta Selatan",
    "company": "PT Budi Perkasa"
  },
  "items": [
    {
      "name": "Kemeja Batik Katun Premium",
      "quantity": 2,
      "unit": "Pcs",
      "unitPrice": 150000,
      "description": "Ukuran L, Warna Hitam Klasik",
      "discountPercent": 0
    },
    {
      "name": "Celana Chino Slim Fit",
      "quantity": 1,
      "unit": "Pcs",
      "unitPrice": 185000,
      "description": "Ukuran 32, Warna Khaki"
    }
  ],
  "discount": 15000,
  "shippingFee": 20000,
  "taxRate": 11,
  "status": "unpaid",
  "notes": "Pesanan dari Toko Online (Checkout Web)"
}
```

#### Penjelasan Kolom Payload:
| Kolom | Tipe | Wajib? | Keterangan |
| :--- | :--- | :--- | :--- |
| `orderId` | String | Ya | ID unik pesanan toko Anda (misal `ORD-123` / ID pesanan WooCommerce) |
| `customer.name` | String | Ya | Nama lengkap pembeli / pemesan |
| `customer.phone` | String | Ya | Nomor WhatsApp pembeli (format `08xxx` atau `628xxx`) |
| `customer.email` | String | Opsional | Email pembeli |
| `customer.address` | String | Opsional | Alamat pengiriman lengkap |
| `items` | Array | Ya | Daftar barang / layanan yang dibeli (minimal 1 barang) |
| `items[].name` | String | Ya | Nama produk |
| `items[].quantity`| Number | Ya | Jumlah item yang dibeli |
| `items[].unitPrice`| Number| Ya | Harga satuan barang (angka murni tanpa titik) |
| `discount` | Number | Opsional | Potongan diskon total (Rp) |
| `shippingFee` | Number | Opsional | Biaya ongkos kirim (Rp) |
| `taxRate` | Number | Opsional | Persentase PPN (misal `11` untuk 11%, atau `0`) |
| `status` | String | Opsional | Status awal tagihan: `"unpaid"` (belum bayar) atau `"paid"` (sudah bayar) |
| `notes` | String | Opsional | Catatan tambahan pesanan |

### 3. Contoh Response Sukses (HTTP 201 Created)

```json
{
  "success": true,
  "message": "Pesanan toko berhasil diproses menjadi Invoice resmi!",
  "invoiceNumber": "INV-STORE-ORD-89214",
  "invoice": {
    "id": "inv_store_1792401061348",
    "invoiceNumber": "INV-STORE-ORD-89214",
    "total": 539350,
    "status": "unpaid",
    "client": {
      "name": "Budi Santoso",
      "phone": "081234567890"
    }
  }
}
```

### 4. Contoh Pengujian via cURL

```bash
curl -X POST http://localhost:3000/api/orders/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sec_store_default123" \
  -d '{
    "orderId": "ORD-TEST-99",
    "customer": {
      "name": "Andi Wijaya",
      "phone": "081377889900"
    },
    "items": [
      { "name": "Paket Suplemen Premium", "quantity": 1, "unitPrice": 250000 }
    ],
    "shippingFee": 15000
  }'
```

### 5. Cara Menghubungkan ke WooCommerce / Shopify:
1. **WooCommerce:** Buka *WooCommerce > Settings > Advanced > Webhooks > Add Webhook*.
   - **Topic:** *Order created* atau *Order processing*.
   - **Delivery URL:** Masukkan URL Webhook KirimInvoice Anda.
   - **Secret:** Isi secret key sesuai yang tertera di menu Pengaturan KirimInvoice.
2. **Shopify:** Buka *Settings > Notifications > Webhooks > Create Webhook*.
   - **Event:** *Order creation*.
   - **Format:** *JSON*.
   - **URL:** Masukkan URL Webhook KirimInvoice Anda.
3. **Simulasi Instan di Aplikasi:**
   Buka menu **Pengaturan > API Toko & Webhook** di KirimInvoice, lalu klik tombol **"Kirim Pesanan Uji Coba Sekarang"**. Sistem akan mensimulasikan pesanan masuk dan otomatis memunculkan notifikasi toast di layar Anda!

---

## ⚡ Panduan Deploy ke Cloudflare Workers / Pages

Aplikasi ini telah dilengkapi berkas konfigurasi **`wrangler.toml`** dan entry point edge **`_worker.ts`** yang menggunakan Web Fetch API murni.

### Langkah Deploy:
1. Pastikan Anda memiliki akun Cloudflare ([Daftar di sini](https://cloudflare.com)).
2. Login ke akun Cloudflare melalui CLI:
   ```bash
   npx wrangler login
   ```
3. Lakukan build aplikasi:
   ```bash
   npm run build
   ```
4. Deploy aplikasi ke Cloudflare:
   ```bash
   npx wrangler deploy
   ```
5. URL produksi Anda di Cloudflare Workers (`https://kirim-invoice.<subdomain>.workers.dev`) akan langsung aktif!

---

## 📂 Struktur Berkas Proyek

```
├── _worker.ts                # Entry point Cloudflare Workers (Edge Handler & API Proxy)
├── wrangler.toml             # Konfigurasi deploy Cloudflare Workers
├── server.ts                 # Server full-stack Node.js / Express untuk lokal & VPS
├── index.html                # Entry point HTML aplikasi
├── package.json              # Dependensi pustaka dan skrip npm
├── src/
│   ├── App.tsx               # Root component: navigasi view, modal state, toast provider
│   ├── main.tsx              # React DOM mounting
│   ├── index.css             # Tailwind CSS & konfigurasi cetak/print
│   ├── types/
│   │   └── invoice.ts        # TypeScript interface Invoice, Profil Usaha, OpenWA
│   ├── services/
│   │   ├── dbAdapter.ts      # Adapter database ganda (Supabase & Lokal) + alat migrasi
│   │   ├── openwa.ts         # Layanan kirim PDF otomatis OpenWA & test connection
│   │   └── storage.ts        # Penyimpanan lokal (localStorage) & data contoh awal
│   ├── utils/
│   │   ├── formatters.ts     # Format Rupiah, tanggal Indo, Terbilang, & sanitisasi WA
│   │   ├── pdfGenerator.ts   # Pembuat PDF resolusi tinggi (jsPDF + html2canvas)
│   │   └── csvExport.ts      # Generator laporan transaksi dalam format CSV Excel
│   └── components/
│       ├── Navbar.tsx        # Navbar bersih: menampilkan Logo/Nama Toko & tab navigasi
│       ├── DashboardView.tsx # Dashboard arus kas & pemantau status pembayaran real-time
│       ├── InvoiceForm.tsx   # Formulir buat & edit invoice + auto-fill pelanggan berulang
│       ├── HistoryView.tsx   # Halaman khusus riwayat invoice & pengiriman WhatsApp
│       ├── SettingsView.tsx  # Pengaturan ID Usaha, OpenWA API, & Supabase/DB
│       ├── InvoicePrintable.tsx # Template cetak resmi Invoice & Kwitansi Lunas
│       ├── InvoiceDetailModal.tsx # Pratinjau full PDF, tombol cetak & ganti dokumen
│       ├── WhatsAppSendModal.tsx  # Dialog pengiriman dokumen otomatis via OpenWA
│       └── PostSaveActionModal.tsx # Popup aksi cepat setelah invoice disimpan
```

---

## 💡 Bantuan & Pertanyaan Umum (FAQ)

**T: Bagaimana jika server OpenWA saya sedang mati atau offline?**
J: Anda tetap dapat mengirim dokumen! Pada modal pengiriman, cukup klik tombol **"Kirim via WhatsApp Web/App"**. Sistem akan otomatis membuka WhatsApp Web/Desktop dengan nomor customer dan pesan pengantar yang sudah terisi.

**T: Di mana data saya disimpan jika saya tidak menyambungkan Supabase?**
J: Seluruh data aman tersimpan di penyimpanan lokal browser Anda. Anda juga dapat mengunduh berkas cadangan melalui menu **Pengaturan > Backup JSON** kapan saja.

**T: Apakah aplikasi ini aman digunakan di ponsel / tablet?**
J: Ya, aplikasi dilengkapi *Mobile Bottom Navigation Bar* dan tata letak yang 100% responsif terhadap ukuran layar smartphone dan tablet.
