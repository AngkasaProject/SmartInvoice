/**
 * Fonnte WhatsApp Gateway Integration (https://fonnte.com)
 * Layanan WhatsApp API Gateway alternatif untuk kemudahan pengiriman instan.
 */

export interface FonnteTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  data?: any;
}

export interface FonnteSendResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function testFonnteConnection(token: string): Promise<FonnteTestResult> {
  if (!token || !token.trim()) {
    return { success: false, message: 'Token Fonnte belum diisi di Pengaturan.' };
  }

  const startTime = Date.now();
  try {
    const res = await fetch('/api/fonnte/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      message: 'Gagal menghubungi server proxy Fonnte: ' + error.message,
      latencyMs,
    };
  }
}

export async function sendInvoicePdfViaFonnte(
  token: string,
  targetPhone: string,
  base64Pdf: string,
  filename: string,
  caption?: string
): Promise<FonnteSendResult> {
  if (!token || !token.trim()) {
    return { success: false, message: 'Token Fonnte belum diisi di Pengaturan.' };
  }
  if (!targetPhone) {
    return { success: false, message: 'Nomor WhatsApp customer tidak valid.' };
  }

  try {
    const res = await fetch('/api/fonnte/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.trim(),
        target: targetPhone,
        file: base64Pdf,
        filename: filename || 'Invoice.pdf',
        caption: caption || '',
      }),
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    return { success: false, message: 'Gagal mengirim berkas via Fonnte: ' + error.message };
  }
}
