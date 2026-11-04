CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  issue_date DATE,
  due_date DATE,
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
  production_stage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
