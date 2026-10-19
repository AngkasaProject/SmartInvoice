/**
 * Cloudflare Workers / Cloudflare Pages Edge Entry Point
 * Handles API proxying for OpenWA and routes static assets
 */

interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api_key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          runtime: 'Cloudflare Workers',
          time: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Test OpenWA endpoint
    if (url.pathname === '/api/openwa/test' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const { serverUrl, apiKey } = body;

        if (!serverUrl) {
          return new Response(
            JSON.stringify({ success: false, message: 'URL Server OpenWA belum diisi' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const startTime = Date.now();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['api_key'] = apiKey;
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        let connected = false;
        let responseData = null;
        let lastError = null;

        const testEndpoints = ['/status', '/getMe', '/ping', ''];
        for (const ep of testEndpoints) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const target = `${cleanUrl}${ep}`;
            const res = await fetch(target, {
              method: 'GET',
              headers,
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (res.ok || res.status === 401 || res.status === 403) {
              connected = true;
              try {
                responseData = await res.json();
              } catch {
                responseData = await res.text();
              }
              break;
            }
          } catch (e: any) {
            lastError = e?.message;
          }
        }

        const latencyMs = Date.now() - startTime;
        if (connected) {
          return new Response(
            JSON.stringify({
              success: true,
              message: `Terhubung dengan OpenWA server (${latencyMs}ms)`,
              latencyMs,
              data: responseData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: `Tidak dapat menghubungi OpenWA di ${cleanUrl}. (${lastError || 'Gagal terhubung'})`,
            latencyMs,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: err?.message || 'Gagal memproses request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send PDF via OpenWA
    if (url.pathname === '/api/openwa/send' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const {
          serverUrl,
          apiKey,
          endpointType = 'sendPdf',
          customEndpointPath,
          chatId,
          phone,
          file,
          filename,
          caption,
        } = body;

        if (!serverUrl) {
          return new Response(
            JSON.stringify({ success: false, message: 'Server URL OpenWA belum ditentukan' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const cleanPhone = (phone || chatId || '').replace(/\D/g, '');
        const formattedChatId = cleanPhone.includes('@c.us')
          ? cleanPhone
          : `${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone.startsWith('62') ? cleanPhone : '62' + cleanPhone}@c.us`;

        const cleanUrl = serverUrl.replace(/\/+$/, '');
        let targetPath = '/sendPdf';
        if (endpointType === 'sendFile') targetPath = '/sendFile';
        else if (endpointType === 'sendMessageWithMedia') targetPath = '/sendMessageWithMedia';
        else if (endpointType === 'custom' && customEndpointPath) targetPath = customEndpointPath;
        if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['api_key'] = apiKey;
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const payload = {
          to: formattedChatId,
          chatId: formattedChatId,
          phone: formattedChatId,
          file,
          filename: filename || 'Invoice.pdf',
          caption: caption || '',
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const openWaRes = await fetch(`${cleanUrl}${targetPath}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        let resData: any = {};
        try {
          resData = await openWaRes.json();
        } catch {
          resData = { raw: await openWaRes.text() };
        }

        if (openWaRes.ok && resData.success !== false && !resData.error) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Invoice PDF berhasil dikirim ke customer via OpenWA!',
              data: resData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: resData.message || resData.error || `HTTP ${openWaRes.status} dari OpenWA`,
            data: resData,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: err?.message || 'Error saat menghubungi OpenWA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Ingest Store Orders (Cloudflare Workers Edge Handler)
    if ((url.pathname === '/api/orders/webhook' || url.pathname === '/api/invoices/create-from-order') && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const {
          orderId,
          customer,
          items = [],
          discount = 0,
          shippingFee = 0,
          taxRate = 0,
          notes = '',
          status = 'unpaid',
        } = body;

        if (!customer || !customer.name || !customer.phone) {
          return new Response(
            JSON.stringify({ success: false, message: 'Data customer (nama & nomor WhatsApp) wajib diisi.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!Array.isArray(items) || items.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: 'Daftar item pesanan toko tidak boleh kosong.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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

        const subtotal = formattedItems.reduce((acc: number, curr: any) => acc + curr.amount, 0);
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

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Pesanan toko berhasil diproses menjadi Invoice resmi di Cloudflare Workers Edge!',
            invoiceNumber,
            invoice: newInvoice,
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, message: 'Gagal memproses pesanan toko: ' + err?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Polling endpoint for Store Webhook Orders
    if (url.pathname === '/api/orders/webhook' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ success: true, count: 0, orders: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Static asset serving for Cloudflare Pages / Workers
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('KirimInvoice Edge Ready', { status: 200 });
  },
};
