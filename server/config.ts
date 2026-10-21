import fs from "fs";
import path from "path";

export interface DatabaseConfig {
  activeDriver: "sqlite" | "mariadb" | "supabase";
  sqlite: { filePath: string };
  mariadb: {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
  };
  supabase: { url: string; anonKey: string };
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "server-config.json");

export function getDatabaseConfig(): DatabaseConfig {
  // 1. PRIORITAS UTAMA: Environment Variables (Docker / Cloudflare)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      activeDriver: "supabase",
      sqlite: { filePath: "" },
      mariadb: { host: "", port: 0, user: "", database: "" },
      supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
      },
    };
  }

  // 2. PRIORITAS KEDUA: File JSON Lokal (Jika tidak ada env)
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return {
        activeDriver: raw.activeDriver || "sqlite",
        sqlite: raw.sqlite || { filePath: "./data/smartinvoice.db" },
        mariadb: raw.mariadb || {
          host: "localhost",
          port: 3306,
          user: "root",
          database: "smartinvoice",
        },
        supabase: raw.supabase || { url: "", anonKey: "" },
      };
    }
  } catch (e) {
    console.warn("[config] Gagal membaca config lokal.");
  }

  // 3. DEFAULT (SQLite)
  return {
    activeDriver: "sqlite",
    sqlite: { filePath: "./data/smartinvoice.db" },
    mariadb: {
      host: "localhost",
      port: 3306,
      user: "root",
      database: "smartinvoice",
    },
    supabase: { url: "", anonKey: "" },
  };
}

export function saveDatabaseConfig(
  config: Partial<DatabaseConfig>,
): DatabaseConfig {
  // Jika di Cloud/Env mode, jangan simpan ke file (karena tidak permanen)
  if (process.env.SUPABASE_URL) {
    console.warn(
      "[config] Mode Environment Variable aktif. Perubahan config diabaikan.",
    );
    return getDatabaseConfig();
  }

  const current = getDatabaseConfig();
  const merged = { ...current, ...config };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
// Tambahkan di bagian bawah file server/config.ts

export function getWhatsAppEnvConfig() {
  const provider = process.env.WHATSAPP_PROVIDER as
    | "openwa"
    | "fonnte"
    | undefined;

  if (!provider) return null; // Jika tidak ada ENV, kembalikan null

  return {
    provider,
    serverUrl: process.env.OPENWA_SERVER_URL || "",
    apiKey: process.env.OPENWA_API_KEY || "",
    sessionName: process.env.OPENWA_SESSION_ID || "",
    fonnteToken: process.env.FONNTE_TOKEN || "",
    endpointType: "sendPdf", // Default
    customEndpointPath: "/sendPdf",
    autoSendCaption: process.env.WHATSAPP_CAPTION_TEMPLATE || "",
    directWhatsappFallback: true,
  };
}
