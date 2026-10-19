import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BusinessProfile, Invoice, OpenWaConfig } from '../types/invoice';
import {
  defaultBusinessProfile,
  defaultOpenWaConfig,
  loadBusinessProfileFromStorage,
  loadInvoicesFromStorage,
  loadOpenWaConfigFromStorage,
  saveBusinessProfileToStorage,
  saveInvoicesToStorage,
  saveOpenWaConfigToStorage,
} from './storage';

export interface DatabaseSettings {
  activeDriver: 'supabase' | 'local';
  supabaseUrl: string;
  supabaseAnonKey: string;
  lastSyncAt?: string;
}

const DB_SETTINGS_KEY = 'kiriminvoice_db_settings_v1';

export const defaultDbSettings: DatabaseSettings = {
  activeDriver: 'local',
  supabaseUrl: (import.meta as any).env?.VITE_SUPABASE_URL || '',
  supabaseAnonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
};

export function loadDatabaseSettings(): DatabaseSettings {
  try {
    const raw = localStorage.getItem(DB_SETTINGS_KEY);
    if (!raw) return defaultDbSettings;
    return { ...defaultDbSettings, ...JSON.parse(raw) };
  } catch {
    return defaultDbSettings;
  }
}

export function saveDatabaseSettings(settings: DatabaseSettings): void {
  try {
    localStorage.setItem(DB_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save db settings', e);
  }
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedKey = '';

export function getSupabaseClient(url?: string, key?: string): SupabaseClient | null {
  const currentSettings = loadDatabaseSettings();
  const targetUrl = url || currentSettings.supabaseUrl;
  const targetKey = key || currentSettings.supabaseAnonKey;

  if (!targetUrl || !targetKey) return null;

  const combinedKey = `${targetUrl}:${targetKey}`;
  if (cachedSupabaseClient && cachedKey === combinedKey) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseClient = createClient(targetUrl, targetKey);
    cachedKey = combinedKey;
    return cachedSupabaseClient;
  } catch (e) {
    console.error('Error initializing Supabase client', e);
    return null;
  }
}

/**
 * Pings Supabase to check if credentials & table connection are valid
 */
export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (!url || !key) {
    return { success: false, message: 'URL Supabase dan Anon Key wajib diisi.' };
  }

  const startTime = Date.now();
  try {
    const client = createClient(url, key);
    // Attempt to query invoices table or check schema
    const { data, error } = await client.from('invoices').select('id').limit(1);
    const latencyMs = Date.now() - startTime;

    if (error) {
      // If table doesn't exist yet, connection is still valid but schema needs to be run
      if (error.code === '42P01' || error.message.includes('relation "invoices" does not exist')) {
        return {
          success: true,
          message: `Koneksi Supabase berhasil (${latencyMs}ms), namun tabel 'invoices' belum dibuat. Silakan salin & jalankan skrip SQL skema yang telah disediakan.`,
          latencyMs,
        };
      }
      return { success: false, message: `Error dari Supabase: ${error.message}` };
    }

    return {
      success: true,
      message: `Terhubung dengan Supabase Cloud (${latencyMs}ms). Tabel invoices siap digunakan!`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi Supabase: ${err.message || 'Periksa format URL dan koneksi internet.'}`,
    };
  }
}

/**
 * Unified Invoices Getter
 */
export async function fetchAllInvoices(): Promise<Invoice[]> {
  const settings = loadDatabaseSettings();

  if (settings.activeDriver === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('invoices')
          .select('*')
          .order('issue_date', { ascending: false });

        if (!error && Array.isArray(data)) {
          const mapped: Invoice[] = data.map((row: any) => ({
            id: row.id,
            invoiceNumber: row.invoice_number || row.id,
            issueDate: row.issue_date,
            dueDate: row.due_date,
            status: row.status,
            client: row.client_data || row.client || {},
            items: row.items_data || row.items || [],
            subtotal: row.subtotal || 0,
            discountType: row.discount_type || 'fixed',
            discountValue: row.discount_value || 0,
            discountAmount: row.discount_amount || 0,
            taxRate: row.tax_rate || 0,
            taxAmount: row.tax_amount || 0,
            shippingFee: row.shipping_fee || 0,
            total: row.total || 0,
            notes: row.notes,
            terms: row.terms,
            paymentInstructions: row.payment_instructions,
            paidAt: row.paid_at,
            paidMethod: row.paid_method,
            whatsappStatus: row.whatsapp_status,
            whatsappSentAt: row.whatsapp_sent_at,
            whatsappRecipient: row.whatsapp_recipient,
            whatsappLastLog: row.whatsapp_last_log,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          // Keep local cache synced for seamless offline/fallback capability
          saveInvoicesToStorage(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Failed to load from Supabase, falling back to local storage', err);
      }
    }
  }

  // Local storage driver
  return loadInvoicesFromStorage();
}

/**
 * Unified Invoice Saver
 */
export async function saveInvoiceRecord(invoice: Invoice): Promise<void> {
  // Always update local storage first (instant responsiveness & offline backup)
  const localList = loadInvoicesFromStorage();
  const exists = localList.some((i) => i.id === invoice.id);
  const updatedLocal = exists
    ? localList.map((i) => (i.id === invoice.id ? invoice : i))
    : [invoice, ...localList];
  saveInvoicesToStorage(updatedLocal);

  const settings = loadDatabaseSettings();
  if (settings.activeDriver === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      try {
        const row = {
          id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          issue_date: invoice.issueDate,
          due_date: invoice.dueDate,
          status: invoice.status,
          client_data: invoice.client,
          items_data: invoice.items,
          subtotal: invoice.subtotal,
          discount_type: invoice.discountType,
          discount_value: invoice.discountValue,
          discount_amount: invoice.discountAmount,
          tax_rate: invoice.taxRate,
          tax_amount: invoice.taxAmount,
          shipping_fee: invoice.shippingFee,
          total: invoice.total,
          notes: invoice.notes,
          terms: invoice.terms,
          payment_instructions: invoice.paymentInstructions,
          paid_at: invoice.paidAt,
          paid_method: invoice.paidMethod,
          whatsapp_status: invoice.whatsappStatus,
          whatsapp_sent_at: invoice.whatsappSentAt,
          whatsapp_recipient: invoice.whatsappRecipient,
          whatsapp_last_log: invoice.whatsappLastLog,
          updated_at: new Date().toISOString(),
        };

        const { error } = await client.from('invoices').upsert(row);
        if (error) {
          console.error('Supabase upsert invoice error', error);
        }
      } catch (e) {
        console.error('Error saving invoice to Supabase', e);
      }
    }
  }
}

/**
 * Unified Invoice Deletion
 */
export async function deleteInvoiceRecord(id: string): Promise<void> {
  const localList = loadInvoicesFromStorage();
  const updated = localList.filter((i) => i.id !== id);
  saveInvoicesToStorage(updated);

  const settings = loadDatabaseSettings();
  if (settings.activeDriver === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('invoices').delete().eq('id', id);
      } catch (e) {
        console.error('Error deleting invoice from Supabase', e);
      }
    }
  }
}

/**
 * Migrate local invoices and settings to Supabase
 */
export async function migrateLocalToSupabase(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, message: 'Klien Supabase belum dikonfigurasi.' };
  }

  const localInvoices = loadInvoicesFromStorage();
  const rows = localInvoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    status: inv.status,
    client_data: inv.client,
    items_data: inv.items,
    subtotal: inv.subtotal,
    discount_type: inv.discountType,
    discount_value: inv.discountValue,
    discount_amount: inv.discountAmount,
    tax_rate: inv.taxRate,
    tax_amount: inv.taxAmount,
    shipping_fee: inv.shippingFee,
    total: inv.total,
    notes: inv.notes,
    terms: inv.terms,
    payment_instructions: inv.paymentInstructions,
    paid_at: inv.paidAt,
    paid_method: inv.paidMethod,
    whatsapp_status: inv.whatsappStatus,
    whatsapp_sent_at: inv.whatsappSentAt,
    whatsapp_recipient: inv.whatsappRecipient,
    whatsapp_last_log: inv.whatsappLastLog,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await client.from('invoices').upsert(rows);
    if (error) {
      return { success: false, count: 0, message: `Gagal migrasi: ${error.message}` };
    }

    // Also migrate business profile
    const profile = loadBusinessProfileFromStorage();
    await client.from('business_profile').upsert({
      id: profile.id || 'biz_default',
      profile_data: profile,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      count: localInvoices.length,
      message: `Berhasil memigrasikan ${localInvoices.length} invoice ke Supabase Cloud!`,
    };
  } catch (err: any) {
    return { success: false, count: 0, message: `Error: ${err.message}` };
  }
}

/**
 * Pull all data from Supabase into Local Storage
 */
export async function migrateSupabaseToLocal(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, message: 'Klien Supabase belum dikonfigurasi.' };
  }

  try {
    const { data: invRows, error: invError } = await client.from('invoices').select('*');
    if (invError) {
      return { success: false, count: 0, message: `Gagal membaca Supabase: ${invError.message}` };
    }

    if (Array.isArray(invRows) && invRows.length > 0) {
      const mapped: Invoice[] = invRows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        status: row.status,
        client: row.client_data || {},
        items: row.items_data || [],
        subtotal: row.subtotal || 0,
        discountType: row.discount_type || 'fixed',
        discountValue: row.discount_value || 0,
        discountAmount: row.discount_amount || 0,
        taxRate: row.tax_rate || 0,
        taxAmount: row.tax_amount || 0,
        shippingFee: row.shipping_fee || 0,
        total: row.total || 0,
        notes: row.notes,
        terms: row.terms,
        paymentInstructions: row.payment_instructions,
        paidAt: row.paid_at,
        paidMethod: row.paid_method,
        whatsappStatus: row.whatsapp_status,
        whatsappSentAt: row.whatsapp_sent_at,
        whatsappRecipient: row.whatsapp_recipient,
        whatsappLastLog: row.whatsapp_last_log,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      }));

      saveInvoicesToStorage(mapped);

      // Check profile
      const { data: profRows } = await client.from('business_profile').select('*').limit(1);
      if (profRows && profRows.length > 0 && profRows[0].profile_data) {
        saveBusinessProfileToStorage(profRows[0].profile_data);
      }

      return {
        success: true,
        count: mapped.length,
        message: `Berhasil mengimpor ${mapped.length} invoice dari Supabase ke database lokal!`,
      };
    }

    return {
      success: true,
      count: 0,
      message: 'Supabase terhubung namun belum ada data invoice.',
    };
  } catch (err: any) {
    return { success: false, count: 0, message: `Error: ${err.message}` };
  }
}

/**
 * Generate copy-paste SQL schema for Supabase SQL Editor
 */
export function generateSupabaseSqlSchema(): string {
  return `-- ========================================================
-- Skrip DDL Database KirimInvoice untuk Supabase SQL Editor
-- Kompatibel dengan PostgreSQL / Supabase Cloud & Lokal
-- ========================================================

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

-- Index pencarian cepat
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 2. Tabel Profil Usaha
CREATE TABLE IF NOT EXISTS business_profile (
    id TEXT PRIMARY KEY,
    profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row Level Security (RLS) Opsional (Bisa dinonaktifkan atau diaktifkan untuk anon)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;

-- Policy untuk public / anon key (akses aplikasi)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Public Access Invoices'
    ) THEN
        CREATE POLICY "Public Access Invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'business_profile' AND policyname = 'Public Access Profile'
    ) THEN
        CREATE POLICY "Public Access Profile" ON business_profile FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;
}
