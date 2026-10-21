import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { InvoicePrintable } from "../components/InvoicePrintable";
import { generateInvoicePdf } from "../utils/pdfGenerator";
import { Invoice, BusinessProfile } from "../types/invoice";
import { Loader2, Download } from "lucide-react";

export const PublicPrintPage = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);

  useEffect(() => {
    fetch(`/api/public/invoice/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setInvoice(data.invoice);
          setBusiness(data.business);
        } else {
          setError(data.message || "Invoice tidak ditemukan.");
        }
      })
      .catch(() => setError("Gagal menghubungi server."))
      .finally(() => setLoading(false));
  }, [id]);

  // Effect untuk menunggu semua gambar (logo) selesai dimuat, lalu trigger download
  useEffect(() => {
    if (!invoice || !business) return;

    const triggerDownload = async () => {
      // Beri jeda 1.5 detik agar layout React & Tailwind selesai
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        await generateInvoicePdf(
          "printable-invoice-element",
          `${invoice.invoiceNumber}.pdf`,
        );
        setDownloadReady(true);
      } catch (err) {
        console.error("Auto download gagal:", err);
        setDownloadReady(true); // Tetap tampilkan tombol manual meskipun gagal
      }
    };

    triggerDownload();
  }, [invoice, business]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
        <p className="text-slate-600 font-medium">
          Menyiapkan dokumen PDF Anda...
        </p>
      </div>
    );
  }

  if (error || !invoice || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-md text-center">
          <h1 className="text-xl font-bold text-rose-600 mb-2">Oops!</h1>
          <p className="text-slate-600">{error || "Data tidak lengkap."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      {/* Container PDF (Akan otomatis ter-download) */}
      <div
        id="printable-invoice-element"
        className="max-w-[820px] mx-auto bg-white shadow-xl rounded-xl overflow-hidden"
      >
        <InvoicePrintable
          invoice={invoice}
          business={business}
          documentType="invoice"
        />
      </div>

      {/* Tombol Manual */}
      <div className="text-center mt-8">
        <button
          onClick={() =>
            generateInvoicePdf(
              "printable-invoice-element",
              `${invoice.invoiceNumber}.pdf`,
            )
          }
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg"
        >
          <Download className="w-5 h-5" /> Unduh PDF Manual
        </button>
        {!downloadReady && (
          <p className="text-xs text-slate-500 mt-2">
            Menunggu proses auto-download...
          </p>
        )}
        {downloadReady && (
          <p className="text-xs text-slate-500 mt-2">
            Jika unduhan tidak dimulai otomatis, klik tombol di atas.
          </p>
        )}
      </div>
    </div>
  );
};
