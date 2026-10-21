import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  testConnection,
  migrateDataBetweenDrivers,
  getAllInvoices,
  saveInvoice,
  deleteInvoice,
  getSetting,
  saveSetting,
  checkAdminExists, // Import fungsi auth
  createAdminUser, // Import fungsi auth
  getAdminUser, // Import fungsi auth
} from "./server/db.ts";

import {
  getDatabaseConfig,
  saveDatabaseConfig,
  getWhatsAppEnvConfig,
} from "./server/config.ts";
import { uploadImage } from "./server/storage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
  app.get("/api/auth/status", async (req, res) => {
    try {
      const hasAdmin = await checkAdminExists();
      const isDbActive =
        Boolean(process.env.SUPABASE_URL) ||
        fs.existsSync(path.join(process.cwd(), "data", "smartinvoice.db"));

      // Mode anonim jika tidak ada Supabase, tidak ada file SQLite, dan belum ada user
      const isAnonymous = !isDbActive && !hasAdmin;

      res.json({ success: true, hasAdmin, isAnonymous });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (await checkAdminExists()) {
        return res
          .status(400)
          .json({ success: false, message: "Admin sudah ada." });
      }

      // Hash password (Bun native)
      const passwordHash = await Bun.password.hash(password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const newUser = {
        id: `user_${Date.now()}`,
        username,
        password_hash: passwordHash,
        role: "admin",
        created_at: new Date().toISOString(),
      };

      await createAdminUser(newUser);
      res.json({ success: true, message: "Admin berhasil dibuat." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await getAdminUser(username);

      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "User tidak ditemukan." });
      }

      const isMatch = await Bun.password.verify(password, user.password_hash);

      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Password salah." });
      }

      res.json({
        success: true,
        token: `auth_${Date.now()}`,
        user: { username: user.username },
      });
    } catch (err: any) {
      console.error("Login Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // IMAGE UPLOAD & DELETE
  // ==========================================
  app.post("/api/upload", async (req, res) => {
    try {
      const { image, filename } = req.body;
      if (!image)
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada data gambar." });

      const result = await uploadImage(image, filename || "upload.png");
      if (result.success)
        return res.json({
          success: true,
          message: "Gambar berhasil diunggah",
          url: result.url,
        });
      return res.status(500).json({
        success: false,
        message: "Gagal mengunggah gambar: " + result.message,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "Gagal mengunggah gambar: " + err.message,
      });
    }
  });

  app.post("/api/delete-file", async (req, res) => {
    try {
      const { fileUrl } = req.body;
      if (!fileUrl) return res.json({ success: true });

      if (fileUrl.startsWith("/uploads/")) {
        const filename = fileUrl.replace("/uploads/", "");
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return res.json({ success: true, message: "File lokal dihapus" });
        }
      }

      if (fileUrl.includes("supabase.co")) {
        const config = getDatabaseConfig();
        if (config.supabase.url && config.supabase.anonKey) {
          const supabase = createClient(
            config.supabase.url,
            config.supabase.anonKey,
          );
          const match = fileUrl.match(/\/([^/]+\/[^/]+)$/);
          const filePathInBucket = match ? match[1] : "";

          if (filePathInBucket) {
            const bucketName =
              process.env.SUPABASE_STORAGE_BUCKET || "smartinvoice-assets";
            const { error } = await supabase.storage
              .from(bucketName)
              .remove([filePathInBucket]);
            if (error) throw error;
            return res.json({
              success: true,
              message: "File Supabase dihapus",
            });
          }
        }
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // DATABASE CONFIG ENDPOINTS
  // ==========================================
  app.get("/api/db/config", (req, res) => {
    try {
      const config = getDatabaseConfig();
      const isEnvLocked = Boolean(process.env.SUPABASE_URL);
      res.json({ success: true, config, isEnvLocked });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/db/config", (req, res) => {
    try {
      const updated = saveDatabaseConfig(req.body);
      res.json({
        success: true,
        config: updated,
        message: "Konfigurasi disimpan",
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/db/test", async (req, res) => {
    try {
      const { driver, credentials } = req.body;
      const result = await testConnection(driver, credentials);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/db/migrate", async (req, res) => {
    try {
      const { fromDriver, toDriver } = req.body;
      const result = await migrateDataBetweenDrivers(fromDriver, toDriver);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // INVOICES CRUD
  // ==========================================
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await getAllInvoices();
      res.json({ success: true, invoices });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      await saveInvoice(req.body);
      res.json({ success: true, message: "Invoice disimpan" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      await deleteInvoice(req.params.id);
      res.json({ success: true, message: "Invoice dihapus" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // SETTINGS KV
  // ==========================================
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const key = req.params.key;
      if (key === "openwa_config") {
        const envWa = getWhatsAppEnvConfig();
        if (envWa)
          return res.json({ success: true, value: envWa, isEnvLocked: true });
      }
      const value = await getSetting(key, null);
      res.json({ success: true, value, isEnvLocked: false });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/settings/:key", async (req, res) => {
    try {
      const key = req.params.key;
      if (key === "openwa_config" && getWhatsAppEnvConfig()) {
        return res
          .status(403)
          .json({ success: false, message: "Dikunci oleh ENV." });
      }
      await saveSetting(key, req.body.value);
      res.json({ success: true, message: `Pengaturan ${key} disimpan` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // OPENWA PROXY
  // ==========================================
  app.post("/api/openwa/test", async (req, res) => {
    const { serverUrl, apiKey } = req.body;
    if (!serverUrl)
      return res
        .status(400)
        .json({ success: false, message: "URL belum diisi" });

    const cleanUrl = serverUrl.replace(/\/+$/, "");
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["api_key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["X-API-Key"] = apiKey;
      }

      const testEndpoints = [
        "/status",
        "/getMe",
        "/ping",
        "/session/status",
        "",
      ];
      let connected = false;
      let responseData = null;
      let lastError = null;

      for (const ep of testEndpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const target = `${cleanUrl}${ep}`;
          const response = await fetch(target, {
            method: "GET",
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (
            response.ok ||
            response.status === 401 ||
            response.status === 403
          ) {
            connected = true;
            try {
              responseData = await response.json();
            } catch {
              responseData = await response.text();
            }
            break;
          }
        } catch (e: any) {
          lastError = e?.message;
        }
      }

      const latencyMs = Date.now() - startTime;
      if (connected)
        return res.json({
          success: true,
          message: `Terhubung (${latencyMs}ms)`,
          latencyMs,
          data: responseData,
        });
      return res.json({
        success: false,
        message: `Gagal (${lastError || "Timeout"})`,
        latencyMs,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, message: err?.message || "Gagal" });
    }
  });

  app.post("/api/openwa/send", async (req, res) => {
    const {
      serverUrl,
      apiKey,
      endpointType = "sendPdf",
      customEndpointPath,
      chatId,
      phone,
      file,
      filename,
      caption,
    } = req.body;
    if (!serverUrl)
      return res
        .status(400)
        .json({ success: false, message: "URL belum ditentukan" });
    if (!chatId && !phone)
      return res
        .status(400)
        .json({ success: false, message: "Nomor belum diisi" });

    const cleanUrl = serverUrl.replace(/\/+$/, "");
    const cleanPhone = (phone || chatId || "").replace(/\D/g, "");
    const formattedChatId = cleanPhone.includes("@c.us")
      ? cleanPhone
      : `${cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone.startsWith("62") ? cleanPhone : "62" + cleanPhone}@c.us`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["api_key"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }

    let targetPath = "/sendPdf";
    if (endpointType === "sendFile") targetPath = "/sendFile";
    else if (endpointType === "sendMessageWithMedia")
      targetPath = "/sendMessageWithMedia";
    else if (endpointType === "custom" && customEndpointPath)
      targetPath = customEndpointPath;
    if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;

    const payloadCandidates = [
      {
        to: formattedChatId,
        chatId: formattedChatId,
        phone: formattedChatId,
        file,
        filename: filename || "Invoice.pdf",
        caption: caption || "",
      },
      {
        chatId: formattedChatId,
        base64: file,
        filename: filename || "Invoice.pdf",
        caption: caption || "",
      },
    ];

    try {
      let finalResponse: any = null;
      let lastErrorMessage = "";

      for (const payload of payloadCandidates) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const response = await fetch(`${cleanUrl}${targetPath}`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          let resJson;
          try {
            resJson = await response.json();
          } catch {
            resJson = { raw: await response.text() };
          }

          if (response.ok && resJson.success !== false && !resJson.error) {
            finalResponse = resJson;
            break;
          } else {
            lastErrorMessage =
              resJson.message || resJson.error || `HTTP ${response.status}`;
            finalResponse = resJson;
          }
        } catch (e: any) {
          lastErrorMessage = e.message;
        }
      }

      if (finalResponse && !lastErrorMessage)
        return res.json({
          success: true,
          message: "Berhasil dikirim",
          data: finalResponse,
        });
      return res.json({
        success: !lastErrorMessage,
        message: lastErrorMessage ? `Gagal: ${lastErrorMessage}` : "Terkirim",
        data: finalResponse,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, message: err.message || "Kesalahan internal" });
    }
  });

  // ==========================================
  // FONNTE PROXY
  // ==========================================
  app.post("/api/fonnte/test", async (req, res) => {
    const { token } = req.body;
    if (!token || !token.trim())
      return res.status(400).json({ success: false, message: "Token kosong" });

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("https://api.fonnte.com/device", {
        method: "POST",
        headers: { Authorization: token.trim() },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;
      const data: any = await response.json();

      if (data.status === true) {
        const deviceStatus = data.device_status || "connect";
        if (deviceStatus === "connect")
          return res.json({
            success: true,
            message: `Terhubung (${latencyMs}ms)`,
            latencyMs,
            data,
          });
        return res.json({
          success: false,
          message: `Status: '${deviceStatus}'`,
          latencyMs,
          data,
        });
      }
      return res.json({
        success: false,
        message: data.reason || data.message || "Token invalid",
        latencyMs,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message,
        latencyMs: Date.now() - startTime,
      });
    }
  });

  app.post("/api/fonnte/send", async (req, res) => {
    const { token, target, file, filename, caption } = req.body;
    if (!token)
      return res.status(400).json({ success: false, message: "Token kosong" });
    if (!target)
      return res.status(400).json({ success: false, message: "Target kosong" });

    let cleanTarget = target.replace(/\D/g, "");
    if (cleanTarget.startsWith("0")) cleanTarget = "62" + cleanTarget.slice(1);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const payload: Record<string, any> = {
        target: cleanTarget,
        message: caption || "",
      };
      if (file) {
        payload.url = file.startsWith("data:")
          ? file
          : `data:application/pdf;base64,${file}`;
        payload.filename = filename || "Invoice.pdf";
      }

      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: token.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data: any = await response.json();

      if (data.status === true)
        return res.json({ success: true, message: "Berhasil dikirim", data });
      return res.json({
        success: false,
        message: data.reason || data.message || "Gagal",
        data,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // STORE WEBHOOK
  // ==========================================
  const handleStoreOrder = async (
    req: express.Request,
    res: express.Response,
  ) => {
    try {
      const {
        orderId,
        customer,
        items = [],
        discount = 0,
        shippingFee = 0,
        taxRate = 0,
        notes = "",
        status = "unpaid",
      } = req.body;

      if (!customer || !customer.name || !customer.phone)
        return res
          .status(400)
          .json({ success: false, message: "Data customer kurang" });
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ success: false, message: "Item kosong" });

      const today = new Date().toISOString().split("T")[0];
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 7);
      const dueDate = dueDateObj.toISOString().split("T")[0];
      const cleanOrderId = (orderId || `${Date.now()}`).replace(
        /[^a-zA-Z0-9-]/g,
        "",
      );
      const invoiceNumber = `INV-STORE-${cleanOrderId}`;

      const formattedItems = items.map((item: any, idx: number) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice || item.price) || 0;
        return {
          id: `item_store_${Date.now()}_${idx}`,
          name: item.name || "Barang",
          description: item.description || "",
          quantity: qty,
          unit: item.unit || "Pcs",
          unitPrice: price,
          discountPercent: parseFloat(item.discountPercent) || 0,
          amount: qty * price,
        };
      });

      const subtotal = formattedItems.reduce(
        (acc, curr) => acc + curr.amount,
        0,
      );
      const discountVal = parseFloat(discount) || 0;
      const shipVal = parseFloat(shippingFee) || 0;
      const taxRateVal = parseFloat(taxRate) || 0;
      const taxable = Math.max(0, subtotal - discountVal);
      const taxAmount = (taxable * taxRateVal) / 100;
      const total = Math.max(0, taxable + taxAmount + shipVal);

      const newInvoice = {
        id: `inv_store_${Date.now()}`,
        invoiceNumber,
        issueDate: today,
        dueDate,
        status: (status === "paid" ? "paid" : "unpaid") as any,
        client: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || "",
          company: customer.company || "",
          address: customer.address || "",
          npwp: customer.npwp || "",
        },
        items: formattedItems,
        subtotal,
        discountType: "fixed" as const,
        discountValue: discountVal,
        discountAmount: discountVal,
        taxRate: taxRateVal,
        taxAmount,
        shippingFee: shipVal,
        total,
        notes: notes || `Pesanan dari Toko Online (Order #${cleanOrderId})`,
        terms: "Pembayaran tagihan pesanan online.",
        paidAt: status === "paid" ? new Date().toISOString() : undefined,
        paidMethod: status === "paid" ? "Online Payment Gateway" : undefined,
        whatsappStatus: "not_sent" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveInvoice(newInvoice);
      return res.status(201).json({
        success: true,
        message: "Pesanan diproses",
        invoiceNumber,
        invoice: newInvoice,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post("/api/orders/webhook", handleStoreOrder);
  app.post("/api/invoices/create-from-order", handleStoreOrder);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // ==========================================
  // VITE MIDDLEWARE (DEV) / STATIC (PROD)
  // ==========================================
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SmartInvoice Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
