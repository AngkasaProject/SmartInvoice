import React, { useMemo, useState } from "react";
import { CheckCircle2, Factory, Search } from "lucide-react";
import { Invoice } from "../types/invoice";
import { PortalConfig } from "../types/portal";
import { formatIndoDate, formatRupiah } from "../utils/formatters";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";

interface OrdersViewProps {
  invoices: Invoice[];
  portal: PortalConfig;
  onUpdateStage: (invoice: Invoice, stage: number) => Promise<void>;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  invoices,
  portal,
  onUpdateStage,
}) => {
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [completionPending, setCompletionPending] = useState<Invoice | null>(
    null,
  );
  const orders = useMemo(() => {
    const value = query.trim().toLowerCase();
    return invoices
      .filter((invoice) => {
        const currentStage = Math.max(
          0,
          Number(invoice.productionStage) || 0,
        );
        return (
          currentStage < portal.workflowStages.length &&
          (!value ||
            invoice.invoiceNumber.toLowerCase().includes(value) ||
            invoice.client.name.toLowerCase().includes(value) ||
            invoice.client.phone.includes(value))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, portal.workflowStages.length, query]);

  const updateStage = async (invoice: Invoice, stage: number): Promise<boolean> => {
    setUpdating(invoice.id);
    try {
      await onUpdateStage(invoice, stage);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui tahap pesanan.",
      );
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const confirmCompletion = async () => {
    if (!completionPending) return;
    if (await updateStage(completionPending, portal.workflowStages.length)) {
      setCompletionPending(null);
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Produksi
            </p>
            <h1 className="text-xl font-bold text-slate-900">Proses Pesanan</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Daftar ini hanya menampilkan pesanan yang belum selesai. Perbarui
          tahap pengerjaan agar pelanggan dapat melihat progres terbaru.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <label className="relative block max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nomor pesanan atau customer"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
          />
        </label>

        <div className="mt-4 divide-y divide-slate-100">
          {orders.map((invoice) => {
            const currentStage = Math.min(
              Math.max(0, invoice.productionStage || 0),
              portal.workflowStages.length,
            );
            return (
              <article
                key={invoice.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatIndoDate(invoice.issueDate)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-slate-700">
                    {invoice.client.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatRupiah(invoice.total)}
                    <span className="mx-2 text-slate-300">•</span>
                    {`Tahap: ${portal.workflowStages[currentStage]}`}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Tahap saat ini
                  <select
                    value={currentStage}
                    disabled={updating === invoice.id}
                    onChange={(event) => {
                      const stage = Number(event.target.value);
                      if (stage === portal.workflowStages.length) {
                        setCompletionPending(invoice);
                      } else {
                        void updateStage(invoice, stage);
                      }
                    }}
                    className="max-w-52 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs disabled:opacity-60"
                  >
                    {portal.workflowStages.map((stage, index) => (
                      <option key={`${stage}-${index}`} value={index}>
                        {stage}
                      </option>
                    ))}
                    <option value={portal.workflowStages.length}>
                      Selesai
                    </option>
                  </select>
                </label>
              </article>
            );
          })}
          {orders.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              {query.trim()
                ? "Tidak ada pesanan yang cocok."
                : "Tidak ada pesanan yang sedang dikerjakan."}
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(completionPending)}
        title="Selesaikan pesanan?"
        message={`Jika ${completionPending?.invoiceNumber || "pesanan ini"} ditandai selesai, pesanan akan hilang dari menu Pesanan. Anda yakin ingin melanjutkan?`}
        confirmLabel={updating ? "Menyelesaikan..." : "Ya, tandai selesai"}
        confirmDisabled={Boolean(updating)}
        variant="primary"
        onCancel={() => {
          if (!updating) setCompletionPending(null);
        }}
        onConfirm={() => void confirmCompletion()}
      />
    </section>
  );
};
