import React, { useState, useEffect } from 'react';
import { BusinessProfile, Invoice, WhatsAppConfig } from '../types/invoice';
import {
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
  sendInvoicePdfViaWhatsApp,
  testWhatsAppGateway,
} from '../services/whatsapp';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { cleanWhatsAppNumber, formatDisplayPhone } from '../utils/formatters';
import {
  Send,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WhatsAppSendModalProps {
  invoice: Invoice;
  business: BusinessProfile;
  config: WhatsAppConfig;
  isOpen: boolean;
  onClose: () => void;
  onSentSuccess: (updatedInvoice: Invoice) => void;
  onOpenSettings: () => void;
}

export const WhatsAppSendModal: React.FC<WhatsAppSendModalProps> = ({
  invoice,
  business,
  config,
  isOpen,
  onClose,
  onSentSuccess,
  onOpenSettings,
}) => {
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverStatus, setServerStatus] = useState<'testing' | 'online' | 'offline' | 'untested'>('untested');
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const providerName = config.provider === 'fonnte' ? 'Fonnte' : 'OpenWA';

  useEffect(() => {
    if (isOpen) {
      setCaption(formatCaptionTemplate(config.autoSendCaption, invoice, business));
      setIsError(false);
      setIsSuccess(false);
      setStatusMessage(null);
      checkConnection();
    }
  }, [isOpen, invoice, config]);

  const checkConnection = async () => {
    setServerStatus('testing');
    try {
      const res = await testWhatsAppGateway(config);
      if (res.success) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  if (!isOpen) return null;

  const recipientClean = cleanWhatsAppNumber(invoice.client.phone);

  const handleSendViaGateway = async () => {
    if (!recipientClean) {
      setIsError(true);
      setStatusMessage('Nomor WhatsApp pelanggan belum diisi dengan benar.');
      return;
    }

    setIsSending(true);
    setIsError(false);
    setIsSuccess(false);
    setStatusMessage('Memproses dokumen PDF faktur...');
    setPdfGenerating(true);

    try {
      const pdfResult = await generateInvoicePdf(
        'printable-invoice-element',
        `${invoice.invoiceNumber}.pdf`
      );
      setPdfGenerating(false);

      setStatusMessage(`Mengirim dokumen via ${providerName} Gateway...`);

      const cleanBase64 = pdfResult.base64DataUri.includes(',')
        ? pdfResult.base64DataUri.split(',')[1]
        : pdfResult.base64DataUri;

      const response = await sendInvoicePdfViaWhatsApp(
        config,
        recipientClean,
        cleanBase64,
        `${invoice.invoiceNumber}.pdf`,
        caption
      );

      if (response.success) {
        setIsSuccess(true);
        setStatusMessage(response.message || `Invoice PDF dan pesan berhasil dikirim via ${providerName}!`);

        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch {}

        const updated: Invoice = {
          ...invoice,
          whatsappStatus: 'sent',
          whatsappSentAt: new Date().toISOString(),
          whatsappRecipient: recipientClean,
          whatsappLastLog: response.message || `Sent successfully via ${providerName}`,
          updatedAt: new Date().toISOString(),
        };

        onSentSuccess(updated);
      } else {
        setIsError(true);
        setStatusMessage(
          response.message || `Gagal mengirim otomatis. Cek konfigurasi ${providerName} atau gunakan fallback tautan langsung.`
        );
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err?.message || 'Terjadi kesalahan sistem saat memproses dokumen PDF.');
    } finally {
      setIsSending(false);
      setPdfGenerating(false);
    }
  };

  const handleOpenDirectWhatsApp = () => {
    const directUrl = buildDirectWhatsAppUrl(invoice.client.phone, caption);
    window.open(directUrl, '_blank', 'noopener,noreferrer');

    const updated: Invoice = {
      ...invoice,
      whatsappStatus: 'sent',
      whatsappSentAt: new Date().toISOString(),
      whatsappRecipient: recipientClean,
      whatsappLastLog: 'Dibuka via Tautan WhatsApp Web Langsung (Fallback)',
      updatedAt: new Date().toISOString(),
    };
    onSentSuccess(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-snug">
                Kirim Invoice via WhatsApp ({providerName})
              </h2>
              <p className="text-xs text-emerald-100">
                Otomatis kirim berkas PDF tagihan langsung ke chat WhatsApp pelanggan
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">Pelanggan:</div>
              <div className="font-bold text-slate-900">{invoice.client.name}</div>
              <div className="text-xs font-mono text-emerald-700 font-bold mt-0.5">
                {formatDisplayPhone(invoice.client.phone)}{' '}
                <span className="text-[10px] text-slate-400">({recipientClean})</span>
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">
                Gateway Aktif ({providerName}):
              </div>
              <div className="flex items-center gap-2">
                {serverStatus === 'testing' ? (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...
                  </span>
                ) : serverStatus === 'online' ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {providerName} Terhubung
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {providerName} Terputus
                  </span>
                )}
                <button
                  onClick={checkConnection}
                  title="Cek ulang koneksi gateway"
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate mt-1">
                {config.provider === 'fonnte' ? 'api.fonnte.com/send' : config.serverUrl || 'Belum diatur'}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Teks Pengantar (Pesan WhatsApp):</label>
              <button
                type="button"
                onClick={() => setCaption(formatCaptionTemplate(config.autoSendCaption, invoice, business))}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Template
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed transition"
              placeholder="Tulis pesan pengantar WhatsApp..."
            />
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-2xs text-emerald-600 shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-emerald-950 block">Lampiran Dokumen PDF Otomatis:</span>
              <span className="text-emerald-800 text-[11px]">
                {invoice.invoiceNumber}.pdf (Total: Rp {invoice.total.toLocaleString('id-ID')})
              </span>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : isError
                  ? 'bg-rose-50 text-rose-900 border border-rose-200'
                  : 'bg-blue-50 text-blue-900 border border-blue-200'
              }`}
            >
              {isSending && <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />}
              {isSuccess && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              <div className="flex-1 font-medium leading-relaxed">{statusMessage}</div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
            >
              Atur Gateway
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {config.directWhatsappFallback && (
              <button
                type="button"
                onClick={handleOpenDirectWhatsApp}
                title="Buka WhatsApp Web langsung jika gateway tidak aktif"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Tautan WA Web
              </button>
            )}

            <button
              type="button"
              onClick={handleSendViaGateway}
              disabled={isSending || pdfGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Kirim PDF via {providerName}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
