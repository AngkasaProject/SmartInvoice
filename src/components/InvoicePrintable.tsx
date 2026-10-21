import React from "react";
import { BusinessProfile, Invoice } from "../types/invoice";
import { formatIndoDate, formatRupiah, terbilang } from "../utils/formatters";

interface InvoicePrintableProps {
  invoice: Invoice;
  business: BusinessProfile;
  id?: string;
  className?: string;
  documentType?: "invoice" | "kwitansi";
}

export const InvoicePrintable: React.FC<InvoicePrintableProps> = ({
  invoice,
  business,
  id = "printable-invoice-element",
  className = "",
  documentType = "invoice",
}) => {
  // ==========================================
  // TAMPILAN KWITANSI
  // ==========================================
  if (documentType === "kwitansi") {
    const kwitansiNo = invoice.invoiceNumber.replace(/^INV-?/i, "KW-");
    const itemsSummary = invoice.items.map((i) => i.name).join(", ");

    return (
      <div
        id={id}
        className={`bg-white text-slate-900 p-8 sm:p-10 max-w-[820px] mx-auto border-2 border-slate-300 shadow-sm print:border-none print:shadow-none print:p-6 ${className}`}
        style={{ minHeight: "800px" }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
          <div className="flex items-start gap-4">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.businessName}
                className="h-14 max-w-[150px] object-contain"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center text-white font-extrabold text-2xl shadow-sm">
                {business.businessName ? business.businessName.charAt(0) : "K"}
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

        <div className="my-8 space-y-6 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">
              Telah Terima Dari:
            </span>
            <span className="font-extrabold text-slate-950 text-base">
              {invoice.client.name}{" "}
              {invoice.client.company ? `(${invoice.client.company})` : ""}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">
              Uang Sejumlah:
            </span>
            <span className="font-semibold text-slate-900 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 capitalize w-full">
              ## {terbilang(invoice.total)} ##
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
            <span className="w-44 font-bold text-slate-700 shrink-0">
              Untuk Pembayaran:
            </span>
            <span className="text-slate-800 leading-relaxed">
              Pelunasan tagihan invoice <strong>{invoice.invoiceNumber}</strong>{" "}
              atas pekerjaan: {itemsSummary}
            </span>
          </div>
          {invoice.notes && (
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2 border-b border-dashed border-slate-300">
              <span className="w-44 font-bold text-slate-700 shrink-0">
                Catatan:
              </span>
              <span className="text-slate-700 leading-relaxed whitespace-pre-line">
                {invoice.notes}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-12 pt-4">
          <div className="p-4 bg-slate-50 border-2 border-slate-900 rounded-xl font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wide shadow-xs">
            {formatRupiah(invoice.total)}
          </div>
          <div className="relative text-center sm:text-right min-w-[200px]">
            <div className="absolute -top-7 -left-6 border-4 border-emerald-600 rounded-xl px-4 py-1 text-emerald-700 font-black text-sm tracking-widest uppercase transform -rotate-12 opacity-85 pointer-events-none">
              LUNAS / PAID
            </div>
            <div className="text-xs text-slate-600 mb-1">
              {business.city ? `${business.city}, ` : ""}
              {formatIndoDate(invoice.paidAt || invoice.issueDate)}
            </div>
            <div className="text-xs font-semibold text-slate-700 mb-16">
              Penerima,
            </div>
            <div className="font-bold text-slate-900 text-xs underline decoration-slate-400">
              {business.ownerName || "Pimpinan Usaha"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN INVOICE
  // ==========================================
  return (
    <div
      id={id}
      className={`bg-white text-slate-900 p-8 sm:p-10 max-w-[820px] mx-auto print:p-0 print:border-none print:shadow-none ${className}`}
    >
      {/* 1. HEADER */}
      <div className="flex justify-between items-start mb-10">
        <div className="flex items-center gap-3">
          {business.logoUrl ? (
            <img
              src={business.logoUrl}
              alt={business.businessName}
              className="h-12 max-w-[200px] object-contain"
            />
          ) : (
            <h1 className="text-2xl font-bold text-emerald-600 tracking-tight">
              {business.businessName || "Nama Usaha Anda"}
            </h1>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-800 tracking-widest uppercase">
            Invoice
          </h2>
          <div className="text-xs font-semibold text-emerald-600 mt-1">
            {invoice.invoiceNumber}
          </div>
        </div>
      </div>

      {/* 2. INFO PIHAK */}
      <div className="grid grid-cols-2 gap-8 mb-10 text-xs">
        <div>
          <div className="font-bold text-slate-800 mb-3 uppercase tracking-wide">
            Diterbitkan Atas Nama
          </div>
          <div className="grid grid-cols-3 gap-y-1">
            <span className="text-slate-500">Penjual</span>
            <span className="col-span-2 font-semibold text-slate-900">
              : {business.businessName}
            </span>
          </div>
          {business.address && (
            <div className="grid grid-cols-3 gap-y-1 mt-1">
              <span className="text-slate-500">Alamat</span>
              <span className="col-span-2 text-slate-700">
                : {business.address}, {business.city}
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="font-bold text-slate-800 mb-3 uppercase tracking-wide">
            Untuk
          </div>
          <div className="grid grid-cols-3 gap-y-1">
            <span className="text-slate-500">Pembeli</span>
            <span className="col-span-2 font-semibold text-slate-900">
              : {invoice.client.name}
            </span>
          </div>
          {invoice.client.phone && (
            <div className="grid grid-cols-3 gap-y-1 mt-1">
              <span className="text-slate-500">WhatsApp</span>
              <span className="col-span-2 text-slate-700">
                : {invoice.client.phone}
              </span>
            </div>
          )}
          {invoice.client.address && (
            <div className="grid grid-cols-3 gap-y-1 mt-1">
              <span className="text-slate-500">Alamat Kirim</span>
              <span className="col-span-2 text-slate-700 leading-relaxed">
                : {invoice.client.address}
              </span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-y-1 mt-1">
            <span className="text-slate-500">Tanggal</span>
            <span className="col-span-2 text-slate-700">
              : {formatIndoDate(invoice.issueDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-slate-300 mb-4"></div>

      {/* 3. TABEL PRODUK DENGAN VARIAN */}
      <table className="w-full text-xs mb-6">
        <thead>
          <tr className="text-left text-slate-800 font-bold uppercase tracking-wide border-b border-slate-300">
            <th className="py-2 w-1/2">Info Produk</th>
            <th className="py-2 text-center w-16">Jumlah</th>
            <th className="py-2 text-right w-28">Harga Satuan</th>
            <th className="py-2 text-right w-32">Total Harga</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {invoice.items.map((item, index) => (
            <tr key={item.id || index}>
              <td className="py-4 pr-4">
                <div className="font-bold text-emerald-700 leading-relaxed">
                  {item.name}
                </div>

                {item.variants && item.variants.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {item.variants.map((variant, vIdx) => (
                      <li
                        key={variant.id || vIdx}
                        className="text-[11px] text-slate-600 flex items-start gap-1"
                      >
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>
                          {variant.name}{" "}
                          <strong className="text-slate-800">
                            ({variant.quantity}x)
                          </strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  item.description && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      {item.description}
                    </div>
                  )
                )}
              </td>
              <td className="py-4 text-center text-slate-700">
                {item.variants && item.variants.length > 0
                  ? item.variants.reduce((sum, v) => sum + v.quantity, 0)
                  : item.quantity}
              </td>
              <td className="py-4 text-right text-slate-700">
                {formatRupiah(item.unitPrice)}
              </td>
              <td className="py-4 text-right text-slate-900 font-semibold">
                {formatRupiah(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 4. KALKULASI & DP */}
      <div className="flex justify-end mb-10">
        <div className="w-full sm:w-1/2 text-xs space-y-2">
          <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-2">
            <span>
              TOTAL HARGA (
              {invoice.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
              BARANG)
            </span>
            <span>{formatRupiah(invoice.subtotal)}</span>
          </div>
          {invoice.shippingFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Ongkos Kirim</span>
              <span>{formatRupiah(invoice.shippingFee)}</span>
            </div>
          )}
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>
                Diskon{" "}
                {invoice.discountType === "percentage"
                  ? `(${invoice.discountValue}%)`
                  : ""}
              </span>
              <span>-{formatRupiah(invoice.discountAmount)}</span>
            </div>
          )}
          {invoice.taxRate > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>PPN ({invoice.taxRate}%)</span>
              <span>{formatRupiah(invoice.taxAmount)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
            <span className="text-sm">TOTAL TAGIHAN</span>
            <span className="text-sm">{formatRupiah(invoice.total)}</span>
          </div>

          {/* LOGIKA DP DI PDF */}
          {(invoice.downPayment || 0) > 0 && (
            <>
              <div className="flex justify-between text-emerald-600 font-semibold pt-1">
                <span>Telah Dibayar (DP)</span>
                <span>-{formatRupiah(invoice.downPayment!)}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-rose-50 text-rose-700 rounded-lg font-bold text-sm mt-1 border border-rose-200">
                <span>SISA TAGIHAN</span>
                <span className="font-mono text-base">
                  {formatRupiah(
                    invoice.remainingBalance ||
                      invoice.total - (invoice.downPayment || 0),
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-300 mb-6"></div>

      {/* 5. FOOTER (Metode Pembayaran Dinamis & TTD) */}
      <div className="flex flex-row justify-between items-start text-xs">
        {/* Kiri: Info Pembayaran & Catatan */}
        <div className="w-1/2 text-slate-600">
          <div className="mb-1 font-bold text-slate-800">
            Metode Pembayaran:
          </div>

          <div className="font-bold text-slate-800 mt-1 text-sm">
            {invoice.paymentMethod ||
              (business.bankAccounts && business.bankAccounts.length > 0
                ? business.bankAccounts[0].bankName
                : "-")}
          </div>

          {invoice.paymentMethod === "QRIS" ? (
            <div className="mt-3 flex flex-col items-start gap-2">
              {business.qrisImageUrl ? (
                <img
                  src={business.qrisImageUrl}
                  alt="QRIS Barcode"
                  className="w-32 h-32 object-contain border border-slate-200 rounded-lg p-1 bg-white"
                />
              ) : (
                <div className="text-[11px] text-rose-500 italic">
                  Gambar QRIS belum diunggah.
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Scan barcode menggunakan M-Banking / E-Wallet.
              </div>
            </div>
          ) : invoice.paymentMethod === "Cash / Tunai" ? (
            <div className="mt-1 text-[11px] text-slate-500 italic">
              Pembayaran dilakukan secara tunai.
            </div>
          ) : (
            <>
              <div className="font-mono text-slate-700 mt-0.5">
                {invoice.paymentAccountNumber ||
                  (business.bankAccounts && business.bankAccounts.length > 0
                    ? business.bankAccounts[0].accountNumber
                    : "-")}
              </div>
              <div className="mt-1">
                a.n.{" "}
                {business.bankAccounts?.find(
                  (b) =>
                    b.accountNumber ===
                    (invoice.paymentAccountNumber ||
                      business.bankAccounts?.[0]?.accountNumber),
                )?.accountHolder ||
                  business.ownerName ||
                  "-"}
              </div>
            </>
          )}

          {invoice.notes && (
            <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
              <div className="font-bold text-slate-800 mb-1">Catatan:</div>
              <div className="whitespace-pre-line leading-relaxed">
                {invoice.notes}
              </div>
            </div>
          )}
        </div>

        {/* Kanan: TTD & Stempel */}
        <div className="w-1/2 flex flex-col items-end mt-0">
          <div className="text-slate-600 mb-16">
            {business.city ? `${business.city}, ` : ""}
            {formatIndoDate(invoice.issueDate)}
          </div>

          <div className="relative text-right pr-4">
            <div className="absolute -top-8 -left-12 opacity-80 pointer-events-none transform -rotate-12 border-2 border-emerald-600/70 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider text-center">
              {(business.businessName || "INVOICE").slice(0, 15)}
              <div className="text-[8px] font-normal text-emerald-500">
                OFFICIAL INVOICE
              </div>
            </div>
            <div className="font-bold text-slate-900 underline decoration-slate-400 underline-offset-4">
              {business.ownerName || "Pimpinan"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center text-[10px] text-slate-400">
        Invoice ini sah dan diproses oleh sistem {business.businessName}.
      </div>
    </div>
  );
};
