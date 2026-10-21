/**
 * Unified WhatsApp Gateway Service
 * Mendukung pilihan provider: OpenWA (rmyndharis/OpenWA) & Fonnte (fonnte.com)
 */

import { WhatsAppConfig, WhatsAppProvider } from "../types/invoice";
import {
  sendInvoicePdfViaOpenWa,
  testOpenWaConnection,
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
} from "./openwa";
import { sendInvoicePdfViaFonnte, testFonnteConnection } from "./fonnte";
import { cleanWhatsAppNumber, formatToOpenWAChatId } from "../utils/formatters";

export {
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
  sendInvoicePdfViaOpenWa,
  testOpenWaConnection,
  sendInvoicePdfViaFonnte,
  testFonnteConnection,
};

export async function testWhatsAppGateway(
  config: WhatsAppConfig,
): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  data?: any;
}> {
  const provider: WhatsAppProvider = config.provider || "openwa";

  if (provider === "fonnte") {
    return testFonnteConnection(config.fonnteToken);
  }

  // Default to OpenWA
  return testOpenWaConnection(
    config.serverUrl,
    config.apiKey,
    config.sessionName,
  );
}

export async function sendInvoicePdfViaWhatsApp(
  config: WhatsAppConfig,
  phone: string,
  base64Pdf: string,
  filename: string,
  caption?: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  const provider: WhatsAppProvider = config.provider || "openwa";

  if (provider === "fonnte") {
    const cleanedPhone = cleanWhatsAppNumber(phone);
    return sendInvoicePdfViaFonnte(
      config.fonnteToken,
      cleanedPhone,
      base64Pdf,
      filename,
      caption,
    );
  }

  // OpenWA requires JID format (e.g. 628xxx@c.us)
  const jid = formatToOpenWAChatId(phone);
  return sendInvoicePdfViaOpenWa(config, jid, base64Pdf, filename, caption);
}

// ==========================================
// KIRIM TEKS (LINK DOWNLOAD)
// ==========================================
export async function sendWhatsAppText(
  config: WhatsAppConfig,
  phone: string,
  text: string,
): Promise<{ success: boolean; message: string; data?: any }> {
  const provider: WhatsAppProvider = config.provider || "openwa";

  // Jika menggunakan Fonnte
  if (provider === "fonnte") {
    try {
      const cleanedPhone = cleanWhatsAppNumber(phone);
      const res = await fetch("/api/fonnte/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: config.fonnteToken,
          target: cleanedPhone,
          caption: text,
        }),
      });
      const data = await res.json();
      return {
        success: data.success,
        message: data.message || "Terkirim",
        data,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // Jika menggunakan OpenWA
  try {
    const baseUrl = config.serverUrl.replace(/\/$/, "");
    const jid = formatToOpenWAChatId(phone);

    const res = await fetch(
      `${baseUrl}/api/sessions/${config.sessionName}/messages/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
        },
        body: JSON.stringify({
          chatId: jid,
          text: text,
        }),
      },
    );

    const data = await res.json();
    return {
      success: res.ok,
      message: res.ok ? "Terkirim" : data.message,
      data,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
