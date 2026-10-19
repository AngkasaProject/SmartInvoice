import { BusinessProfile, Invoice, OpenWaConfig, StoreApiConfig } from '../types/invoice';

const STORAGE_KEYS = {
  INVOICES: 'kiriminvoice_invoices_v1',
  BUSINESS_PROFILE: 'kiriminvoice_business_profile_v1',
  OPENWA_CONFIG: 'kiriminvoice_openwa_config_v1',
  STORE_API_CONFIG: 'kiriminvoice_store_api_config_v1',
};

export const defaultBusinessProfile: BusinessProfile = {
  id: 'biz_default',
  businessName: 'Solusi Digital Nusantara',
  tagline: 'Jasa IT Solusi, Desain Kreatif & Perangkat Lunak',
  ownerName: 'Yoga Saputra',
  phone: '081288991234',
  email: 'halo@solusidigital.id',
  address: 'Jl. Jend. Sudirman No. 45, Gedung Graha Pratama Lt. 4',
  city: 'Jakarta Selatan',
  postalCode: '12190',
  website: 'https://solusidigital.id',
  taxId: '01.234.567.8-012.000',
  bankName: 'BCA (Bank Central Asia)',
  bankAccountNumber: '8291038472',
  bankAccountHolder: 'Yoga Saputra',
  secondaryBank: {
    bankName: 'Bank Mandiri',
    bankAccountNumber: '1370019283741',
    bankAccountHolder: 'CV Solusi Digital Nusantara',
  },
  qrisImageUrl: '',
  invoicePrefix: 'INV',
  defaultTaxRate: 11,
  defaultTerms: '1. Pembayaran ditransfer ke rekening bank resmi yang tercantum di invoice.\n2. Harap cantumkan Nomor Invoice pada berita transfer.\n3. Konfirmasi pembayaran dapat dikirimkan ke WhatsApp kami.\n4. Terima kasih telah mempercayakan bisnis Anda bersama kami.',
  defaultNotes: 'Terima kasih atas kerja samanya. Layanan purna jual aktif 30 hari kalender setelah serah terima.',
  currencySymbol: 'Rp',
};

export const defaultOpenWaConfig: OpenWaConfig = {
  serverUrl: 'http://localhost:8080',
  apiKey: '',
  sessionName: 'default',
  endpointType: 'sendPdf',
  customEndpointPath: '/sendPdf',
  autoSendCaption: `Halo {client_name},

Berikut kami lampirkan dokumen invoice resmi *{invoice_no}* sebesar *{total}* dari *{company_name}*.

📅 *Jatuh Tempo:* {due_date}
📌 *Status:* {status}

💳 *Informasi Pembayaran:*
{bank_info}

Silakan kirimkan bukti transfer ke nomor WhatsApp ini setelah pembayaran selesai. Terima kasih banyak atas kepercayaan Anda! 🙏`,
  directWhatsappFallback: true,
};

export const defaultStoreApiConfig: StoreApiConfig = {
  webhookSecret: 'sec_store_live_99218',
  autoSendWhatsAppOnOrder: false,
  defaultOrderStatus: 'unpaid',
  invoicePrefix: 'INV-STORE',
};

