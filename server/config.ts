import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";

export interface DatabaseConfig {
  activeDriver: "sqlite" | "d1" | "supabase" | "neon";
  sqlite: { filePath: string };
  d1: { binding: string };
  supabase: {
    url: string;
    anonKey: string;
    configured?: boolean;
    storageBucket?: string;
  };
  neon: {
    configured: boolean;
    connectionString?: string;
    storageEndpoint?: string;
    storageRegion?: string;
    storageBucket?: string;
    storageAccessKeyId?: string;
    storageSecretAccessKey?: string;
    storageConfigured?: boolean;
  };
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.resolve(
  process.cwd(),
  process.env.SQLITE_PATH || "./data/smartinvoice.db",
);
const CONFIG_PATH = path.join(DATA_DIR, "server-config.json");

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
const defaultDb = new Database(DB_PATH, { create: true });
defaultDb.run(`
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

function defaultConfig(): DatabaseConfig {
  return {
    activeDriver: "sqlite",
    sqlite: { filePath: DB_PATH },
    d1: { binding: "" },
    supabase: {
      url: "",
      anonKey: "",
      storageBucket: "smartinvoice-assets",
    },
    neon: {
      configured: false,
      storageEndpoint: "",
      storageRegion: "",
      storageBucket: "smartinvoice-assets",
      storageAccessKeyId: "",
      storageSecretAccessKey: "",
      storageConfigured: false,
    },
  };
}

function readStoredConfig(): DatabaseConfig {
  const row = defaultDb
    .query("SELECT value FROM app_config WHERE key = ?")
    .get("database_config") as { value: string } | null;
  if (row) return { ...defaultConfig(), ...JSON.parse(row.value) };

  if (fs.existsSync(CONFIG_PATH)) {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const stored: DatabaseConfig = {
      ...defaultConfig(),
      ...raw,
      activeDriver: raw.activeDriver === "mariadb" ? "sqlite" : raw.activeDriver,
      sqlite: { ...defaultConfig().sqlite, ...raw.sqlite },
      supabase: { ...defaultConfig().supabase, ...raw.supabase },
      neon: {
        ...defaultConfig().neon,
        ...raw.neon,
        connectionString:
          raw.neon?.connectionString || process.env.NEON_DATABASE_URL || "",
        storageEndpoint: raw.neon?.storageEndpoint || "",
        storageRegion: raw.neon?.storageRegion || "",
        storageBucket:
          raw.neon?.storageBucket || defaultConfig().neon.storageBucket,
        storageAccessKeyId: raw.neon?.storageAccessKeyId || "",
        storageSecretAccessKey: raw.neon?.storageSecretAccessKey || "",
        storageConfigured: Boolean(
          raw.neon?.storageEndpoint &&
            raw.neon?.storageRegion &&
            raw.neon?.storageBucket &&
            raw.neon?.storageAccessKeyId &&
            raw.neon?.storageSecretAccessKey,
        ),
      },
    };
    persistConfig(stored);
    try {
      fs.unlinkSync(CONFIG_PATH);
    } catch (error) {
      console.warn(
        "[config] Config lama sudah dipindahkan ke SQLite, tetapi file lama tidak dapat dihapus.",
        error,
      );
    }
    return stored;
  }

  return defaultConfig();
}

function persistConfig(config: DatabaseConfig): void {
  defaultDb
    .query(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run("database_config", JSON.stringify(config), new Date().toISOString());
}

export function isDatabaseEnvLocked(): boolean {
  return Boolean(
    process.env.DATABASE_DRIVER ||
      process.env.SUPABASE_URL ||
      process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEON_DATABASE_URL,
  );
}

export function getDatabaseConfig(): DatabaseConfig {
  const stored = readStoredConfig();
  const requestedDriver = process.env.DATABASE_DRIVER?.toLowerCase();
  if (
    requestedDriver &&
    requestedDriver !== "sqlite" &&
    requestedDriver !== "neon" &&
    requestedDriver !== "supabase"
  ) {
    throw new Error(
      `DATABASE_DRIVER '${requestedDriver}' tidak didukung oleh server Bun.`,
    );
  }

  if (!isDatabaseEnvLocked()) return stored;

  const activeDriver =
    requestedDriver === "sqlite" ||
    requestedDriver === "neon" ||
    requestedDriver === "supabase"
      ? requestedDriver
      : process.env.NEON_DATABASE_URL
        ? "neon"
        : process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY
          ? "supabase"
          : stored.activeDriver;

  return {
    ...stored,
    activeDriver,
    sqlite: { filePath: DB_PATH },
    supabase: {
      url: process.env.SUPABASE_URL || stored.supabase.url,
      anonKey: process.env.SUPABASE_ANON_KEY || stored.supabase.anonKey,
      storageBucket:
        process.env.SUPABASE_STORAGE_BUCKET ||
        stored.supabase.storageBucket ||
        "smartinvoice-assets",
    },
    neon: {
      configured: Boolean(
        process.env.NEON_DATABASE_URL || stored.neon.connectionString,
      ),
      connectionString:
        process.env.NEON_DATABASE_URL || stored.neon.connectionString || "",
      storageEndpoint: stored.neon.storageEndpoint,
      storageRegion: stored.neon.storageRegion,
      storageBucket: stored.neon.storageBucket,
      storageAccessKeyId: stored.neon.storageAccessKeyId,
      storageSecretAccessKey: stored.neon.storageSecretAccessKey,
      storageConfigured: stored.neon.storageConfigured,
    },
  };
}

export function getPublicDatabaseConfig(
  config: DatabaseConfig = getDatabaseConfig(),
): DatabaseConfig {
  return {
    ...config,
    supabase: {
      url: config.supabase.url,
      anonKey: "",
      configured: Boolean(config.supabase.anonKey),
      storageBucket: config.supabase.storageBucket || "smartinvoice-assets",
    },
    neon: {
      configured: Boolean(
        config.neon.connectionString || process.env.NEON_DATABASE_URL,
      ),
      connectionString: "",
      storageEndpoint: config.neon.storageEndpoint || "",
      storageRegion: config.neon.storageRegion || "",
      storageBucket: config.neon.storageBucket || "smartinvoice-assets",
      storageAccessKeyId: "",
      storageSecretAccessKey: "",
      storageConfigured: Boolean(
        config.neon.storageEndpoint &&
          config.neon.storageRegion &&
          config.neon.storageBucket &&
          config.neon.storageAccessKeyId &&
          config.neon.storageSecretAccessKey,
      ),
    },
  };
}

export function saveDatabaseConfig(
  update: Partial<DatabaseConfig>,
): DatabaseConfig {
  if (isDatabaseEnvLocked()) {
    throw new Error(
      "Konfigurasi database dikunci oleh Environment Variable.",
    );
  }

  const current = readStoredConfig();
  const next: DatabaseConfig = {
    ...current,
    ...update,
    sqlite: { ...current.sqlite, ...update.sqlite, filePath: DB_PATH },
    d1: { ...current.d1, ...update.d1 },
    supabase: {
      ...current.supabase,
      ...update.supabase,
      anonKey: update.supabase?.anonKey || current.supabase.anonKey,
      storageBucket:
        update.supabase?.storageBucket ||
        current.supabase.storageBucket ||
        "smartinvoice-assets",
    },
    neon: {
      ...current.neon,
      ...update.neon,
      connectionString:
        update.neon?.connectionString || current.neon.connectionString || "",
      storageEndpoint:
        update.neon?.storageEndpoint || current.neon.storageEndpoint || "",
      storageRegion:
        update.neon?.storageRegion || current.neon.storageRegion || "",
      storageBucket:
        update.neon?.storageBucket || current.neon.storageBucket || "smartinvoice-assets",
      storageAccessKeyId:
        update.neon?.storageAccessKeyId ||
        current.neon.storageAccessKeyId ||
        "",
      storageSecretAccessKey:
        update.neon?.storageSecretAccessKey ||
        current.neon.storageSecretAccessKey ||
        "",
      storageConfigured: Boolean(
        update.neon?.storageEndpoint || current.neon.storageEndpoint
      ) &&
        Boolean(update.neon?.storageRegion || current.neon.storageRegion) &&
        Boolean(update.neon?.storageBucket || current.neon.storageBucket) &&
        Boolean(update.neon?.storageAccessKeyId || current.neon.storageAccessKeyId) &&
        Boolean(
          update.neon?.storageSecretAccessKey ||
            current.neon.storageSecretAccessKey,
        ),
    },
  };

  if (next.activeDriver === "d1") {
    throw new Error("Cloudflare D1 hanya tersedia pada runtime Workers.");
  }
  if (
    next.activeDriver !== "sqlite" &&
    next.activeDriver !== "supabase" &&
    next.activeDriver !== "neon"
  ) {
    throw new Error("Driver database tidak valid untuk server Bun.");
  }
  if (next.activeDriver === "neon" && !next.neon.connectionString) {
    throw new Error("Connection string Neon wajib diisi.");
  }
  if (
    next.activeDriver === "neon" &&
    (!next.neon.storageEndpoint ||
      !next.neon.storageRegion ||
      !next.neon.storageBucket ||
      !next.neon.storageAccessKeyId ||
      !next.neon.storageSecretAccessKey)
  ) {
    throw new Error("Konfigurasi Neon Object Storage wajib diisi.");
  }
  if (
    next.activeDriver === "supabase" &&
    (!next.supabase.url || !next.supabase.anonKey)
  ) {
    throw new Error("URL dan Anon Key Supabase wajib diisi.");
  }

  persistConfig(next);
  return next;
}

export function getWhatsAppEnvConfig() {
  const provider = process.env.WHATSAPP_PROVIDER as
    | "openwa"
    | "fonnte"
    | undefined;

  if (!provider) return null;

  return {
    provider,
    serverUrl: process.env.OPENWA_SERVER_URL || "",
    apiKey: process.env.OPENWA_API_KEY || "",
    sessionName: process.env.OPENWA_SESSION_ID || "",
    fonnteToken: process.env.FONNTE_TOKEN || "",
    endpointType: "sendPdf",
    customEndpointPath: "/sendPdf",
    autoSendCaption: process.env.WHATSAPP_CAPTION_TEMPLATE || "",
    directWhatsappFallback: true,
  };
}
