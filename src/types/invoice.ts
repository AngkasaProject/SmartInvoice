export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "paid"
  | "overdue"
  | "cancelled";

// ==========================================
// 1. VARIAN PRODUK
// ==========================================
export interface InvoiceItemVariant {
  id: string;
  name: string; // cth: "Ukuran L", "Warna Merah"
  quantity: number; // cth: 2
  price: number; // Harga per varian
}

// ==========================================
// 2. ITEM PRODUK (Dengan Varian)
// ==========================================
export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string; // e.g. "Pcs", "Jam", "Hari", "Bulan", "Paket", "Unit", "Proyek"
  unitPrice: number;
  discountPercent?: number;
  amount: number;
  variants?: InvoiceItemVariant[]; // <-- Fitur Varian
}

// ==========================================
// 3. INFO PELANGGAN
// ==========================================
export interface ClientInfo {
  name: string;
  company?: string;
  phone: string; // WhatsApp number
  email?: string;
  address?: string;
  npwp?: string;
}

// ==========================================
// 4. REKENING BANK (Bisa Banyak)
// ==========================================
export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// ==========================================
// 5. PROFIL USAHA (Menggunakan Array BankAccount)
// ==========================================
export interface BusinessProfile {
  id: string;
  businessName: string;
  tagline: string;
  logoUrl?: string;
  ownerName: string;
  phone: string; // WhatsApp usaha
  email: string;
  address: string;
  city: string;
  postalCode?: string;
  website?: string;
  taxId?: string; // NPWP / NIB

  // FITUR BARU: Daftar Rekening (Bisa lebih dari 1)
  bankAccounts: BankAccount[];
  qrisImageUrl?: string;

  // Defaults
  invoicePrefix: string; // e.g. "INV"
  defaultTaxRate: number; // e.g. 11 (%)
  defaultTerms: string;
  defaultNotes: string;
  currencySymbol: string;
}

// ==========================================
// 6. KONFIGURASI WHATSAPP (OpenWA / Fonnte)
// ==========================================
export type WhatsAppProvider = "openwa" | "fonnte";

export interface WhatsAppConfig {
  provider: WhatsAppProvider; // 'openwa' | 'fonnte'
  // OpenWA settings
  serverUrl: string; // e.g. http://localhost:8080
  apiKey: string;
  sessionName: string; // UUID session
  // Fonnte settings
  fonnteToken: string;
  // General sending options
  endpointType: "sendPdf" | "sendFile" | "sendMessageWithMedia" | "custom";
  customEndpointPath: string;
  autoSendCaption: string;
  directWhatsappFallback: boolean;
}

// Backward compatibility
export type OpenWaConfig = WhatsAppConfig;

// ==========================================
// 7. KONFIGURASI API TOKO
// ==========================================
export interface StoreApiConfig {
  webhookSecret: string;
  autoSendWhatsAppOnOrder: boolean;
  defaultOrderStatus: "unpaid" | "paid";
  invoicePrefix: string;
}

// ==========================================
// 8. INVOICE UTAMA (Dengan Metode Pembayaran)
// ==========================================
export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  client: ClientInfo;
  items: InvoiceItem[];
  subtotal: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  taxRate: number; // in %
  taxAmount: number;
  shippingFee: number;
  total: number;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  paidAt?: string;
  paidMethod?: string;

  // FITUR BARU: Metode Pembayaran yang dipilih
  paymentMethod?: string;
  paymentAccountNumber?: string;

  // WhatsApp dispatch record
  whatsappStatus?: "not_sent" | "sent" | "failed";
  whatsappSentAt?: string;
  whatsappRecipient?: string;
  whatsappLastLog?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 9. STATISTIK DASHBOARD
// ==========================================
export interface DashboardStats {
  totalRevenue: number;
  totalPaid: number;
  totalUnpaid: number;
  totalOverdue: number;
  countAll: number;
  countPaid: number;
  countOverdue: number;
  countDraft: number;
}

// ==========================================
// 10. KONFIGURASI DATABASE
// ==========================================
export type DatabaseDriver = "sqlite" | "mariadb" | "supabase";

export interface MariaDbCredentials {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

export interface DatabaseConfig {
  activeDriver: DatabaseDriver;
  sqlite: {
    filePath: string;
  };
  mariadb: MariaDbCredentials;
  supabase: SupabaseCredentials;
}