const initialSampleInvoices: Invoice[] = [
  {
    id: 'inv_sample_001',
    invoiceNumber: 'INV-202610-001',
    issueDate: '2026-10-10',
    dueDate: '2026-10-24',
    status: 'paid',
    client: {
      name: 'Budi Santoso',
      company: 'PT Cipta Inovasi Maju',
      phone: '081234567890',
      email: 'budi@ciptainovasi.co.id',
      address: 'Jl. Pemuda No. 12, Surabaya',
      npwp: '02.456.789.0-604.000',
    },
    items: [
      {
        id: 'item_1',
        name: 'Pengembangan Website E-Commerce Custom',
        description: 'Termasuk payment gateway Midtrans, katalog produk, dan dashboard admin',
        quantity: 1,
        unit: 'Paket',
        unitPrice: 15000000,
        discountPercent: 0,
        amount: 15000000,
      },
      {
        id: 'item_2',
        name: 'Hosting Cloud Server & Domain .co.id (1 Tahun)',
        description: 'Spesifikasi NVMe 8GB RAM, SSL Sertifikat, Backup Otomatis',
        quantity: 1,
        unit: 'Tahun',
        unitPrice: 2500000,
        discountPercent: 0,
        amount: 2500000,
      },
    ],
    subtotal: 17500000,
    discountType: 'percentage',
    discountValue: 5,
    discountAmount: 875000,
    taxRate: 11,
    taxAmount: 1828750,
    shippingFee: 0,
    total: 18453750,
    notes: 'Pekerjaan telah selesai diuji dan serah terima tanggal 10 Oktober 2026.',
    terms: 'Garansi maintenance teknis 3 bulan sejak serah terima.',
    paymentInstructions: 'Transfer ke BCA 8291038472 a/n Yoga Saputra',
    paidAt: '2026-10-14T10:30:00.000Z',
    paidMethod: 'Transfer BCA',
    whatsappStatus: 'sent',
    whatsappSentAt: '2026-10-10T14:20:00.000Z',
    whatsappRecipient: '6281234567890@c.us',
    whatsappLastLog: 'Berhasil dikirim via OpenWA API',
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-14T10:30:00.000Z',
  },
  {
    id: 'inv_sample_002',
    invoiceNumber: 'INV-202610-002',
    issueDate: '2026-10-15',
    dueDate: '2026-10-22',
    status: 'unpaid',
    client: {
      name: 'Rina Wijaya',
      company: 'CV Sumber Rejeki Abadi',
      phone: '081987654321',
      email: 'rina@sumberrejeki.com',
      address: 'Komp. Ruko Harmoni Blok B2, Bandung',
      npwp: '03.882.112.5-422.000',
    },
    items: [
      {
        id: 'item_3',
        name: 'Desain Branding & Identitas Visual Perusahaan',
        description: 'Logo master, brand book guide, stationary kit, dan template medsos',
        quantity: 1,
        unit: 'Paket',
        unitPrice: 4800000,
        discountPercent: 0,
        amount: 4800000,
      },
      {
        id: 'item_4',
        name: 'Cetak Kartu Nama Premium & Kop Surat',
        description: 'Bahan art carton 310gsm laminasi doff spot UV (5 box)',
        quantity: 5,
        unit: 'Box',
        unitPrice: 120000,
        discountPercent: 0,
        amount: 600000,
      },
    ],
    subtotal: 5400000,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxRate: 11,
    taxAmount: 594000,
    shippingFee: 50000,
    total: 6044000,
    notes: 'Pengiriman via Kurir Instant setelah pelunasan diverifikasi.',
    terms: 'Batas pembayaran 7 hari kalender dari tanggal penerbitan invoice.',
    paymentInstructions: 'Transfer ke BCA 8291038472 a/n Yoga Saputra',
    whatsappStatus: 'sent',
    whatsappSentAt: '2026-10-15T09:15:00.000Z',
    whatsappRecipient: '6281987654321@c.us',
    whatsappLastLog: 'Terkirim via OpenWA',
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:15:00.000Z',
  },
  {
    id: 'inv_sample_003',
    invoiceNumber: 'INV-202610-003',
    issueDate: '2026-10-01',
    dueDate: '2026-10-15',
    status: 'overdue',
    client: {
      name: 'Hendro Kusuma',
      company: 'PT Megah Logistik Internasional',
      phone: '085712349999',
      email: 'hendro.k@megahlogistik.id',
      address: 'Kawasan Industri MM2100 Blok C, Cikarang',
      npwp: '01.998.441.2-413.000',
    },
    items: [
      {
        id: 'item_5',
        name: 'Langganan Software Manajemen Pengiriman (Oktober 2026)',
        description: 'Modul GPS Tracking, Notifikasi WA Driver, dan Integrasi Resi',
        quantity: 1,
        unit: 'Bulan',
        unitPrice: 3200000,
        discountPercent: 0,
        amount: 3200000,
      },
      {
        id: 'item_6',
        name: 'Dukungan Dedicated Support 24/7',
        description: 'Level SLA 99.9% dengan engineer standby',
        quantity: 1,
        unit: 'Bulan',
        unitPrice: 1000000,
        discountPercent: 0,
        amount: 1000000,
      },
    ],
    subtotal: 4200000,
    discountType: 'percentage',
    discountValue: 0,
    discountAmount: 0,
    taxRate: 11,
    taxAmount: 462000,
    shippingFee: 0,
    total: 4662000,
    notes: 'Tagihan telah melewati batas jatuh tempo per 15 Oktober 2026. Harap segera lakukan pelunasan.',
    terms: 'Akses dashboard akan dinonaktifkan sementara jika belum lunas.',
    paymentInstructions: 'Transfer ke BCA 8291038472 a/n Yoga Saputra',
    whatsappStatus: 'sent',
    whatsappSentAt: '2026-10-01T11:00:00.000Z',
    whatsappRecipient: '6285712349999@c.us',
    whatsappLastLog: 'Sent via OpenWA',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-16T08:00:00.000Z',
  },
  {
    id: 'inv_sample_004',
    invoiceNumber: 'INV-202610-004',
    issueDate: '2026-10-18',
    dueDate: '2026-10-25',
    status: 'unpaid',
    client: {
      name: 'dr. Farah Amanda',
      company: 'Klinik Sehat Amanda Medika',
      phone: '081388776655',
      email: 'dr.farah@amandamedika.com',
      address: 'Jl. Diponegoro No. 101, Semarang',
      npwp: '',
    },
    items: [
      {
        id: 'item_7',
        name: 'Pengaturan WhatsApp Bot Jadwal Pasien Otomatis',
        description: 'Integrasi OpenWA gateway dengan database antrean poliklinik',
        quantity: 1,
        unit: 'Sistem',
        unitPrice: 3500000,
        discountPercent: 0,
        amount: 3500000,
      },
    ],
    subtotal: 3500000,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    shippingFee: 0,
    total: 3500000,
    notes: 'Instalasi selesai dilakukan di server klinik. Siap live.',
    terms: 'Garansi pemeliharaan 1 bulan.',
    paymentInstructions: 'Transfer ke Mandiri 1370019283741 a/n CV Solusi Digital Nusantara',
    whatsappStatus: 'not_sent',
    createdAt: '2026-10-18T14:00:00.000Z',
    updatedAt: '2026-10-18T14:00:00.000Z',
  },
  {
    id: 'inv_sample_005',
    invoiceNumber: 'INV-202610-005',
    issueDate: '2026-10-19',
    dueDate: '2026-11-02',
    status: 'draft',
    client: {
      name: 'Agus Setiawan',
      company: 'Koperasi Karyawan Makmur',
      phone: '087811223344',
      email: 'agus@kopmakmur.id',
      address: 'Gedung Koperasi Lt. 1, Cilandak, Jakarta',
      npwp: '',
    },
    items: [
      {
        id: 'item_8',
        name: 'Aplikasi Simpan Pinjam Koperasi (Modul Anggota & Kasir)',
        description: 'Fitur cetak struk kasir, simpanan pokok, simpanan wajib, dan pelaporan SHU',
        quantity: 1,
        unit: 'Modul',
        unitPrice: 7500000,
        discountPercent: 10,
        amount: 6750000,
      },
    ],
    subtotal: 6750000,
    discountType: 'fixed',
    discountValue: 0,
    discountAmount: 0,
    taxRate: 11,
    taxAmount: 742500,
    shippingFee: 0,
    total: 7492500,
    notes: 'Draft penawaran & rencana kerja.',
    terms: 'Uang muka (DP) 50% sebelum pengerjaan dimulai.',
    paymentInstructions: 'Transfer ke BCA 8291038472 a/n Yoga Saputra',
    whatsappStatus: 'not_sent',
    createdAt: '2026-10-19T07:00:00.000Z',
    updatedAt: '2026-10-19T07:00:00.000Z',
  },
];

