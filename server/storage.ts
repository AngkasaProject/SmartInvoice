import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getDatabaseConfig } from "./config";

const DATA_DIR = path.resolve(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Pastikan folder uploads ada di lokal
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function uploadImage(
  base64Data: string,
  originalFilename: string,
): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const config = getDatabaseConfig();

    // Bersihkan prefix data URI (misal: "data:image/png;base64,")
    const cleanBase64 = base64Data.includes(",")
      ? base64Data.split(",")[1]
      : base64Data;
    const buffer = Buffer.from(cleanBase64, "base64");

    // Buat nama file unik untuk menghindari tabrakan
    const ext = path.extname(originalFilename) || ".png";
    const filename = `img_${Date.now()}${ext}`;

    // ── OPSI 1: SUPABASE STORAGE (Cloudflare / Production) ──
    if (
      config.activeDriver === "supabase" &&
      config.supabase.url &&
      config.supabase.anonKey
    ) {
      const bucketName =
        process.env.SUPABASE_STORAGE_BUCKET || "smartinvoice-assets";
      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey,
      );

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(`public/${filename}`, buffer, {
          contentType: `image/${ext.replace(".", "")}`,
          upsert: true,
        });

      if (error) throw error;

      // Ambil URL Publik
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(`public/${filename}`);

      return { success: true, url: publicUrlData.publicUrl };
    }

    // ── OPSI 2: LOCAL DISK (Docker / Self-Hosted) ──
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    // Kembalikan URL relatif yang bisa diakses via static route di Express/Bun
    return { success: true, url: `/uploads/${filename}` };
  } catch (err: any) {
    console.error("[storage] Upload error:", err.message);
    return { success: false, message: err.message };
  }
}
