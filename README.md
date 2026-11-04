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

4. SQLite adalah database default sekaligus penyimpan konfigurasi database dan akun admin. Data invoice/profil usaha dapat memakai driver yang dipilih di Pengaturan → Database. Data dan kredensial database tersimpan di database default; file upload lokal ada di `./data` (di-mount sebagai volume).
5. Untuk memakai Neon atau Supabase tanpa mengunci pilihan driver, siapkan skema provider, lalu masukkan kredensialnya di Pengaturan → Database. Mengganti driver tidak menyalin invoice maupun pengaturan bisnis secara otomatis.

6. Setup Admin Pertama
   Saat pertama kali dibuka, aplikasi akan meminta Anda membuat Akun Admin (Username & Password). Simpan kredensial ini untuk login.

### Setup Neon PostgreSQL

Neon dapat digunakan dari Docker maupun Workers. Jalankan SQL dari [`migrations/neon/0001_init.sql`](./migrations/neon/0001_init.sql) di SQL Editor Neon sebelum memilih Neon di Pengaturan → Database. Jika `DATABASE_DRIVER` atau secret provider diatur lewat environment, pilihan driver akan dikunci oleh environment.

### ☁️ Deployment via Cloudflare Workers (Cloud)

Berikut langkah deploy dari repository ke Cloudflare Workers menggunakan D1 sebagai database default dan R2 untuk file gambar. Perintah `npx wrangler` juga dapat dijalankan dari Windows PowerShell.

#### 1. Persiapan

- Siapkan akun Cloudflare dan domain (domain khusus opsional; URL `workers.dev` cukup untuk mulai).
- Install [Bun](https://bun.sh/) dan Node.js/npm.
- Clone repository, checkout branch yang ingin dideploy, lalu install dependency:

  ```powershell
  git clone https://github.com/AngkasaProject/SmartInvoice.git
  cd SmartInvoice
  git checkout preview
  bun install
  npx wrangler login
  ```

#### 2. Buat database D1 dan bucket R2

Jalankan sekali untuk membuat resource:

```powershell
npx wrangler d1 create smartinvoice
npx wrangler r2 bucket create smartinvoice-assets
```

Perintah D1 menampilkan `database_id`. Buka `wrangler.toml` dan ganti nilai contoh `REPLACE_WITH_D1_DATABASE_ID` dengan ID tersebut. Pastikan nama bucket R2 sama dengan `smartinvoice-assets` di konfigurasi. Jika resource sudah ada, gunakan database ID dan nama bucket yang sudah ada, jangan membuat duplikat.

Konfigurasi `[assets]`, binding D1 `DB`, binding R2 `R2_BUCKET`, dan direktori migration sudah tersedia di `wrangler.toml`. D1 dan R2 tetap dipakai jika nanti Anda memilih Neon atau Supabase sebagai database.

#### 3. Terapkan skema D1

Migration membuat tabel invoice, settings, users, sesi admin, dan registry konfigurasi:

```powershell
npx wrangler d1 migrations apply smartinvoice --remote
```

Pastikan perintah selesai tanpa error sebelum deploy. Untuk database yang telah menjalankan migration sebelumnya, perintah yang sama akan menerapkan migration baru [`migrations/d1/0002_database_registry.sql`](./migrations/d1/0002_database_registry.sql).

#### 4. Build dan deploy

```powershell
bun run lint
bun run build
npx wrangler deploy
```

Wrangler akan menampilkan URL Worker, biasanya `https://smart-invoice.<subdomain>.workers.dev`. Buka URL itu untuk menyelesaikan setup admin pertama kali. Buat satu invoice percobaan dan unggah logo/QRIS untuk memastikan database dan storage berfungsi.

#### 5. Secrets dan konfigurasi opsional

D1 adalah default dan tetap menyimpan konfigurasi provider serta akun admin meskipun data aplikasi dialihkan ke Neon/Supabase. Agar driver dapat diganti melalui Pengaturan, jangan atur `DATABASE_DRIVER`, `NEON_DATABASE_URL`, `SUPABASE_URL`, atau `SUPABASE_ANON_KEY`. Masukkan connection string/key provider di UI setelah deployment. Kredensial disimpan di D1 dan tidak dikirim kembali saat konfigurasi dibaca.

Secret berikut opsional untuk integrasi WhatsApp:

```powershell
npx wrangler secret put WHATSAPP_PROVIDER
npx wrangler secret put FONNTE_TOKEN
```

Isi nilai saat Wrangler meminta input. Atur hanya secret yang diperlukan. Untuk OpenWA, masukkan `openwa` sebagai nilai `WHATSAPP_PROVIDER`, lalu tambahkan secret `OPENWA_SERVER_URL`, `OPENWA_API_KEY`, dan `OPENWA_SESSION_ID`.

Jika ingin mengunci database ke Neon melalui environment (tanpa pilihan driver di UI), ubah bagian `[vars]` pada `wrangler.toml` menjadi:

```toml
[vars]
ENVIRONMENT = "production"
DATABASE_DRIVER = "neon"
```

Kemudian simpan connection string sebagai secret:

```powershell
npx wrangler secret put NEON_DATABASE_URL
```

Sebelum deploy dengan Neon, jalankan [`migrations/neon/0001_init.sql`](./migrations/neon/0001_init.sql) melalui SQL Editor Neon. Untuk mengunci ke Supabase melalui environment, tambahkan `DATABASE_DRIVER = "supabase"` di `[vars]`, lalu simpan URL dan key:

```powershell
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

Jika driver dipilih lewat UI, D1 tetap menjadi registry konfigurasi dan penyimpan akun admin. Jalankan skema Neon di atas atau siapkan skema Supabase sebelum memilih provider. R2 tetap diperlukan untuk upload gambar pada semua pilihan database di Workers.

Sesudah mengubah binding, variable, atau secret, jalankan ulang `npx wrangler deploy`. `.env` dan `.env.example` dipakai untuk server Docker/Bun; Workers membaca binding dari `wrangler.toml` dan variable/secret dari konfigurasi Cloudflare. Endpoint pengaturan database hanya dapat diakses dengan sesi admin yang valid.

#### 6. Perbarui deployment

Setelah perubahan kode pada branch yang dipakai:

```powershell
git pull
bun install
bun run lint
bun run build
npx wrangler deploy
```

Jika ada migration D1 baru, terapkan terlebih dahulu dengan:

```powershell
npx wrangler d1 migrations apply smartinvoice --remote
```

Untuk memeriksa migration dan resource D1:

```powershell
npx wrangler d1 migrations list smartinvoice --remote
npx wrangler d1 execute smartinvoice --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

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
