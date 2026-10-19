import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Increase payload limit to handle base64 PDFs
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // OpenWa API Proxy endpoints to bypass CORS and mixed-content issues
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
    }

    // Determine target endpoint
    let targetPath = '/sendPdf';
    if (endpointType === 'sendFile') targetPath = '/sendFile';
    else if (endpointType === 'sendMessageWithMedia') targetPath = '/sendMessageWithMedia';
    else if (endpointType === 'custom' && customEndpointPath) targetPath = customEndpointPath;

    if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

    const payloadCandidates = [
      // Standard OpenWA sendPdf format: { to: '...', file: '...', filename: '...', caption: '...' }
      {
        to: formattedChatId,
        chatId: formattedChatId,
        phone: formattedChatId,
        file: file,
        filename: filename || 'Invoice.pdf',
        caption: caption || '',
      },
      // Alternative OpenWA format with base64 / data string
      {
        chatId: formattedChatId,
        base64: file,
        filename: filename || 'Invoice.pdf',
        caption: caption || '',
      }
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

          if (response.ok && (resJson.success !== false && !resJson.error)) {
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

      // If OpenWA responded with structured data
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

  // In-memory queue for incoming store orders
  const receivedStoreOrders: any[] = [];

  // Store Webhook Endpoint to automatically ingest orders from WooCommerce / Shopify / Custom Store
  const handleStoreOrder = (req: express.Request, res: express.Response) => {
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
        status: status === 'paid' ? 'paid' : 'unpaid',
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
        discountType: 'fixed',
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
        whatsappStatus: 'not_sent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      receivedStoreOrders.push(newInvoice);

      return res.status(201).json({
        success: true,
        message: 'Pesanan toko berhasil diproses menjadi Invoice resmi!',
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

  // Poll or retrieve incoming store orders for frontend ingestion
  app.get('/api/orders/webhook', (req, res) => {
    const orders = [...receivedStoreOrders];
    receivedStoreOrders.length = 0; // Drain queue
    res.json({ success: true, count: orders.length, orders });
  });

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
    console.log(`🚀 KirimInvoice Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
