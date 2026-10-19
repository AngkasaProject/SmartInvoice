import React, { useState } from 'react';
import { BusinessProfile, Invoice, OpenWaConfig } from '../types/invoice';
import { InvoicePrintable } from './InvoicePrintable';
import { downloadInvoicePdf } from '../utils/pdfGenerator';
import {
  Download,
  Printer,
  Edit,
  Send,
  X,
  CheckCircle2,
  Clock,
  Trash2,
  Loader2,
  Copy,
  Receipt,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  business: BusinessProfile;
  config: OpenWaConfig;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (invoice: Invoice) => void;
  onOpenWhatsAppModal: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  business,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTogglePaid,
  onOpenWhatsAppModal,
  onDuplicate,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [documentType, setDocumentType] = useState<'invoice' | 'kwitansi'>('invoice');

  if (!isOpen || !invoice) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    const fileName =
      documentType === 'kwitansi'
        ? `Kwitansi_${invoice.invoiceNumber.replace('INV-', '')}.pdf`
        : `${invoice.invoiceNumber}.pdf`;

    try {
      await downloadInvoicePdf('detail-modal-printable-element', fileName);
      toast.success(`Berkas ${documentType === 'kwitansi' ? 'Kwitansi' : 'Invoice'} berhasil diunduh!`);
    } catch (err: any) {
      toast.error(`Gagal mengunduh PDF: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStatusToggle = () => {
    if (invoice.status !== 'paid') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }
    }
    onTogglePaid(invoice);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-300 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-slate-800 text-sm">
              {invoice.invoiceNumber}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                invoice.status === 'paid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : invoice.status === 'overdue'
                  ? 'bg-rose-100 text-rose-800'
                  : invoice.status === 'unpaid'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {invoice.status === 'paid'
                ? 'Lunas'
                : invoice.status === 'overdue'
                ? 'Jatuh Tempo'
                : invoice.status === 'unpaid'
                ? 'Belum Bayar'
                : 'Draft'}
            </span>

            {/* Document Type Switcher (Invoice vs Kwitansi) */}
            {invoice.status === 'paid' && (
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setDocumentType('invoice')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition ${
                    documentType === 'invoice'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3 h-3" /> Invoice Tagihan
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType('kwitansi')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition ${
                    documentType === 'kwitansi'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3 h-3" /> Kwitansi Bukti Lunas
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mark as paid button */}
            <button
              onClick={handleStatusToggle}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                invoice.status === 'paid'
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {invoice.status === 'paid' ? (
                <>
                  <Clock className="w-3.5 h-3.5" /> Ubah Belum Lunas
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Lunas
                </>
              )}
            </button>

            {/* WhatsApp Send button */}
            <button
              onClick={() => onOpenWhatsAppModal(invoice)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Kirim WA
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-indigo-600" />
              )}
              Download PDF
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition hidden sm:inline-flex"
              title="Cetak Invoice"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Edit */}
            <button
              onClick={() => onEdit(invoice)}
              className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
              title="Edit Invoice"
            >
              <Edit className="w-4 h-4" />
            </button>

            {/* Duplicate */}
            <button
              onClick={() => onDuplicate(invoice)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition hidden sm:inline-flex"
              title="Duplikat Invoice"
            >
              <Copy className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={() => {
                if (window.confirm(`Yakin ingin menghapus invoice ${invoice.invoiceNumber}?`)) {
                  onDelete(invoice.id);
                  onClose();
                }
              }}
              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition"
              title="Hapus Invoice"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Body (Scrollable canvas for mobile & tablet) */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-6 md:p-8 bg-slate-200/60">
          <div className="min-w-[620px] sm:min-w-0 max-w-[820px] mx-auto">
            <InvoicePrintable
              id="detail-modal-printable-element"
              invoice={invoice}
              business={business}
              documentType={documentType}
              className="shadow-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
