import {
  BusinessProfile,
  DatabaseConfig,
  DatabaseDriver,
  Invoice,
  OpenWaConfig,
  StoreApiConfig,
} from '../types/invoice';
import {
  defaultBusinessProfile,
  defaultOpenWaConfig,
  defaultStoreApiConfig,
} from './storage';

export const defaultDatabaseConfig: DatabaseConfig = {
  activeDriver: 'sqlite',
  sqlite: {
    filePath: './data/smartinvoice.db',
  },
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'smartinvoice',
  },
  supabase: {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
  },
};

// In-memory cache for ultra-fast UI rendering
let cachedDbConfig: DatabaseConfig = defaultDatabaseConfig;

// ==========================================
// CONFIGURATION & DRIVER MANAGEMENT
// ==========================================

export async function fetchDatabaseConfig(): Promise<DatabaseConfig> {
  try {
    const res = await fetch('/api/db/config');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        cachedDbConfig = data.config;
        return data.config;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch db config from server, using cached', e);
  }
  return cachedDbConfig;
}

export function getCachedDatabaseConfig(): DatabaseConfig {
  return cachedDbConfig;
}

export async function saveDatabaseConfig(
  config: Partial<DatabaseConfig>
): Promise<{ success: boolean; config: DatabaseConfig; message: string }> {
  try {
    const res = await fetch('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (data.success && data.config) {
      cachedDbConfig = data.config;
      return { success: true, config: data.config, message: data.message };
    }
    return { success: false, config: cachedDbConfig, message: data.message || 'Gagal menyimpan konfigurasi' };
  } catch (err: any) {
    return { success: false, config: cachedDbConfig, message: err.message || 'Gagal menghubungi server' };
  }
}

export async function testDatabaseConnection(
  driver: DatabaseDriver,
  credentials?: any
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const res = await fetch('/api/db/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver, credentials }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `Tidak dapat menghubungi server: ${err.message}`,
    };
  }
}

export async function migrateDatabase(
  fromDriver: DatabaseDriver,
  toDriver: DatabaseDriver
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch('/api/db/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDriver, toDriver }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchDatabaseConfig();
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Gagal migrasi database: ${err.message}`,
    };
  }
}

// ==========================================
// INVOICES CRUD (ACTUAL DATABASE WORKING)
// ==========================================

export async function fetchAllInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch('/api/invoices');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        return data.invoices;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch invoices from server database', err);
  }
  return [];
}

export async function saveInvoiceRecord(invoice: Invoice): Promise<void> {
  const res = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoice),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Gagal menyimpan invoice ke database');
  }
}

export async function deleteInvoiceRecord(id: string): Promise<void> {
  const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Gagal menghapus invoice dari database');
  }
}

// ==========================================
// SETTINGS PERSISTENCE (ACTUAL DATABASE)
// ==========================================

export async function fetchSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.value !== null && data.value !== undefined) {
        return data.value as T;
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch setting ${key} from server database`, err);
  }
  return defaultValue;
}

export async function saveSettingRecord<T>(key: string, value: T): Promise<void> {
  const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Gagal menyimpan pengaturan ${key} ke database`);
  }
}

// Convenience wrappers for specific settings
export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  return fetchSetting<BusinessProfile>('business_profile', defaultBusinessProfile);
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  return saveSettingRecord<BusinessProfile>('business_profile', profile);
}

export async function fetchOpenWaConfig(): Promise<OpenWaConfig> {
  return fetchSetting<OpenWaConfig>('openwa_config', defaultOpenWaConfig);
}

export async function saveOpenWaConfig(config: OpenWaConfig): Promise<void> {
  return saveSettingRecord<OpenWaConfig>('openwa_config', config);
}

export async function fetchStoreApiConfig(): Promise<StoreApiConfig> {
  return fetchSetting<StoreApiConfig>('store_api_config', defaultStoreApiConfig);
}

export async function saveStoreApiConfig(config: StoreApiConfig): Promise<void> {
  return saveSettingRecord<StoreApiConfig>('store_api_config', config);
}

// ==========================================
// SUPABASE SQL SCHEMA GENERATOR
// ==========================================

export function generateSupabaseSqlSchema(): string {
  return `-- ========================================================
-- Skrip DDL Database SmartInvoice untuk Supabase SQL Editor
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

-- 2. Tabel Settings (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row Level Security (RLS)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy untuk public / anon key (akses aplikasi)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Public Access Invoices'
    ) THEN
        CREATE POLICY "Public Access Invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Public Access Settings'
    ) THEN
        CREATE POLICY "Public Access Settings" ON settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;
}
