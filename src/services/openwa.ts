/**
 * OpenWA API Service Integration
 * Final Revision: Menyediakan semua fungsi yang dibutuhkan komponen, menggunakan API OpenWA yang benar, dan dilengkapi validasi.
 */

export interface OpenWAConfig {
  serverUrl: string; // Contoh: https://wa.angkasaproject.web.id
  apiKey: string;
  sessionId: string; // Contoh: chatbot1
}

// 1. Fungsi untuk membuat teks caption (Template)
export function formatCaptionTemplate(invoiceData: any): string {
  // Anda bisa menyesuaikan teks ini dengan data invoice Anda
  return `Halo, berikut adalah invoice untuk tagihan Anda. Terima kasih telah menggunakan layanan kami.`;
}

// 2. Fungsi untuk membuat URL WhatsApp Web langsung (Fallback)
export function buildDirectWhatsAppUrl(phone: string, text: string): string {
  // Membersihkan nomor HP
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
  // Validasi konfigurasi
  if (!config.serverUrl || !config.apiKey || !config.sessionId) {
    return { 
      success: false, 
      message: 'Konfigurasi OpenWA belum lengkap. Silakan isi Server URL, API Key, dan Session ID di menu Pengaturan.' 
    };
  }
  if (!chatId) {
    return { success: false, message: 'Nomor WhatsApp (Chat ID) tidak valid.' };
  }

  try {
    const baseUrl = config.serverUrl.replace(/\/$/, ''); 
    const endpoint = `${baseUrl}/api/sessions/${config.sessionId}/messages/send-document`;

    const body = {
      chatId: chatId,
      filename: filename,
      mimetype: 'application/pdf',
      base64: base64Pdf,
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
  sessionId: string = 'chatbot1' 
): Promise<{ success: boolean; message: string }> {
  if (!serverUrl || !apiKey) {
    return { success: false, message: 'Server URL dan API Key tidak boleh kosong.' };
  }

  try {
    const baseUrl = serverUrl.replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/sessions/${sessionId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });

    if (!response.ok) {
      return { success: false, message: 'Gagal terhubung. Periksa URL dan API Key.' };
    }

    const data = await response.json();
    
    if (data && data.status === 'connected') {
      return { success: true, message: 'Terhubung ke OpenWA (Sesi Aktif)' };
    } else {
      return { success: false, message: `Server merespons, tapi sesi berstatus: ${data?.status || 'unknown'}. Scan QR dulu.` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal terhubung ke server OpenWA' };
  }
}
