import React, { useState, useEffect } from 'react';
import { BusinessProfile, Invoice, OpenWaConfig } from '../types/invoice';
import { formatCaptionTemplate, sendInvoicePdfViaOpenWa, buildDirectWhatsAppUrl, testOpenWaConnection } from '../services/openwa';
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
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WhatsAppSendModalProps {
  invoice: Invoice;
  business: BusinessProfile;
  config: OpenWaConfig;
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

  useEffect(() => {
    if (isOpen) {
      setCaption(formatCaptionTemplate(config.autoSendCaption, invoice, business));
      setIsError(false);
      setIsSuccess(false);
      setStatusMessage(null);
      checkConnection();
    }
  }, [isOpen, invoice]);

  const checkConnection = async () => {
    setServerStatus('testing');
    try {
      const res = await testOpenWaConnection(config.serverUrl, config.apiKey);
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

  const handleSendViaOpenWa = async () => {
    if (!recipientClean) {
      setIsError(true);
      setStatusMessage('Nomor WhatsApp klien belum diisi dengan benar.');
      return;
    }

    setIsSending(true);
    setIsError(false);
    setIsSuccess(false);
    setStatusMessage('Memproses dokumen PDF beresolusi tinggi...');
    setPdfGenerating(true);

    try {
      // 1. Generate PDF from DOM
      const pdfResult = await generateInvoicePdf(
        'printable-invoice-element',
        `${invoice.invoiceNumber}.pdf`
      );
      setPdfGenerating(false);

      setStatusMessage(`Menghubungi OpenWA API (${config.serverUrl})...`);

      // 2. Dispatch via OpenWA service
      const response = await sendInvoicePdfViaOpenWa(
        invoice,
        business,
        config,
        pdfResult.base64DataUri,
        caption
      );

      if (response.success) {
        setIsSuccess(true);
        setStatusMessage(response.message || 'Invoice PDF berhasil dikirim ke WhatsApp klien!');

        try {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }

        const updated: Invoice = {
          ...invoice,
          whatsappStatus: 'sent',
          whatsappSentAt: new Date().toISOString(),
          whatsappRecipient: `${recipientClean}@c.us`,
          whatsappLastLog: response.message || 'Sent successfully via OpenWA',
          updatedAt: new Date().toISOString(),
        };

        onSentSuccess(updated);
      } else {
        setIsError(true);
        setStatusMessage(
          response.message ||
            'Gagal mengirim otomatis via OpenWA. Cek apakah server OpenWA aktif atau gunakan fallback tombol WhatsApp Web.'
        );
      }
    } catch (err: any) {
      setPdfGenerating(false);
      setIsError(true);
      setStatusMessage(`Terjadi kesalahan: ${err.message || 'Gagal memproses pengiriman.'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDirectWhatsAppFallback = () => {
    const directUrl = buildDirectWhatsAppUrl(recipientClean, caption);
    if (directUrl) {
      const link = document.createElement('a');
      link.href = directUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Mark as sent record
      const updated: Invoice = {
        ...invoice,
        whatsappStatus: 'sent',
        whatsappSentAt: new Date().toISOString(),
        whatsappRecipient: recipientClean,
        whatsappLastLog: 'Dibuka via WhatsApp Web / App',
        updatedAt: new Date().toISOString(),
      };
      onSentSuccess(updated);
    }
  };

  const insertVariable = (variableStr: string) => {
    setCaption((prev) => prev + ' ' + variableStr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-snug">Kirim Invoice via WhatsApp OpenWA</h2>
              <p className="text-xs text-emerald-100">
                Otomatis kirim file PDF langsung ke chat WhatsApp pelanggan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          {/* Target Info & OpenWA status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>Customer Penerima (Dari Form Invoice):</span>
              </div>
              <div className="font-bold text-slate-900">{invoice.client.name}</div>
              <div className="text-xs font-mono text-emerald-700 font-bold flex items-center gap-1.5 mt-0.5">
                <span>{formatDisplayPhone(invoice.client.phone)}</span>
                <span className="text-[10px] text-slate-400 font-normal">({recipientClean}@c.us)</span>
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3 flex flex-col justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Koneksi OpenWA:
              </div>
              <div className="flex items-center gap-2">
                {serverStatus === 'testing' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...
                  </span>
                ) : serverStatus === 'online' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> OpenWA Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" /> OpenWA Offline / Belum Aktif
                  </span>
                )}
                <button
                  type="button"
                  onClick={checkConnection}
                  title="Cek ulang koneksi"
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate" title={config.serverUrl}>
                {config.serverUrl}
              </div>
            </div>
          </div>

          {/* Attachment Preview info */}
          <div className="flex items-center gap-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-indigo-950">Lampiran Dokumen PDF:</div>
              <div className="text-indigo-800 font-mono text-[11px]">
                {invoice.invoiceNumber}.pdf • Total: {invoice.total.toLocaleString('id-ID')}
              </div>
            </div>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-semibold text-[10px]">
              Otomatis Dibuat
            </span>
          </div>

          {/* Caption editor */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Pesan / Caption WhatsApp:
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-slate-400">Template Cepat:</span>
                <button
                  type="button"
                  onClick={() => setCaption(formatCaptionTemplate(config.autoSendCaption, invoice, business))}
                  className="px-2 py-0.5 text-[10px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Tagihan Baru
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCaption(
                      formatCaptionTemplate(
                        `Halo {client_name},\n\nSekadar mengingatkan dengan hormat bahwa tagihan *{invoice_no}* sebesar *{total}* telah memasuki masa jatuh tempo pada *{due_date}*.\n\nJika pembayaran telah dilakukan, mohon kirimkan konfirmasi atau bukti transfer ke kontak ini:\n{bank_info}\n\nTerima kasih banyak atas perhatian dan kerjasamanya! 🙏`,
                        invoice,
                        business
                      )
                    )
                  }
                  className="px-2 py-0.5 text-[10px] rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200"
                >
                  Pengingat Jatuh Tempo
                </button>
                {invoice.status === 'paid' && (
                  <button
                    type="button"
                    onClick={() =>
                      setCaption(
                        formatCaptionTemplate(
                          `Halo {client_name},\n\nTerima kasih! Pembayaran untuk tagihan *{invoice_no}* sebesar *{total}* telah kami terima dengan status *LUNAS* ✅.\n\nTerlampir salinan dokumen resmi untuk arsip pembukuan Anda.\n\nSenang dapat bekerjasama dengan Anda! 🙏`,
                          invoice,
                          business
                        )
                      )
                    }
                    className="px-2 py-0.5 text-[10px] rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200"
                  >
                    Konfirmasi Lunas
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={6}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent leading-relaxed bg-slate-50/50"
              placeholder="Tulis pesan pengantar invoice..."
            />

            {/* Quick Tag Insert Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-medium">Sisipkan:</span>
              {[
                { label: 'Nama Klien', val: '{client_name}' },
                { label: 'No Invoice', val: '{invoice_no}' },
                { label: 'Total', val: '{total}' },
                { label: 'Jatuh Tempo', val: '{due_date}' },
                { label: 'Rekening', val: '{bank_info}' },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => insertVariable(chip.val)}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition border border-slate-200"
                >
                  +{chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : isError
                  ? 'bg-rose-50 text-rose-900 border border-rose-200'
                  : 'bg-blue-50 text-blue-900 border border-blue-200'
              }`}
            >
              {isSuccess ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium leading-relaxed">{statusMessage}</p>
                {isError && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="font-bold underline text-indigo-700 hover:text-indigo-900"
                    >
                      Buka Pengaturan OpenWA
                    </button>
                    <span>atau gunakan tombol alternatif di bawah:</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Fallback button */}
          <button
            type="button"
            onClick={handleDirectWhatsAppFallback}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-xs"
            title="Kirim pesan langsung melalui WhatsApp Web/Desktop"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            Kirim via WhatsApp Web/App
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSendViaOpenWa}
              disabled={isSending || pdfGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-sm"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengirim via OpenWA...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Kirim Otomatis (OpenWA API)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
