import React, { useState } from 'react';
import { Invoice } from '../types/invoice';
import { formatDisplayPhone, formatRupiah } from '../utils/formatters';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import {
  CheckCircle2,
  Download,
  Send,
  ArrowRight,
  Loader2,
  FileText,
  User,
  Phone,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface PostSaveActionModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onSendWhatsApp: (invoice: Invoice) => void;
  onViewDetail: (invoice: Invoice) => void;
}

export const PostSaveActionModal: React.FC<PostSaveActionModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSendWhatsApp,
  onViewDetail,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !invoice) return null;

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await downloadInvoicePdf('printable-invoice-element', `${invoice.invoiceNumber}.pdf`);
      toast.success(`PDF ${invoice.invoiceNumber} berhasil diunduh!`);
    } catch (err: any) {
      toast.error(`Gagal mengunduh PDF: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendViaWhatsApp = () => {
    onClose();
    onSendWhatsApp(invoice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Perubahan Invoice Disimpan!</h3>
              <p className="text-xs text-slate-500">
                Pilih tindakan selanjutnya untuk berkas tagihan ini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Pill */}
        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
              {invoice.invoiceNumber}
            </span>
            <span className="font-extrabold text-slate-900 text-sm font-mono">
              {formatRupiah(invoice.total)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-slate-700">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold truncate">{invoice.client.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-mono">
              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-semibold truncate">
                {formatDisplayPhone(invoice.client.phone)}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Action Cards */}
        <div className="p-6 space-y-3">
          {/* Action 1: Kirim WhatsApp OpenWA */}
          <div
            onClick={handleSendViaWhatsApp}
            className="group cursor-pointer p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 transition flex items-center justify-between shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  Kirim PDF ke WhatsApp Customer
                  <span className="bg-emerald-200/70 text-emerald-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                    Rekomendasi
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-snug">
                  Kirim salinan file PDF secara otomatis ke nomor{' '}
                  <strong className="font-mono">{formatDisplayPhone(invoice.client.phone)}</strong> via OpenWA.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-700 shrink-0 group-hover:translate-x-1 transition ml-2" />
          </div>

          {/* Action 2: Download PDF */}
          <div
            onClick={handleDownloadPdf}
            className="group cursor-pointer p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-between shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                {isDownloading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                ) : (
                  <Download className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {isDownloading ? 'Sedang Menyiapkan PDF...' : 'Download Berkas PDF Salinan'}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Unduh dokumen PDF invoice beresolusi tinggi langsung ke perangkat Anda.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-1 transition ml-2" />
          </div>

          {/* Action 3: View Details */}
          <button
            onClick={() => {
              onClose();
              onViewDetail(invoice);
            }}
            className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Lihat Pratinjau Invoice Lengkap
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
          >
            Selesai / Kembali ke Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
