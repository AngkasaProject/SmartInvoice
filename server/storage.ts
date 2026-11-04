import fs from "fs";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { getDatabaseConfig } from "./config";

const DATA_DIR = path.resolve(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getNeonStorageClient(): S3Client {
  const { neon } = getDatabaseConfig();
  if (
    !neon.storageEndpoint ||
    !neon.storageRegion ||
    !neon.storageAccessKeyId ||
    !neon.storageSecretAccessKey
  ) {
    throw new Error("Konfigurasi Neon Object Storage belum lengkap.");
  }
  return new S3Client({
    region: neon.storageRegion,
    endpoint: neon.storageEndpoint,
    credentials: {
      accessKeyId: neon.storageAccessKeyId,
      secretAccessKey: neon.storageSecretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export async function testStorageConnection(
  provider: string,
  credentials?: Record<string, string>,
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const startedAt = Date.now();
  try {
    const config = getDatabaseConfig();
    if (provider === "neon") {
      const endpoint = credentials?.endpoint || config.neon.storageEndpoint;
      const region = credentials?.region || config.neon.storageRegion;
      const bucket = credentials?.bucket || config.neon.storageBucket;
      const accessKeyId =
        credentials?.accessKeyId || config.neon.storageAccessKeyId;
      const secretAccessKey =
        credentials?.secretAccessKey || config.neon.storageSecretAccessKey;
      if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
        throw new Error("Konfigurasi Neon Object Storage belum lengkap.");
      }
      const client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
      });
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } else if (provider === "supabase") {
      const url = credentials?.url || config.supabase.url;
      const anonKey = credentials?.anonKey || config.supabase.anonKey;
      const bucket =
        credentials?.bucket || config.supabase.storageBucket || "smartinvoice-assets";
      if (!url || !anonKey) {
        throw new Error("URL dan Anon Key Supabase belum dikonfigurasi.");
      }
      const { error } = await createClient(url, anonKey)
        .storage.from(bucket)
        .list("", { limit: 1 });
      if (error) throw new Error(`Supabase Storage: ${error.message}`);
    } else throw new Error(`Provider storage '${provider}' tidak didukung.`);
    return {
      success: true,
      message: `Berhasil terhubung ke ${provider} Object Storage.`,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Gagal menguji koneksi object storage.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

function getStorageKey(fileUrl: string): { provider: string; key: string } | null {
  try {
    const url = new URL(fileUrl, "http://localhost");
    const match = url.pathname.match(/^\/api\/storage\/(neon|supabase)\/(.+)$/);
    if (match) {
      return {
        provider: match[1],
        key: decodeURIComponent(match[2]),
      };
    }

    if (url.pathname.startsWith("/uploads/")) {
      return {
        provider: "local",
        key: decodeURIComponent(url.pathname.slice("/uploads/".length)),
      };
    }

    if (url.hostname.endsWith(".supabase.co")) {
      const marker = "/storage/v1/object/public/";
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        const [, ...parts] = url.pathname.slice(index + marker.length).split("/");
        return {
          provider: "supabase",
          key: decodeURIComponent(parts.join("/")),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function uploadImage(
  base64Data: string,
  originalFilename: string,
): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const config = getDatabaseConfig();
    const cleanBase64 = base64Data.includes(",")
      ? base64Data.split(",")[1]
      : base64Data;
    const buffer = Buffer.from(cleanBase64, "base64");
    const ext = path.extname(originalFilename).toLowerCase() || ".png";
    const allowedTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const contentType = allowedTypes[ext];
    if (!contentType) throw new Error("Format gambar tidak didukung.");

    const key = `public/img_${crypto.randomUUID()}${ext}`;
    if (config.activeDriver === "neon") {
      const bucket = config.neon.storageBucket;
      if (!bucket) throw new Error("Nama bucket Neon Object Storage belum diisi.");
      await getNeonStorageClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return {
        success: true,
        url: `/api/storage/neon/${encodeURIComponent(key)}`,
      };
    }

    if (config.activeDriver === "supabase") {
      if (!config.supabase.url || !config.supabase.anonKey) {
        throw new Error("Kredensial Supabase belum dikonfigurasi.");
      }
      const bucket = config.supabase.storageBucket || "smartinvoice-assets";
      const supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey,
      );
      const { error } = await supabase.storage
        .from(bucket)
        .upload(key, buffer, { contentType, upsert: true });
      if (error) throw new Error(`Supabase Storage: ${error.message}`);
      const { data } = supabase.storage.from(bucket).getPublicUrl(key);
      return {
        success: true,
        url: data.publicUrl,
      };
    }

    const filename = path.basename(key);
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return { success: true, url: `/uploads/${filename}` };
  } catch (err: any) {
    console.error("[storage] Gagal mengunggah gambar:", err.message);
    return { success: false, message: err.message };
  }
}

export async function getStoredImage(
  provider: "neon" | "supabase",
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const config = getDatabaseConfig();
  if (provider === "neon") {
    const bucket = config.neon.storageBucket;
    if (!bucket) throw new Error("Nama bucket Neon Object Storage belum diisi.");
    let response;
    try {
      response = await getNeonStorageClient().send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (error: any) {
      if (["NoSuchKey", "NotFound"].includes(error.name)) return null;
      throw error;
    }
    if (!response.Body) return null;
    return {
      body: await response.Body.transformToByteArray(),
      contentType: response.ContentType || "application/octet-stream",
    };
  }

  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error("Kredensial Supabase belum dikonfigurasi.");
  }
  const { data, error } = await createClient(
    config.supabase.url,
    config.supabase.anonKey,
  )
    .storage.from(config.supabase.storageBucket || "smartinvoice-assets")
    .download(key);
  if (error) {
    if (error.name === "StorageApiError" && error.status === 404) return null;
    throw new Error(`Supabase Storage: ${error.message}`);
  }
  return {
    body: new Uint8Array(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}

export async function deleteStoredFile(fileUrl: string): Promise<void> {
  const stored = getStorageKey(fileUrl);
  if (!stored) return;

  if (stored.provider === "local") {
    const safeKey = path.basename(stored.key);
    const filePath = path.join(UPLOADS_DIR, safeKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }

  const config = getDatabaseConfig();
  if (stored.provider === "neon") {
    if (!config.neon.storageBucket) {
      throw new Error("Nama bucket Neon Object Storage belum diisi.");
    }
    await getNeonStorageClient().send(
      new DeleteObjectCommand({
        Bucket: config.neon.storageBucket,
        Key: stored.key,
      }),
    );
    return;
  }

  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error("Kredensial Supabase belum dikonfigurasi.");
  }
  const { error } = await createClient(
    config.supabase.url,
    config.supabase.anonKey,
  )
    .storage.from(config.supabase.storageBucket || "smartinvoice-assets")
    .remove([stored.key]);
  if (error) throw new Error(`Supabase Storage: ${error.message}`);
}
