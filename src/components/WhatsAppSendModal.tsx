import React, { useState, useEffect } from "react";
import { BusinessProfile, Invoice, WhatsAppConfig } from "../types/invoice";
import {
  formatCaptionTemplate,
  buildDirectWhatsAppUrl,
  sendInvoicePdfViaWhatsApp,
  testWhatsAppGateway,
  sendWhatsAppText, // <-- Import fungsi baru
} from "../services/whatsapp";
import { generateInvoicePdf } from "../utils/pdfGenerator";
import { cleanWhatsAppNumber, formatDisplayPhone } from "../utils/formatters";
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
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import confetti from "canvas-confetti";

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
  const [caption, setCaption] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverStatus, setServerStatus] = useState<
    "testing" | "online" | "offline" | "untested"
  >("untested");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // State Mode Pengiriman
  const [sendMode, setSendMode] = useState<"document" | "link">("document");

  const providerName = config.provider === "fonnte" ? "Fonnte" : "OpenWA";

  useEffect(() => {
    if (isOpen) {
      setCaption(
        formatCaptionTemplate(config.autoSendCaption, invoice, business),
      );
      setIsError(false);
      setIsSuccess(false);
      setStatusMessage(null);
      checkConnection();
    }
  }, [isOpen, invoice, config]);

  const checkConnection = async () => {
    setServerStatus("testing");
    try {
      const res = await testWhatsAppGateway(config);
      setServerStatus(res.success ? "online" : "offline");
    } catch {
      setServerStatus("offline");
    }
  };

  if (!isOpen) return null;

  const recipientClean = cleanWhatsAppNumber(invoice.client.phone);

  const handleSend = async () => {
    if (!recipientClean) {
      setIsError(true);
      setStatusMessage("Nomor WhatsApp pelanggan belum diisi dengan benar.");
      return;
    }

    setIsSending(true);
    setIsError(false);
    setIsSuccess(false);

    try {
      // ==========================================
      // MODE 1: KIRIM FILE PDF
      // ==========================================
      if (sendMode === "document") {
        setStatusMessage("Memproses dokumen PDF faktur...");
        setPdfGenerating(true);

        const pdfResult = await generateInvoicePdf(
          "printable-invoice-element",
          `${invoice.invoiceNumber}.pdf`,
        );
        setPdfGenerating(false);
        setStatusMessage(`Mengirim dokumen via ${providerName} Gateway...`);

        const cleanBase64 = pdfResult.base64DataUri.includes(",")
          ? pdfResult.base64DataUri.split(",")[1]
          : pdfResult.base64DataUri;
        const response = await sendInvoicePdfViaWhatsApp(
          config,
          recipientClean,
          cleanBase64,
          `${invoice.invoiceNumber}.pdf`,
          caption,
        );

        if (response.success) {
          setIsSuccess(true);
          setStatusMessage(
            response.message ||
              `Invoice PDF berhasil dikirim via ${providerName}!`,
          );
          try {
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
          } catch {}
          onSentSuccess({
            ...invoice,
            whatsappStatus: "sent",
            whatsappSentAt: new Date().toISOString(),
            whatsappRecipient: recipientClean,
            whatsappLastLog: response.message,
            updatedAt: new Date().toISOString(),
          });
        } else {
          throw new Error(response.message);
        }
      }
      // ==========================================
      // MODE 2: KIRIM LINK DOWNLOAD
      // ==========================================
      else {
        setStatusMessage("Mengirim link download...");

        // Buat URL Print
        const printUrl = `${window.location.origin}/print/${invoice.id}`;
        const finalCaption = `${caption}\n\n📥 *Download Invoice:*\n${printUrl}`;

        const response = await sendWhatsAppText(
          config,
          `${recipientClean}@c.us`,
          finalCaption,
        );

        if (response.success) {
          setIsSuccess(true);
          setStatusMessage("Link download berhasil dikirim!");
          try {
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
          } catch {}
          onSentSuccess({
            ...invoice,
            whatsappStatus: "sent",
            whatsappSentAt: new Date().toISOString(),
            whatsappRecipient: recipientClean,
            whatsappLastLog: "Mengirim link download",
            updatedAt: new Date().toISOString(),
          });
        } else {
          throw new Error(response.message);
        }
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSending(false);
      setPdfGenerating(false);
    }
  };

  const handleOpenDirectWhatsApp = () => {
    let finalCaption = caption;
    if (sendMode === "link") {
      finalCaption += `\n\n📥 Download Invoice:\n${window.location.origin}/print/${invoice.id}`;
    }

    const directUrl = buildDirectWhatsAppUrl(
      invoice.client.phone,
      finalCaption,
    );
    window.open(directUrl, "_blank", "noopener,noreferrer");
    onSentSuccess({
      ...invoice,
      whatsappStatus: "sent",
      whatsappSentAt: new Date().toISOString(),
      whatsappRecipient: recipientClean,
      whatsappLastLog: "Dibuka via Tautan WA",
      updatedAt: new Date().toISOString(),
    });
    onClose();
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
              <h2 className="text-base font-bold leading-snug">
                Kirim Invoice via WhatsApp
              </h2>
              <p className="text-xs text-emerald-100">
                Pilih metode pengiriman yang sesuai.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          {/* Pilihan Mode */}
          <div className="flex gap-3">
            <button
              onClick={() => setSendMode("document")}
              className={`flex-1 p-3 rounded-xl border-2 transition text-left ${sendMode === "document" ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                <FileText className="w-4 h-4 text-emerald-600" /> Kirim File PDF
              </div>
              <div className="text-[11px] text-slate-500 leading-tight">
                Lampiran dokumen fisik. (Hanya OpenWA / Fonnte Pro).
              </div>
            </button>

            <button
              onClick={() => setSendMode("link")}
              className={`flex-1 p-3 rounded-xl border-2 transition text-left ${sendMode === "link" ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                <LinkIcon className="w-4 h-4 text-emerald-600" /> Kirim Link
                Download
              </div>
              <div className="text-[11px] text-slate-500 leading-tight">
                Link ke halaman PDF. (Support Fonnte Free).
              </div>
            </button>
          </div>

          {/* Info Penerima & Gateway */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">
                Pelanggan:
              </div>
              <div className="font-bold text-slate-900">
                {invoice.client.name}
              </div>
              <div className="text-xs font-mono text-emerald-700 font-bold mt-0.5">
                {formatDisplayPhone(invoice.client.phone)}
              </div>
            </div>
            <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[11px] font-bold text-slate-400 mb-0.5">
                Gateway Aktif:
              </div>
              <div className="flex items-center gap-2">
                {serverStatus === "online" ? (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {providerName}{" "}
                    Terhubung
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {providerName}{" "}
                    Terputus
                  </span>
                )}
                <button
                  onClick={checkConnection}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Textarea Caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Pesan Pengantar:
              </label>
              <button
                onClick={() =>
                  setCaption(
                    formatCaptionTemplate(
                      config.autoSendCaption,
                      invoice,
                      business,
                    ),
                  )
                }
                className="text-[11px] text-emerald-600 hover:underline"
              >
                Reset
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-slate-50/50"
            />
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${isSuccess ? "bg-emerald-50 text-emerald-900" : isError ? "bg-rose-50 text-rose-900" : "bg-blue-50 text-blue-900"}`}
            >
              {isSending && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
              )}
              {isSuccess && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="flex-1 font-medium">{statusMessage}</div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
          >
            Tutup
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleOpenDirectWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl"
            >
              <ExternalLink className="w-3.5 h-3.5" /> WA Web
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || pdfGenerating}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendMode === "document" ? "Kirim PDF" : "Kirim Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