export function loadInvoicesFromStorage(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (!raw) {
      saveInvoicesToStorage(initialSampleInvoices);
      return initialSampleInvoices;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return initialSampleInvoices;
  } catch {
    return initialSampleInvoices;
  }
}

export function saveInvoicesToStorage(invoices: Invoice[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  } catch (e) {
    console.error('Failed to save invoices to storage', e);
  }
}

export function loadBusinessProfileFromStorage(): BusinessProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUSINESS_PROFILE);
    if (!raw) {
      saveBusinessProfileToStorage(defaultBusinessProfile);
      return defaultBusinessProfile;
    }
    return { ...defaultBusinessProfile, ...JSON.parse(raw) };
  } catch {
    return defaultBusinessProfile;
  }
}

export function saveBusinessProfileToStorage(profile: BusinessProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BUSINESS_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save business profile to storage', e);
  }
}

export function loadOpenWaConfigFromStorage(): OpenWaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OPENWA_CONFIG);
    if (!raw) {
      saveOpenWaConfigToStorage(defaultOpenWaConfig);
      return defaultOpenWaConfig;
    }
    return { ...defaultOpenWaConfig, ...JSON.parse(raw) };
  } catch {
    return defaultOpenWaConfig;
  }
}

export function saveOpenWaConfigToStorage(config: OpenWaConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OPENWA_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save OpenWA config to storage', e);
  }
}

export function loadStoreApiConfigFromStorage(): StoreApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORE_API_CONFIG);
    if (!raw) {
      saveStoreApiConfigToStorage(defaultStoreApiConfig);
      return defaultStoreApiConfig;
    }
    return { ...defaultStoreApiConfig, ...JSON.parse(raw) };
  } catch {
    return defaultStoreApiConfig;
  }
}

export function saveStoreApiConfigToStorage(config: StoreApiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STORE_API_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Store API config to storage', e);
  }
}

export function resetToSampleData(): void {
  localStorage.removeItem(STORAGE_KEYS.INVOICES);
  localStorage.removeItem(STORAGE_KEYS.BUSINESS_PROFILE);
  localStorage.removeItem(STORAGE_KEYS.OPENWA_CONFIG);
  localStorage.removeItem(STORAGE_KEYS.STORE_API_CONFIG);
  saveInvoicesToStorage(initialSampleInvoices);
  saveBusinessProfileToStorage(defaultBusinessProfile);
  saveOpenWaConfigToStorage(defaultOpenWaConfig);
  saveStoreApiConfigToStorage(defaultStoreApiConfig);
}
