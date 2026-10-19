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
      // PERBAIKAN 1: Tambahkan config.sessionName (UUID) sebagai parameter ketiga
      const res = await testOpenWaConnection(
        config.serverUrl, 
        config.apiKey, 
        config.sessionName 
      );
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
    setStatusMessage('Memproses dokumen PDF...');
    setPdfGenerating(true);

    try {
      // 1. Generate PDF dari DOM
      const pdfResult = await generateInvoicePdf(
        'printable-invoice-element',
        `${invoice.invoiceNumber}.pdf`
      );
      setPdfGenerating(false);

      setStatusMessage(`Mengirim dokumen ke OpenWA API...`);

      // Bersihkan prefix data URI (data:application/pdf;base64,) jika ada
      const cleanBase64 = pdfResult.base64DataUri.includes(',') 
        ? pdfResult.base64DataUri.split(',')[1] 
        : pdfResult.base64DataUri;

      // PERBAIKAN 2: Panggil fungsi sesuai dengan parameter yang benar
      const response = await sendInvoicePdfViaOpenWa(
        {
          serverUrl: config.serverUrl,
          apiKey: config.apiKey,
          sessionId: config.sessionName // Gunakan UUID
        },
        `${recipientClean}@c.us`, // Chat ID tujuan
        cleanBase64, // Base64 murni
        `${invoice.invoiceNumber}.pdf` // Nama File
      );

      if (response.success) {
        setIsSuccess(true);
        setStatusMessage(response.message || 'Invoice PDF berhasil dikirim!');

        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch {}

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
          response.message || 'Gagal mengirim otomatis. Cek konfigurasi OpenWA atau gunakan fallback.'
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
      window.open(directUrl, '_blank');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
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
                Otomatis kirim file PDF langsung ke chat pelanggan
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">Customer:</div>
              <div className="font-bold text-slate-900">{invoice.client.name}</div>
              <div className="text-xs font-mono text-emerald-700 font-bold mt-0.5">
                {formatDisplayPhone(invoice.client.phone)} <span className="text-[10px] text-slate-400">({recipientClean}@c.us)</span>
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">Koneksi OpenWA:</div>
              <div className="flex items-center gap-2">
                {serverStatus === 'testing' ? (
                  <span className="text-xs text-amber-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...</span>
                ) : serverStatus === 'online' ? (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> OpenWA Terhubung
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> OpenWA Offline
                  </span>
                )}
                <button onClick={checkConnection} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate mt-1" title={config.serverUrl}>
                {config.serverUrl}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs">
            <div className="p-2 bg-indigo-600 text-white rounded-lg"><FileCheck className="w-4 h-4" /></div>
            <div className="flex-1">
              <div className="font-bold text-indigo-950">Lampiran PDF:</div>
              <div className="text-indigo-800 font-mono text-[11px]">
                {invoice.invoiceNumber}.pdf • Total: {invoice.total.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Pesan Pengantar:</label>
            <textarea
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400">Sisipkan:</span>
              {[
                { label: 'Nama Klien', val: '{client_name}' },
                { label: 'No Invoice', val: '{invoice_no}' },
                { label: 'Total', val: '{total}' },
                { label: 'Rekening', val: '{bank_info}' },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => insertVariable(chip.val)}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-200"
                >
                  +{chip.label}
                </button>
              ))}
            </div>
          </div>

          {statusMessage && (
            <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                isSuccess ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : isError ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : 'bg-blue-50 text-blue-900 border border-blue-200'
              }`}>
              {isSuccess ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                : isError ? <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
                : <Loader2 className="w-4 h-4 text-blue-600 animate-spin mt-0.5" />}
              <div className="flex-1">
                <p className="font-medium leading-relaxed">{statusMessage}</p>
                {isError && (
                  <div className="mt-2 flex items-center gap-3">
                    <button onClick={onOpenSettings} className="font-bold underline text-indigo-700">Buka Pengaturan</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDirectWhatsAppFallback}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" /> Kirim Manual (WA Web)
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button onClick={onClose} disabled={isSending} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl">
              Tutup
            </button>
            <button
              onClick={handleSendViaOpenWa}
              disabled={isSending || pdfGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSending || pdfGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              ) : (
                <><Send className="w-4 h-4" /> Kirim Otomatis</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
