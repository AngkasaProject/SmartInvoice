/**
 * Unified WhatsApp Gateway Service
 * Mendukung pilihan provider: OpenWA (rmyndharis/OpenWA) & Fonnte (fonnte.com)
 */

import { WhatsAppConfig, WhatsAppProvider } from '../types/invoice';
import {
  sendInvoicePdfViaOpenWa,
  testOpenWaConnection,
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
} from './openwa';
import {
  sendInvoicePdfViaFonnte,
  testFonnteConnection,
} from './fonnte';
import { cleanWhatsAppNumber, formatToOpenWAChatId } from '../utils/formatters';

export {
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
  sendInvoicePdfViaOpenWa,
  testOpenWaConnection,
  sendInvoicePdfViaFonnte,
  testFonnteConnection,
};

export async function testWhatsAppGateway(
  config: WhatsAppConfig
): Promise<{ success: boolean; message: string; latencyMs?: number; data?: any }> {
  const provider: WhatsAppProvider = config.provider || 'openwa';

  if (provider === 'fonnte') {
    return testFonnteConnection(config.fonnteToken);
  }

  // Default to OpenWA
  return testOpenWaConnection(config.serverUrl, config.apiKey, config.sessionName);
}

export async function sendInvoicePdfViaWhatsApp(
  config: WhatsAppConfig,
  phone: string,
  base64Pdf: string,
  filename: string,
  caption?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const provider: WhatsAppProvider = config.provider || 'openwa';

  if (provider === 'fonnte') {
    const cleanedPhone = cleanWhatsAppNumber(phone);
    return sendInvoicePdfViaFonnte(
      config.fonnteToken,
      cleanedPhone,
      base64Pdf,
      filename,
      caption
    );
  }

  // OpenWA requires JID format (e.g. 628xxx@c.us)
  const jid = formatToOpenWAChatId(phone);
  return sendInvoicePdfViaOpenWa(
    config,
    jid,
    base64Pdf,
    filename,
    caption
  );
}
