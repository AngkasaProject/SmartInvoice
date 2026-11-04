CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  issue_date TEXT,
  due_date TEXT,
  status TEXT,
  client_data TEXT NOT NULL DEFAULT '{}',
  items_data TEXT NOT NULL DEFAULT '[]',
  subtotal REAL DEFAULT 0,
  discount_type TEXT,
  discount_value REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  shipping_fee REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  payment_instructions TEXT,
  payment_method TEXT,
  payment_account_number TEXT,
  down_payment REAL DEFAULT 0,
  remaining_balance REAL DEFAULT 0,
  paid_at TEXT,
  paid_method TEXT,
  whatsapp_status TEXT,
  whatsapp_sent_at TEXT,
  whatsapp_recipient TEXT,
  whatsapp_last_log TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT
);
