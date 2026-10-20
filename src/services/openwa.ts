/**
 * OpenWA API Service Integration
 * Sesuai spesifikasi rmyndharis/OpenWA (https://github.com/rmyndharis/OpenWA)
 * Mendukung pengiriman PDF beserta caption (teks pengantar)
 */

import { WhatsAppConfig } from '../types/invoice';

export type OpenWAConfig = WhatsAppConfig;

// 1. Fungsi untuk membuat teks caption (Template) dengan replacement token
export function formatCaptionTemplate(template?: string, invoice?: any, business?: any): string {
  if (!template) {
    return 'Halo, berikut adalah invoice untuk tagihan Anda. Terima kasih telah menggunakan layanan kami.';
  }

  const clientName = invoice?.client?.name || 'Pelanggan';
  const invoiceNo = invoice?.invoiceNumber || '-';
  const totalStr = invoice?.total ? `Rp ${invoice.total.toLocaleString('id-ID')}` : 'Rp 0';
  const dueDateStr = invoice?.dueDate || '-';
  const statusStr = invoice?.status === 'paid' ? 'LUNAS' : invoice?.status === 'overdue' ? 'JATUH TEMPO' : 'BELUM DIBAYAR';
  const companyName = business?.businessName || 'SmartInvoice';

  const bankInfo = business?.bankName
    ? `Bank: ${business.bankName}\nNo. Rekening: ${business.bankAccountNumber || '-'}\nAtas Nama: ${business.bankAccountHolder || '-'}`
    : 'Hubungi admin kami untuk informasi pembayaran.';

  return template
    .replace(/{client_name}/g, clientName)
    .replace(/{invoice_no}/g, invoiceNo)
    .replace(/{total}/g, totalStr)
    .replace(/{due_date}/g, dueDateStr)
    .replace(/{status}/g, statusStr)
    .replace(/{company_name}/g, companyName)
    .replace(/{bank_info}/g, bankInfo);
}

// 2. Fungsi untuk membuat URL WhatsApp Web langsung (Fallback)
export function buildDirectWhatsAppUrl(phone: string, text: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

// 3. Fungsi Utama: Kirim PDF via OpenWA (DENGAN CAPTION)
// Kompatibel dengan rmyndharis/OpenWA: POST /api/sessions/{sessionId}/messages/send-document
export async function sendInvoicePdfViaOpenWa(
  config: { serverUrl: string; apiKey: string; sessionName?: string; sessionId?: string },
  chatId: string, 
  base64Pdf: string,
  filename: string,
  caption?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const targetSession = config.sessionName || config.sessionId;

  // Validasi konfigurasi
  if (!config.serverUrl || !config.apiKey || !targetSession) {
    return { 
      success: false, 
      message: 'Konfigurasi OpenWA belum lengkap. Silakan isi Server URL, API Key, dan Session ID (UUID) di menu Pengaturan.' 
    };
  }
  if (!chatId) {
    return { success: false, message: 'Nomor WhatsApp (Chat ID) tidak valid.' };
  }

  try {
    const baseUrl = config.serverUrl.replace(/\/$/, ''); 
    const endpoint = `${baseUrl}/api/sessions/${targetSession}/messages/send-document`;

    // Bersihkan prefix Base64 jika ada (misal: "data:application/pdf;base64,")
    const cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;

    const body = {
      chatId: chatId,
      filename: filename || 'Invoice.pdf',
      mimetype: 'application/pdf',
      base64: cleanBase64,
      caption: caption || '',
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey, 
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Gagal mengirim dokumen via OpenWA');
    }

    return { success: true, message: 'Dokumen dan pesan berhasil dikirim via OpenWA!', data: data };
  } catch (error: any) {
    console.error('OpenWA Error:', error);
    return { success: false, message: error.message || 'Terjadi kesalahan jaringan OpenWA' };
  }
}

// 4. Fungsi Tes Koneksi OpenWA (rmyndharis/OpenWA)
export async function testOpenWaConnection(
  serverUrl: string,
  apiKey: string,
  sessionId: string
): Promise<{ success: boolean; message: string; latencyMs?: number; data?: any }> {
  if (!serverUrl || !apiKey || !sessionId) {
    return { success: false, message: 'Server URL, API Key, dan Session ID (UUID) wajib diisi.' };
  }

  const startTime = Date.now();
  try {
    const baseUrl = serverUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/sessions/${sessionId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return { success: false, message: 'Gagal terhubung ke OpenWA. Periksa URL, API Key, dan Session ID UUID Anda.', latencyMs };
    }

    const data = await response.json();
    const statusSesi = data?.status?.toLowerCase();

    if (statusSesi === 'connected' || statusSesi === 'ready') {
      return { success: true, message: `Terhubung ke OpenWA (${latencyMs}ms) - Sesi Siap!`, latencyMs, data };
    } else {
      return { 
        success: false, 
        message: `Server merespons (${latencyMs}ms), namun sesi berstatus: ${data?.status || 'unknown'}. Pastikan WhatsApp sudah tertaut dan scan QR jika perlu.`,
        latencyMs,
        data,
      };
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return { success: false, message: 'Gagal terhubung ke server OpenWA: ' + error.message, latencyMs };
  }
}
