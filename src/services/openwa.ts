// src/services/openwa.ts

export interface OpenWAConfig {
  serverUrl: string; // Contoh: https://wa.angkasaproject.web.id
  apiKey: string;
  sessionId: string; // Contoh: chatbot1
}

export interface SendDocumentPayload {
  chatId: string;    // Contoh: 628123456789@c.us
  base64: string;    // Base64 string dari file PDF
  filename: string;  // Contoh: invoice.pdf
}

/**
 * Mengirim dokumen (PDF) melalui OpenWA API
 */
export async function sendDocumentViaOpenWA(
  config: OpenWAConfig,
  payload: SendDocumentPayload
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // 1. Pastikan URL tidak berakhiran slash
    const baseUrl = config.serverUrl.replace(/\/$/, '');
    
    // 2. Endpoint yang benar sesuai dokumentasi OpenWA
    const endpoint = `${baseUrl}/api/sessions/${config.sessionId}/messages/send-document`;

    // 3. Susun body request
    const body = {
      chatId: payload.chatId,
      filename: payload.filename,
      mimetype: 'application/pdf',
      base64: payload.base64,
    };

    // 4. Kirim request dengan header X-API-Key
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey, // OpenWA menggunakan X-API-Key, bukan Authorization
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Gagal mengirim dokumen via OpenWA');
    }

    return {
      success: true,
      message: 'Dokumen berhasil dikirim',
      data: data,
    };
  } catch (error: any) {
    console.error('OpenWA Error:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan jaringan',
    };
  }
}

/**
 * Tes koneksi ke OpenWA
 */
export async function testOpenWAConnection(
  config: OpenWAConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const baseUrl = config.serverUrl.replace(/\/$/, '');
    // Cek status sesi
    const endpoint = `${baseUrl}/api/sessions/${config.sessionId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      return { success: false, message: 'Gagal terhubung. Periksa URL, API Key, dan Session ID.' };
    }

    const data = await response.json();
    if (data.status === 'connected') {
      return { success: true, message: 'Terhubung ke OpenWA (Sesi Aktif)' };
    } else {
      return { success: false, message: `Terhubung, tapi sesi berstatus: ${data.status}. Scan QR dulu.` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Gagal terhubung ke server OpenWA' };
  }
}
