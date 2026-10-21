# 🧾 SmartInvoice - Aplikasi Invoice Profesional & WhatsApp Gateway

Aplikasi pembuatan, pengeditan, dan pemantauan invoice lengkap dengan fitur cetak/unduh PDF, **Kwitansi Resmi Lunas**, pengiriman otomatis berkas PDF ke customer via **WhatsApp Gateway (OpenWA & Fonnte)**, dukungan **Dual Database (SQLite Lokal & Supabase Cloud)**, serta integrasi Webhook pesanan toko online.

Didesain agar bisa berjalan di **Docker (Self-Hosted)** maupun **Cloudflare Workers (Cloud)**.

---

## 📑 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Prasyarat Sistem](#-prasyarat-sistem)
3. [Instalasi Mode Development (Lokal)](#-instalasi-mode-development-lokal)
4. [Setup Supabase (Database & Storage)](#-setup-supabase-database--storage)
5. [Deployment via Docker (Self-Hosted)](#-deployment-via-docker-self-hosted)
6. [Deployment via Cloudflare Workers (Cloud)](#-deployment-via-cloudflare-workers-cloud)
7. [Panduan Integrasi WhatsApp Gateway](#-panduan-integrasi-whatsapp-gateway)
8. [Integrasi API Toko Online (Webhook)](#-integrasi-api-toko-online-webhook)
9. [Lisensi](#-lisensi)

---

## 🚀 Fitur Utama

- **Dashboard Real-Time**: Memantau total omset, piutang belum bayar, tagihan jatuh tempo, dan bilah progres persentase dana lunas.
- **Pembuatan Invoice Cepat**: Penomoran otomatis, baris barang/jasa dinamis, kalkulasi PPN, diskon, ongkir, serta _Terbilang_ otomatis.
- **Dukungan Varian Produk**: Tambahkan varian (ukuran/warna) di bawah satu produk utama tanpa perlu membuat baris baru.
- **Metode Pembayaran Dinamis**: Dukungan multi-rekening bank, pembayaran Cash, dan QRIS yang otomatis tercetak di PDF.
- **Dual WhatsApp Gateway**:
  - **OpenWA (Self-Hosted)**: Kompatibel dengan API OpenWA REST (UUID session, API key, pengiriman PDF base64).
  - **Fonnte (Cloud)**: Cukup masukkan Device Token Fonnte.
- **Penyimpanan Gambar**: Logo dan QRIS disimpan di Supabase Storage (Cloud) atau Local Disk (Docker).
- **Hybrid Configuration**: Konfigurasi sensitif (Database & WhatsApp) bisa dikunci via Environment Variables (`.env`) untuk keamanan, atau diatur via UI jika ENV kosong.
- **Integrasi API Toko Online**: Endpoint Webhook untuk menerima pesanan dari WooCommerce, Shopify, atau custom store.

---

## 📋 Prasyarat Sistem

1. **Bun** versi 1.0+ (Sangat Direkomendasikan) atau **Node.js** versi 18+.
2. (Opsional) Server **OpenWA** aktif atau akun **Fonnte**.
3. (Opsional) Akun **Supabase** (untuk database cloud & storage).
4. (Opsional) **Docker** & **Docker Compose** (untuk deployment self-hosted).

---

## 🛠️ Instalasi Mode Development (Lokal)

1. **Clone Repositori**

   ```bash
   git clone https://github.com/AngkasaProject/SmartInvoice.git
   cd SmartInvoice
   bun install

   cp .env.example .env

   bun run dev

   ## 🛠️ SETUP DATABASE SUPA
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
    whatsapp_status TEXT DEFAULT 'not_sent',
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_recipient TEXT,
    whatsapp_last_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
