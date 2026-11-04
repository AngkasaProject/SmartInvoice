# 🧾 SmartInvoice - Aplikasi Invoice Profesional & WhatsApp Gateway

Aplikasi pembuatan, pengeditan, dan pemantauan invoice lengkap dengan fitur cetak/unduh PDF, **Kwitansi Resmi Lunas**, pengiriman otomatis berkas PDF ke customer via **WhatsApp Gateway (OpenWA & Fonnte)**, dukungan **SQLite, Cloudflare D1, Supabase, dan Neon**, serta integrasi Webhook pesanan toko online.

Didesain agar bisa berjalan di **Docker (Self-Hosted)** maupun **Cloudflare Workers (Cloud)**.

---

## 📑 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Prasyarat Sistem](#-prasyarat-sistem)
3. [Instalasi Mode Development (Lokal)](#-instalasi-mode-development-lokal)
4. [Setup Supabase (Database & Storage)](#-setup-supabase-database--storage)
5. [Setup Neon PostgreSQL](#setup-neon-postgresql)
6. [Deployment via Docker (Self-Hosted)](#-deployment-via-docker-self-hosted)
7. [Deployment via Cloudflare Workers (Cloud)](#-deployment-via-cloudflare-workers-cloud)
8. [Panduan Integrasi WhatsApp Gateway](#-panduan-integrasi-whatsapp-gateway)
9. [Integrasi API Toko Online (Webhook)](#-integrasi-api-toko-online-webhook)
10. [Lisensi](#-lisensi)

---

## 🚀 Fitur Utama

- **Autentikasi Aman**: Halaman Setup Admin pertama kali dan Login dengan konfirmasi password (Anti-Typo).
- **Dashboard Real-Time**: Memantau total omset, piutang belum bayar, tagihan jatuh tempo, dan bilah progres dana lunas.
- **Pembuatan Invoice Cepat**: Penomoran otomatis (Prefix dapat diubah), baris barang/jasa dinamis, kalkulasi PPN (Default dapat diubah), diskon, ongkir, serta _Terbilang_ otomatis.
- **Fitur Uang Muka (DP)**: Menghitung sisa tagihan secara otomatis dan mencetaknya di PDF.
- **Dukungan Varian Produk**: Tambahkan varian (ukuran/warna) dengan harga masing-masing di bawah satu produk utama.
- **Metode Pembayaran Dinamis**: Dukungan multi-rekening bank, pembayaran Cash, dan QRIS yang otomatis tercetak di PDF.
- **Watermark Anti-Pemalsuan**: PDF otomatis diberi tanda air (LUNAS, BELUM LUNAS, BELUM BAYAR, DRAFT) yang proporsional di tengah.
- **Dual WhatsApp Gateway**:
  - **OpenWA (Self-Hosted)**: Kompatibel dengan API OpenWA REST (UUID session, API key, pengiriman PDF base64).
  - **Fonnte (Cloud)**: Cukup masukkan Device Token Fonnte.
- **Penyimpanan Gambar**: Logo dan QRIS disimpan di R2 (Workers), Supabase Storage, atau Local Disk (Docker).
- **Pilihan Database per Runtime**: Docker memakai SQLite secara default; Cloudflare Workers memakai D1; Supabase dan Neon tersedia sebagai database pihak ketiga.
- **Penyimpanan Gambar Cloud**: Workers menggunakan Cloudflare R2 untuk logo dan QRIS; Docker dapat menyimpan file di disk lokal.
- **Hybrid & Fallback Storage**: Konfigurasi sensitif bisa dikunci via Environment Variables (`.env`). Jika server tidak tersedia, aplikasi dapat memakai `localStorage` browser.
- **Integrasi API Toko Online**: Endpoint Webhook untuk menerima pesanan dari WooCommerce, Shopify, atau custom store.

---

## 📋 Prasyarat Sistem

1. **Bun** versi 1.0+ (Sangat Direkomendasikan) atau **Node.js** versi 18+.
2. (Opsional) Server **OpenWA** aktif atau akun **Fonnte**.
3. (Opsional) Akun **Cloudflare** untuk Workers, D1, dan R2.
4. (Opsional) Akun **Supabase** atau **Neon** untuk database PostgreSQL.
5. (Opsional) **Docker** & **Docker Compose** (untuk deployment self-hosted).

---

## 🛠️ Instalasi Mode Development (Lokal)

1. **Clone Repositori**

   ```bash
   git clone https://github.com/AngkasaProject/SmartInvoice.git
   cd SmartInvoice
   ```

2. **Instal Dependensi**

```bash
bun install
```

3. **Konfigurasi Environment**
   Salin file .env.example menjadi .env.

```bash
cp .env.example .env
```

4. **Jalankan Server**

```bash
bun run dev
```

## Setup Supabase (Database & Storage)

Jika Anda menggunakan Supabase, jalankan skrip SQL berikut di SQL Editor Supabase:

1. Table Configuration

```bash
-- Tabel Invoices
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
    payment_method TEXT,
    payment_account_number TEXT,
    down_payment NUMERIC(15, 2) DEFAULT 0,
    remaining_balance NUMERIC(15, 2) DEFAULT 0,
    whatsapp_status TEXT DEFAULT 'not_sent',
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_recipient TEXT,
    whatsapp_last_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel Settings (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel Users (Untuk Login Admin)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Users" ON users FOR ALL USING (true) WITH CHECK (true);
```

2. Supabase Bucket

```bash
-- Buat bucket publik
INSERT INTO storage.buckets (id, name, public)
VALUES ('smartinvoice-assets', 'smartinvoice-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Izinkan akses publik (Read, Insert, Update, Delete)
CREATE POLICY "Public Access Assets"
ON storage.objects FOR ALL
USING (bucket_id = 'smartinvoice-assets')
WITH CHECK (bucket_id = 'smartinvoice-assets');
```

## Deployment via Docker (Self-Hosted)

1. Clone Repository
2. Build docker

```bash
docker compose up -d --build
```

3. Aplikasi akan berjalan di http://localhost:3777 (atau sesuai port yang Anda atur di docker-compose.yml).

4. SQLite adalah database default. Data SQLite dan file upload lokal tersimpan di folder `./data` (di-mount sebagai volume).
5. Untuk memakai Neon, atur `NEON_DATABASE_URL` di `.env` (opsional `DATABASE_DRIVER=neon`). Connection string Neon tidak disimpan di UI. Supabase dapat dikonfigurasi melalui UI atau environment variables.

6. Setup Admin Pertama
   Saat pertama kali dibuka, aplikasi akan meminta Anda membuat Akun Admin (Username & Password). Simpan kredensial ini untuk login.

### Setup Neon PostgreSQL

Neon dapat digunakan dari Docker maupun Workers. Atur `NEON_DATABASE_URL` sebagai environment secret; pada Workers, tambahkan `DATABASE_DRIVER=neon` agar Neon dipilih alih-alih D1. Jalankan SQL dari [`migrations/neon/0001_init.sql`](./migrations/neon/0001_init.sql) di SQL Editor Neon sebelum menjalankan aplikasi.

### ☁️ Deployment via Cloudflare Workers (Cloud)

Aplikasi ini sudah dilengkapi \_worker.ts untuk berjalan di edge Cloudflare.

Pastikan Anda memiliki akun Cloudflare dan sudah login via Wrangler (`npx wrangler login`).

1. Buat D1 dan R2, lalu hubungkan D1 ID yang ditampilkan Wrangler ke `database_id` di `wrangler.toml`:

   ```bash
   npx wrangler d1 create smartinvoice
   npx wrangler r2 bucket create smartinvoice-assets
   ```

2. Terapkan skema D1 dari [`migrations/d1/0001_init.sql`](./migrations/d1/0001_init.sql) dan deploy:

   ```bash
   npx wrangler d1 migrations apply smartinvoice --remote
   bun run build
   npx wrangler deploy
   ```

3. D1 (`DB`) adalah database default Workers dan R2 (`R2_BUCKET`) dipakai untuk upload logo/QRIS. R2 bucket dibutuhkan untuk upload gambar ketika memakai D1.
4. Untuk memakai Neon, tambahkan secret `NEON_DATABASE_URL` dan variable `DATABASE_DRIVER=neon`. Untuk Supabase, atur `DATABASE_DRIVER=supabase`, `SUPABASE_URL`, dan `SUPABASE_ANON_KEY`. Jalankan [`migrations/neon/0001_init.sql`](./migrations/neon/0001_init.sql) terlebih dahulu jika memakai Neon.

Konfigurasi Workers dikelola melalui Wrangler dan Secrets sehingga terkunci dari UI. Jika menggunakan Neon atau Supabase sebagai database, R2 tetap digunakan oleh Worker untuk file upload.

### 📱 Panduan Integrasi WhatsApp Gateway

Buka menu Pengaturan > WhatsApp Gateway di aplikasi:

Opsi A: Menggunakan OpenWA
Jalankan server OpenWA Anda.

Di SmartInvoice, pilih tab OpenWA.

Masukkan URL Server, Session ID (UUID), dan API Key.

Klik Tes Koneksi.

Opsi B: Menggunakan Fonnte
Dapatkan Device Token dari dashboard Fonnte.

Di SmartInvoice, pilih tab Fonnte.

Masukkan Device Token.

Klik Tes Koneksi.

### 🔗 Integrasi API Toko Online (Webhook)

Aplikasi ini menyediakan endpoint untuk menerima pesanan dari toko online Anda:

URL: http://domain-anda.com/api/orders/webhook

Method: POST

Headers: Authorization: Bearer <WEBHOOK_SECRET>

Contoh Payload:

json
{
"orderId": "ORD-12345",
"customer": {
"name": "Budi Santoso",
"phone": "081234567890",
"address": "Jl. Sudirman No. 45"
},
"items": [
{ "name": "Kaos Polos", "quantity": 2, "unitPrice": 50000 }
],
"shippingFee": 15000,
"taxRate": 11
}
📄 Lisensi
Proyek ini dilisensikan di bawah MIT License. Anda bebas menggunakannya untuk keperluan pribadi maupun komersial.

### Dibuat dengan ❤️ oleh AngkasaProject.
