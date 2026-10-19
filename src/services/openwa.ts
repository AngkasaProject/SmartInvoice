import { BusinessProfile, Invoice, OpenWaConfig } from '../types/invoice';
import { cleanWhatsAppNumber, formatIndoDate, formatRupiah } from '../utils/formatters';

export interface OpenWaSendResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface OpenWaTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  data?: any;
}

/**
 * Replaces placeholders in the message template
 */
export function formatCaptionTemplate(
  template: string,
  invoice: Invoice,
  business: BusinessProfile
): string {
  const bankInfo = business.bankName
    ? `${business.bankName}\nNo. Rekening: ${business.bankAccountNumber}\na/n ${business.bankAccountHolder}`
    : 'Hubungi kami untuk informasi rekening';

  const statusLabel =
    invoice.status === 'paid'
      ? 'LUNAS ✅'
      : invoice.status === 'overdue'
      ? 'JATUH TEMPO ⚠️'
      : invoice.status === 'draft'
      ? 'DRAFT'
      : 'BELUM DIBAYAR ⏳';

  return template
    .replace(/\{client_name\}/g, invoice.client.name || 'Pelanggan')
    .replace(/\{invoice_no\}/g, invoice.invoiceNumber)
    .replace(/\{total\}/g, formatRupiah(invoice.total))
    .replace(/\{due_date\}/g, formatIndoDate(invoice.dueDate))
    .replace(/\{issue_date\}/g, formatIndoDate(invoice.issueDate))
    .replace(/\{company_name\}/g, business.businessName)
    .replace(/\{bank_info\}/g, bankInfo)
    .replace(/\{status\}/g, statusLabel);
}

/**
 * Pings OpenWA Server to test connectivity
 */
export async function testOpenWaConnection(
  serverUrl: string,
  apiKey: string = ''
): Promise<OpenWaTestResult> {
  if (!serverUrl) {
    return {
      success: false,
      message: 'URL Server OpenWA belum diisi.',
    };
  }

  // 1. Try via backend proxy first
  try {
    const res = await fetch('/api/openwa/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverUrl, apiKey }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (proxyErr) {
    console.warn('Proxy test failed, trying direct browser ping', proxyErr);
  }

  // 2. Direct browser fetch attempt
  try {
    const startTime = Date.now();
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const directRes = await fetch(`${cleanUrl}/status`, {
      method: 'GET',
      headers: apiKey ? { api_key: apiKey } : {},
    });

    const latency = Date.now() - startTime;
    if (directRes.ok) {
      const data = await directRes.json().catch(() => ({}));
      return {
        success: true,
        message: `Terhubung langsung dengan OpenWA server (${latency}ms)`,
        latencyMs: latency,
        data,
      };
    }

    return {
      success: false,
      message: `OpenWA merespon dengan status ${directRes.status} (${directRes.statusText})`,
      latencyMs: latency,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal terhubung ke ${serverUrl}. Pastikan server OpenWA aktif dan port tidak diblokir. (${err.message})`,
    };
  }
}

/**
 * Sends Invoice PDF to recipient phone via OpenWA API
 */
export async function sendInvoicePdfViaOpenWa(
  invoice: Invoice,
  business: BusinessProfile,
  config: OpenWaConfig,
  pdfBase64: string,
  customCaption?: string
): Promise<OpenWaSendResult> {
  const recipientDigits = cleanWhatsAppNumber(invoice.client.phone);
  if (!recipientDigits) {
    return {
      success: false,
      message: 'Nomor WhatsApp klien tidak valid atau kosong.',
    };
  }

  const chatId = `${recipientDigits}@c.us`;
  const caption = customCaption || formatCaptionTemplate(config.autoSendCaption, invoice, business);
  const filename = `${invoice.invoiceNumber}.pdf`;

  // 1. Try sending via backend proxy
  try {
    const res = await fetch('/api/openwa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
        endpointType: config.endpointType,
        customEndpointPath: config.customEndpointPath,
        chatId,
        phone: recipientDigits,
        file: pdfBase64,
        filename,
        caption,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      return result;
    } else {
      const errJson = await res.json().catch(() => ({ message: res.statusText }));
      return {
        success: false,
        message: errJson.message || `Proxy OpenWA error (${res.status})`,
      };
    }
  } catch (proxyError: any) {
    console.warn('Proxy dispatch failed, trying direct browser fetch', proxyError);
  }

  // 2. Direct browser fetch attempt if proxy is not responding
  try {
    const cleanUrl = config.serverUrl.replace(/\/+$/, '');
    let endpoint = '/sendPdf';
    if (config.endpointType === 'sendFile') endpoint = '/sendFile';
    else if (config.endpointType === 'sendMessageWithMedia') endpoint = '/sendMessageWithMedia';
    else if (config.endpointType === 'custom' && config.customEndpointPath) {
      endpoint = config.customEndpointPath.startsWith('/') ? config.customEndpointPath : '/' + config.customEndpointPath;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['api_key'] = config.apiKey;
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const payload = {
      to: chatId,
      chatId,
      file: pdfBase64,
      filename,
      caption,
    };

    const directRes = await fetch(`${cleanUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await directRes.json().catch(() => ({}));
    if (directRes.ok && !data.error) {
      return {
        success: true,
        message: 'Invoice PDF berhasil dikirim langsung ke OpenWA!',
        data,
      };
    }

    return {
      success: false,
      message: data.message || data.error || `HTTP ${directRes.status} dari OpenWA`,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Koneksi ke OpenWA gagal: ${err.message}. Anda juga dapat menggunakan tombol 'Kirim via WhatsApp Web/App'.`,
    };
  }
}

/**
 * Builds a direct wa.me link for manual sending fallback
 */
export function buildDirectWhatsAppUrl(phone: string, message: string): string {
  const cleaned = cleanWhatsAppNumber(phone);
  if (!cleaned) return '';
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleaned}&text=${encoded}`;
}
