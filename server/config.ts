import fs from "fs";
import path from "path";

export interface DatabaseConfig {
  activeDriver: "sqlite" | "d1" | "supabase" | "neon";
  sqlite: { filePath: string };
  d1: { binding: string };
  supabase: { url: string; anonKey: string };
  neon: { configured: boolean };
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "server-config.json");

export function getDatabaseConfig(): DatabaseConfig {
  const requestedDriver = process.env.DATABASE_DRIVER;
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

  if (
    requestedDriver === "sqlite" ||
    requestedDriver === "neon" ||
    requestedDriver === "supabase"
  ) {
    return {
      activeDriver: requestedDriver,
      sqlite: { filePath: process.env.SQLITE_PATH || "./data/smartinvoice.db" },
      d1: { binding: "" },
      supabase: {
        url: process.env.SUPABASE_URL || "",
        anonKey: process.env.SUPABASE_ANON_KEY || "",
      },
      neon: { configured: Boolean(process.env.NEON_DATABASE_URL) },
    };
  }

  if (process.env.NEON_DATABASE_URL || process.env.SUPABASE_URL) {
    const activeDriver =
      requestedDriver === "neon" || requestedDriver === "supabase"
        ? requestedDriver
        : process.env.NEON_DATABASE_URL
          ? "neon"
          : "supabase";

    return {
      activeDriver,
      sqlite: { filePath: "./data/smartinvoice.db" },
      d1: { binding: "" },
      supabase: {
        url: process.env.SUPABASE_URL || "",
        anonKey: process.env.SUPABASE_ANON_KEY || "",
      },
      neon: { configured: Boolean(process.env.NEON_DATABASE_URL) },
    };
  }

  // File JSON lokal digunakan jika tidak ada driver ENV.
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      // Older configurations selected MariaDB but actually fell back to SQLite.
      const activeDriver =
        raw.activeDriver === "mariadb" ? "sqlite" : raw.activeDriver;
      return {
        activeDriver: activeDriver || "sqlite",
        sqlite: raw.sqlite || { filePath: "./data/smartinvoice.db" },
        d1: { binding: "" },
        supabase: raw.supabase || { url: "", anonKey: "" },
        neon: { configured: Boolean(process.env.NEON_DATABASE_URL) },
      };
    }
  } catch (e) {
    console.warn("[config] Gagal membaca config lokal.");
  }

  // 2. DEFAULT (SQLite for Bun/Docker)
  return {
    activeDriver: "sqlite",
    sqlite: { filePath: "./data/smartinvoice.db" },
    d1: { binding: "" },
    supabase: { url: "", anonKey: "" },
    neon: { configured: false },
  };
}

export function saveDatabaseConfig(
  config: Partial<DatabaseConfig>,
): DatabaseConfig {
  // Jika di Cloud/Env mode, jangan simpan ke file (karena tidak permanen)
  if (
    process.env.DATABASE_DRIVER ||
    process.env.SUPABASE_URL ||
    process.env.NEON_DATABASE_URL
  ) {
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
