import React from 'react';
import { BusinessProfile, Invoice } from '../types/invoice';
import { formatIndoDate, formatIndoDateFull, formatRupiah, terbilang } from '../utils/formatters';
import { Building2, CheckCircle2, Clock, AlertTriangle, FileText, QrCode } from 'lucide-react';

interface InvoicePrintableProps {
  invoice: Invoice;
  business: BusinessProfile;
  id?: string;
  className?: string;
  documentType?: 'invoice' | 'kwitansi';
}

export const InvoicePrintable: React.FC<InvoicePrintableProps> = ({
  invoice,
  business,
  id = 'printable-invoice-element',
  className = '',
  documentType = 'invoice',
}) => {
  const getStatusBadge = () => {
    switch (invoice.status) {
      case 'paid':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            LUNAS (PAID)
          </div>
        );
      case 'overdue':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            JATUH TEMPO
          </div>
        );
      case 'unpaid':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" />
            BELUM DIBAYAR
          </div>
        );
      case 'draft':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <FileText className="w-3.5 h-3.5" />
            DRAFT
          </div>
        );
    }
  };

  if (documentType === 'kwitansi') {
    const kwitansiNo = invoice.invoiceNumber.replace(/^INV-?/i, 'KW-');
    const itemsSummary = invoice.items.map((i) => i.name).join(', ');

    return (
      <div
        id={id}
        className={`bg-white text-slate-900 p-8 sm:p-10 max-w-[820px] mx-auto border-2 border-slate-300 shadow-sm print:border-none print:shadow-none print:p-6 ${className}`}
        style={{ minHeight: '800px' }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
          <div className="flex items-start gap-4">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.businessName}
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 bg-white"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center text-white font-extrabold text-2xl shadow-sm">
                {business.businessName ? business.businessName.charAt(0) : 'K'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                {business.businessName}
              </h1>
              <p className="text-xs text-slate-600 max-w-sm">
                {business.address}, {business.city}
              </p>
              <div className="text-xs text-slate-500 mt-0.5">
                WA: {business.phone} • Email: {business.email}
              </div>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-2xl font-black text-slate-900 tracking-wider underline underline-offset-4">
              KWITANSI
            </h2>
            <div className="text-xs font-mono font-bold text-slate-700 mt-1">
              No: {kwitansiNo}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Ref Invoice: {invoice.invoiceNumber}
            </div>
          </div>
        </div>

        {/* Kwitansi Body */}
        <div className="my-8 space-y-6 text-sm">
          {/* Row 1: Telah Terima Dari */}
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">Telah Terima Dari:</span>
            <span className="font-extrabold text-slate-950 text-base">
              {invoice.client.name} {invoice.client.company ? `(${invoice.client.company})` : ''}
            </span>
          </div>

          {/* Row 2: Uang Sejumlah */}
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">Uang Sejumlah:</span>
            <span className="font-semibold text-slate-900 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 capitalize w-full">
              ## {terbilang(invoice.total)} ##
            </span>
          </div>

          {/* Row 3: Untuk Pembayaran */}
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">Untuk Pembayaran:</span>
            <span className="text-slate-800 leading-relaxed">
              Pelunasan tagihan invoice <strong>{invoice.invoiceNumber}</strong> atas pekerjaan:{' '}
              {itemsSummary}
            </span>
          </div>

          {/* Row 4: Metode Pembayaran & Tanggal */}
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">Metode & Tgl Lunas:</span>
            <span className="text-emerald-700 font-semibold">
              {invoice.paidMethod || 'Transfer Bank'} pada{' '}
              {formatIndoDateFull(invoice.paidAt || invoice.issueDate)}
            </span>
          </div>
        </div>

        {/* Nominal Box & Stamp Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-12 pt-4">
          {/* Big Amount Box */}
          <div className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wide shadow-xs">
            TERBILANG: {formatRupiah(invoice.total)}
          </div>

          {/* Stamp & Signature */}
          <div className="relative text-center sm:text-right min-w-[200px]">
            {/* Lunas Stamp */}
            <div className="absolute -top-7 -left-6 border-4 border-emerald-600 rounded-xl px-4 py-1 text-emerald-700 font-black text-sm tracking-widest uppercase transform -rotate-12 opacity-85 pointer-events-none">
              LUNAS / PAID
              <div className="text-[9px] font-bold text-emerald-800">
                {formatIndoDate(invoice.paidAt || invoice.issueDate)}
              </div>
            </div>

            <div className="text-xs text-slate-600 mb-1">
              {business.city ? `${business.city}, ` : ''}
              {formatIndoDate(invoice.paidAt || invoice.issueDate)}
            </div>
            <div className="text-xs font-semibold text-slate-700 mb-16">Penerima,</div>
            <div className="font-bold text-slate-900 text-xs underline decoration-slate-400">
              {business.ownerName || 'Pimpinan Usaha'}
            </div>
            <div className="text-[11px] text-slate-500">{business.businessName}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Kwitansi ini adalah tanda bukti pembayaran yang sah dan sah secara hukum tanpa materai tambahan untuk transaksi digital.
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`bg-white text-slate-900 p-8 sm:p-10 max-w-[820px] mx-auto border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-6 ${className}`}
      style={{ minHeight: '1050px' }}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-4">
        {/* Company Identity */}
        <div className="flex items-start gap-4">
          {business.logoUrl ? (
            <img
              src={business.logoUrl}
              alt={business.businessName}
              className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 bg-white"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-extrabold text-2xl shadow-sm">
              {business.businessName ? business.businessName.charAt(0) : 'K'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              {business.businessName || 'Nama Usaha Anda'}
            </h1>
            {business.tagline && (
              <p className="text-xs text-slate-500 font-medium mb-1">{business.tagline}</p>
            )}
            <p className="text-xs text-slate-600 max-w-sm">
              {business.address}
              {business.city ? `, ${business.city}` : ''}
              {business.postalCode ? ` ${business.postalCode}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
              {business.phone && <span>WA: {business.phone}</span>}
              {business.email && <span>• {business.email}</span>}
              {business.taxId && <span>• NPWP: {business.taxId}</span>}
            </div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="text-left sm:text-right flex flex-col sm:items-end">
          <div className="text-2xl font-black text-indigo-950 tracking-tight mb-1">
            INVOICE
          </div>
          <div className="text-sm font-bold text-slate-800 font-mono bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 mb-2 inline-block">
            {invoice.invoiceNumber}
          </div>
          <div className="mb-2">{getStatusBadge()}</div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <div>
              <span className="text-slate-400">Tgl Terbit:</span>{' '}
              <strong className="text-slate-700">{formatIndoDate(invoice.issueDate)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Jatuh Tempo:</span>{' '}
              <strong className="text-rose-600 font-semibold">{formatIndoDate(invoice.dueDate)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To & Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            Ditagihkan Kepada (Bill To):
          </div>
          <div className="text-base font-bold text-slate-900">{invoice.client.name}</div>
          {invoice.client.company && (
            <div className="text-xs font-semibold text-indigo-700 mb-0.5">
              {invoice.client.company}
            </div>
          )}
          {invoice.client.phone && (
            <div className="text-xs text-slate-600">WhatsApp: {invoice.client.phone}</div>
          )}
          {invoice.client.email && (
            <div className="text-xs text-slate-600">Email: {invoice.client.email}</div>
          )}
          {invoice.client.address && (
            <div className="text-xs text-slate-500 mt-1 whitespace-pre-line">
              {invoice.client.address}
            </div>
          )}
          {invoice.client.npwp && (
            <div className="text-xs text-slate-500 mt-0.5">NPWP: {invoice.client.npwp}</div>
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-4 sm:pt-0 sm:pl-6 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Ringkasan Tagihan:
            </div>
            <div className="text-sm text-slate-600">
              Total Tagihan:{' '}
              <span className="font-extrabold text-indigo-900 text-lg">
                {formatRupiah(invoice.total)}
              </span>
            </div>
            {invoice.status === 'paid' && invoice.paidAt && (
              <div className="text-xs text-emerald-700 font-medium mt-1">
                Lunas pada: {formatIndoDateFull(invoice.paidAt)} ({invoice.paidMethod || 'Transfer'})
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 italic mt-3 bg-white p-2 rounded border border-slate-200">
            Terbilang:
            <div className="font-medium text-slate-800 not-italic capitalize">
              {terbilang(invoice.total)}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3">Item & Deskripsi</th>
              <th className="py-2.5 px-3 text-center w-16">Qty</th>
              <th className="py-2.5 px-3 text-center w-20">Satuan</th>
              <th className="py-2.5 px-3 text-right w-28">Harga</th>
              {invoice.items.some((i) => (i.discountPercent || 0) > 0) && (
                <th className="py-2.5 px-3 text-center w-16">Diskon</th>
              )}
              <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((item, index) => (
              <tr key={item.id || index} className="hover:bg-slate-50/50">
                <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-800 text-xs">{item.name}</div>
                  {item.description && (
                    <div className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line leading-relaxed">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="py-3 px-3 text-center font-medium text-slate-700">
                  {item.quantity}
                </td>
                <td className="py-3 px-3 text-center text-slate-500">{item.unit || 'Unit'}</td>
                <td className="py-3 px-3 text-right text-slate-700 font-mono">
                  {formatRupiah(item.unitPrice)}
                </td>
                {invoice.items.some((i) => (i.discountPercent || 0) > 0) && (
                  <td className="py-3 px-3 text-center text-amber-600 font-mono">
                    {item.discountPercent ? `${item.discountPercent}%` : '-'}
                  </td>
                )}
                <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                  {formatRupiah(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculations & Summary Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6 mb-6">
        {/* Payment Transfer Info */}
        <div className="w-full sm:w-1/2 p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 text-xs">
          <div className="font-bold text-indigo-950 mb-2 flex items-center justify-between">
            <span>Metode Pembayaran Resmi:</span>
            {business.qrisImageUrl && (
              <span className="text-[10px] text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                <QrCode className="w-3 h-3" /> QRIS Ready
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-slate-700">
            <div className="flex items-center justify-between py-1 border-b border-indigo-100/60">
              <span className="text-slate-500">Bank Tujuan:</span>
              <span className="font-bold text-slate-900">{business.bankName}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-indigo-100/60">
              <span className="text-slate-500">No. Rekening:</span>
              <span className="font-bold text-indigo-900 font-mono text-sm tracking-wide">
                {business.bankAccountNumber}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Atas Nama:</span>
              <span className="font-semibold text-slate-800">{business.bankAccountHolder}</span>
            </div>
            {business.secondaryBank && business.secondaryBank.bankAccountNumber && (
              <div className="mt-2 pt-2 border-t border-indigo-100/80 text-[11px] text-slate-600">
                <span className="text-slate-500">Opsi Bank 2:</span>{' '}
                <strong>{business.secondaryBank.bankName}</strong> -{' '}
                <span className="font-mono font-bold">
                  {business.secondaryBank.bankAccountNumber}
                </span>{' '}
                ({business.secondaryBank.bankAccountHolder})
              </div>
            )}
          </div>
        </div>

        {/* Calculation Table */}
        <div className="w-full sm:w-5/12 space-y-2 text-xs">
          <div className="flex justify-between py-1 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-slate-800">{formatRupiah(invoice.subtotal)}</span>
          </div>

          {invoice.discountAmount > 0 && (
            <div className="flex justify-between py-1 text-emerald-700">
              <span>
                Diskon{' '}
                {invoice.discountType === 'percentage'
                  ? `(${invoice.discountValue}%)`
                  : '(Potongan)'}
                :
              </span>
              <span className="font-mono font-medium">- {formatRupiah(invoice.discountAmount)}</span>
            </div>
          )}

          {invoice.taxRate > 0 && (
            <div className="flex justify-between py-1 text-slate-600">
              <span>PPN ({invoice.taxRate}%):</span>
              <span className="font-mono font-medium text-slate-800">{formatRupiah(invoice.taxAmount)}</span>
            </div>
          )}

          {invoice.shippingFee > 0 && (
            <div className="flex justify-between py-1 text-slate-600">
              <span>Biaya Pengiriman:</span>
              <span className="font-mono font-medium text-slate-800">{formatRupiah(invoice.shippingFee)}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2.5 px-3 bg-indigo-900 text-white rounded-lg font-bold text-sm mt-2">
            <span>TOTAL TAGIHAN:</span>
            <span className="font-mono text-base">{formatRupiah(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes, Terms & Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
        {/* Notes & Terms */}
        <div className="space-y-3 text-xs text-slate-600">
          {invoice.notes && (
            <div>
              <div className="font-bold text-slate-800 mb-0.5">Catatan:</div>
              <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line bg-slate-50 p-2 rounded border border-slate-200">
                {invoice.notes}
              </p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div className="font-bold text-slate-800 mb-0.5">Syarat & Ketentuan:</div>
              <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">
                {invoice.terms}
              </p>
            </div>
          )}
        </div>

        {/* Business Signature & Official Stamp */}
        <div className="text-right sm:text-right flex flex-col items-end">
          <div className="text-xs text-slate-600 mb-1">
            {business.city ? `${business.city}, ` : ''}
            {formatIndoDate(invoice.issueDate)}
          </div>
          <div className="text-xs font-semibold text-slate-700 mb-14">Hormat Kami,</div>

          {/* Authentic stamp & signature overlay */}
          <div className="relative inline-block pr-2">
            {/* Stamp simulation */}
            <div className="absolute -top-10 -left-12 opacity-80 pointer-events-none transform -rotate-12 border-2 border-indigo-600/70 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">
              {(business.businessName || 'INVOICE').slice(0, 15)}
              <div className="text-[8px] font-normal text-indigo-500">OFFICIAL INVOICE</div>
            </div>
            <div className="font-bold text-slate-900 text-xs underline decoration-indigo-300 underline-offset-4">
              {business.ownerName || 'Pimpinan Usaha'}
            </div>
            <div className="text-[11px] text-slate-500">{business.businessName}</div>
          </div>
        </div>
      </div>

      {/* Footer verification note */}
      <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
        Dokumen ini diterbitkan secara sah dan otomatis melalui sistem KirimInvoice. Verifikasi keabsahan dapat ditanyakan langsung ke WhatsApp resmi {business.phone}.
      </div>
    </div>
  );
};
