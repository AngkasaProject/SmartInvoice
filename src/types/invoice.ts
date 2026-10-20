export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string; // e.g. "Pcs", "Jam", "Hari", "Bulan", "Paket", "Unit", "Proyek"
  unitPrice: number;
  discountPercent?: number;
  amount: number;
}

export interface ClientInfo {
  name: string;
  company?: string;
  phone: string; // WhatsApp number
  email?: string;
  address?: string;
  npwp?: string;
}

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
  // Bank transfer info
  bankName: string; // e.g. "BCA", "Mandiri", "BRI"
  bankAccountNumber: string;
  bankAccountHolder: string;
  secondaryBank?: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  };
  qrisImageUrl?: string;
  // Defaults
  invoicePrefix: string; // e.g. "INV"
  defaultTaxRate: number; // e.g. 11 (%)
  defaultTerms: string;
  defaultNotes: string;
  currencySymbol: string;
}

export type WhatsAppProvider = 'openwa' | 'fonnte';

export interface WhatsAppConfig {
  provider: WhatsAppProvider; // 'openwa' | 'fonnte'
  // OpenWA settings (compatible with rmyndharis/OpenWA)
  serverUrl: string; // e.g. http://localhost:8080
  apiKey: string;
  sessionName: string; // UUID session
  // Fonnte settings (https://fonnte.com)
  fonnteToken: string;
  // General sending options
  endpointType: 'sendPdf' | 'sendFile' | 'sendMessageWithMedia' | 'custom';
  customEndpointPath: string;
  autoSendCaption: string;
  directWhatsappFallback: boolean;
}

// Kept for backwards compatibility across existing components
export type OpenWaConfig = WhatsAppConfig;

export interface StoreApiConfig {
  webhookSecret: string;
  autoSendWhatsAppOnOrder: boolean;
  defaultOrderStatus: 'unpaid' | 'paid';
  invoicePrefix: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  client: ClientInfo;
  items: InvoiceItem[];
  subtotal: number;
  discountType: 'percentage' | 'fixed';
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
  // WhatsApp dispatch record
  whatsappStatus?: 'not_sent' | 'sent' | 'failed';
  whatsappSentAt?: string;
  whatsappRecipient?: string;
  whatsappLastLog?: string;
  createdAt: string;
  updatedAt: string;
}

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

export type DatabaseDriver = 'sqlite' | 'mariadb' | 'supabase';

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
