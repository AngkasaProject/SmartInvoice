import {
  BusinessProfile,
  DatabaseConfig,
  DatabaseDriver,
  Invoice,
  WhatsAppConfig,
  StoreApiConfig,
} from "../types/invoice";
import {
  defaultBusinessProfile,
  defaultOpenWaConfig,
  defaultStoreApiConfig,
} from "./storage";

export const defaultDatabaseConfig: DatabaseConfig = {
  activeDriver: "sqlite",
  sqlite: {
    filePath: "./data/smartinvoice.db",
  },
  mariadb: {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "smartinvoice",
  },
  supabase: {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || "",
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "",
  },
};

// Interface untuk respons konfigurasi (menambahkan isEnvLocked)
export interface DbConfigResponse {
  config: DatabaseConfig;
  isEnvLocked: boolean;
}

// In-memory cache for ultra-fast UI rendering
let cachedDbConfig: DatabaseConfig = defaultDatabaseConfig;

// ==========================================
// LOCALSTORAGE FALLBACK (Mode Anonim)
// ==========================================
const LS_INVOICES_KEY = "smartinvoice_local_invoices";
const LS_SETTINGS_KEY = "smartinvoice_local_settings";

function getLocalInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(LS_INVOICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInvoice(invoice: Invoice): void {
  const invoices = getLocalInvoices();
  const idx = invoices.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) invoices[idx] = invoice;
  else invoices.push(invoice);
  localStorage.setItem(LS_INVOICES_KEY, JSON.stringify(invoices));
}

function deleteLocalInvoice(id: string): void {
  const invoices = getLocalInvoices().filter((i) => i.id !== id);
  localStorage.setItem(LS_INVOICES_KEY, JSON.stringify(invoices));
}

function getLocalSetting<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(`${LS_SETTINGS_KEY}_${key}`);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveLocalSetting<T>(key: string, value: T): void {
  localStorage.setItem(`${LS_SETTINGS_KEY}_${key}`, JSON.stringify(value));
}

// ==========================================
// CONFIGURATION & DRIVER MANAGEMENT
// ==========================================

export async function fetchDatabaseConfig(): Promise<DbConfigResponse> {
  try {
    const res = await fetch("/api/db/config");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        cachedDbConfig = data.config;
        return {
          config: data.config,
          isEnvLocked: data.isEnvLocked || false,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to fetch db config from server, using cached", e);
  }
  return {
    config: cachedDbConfig,
    isEnvLocked: false,
  };
}

export function getCachedDatabaseConfig(): DatabaseConfig {
  return cachedDbConfig;
}

export async function saveDatabaseConfig(
  config: Partial<DatabaseConfig>,
): Promise<{ success: boolean; config: DatabaseConfig; message: string }> {
  try {
    const res = await fetch("/api/db/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (data.success && data.config) {
      cachedDbConfig = data.config;
      return { success: true, config: data.config, message: data.message };
    }
    return {
      success: false,
      config: cachedDbConfig,
      message: data.message || "Gagal menyimpan konfigurasi",
    };
  } catch (err: any) {
    return {
      success: false,
      config: cachedDbConfig,
      message: err.message || "Gagal menghubungi server",
    };
  }
}

export async function testDatabaseConnection(
  driver: DatabaseDriver,
  credentials?: any,
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  try {
    const res = await fetch("/api/db/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  toDriver: DatabaseDriver,
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch("/api/db/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
// INVOICES CRUD (DENGAN FALLBACK)
// ==========================================

export async function fetchAllInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch("/api/invoices");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        return data.invoices;
      }
    }
  } catch (err) {
    console.warn("API offline, beralih ke LocalStorage", err);
  }
  // Fallback ke LocalStorage
  return getLocalInvoices();
}

export async function saveInvoiceRecord(invoice: Invoice): Promise<void> {
  try {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoice),
    });
    if (res.ok) return; // Berhasil simpan ke server
  } catch (err) {
    console.warn("API offline, menyimpan ke LocalStorage", err);
  }
  // Fallback ke LocalStorage
  saveLocalInvoice(invoice);
}

export async function deleteInvoiceRecord(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) return;
  } catch (err) {
    console.warn("API offline, menghapus dari LocalStorage", err);
  }
  // Fallback ke LocalStorage
  deleteLocalInvoice(id);
}

// ==========================================
// SETTINGS PERSISTENCE (DENGAN FALLBACK)
// ==========================================

export async function fetchSetting<T>(
  key: string,
  defaultValue: T,
): Promise<T> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.value !== null && data.value !== undefined) {
        return data.value as T;
      }
    }
  } catch (err) {
    console.warn(`API offline, mengambil ${key} dari LocalStorage`, err);
  }
  // Fallback ke LocalStorage
  return getLocalSetting<T>(key, defaultValue);
}

export async function saveSettingRecord<T>(
  key: string,
  value: T,
): Promise<void> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) return;
  } catch (err) {
    console.warn(`API offline, menyimpan ${key} ke LocalStorage`, err);
  }
  // Fallback ke LocalStorage
  saveLocalSetting<T>(key, value);
}

// Convenience wrappers for specific settings
export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  return fetchSetting<BusinessProfile>(
    "business_profile",
    defaultBusinessProfile,
  );
}

export async function saveBusinessProfile(
  profile: BusinessProfile,
): Promise<void> {
  return saveSettingRecord<BusinessProfile>("business_profile", profile);
}

export async function fetchOpenWaConfig(): Promise<WhatsAppConfig> {
  return fetchSetting<WhatsAppConfig>("openwa_config", defaultOpenWaConfig);
}

export async function saveOpenWaConfig(config: WhatsAppConfig): Promise<void> {
  return saveSettingRecord<WhatsAppConfig>("openwa_config", config);
}

export async function fetchStoreApiConfig(): Promise<StoreApiConfig> {
  return fetchSetting<StoreApiConfig>(
    "store_api_config",
    defaultStoreApiConfig,
  );
}

export async function saveStoreApiConfig(
  config: StoreApiConfig,
): Promise<void> {
  return saveSettingRecord<StoreApiConfig>("store_api_config", config);
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
