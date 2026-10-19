/**
 * OpenWA API Service Integration
 * Final Revision: Menyesuaikan dengan standar API OpenWA v0.25.0
 */

export interface OpenWAConfig {
  serverUrl: string; // Contoh: https://wa.angkasaproject.web.id
  apiKey: string;
  sessionId: string; // Harus UUID (diambil dari Pengaturan)
}

// 1. Fungsi untuk membuat teks caption (Template)
export function formatCaptionTemplate(invoiceData: any): string {
  return `Halo, berikut adalah invoice untuk tagihan Anda. Terima kasih telah menggunakan layanan kami.`;
}

// 2. Fungsi untuk membuat URL WhatsApp Web langsung (Fallback)
export function buildDirectWhatsAppUrl(phone: string, text: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

// 3. Fungsi Utama: Kirim PDF via OpenWA
export async function sendInvoicePdfViaOpenWa(
  config: OpenWAConfig,
  chatId: string, 
  base64Pdf: string,
  filename: string
): Promise<{ success: boolean; message: string; data?: any }> {
  // Validasi konfigurasi (Tidak ada hardcode di sini)
  if (!config.serverUrl || !config.apiKey || !config.sessionId) {
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
    const endpoint = `${baseUrl}/api/sessions/${config.sessionId}/messages/send-document`;

    // PENTING: Bersihkan prefix Base64 jika ada (misal: "data:application/pdf;base64,")
    const cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;

    const body = {
      chatId: chatId,
      filename: filename,
      mimetype: 'application/pdf',
      base64: cleanBase64,
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

    return { success: true, message: 'Dokumen berhasil dikirim', data: data };
  } catch (error: any) {
    console.error('OpenWA Error:', error);
    return { success: false, message: error.message || 'Terjadi kesalahan jaringan' };
  }
}

// 4. Fungsi Tes Koneksi
export async function testOpenWaConnection(
  serverUrl: string,
  apiKey: string,
  sessionId: string // Tidak ada nilai default hardcode, wajib diisi dari form
): Promise<{ success: boolean; message: string }> {
  if (!serverUrl || !apiKey || !sessionId) {
    return { success: false, message: 'Server URL, API Key, dan Session ID (UUID) wajib diisi.' };
  }

  try {
    const baseUrl = serverUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/sessions/${sessionId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });

    if (!response.ok) {
      return { success: false, message: 'Gagal terhubung. Periksa URL, API Key, dan UUID Anda.' };
    }

    const data = await response.json();
    const statusSesi = data?.status?.toLowerCase();

    // Perbaikan: Menerima status 'ready' (standar OpenWA) dan 'connected'
    if (statusSesi === 'connected' || statusSesi === 'ready') {
      return { success: true, message: 'Terhubung ke OpenWA (Sesi Siap)' };
    } else {
      return { 
        success: false, 
        message: `Server merespons, tapi sesi berstatus: ${data?.status || 'unknown'}. Pastikan WhatsApp sudah tertaut dan scan QR jika perlu.` 
      };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal terhubung ke server OpenWA' };
  }
}
