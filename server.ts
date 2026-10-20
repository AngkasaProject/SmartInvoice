import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  loadServerDbConfig,
  saveServerDbConfig,
  testConnection,
  migrateDataBetweenDrivers,
  getAllInvoices,
  saveInvoice,
  deleteInvoice,
  getSetting,
  saveSetting,
} from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Local uploads directory (keeps DB lightweight by saving images on disk)
  const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Serve static uploaded files (logo, QRIS, etc.)
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Increase payload limit to handle base64 PDFs & images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ==========================================
  // IMAGE UPLOAD ENDPOINT
  // ==========================================
  app.post('/api/upload', (req, res) => {
    try {
      const { image, filename } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, message: 'Tidak ada data gambar yang dikirim.' });
      }

      // Check if data is Base64 URI
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const ext = matches ? (matches[1].split('/')[1] || 'png') : 'png';
      const base64Data = matches ? matches[2] : image;

      const cleanExt = ext === 'jpeg' ? 'jpg' : ext.replace(/[^a-zA-Z0-9]/g, '');
      const rawName = (filename || 'image').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueFilename = `${rawName}_${Date.now()}.${cleanExt}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);

      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

      const publicUrl = `/uploads/${uniqueFilename}`;
      return res.json({
        success: true,
        message: 'Gambar berhasil diunggah ke penyimpanan lokal server',
        url: publicUrl,
        filename: uniqueFilename,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengunggah gambar: ' + err.message,
      });
    }
  });

  // ==========================================
  // DATABASE MANAGEMENT ENDPOINTS
  // ==========================================

  // 1. Get current database configuration
  app.get('/api/db/config', (req, res) => {
    try {
      const config = loadServerDbConfig();
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. Save database configuration
  app.post('/api/db/config', (req, res) => {
    try {
      const updated = saveServerDbConfig(req.body);
      res.json({
        success: true,
        config: updated,
        message: 'Konfigurasi database server berhasil disimpan',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. Test database connection
  app.post('/api/db/test', async (req, res) => {
    try {
      const { driver, credentials } = req.body;
      const result = await testConnection(driver, credentials);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Migrate database between drivers
  app.post('/api/db/migrate', async (req, res) => {
    try {
      const { fromDriver, toDriver } = req.body;
      const result = await migrateDataBetweenDrivers(fromDriver, toDriver);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Invoices CRUD Endpoints
  app.get('/api/invoices', async (req, res) => {
    try {
      const invoices = await getAllInvoices();
      res.json({ success: true, invoices });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/invoices', async (req, res) => {
    try {
      await saveInvoice(req.body);
      res.json({ success: true, message: 'Invoice berhasil disimpan ke database' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/invoices/:id', async (req, res) => {
    try {
      await deleteInvoice(req.params.id);
      res.json({ success: true, message: 'Invoice berhasil dihapus dari database' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Settings KV Endpoints
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const value = await getSetting(req.params.key, null);
      res.json({ success: true, value });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/settings/:key', async (req, res) => {
    try {
      await saveSetting(req.params.key, req.body.value);
      res.json({
        success: true,
        message: `Pengaturan ${req.params.key} berhasil disimpan ke database`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // OPENWA PROXY ENDPOINTS (rmyndharis/OpenWA)
  // ==========================================
  app.post('/api/openwa/test', async (req, res) => {
    const { serverUrl, apiKey } = req.body;
    if (!serverUrl) {
      return res.status(400).json({ success: false, message: 'URL Server OpenWA belum diisi' });
    }

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['api_key'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }

      // Try calling status or getMe endpoint
      const testEndpoints = ['/status', '/getMe', '/ping', '/session/status', ''];
      let lastError = null;
      let connected = false;
      let responseData = null;

      for (const ep of testEndpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);

          const target = `${cleanUrl}${ep}`;
          const response = await fetch(target, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok || response.status === 401 || response.status === 403) {
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

      if (connected) {
        return res.json({
          success: true,
          message: `Terhubung dengan OpenWA server (${latencyMs}ms)`,
          latencyMs,
          data: responseData,
        });
      }

      return res.json({
        success: false,
        message: `Tidak dapat menghubungi OpenWA di ${cleanUrl}. Pastikan server OpenWA aktif. (${lastError || 'Timeout'})`,
        latencyMs,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Gagal menghubungi server OpenWA',
      });
    }
  });

  app.post('/api/openwa/send', async (req, res) => {
    const {
      serverUrl,
      apiKey,
      endpointType = 'sendPdf',
      customEndpointPath,
      chatId,
      phone,
      file, // Base64 data URI or url
      filename,
      caption,
    } = req.body;

    if (!serverUrl) {
      return res.status(400).json({ success: false, message: 'Server URL OpenWA belum ditentukan' });
    }

    if (!chatId && !phone) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp penerima belum diisi' });
    }

    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const cleanPhone = (phone || chatId || '').replace(/\D/g, '');
    const formattedChatId = cleanPhone.includes('@c.us')
      ? cleanPhone
      : `${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone.startsWith('62') ? cleanPhone : '62' + cleanPhone}@c.us`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['api_key'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }

    // Determine target endpoint
    let targetPath = '/sendPdf';
    if (endpointType === 'sendFile') targetPath = '/sendFile';
    else if (endpointType === 'sendMessageWithMedia') targetPath = '/sendMessageWithMedia';
    else if (endpointType === 'custom' && customEndpointPath) targetPath = customEndpointPath;

    if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

    const payloadCandidates = [
      {
        to: formattedChatId,
        chatId: formattedChatId,
        phone: formattedChatId,
        file: file,
        filename: filename || 'Invoice.pdf',
        caption: caption || '',
      },
      {
        chatId: formattedChatId,
        base64: file,
        filename: filename || 'Invoice.pdf',
        caption: caption || '',
      },
    ];

    try {
      let finalResponse: any = null;
      let lastErrorMessage = '';

      for (const payload of payloadCandidates) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const fullTargetUrl = `${cleanUrl}${targetPath}`;
          const response = await fetch(fullTargetUrl, {
            method: 'POST',
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
            lastErrorMessage = resJson.message || resJson.error || `HTTP ${response.status}`;
            finalResponse = resJson;
          }
        } catch (e: any) {
          lastErrorMessage = e.message;
        }
      }

      if (finalResponse && !lastErrorMessage) {
        return res.json({
          success: true,
          message: 'Invoice PDF berhasil dikirim via OpenWA!',
          data: finalResponse,
        });
      }

      return res.json({
        success: !lastErrorMessage,
        message: lastErrorMessage ? `Gagal mengirim via OpenWA: ${lastErrorMessage}` : 'Terkirim ke OpenWA',
        data: finalResponse,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Kesalahan internal proxy OpenWA',
      });
    }
  });

  // ==========================================
  // FONNTE PROXY ENDPOINTS (https://fonnte.com)
  // ==========================================
  app.post('/api/fonnte/test', async (req, res) => {
    const { token } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Token Fonnte belum diisi.' });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: {
          Authorization: token.trim(),
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;
      const data: any = await response.json();

      if (data.status === true) {
        const deviceStatus = data.device_status || 'connect';
        if (deviceStatus === 'connect') {
          return res.json({
            success: true,
            message: `Terhubung dengan Fonnte (${latencyMs}ms) - Perangkat: ${data.name || data.device || 'Online'}!`,
            latencyMs,
            data,
          });
        } else {
          return res.json({
            success: false,
            message: `Akun Fonnte terdaftar, namun status perangkat '${deviceStatus}'. Pastikan WhatsApp sudah terhubung di dashboard Fonnte.`,
            latencyMs,
            data,
          });
        }
      }

      return res.json({
        success: false,
        message: data.reason || data.message || 'Token Fonnte tidak valid atau perangkat terputus.',
        latencyMs,
        data,
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return res.status(500).json({
        success: false,
        message: 'Gagal menghubungi server Fonnte: ' + err.message,
        latencyMs,
      });
    }
  });

  app.post('/api/fonnte/send', async (req, res) => {
    const { token, target, file, filename, caption } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token Fonnte wajib diisi.' });
    }
    if (!target) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp penerima wajib diisi.' });
    }

    let cleanTarget = target.replace(/\D/g, '');
    if (cleanTarget.startsWith('0')) cleanTarget = '62' + cleanTarget.slice(1);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const payload: Record<string, any> = {
        target: cleanTarget,
        message: caption || '',
      };

      if (file) {
        payload.url = file.startsWith('data:') ? file : `data:application/pdf;base64,${file}`;
        payload.filename = filename || 'Invoice.pdf';
      }

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data: any = await response.json();

      if (data.status === true) {
        return res.json({
          success: true,
          message: 'Invoice PDF berhasil dikirim via Fonnte!',
          data,
        });
      }

      return res.json({
        success: false,
        message: data.reason || data.message || 'Gagal mengirim pesan via Fonnte.',
        data,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Gagal mengirim pesan via Fonnte: ' + err.message,
      });
    }
  });

  // ==========================================
  // STORE WEBHOOK ORDER INGESTION
  // ==========================================
  const handleStoreOrder = async (req: express.Request, res: express.Response) => {
    try {
      const {
        orderId,
        customer,
        items = [],
        discount = 0,
        shippingFee = 0,
        taxRate = 0,
        notes = '',
        status = 'unpaid',
      } = req.body;

      if (!customer || !customer.name || !customer.phone) {
        return res.status(400).json({
          success: false,
          message: 'Data customer (nama dan nomor WhatsApp) wajib diisi.',
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Daftar item pesanan toko tidak boleh kosong.',
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 7);
      const dueDate = dueDateObj.toISOString().split('T')[0];

      const cleanOrderId = (orderId || `${Date.now()}`).replace(/[^a-zA-Z0-9-]/g, '');
      const invoiceNumber = `INV-STORE-${cleanOrderId}`;

      const formattedItems = items.map((item: any, idx: number) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice || item.price) || 0;
        return {
          id: `item_store_${Date.now()}_${idx}`,
          name: item.name || 'Barang Pesanan',
          description: item.description || '',
          quantity: qty,
          unit: item.unit || 'Pcs',
          unitPrice: price,
          discountPercent: parseFloat(item.discountPercent) || 0,
          amount: qty * price,
        };
      });

      const subtotal = formattedItems.reduce((acc, curr) => acc + curr.amount, 0);
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
        status: (status === 'paid' ? 'paid' : 'unpaid') as any,
        client: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || '',
          company: customer.company || '',
          address: customer.address || '',
          npwp: customer.npwp || '',
        },
        items: formattedItems,
        subtotal,
        discountType: 'fixed' as const,
        discountValue: discountVal,
        discountAmount: discountVal,
        taxRate: taxRateVal,
        taxAmount,
        shippingFee: shipVal,
        total,
        notes: notes || `Pesanan otomatis dari Toko Online (Order #${cleanOrderId})`,
        terms: 'Pembayaran tagihan pesanan online. Hubungi kontak resmi jika butuh bantuan.',
        paidAt: status === 'paid' ? new Date().toISOString() : undefined,
        paidMethod: status === 'paid' ? 'Online Payment Gateway' : undefined,
        whatsappStatus: 'not_sent' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save directly to the active database!
      await saveInvoice(newInvoice);

      return res.status(201).json({
        success: true,
        message: 'Pesanan toko berhasil diproses menjadi Invoice resmi di database!',
        invoiceNumber,
        invoice: newInvoice,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses pesanan toko: ' + err.message,
      });
    }
  };

  app.post('/api/orders/webhook', handleStoreOrder);
  app.post('/api/invoices/create-from-order', handleStoreOrder);

  // Check health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount Vite middleware in development
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SmartInvoice Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
