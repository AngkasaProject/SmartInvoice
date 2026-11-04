import React from "react";
import {
  Invoice,
  InvoiceBackup,
  BusinessProfile,
  WhatsAppConfig,
  StoreApiConfig,
} from "../../types/invoice";
import { Database, Download, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../ConfirmDialog";
import { defaultStoreApiConfig } from "../../services/storage";

interface BackupSettingsProps {
  invoices: Invoice[];
  business: BusinessProfile;
  config: WhatsAppConfig;
  storeConfig?: StoreApiConfig | null;
  onRestoreData: (data: InvoiceBackup) => Promise<void>;
  onResetData: () => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
  invoices,
  business,
  config,
  storeConfig,
  onRestoreData,
  onResetData,
}) => {
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);
  const [backupToRestore, setBackupToRestore] =
    React.useState<InvoiceBackup | null>(null);
  const [backupFileName, setBackupFileName] = React.useState("");
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  const handleExport = () => {
    const backupData = {
      version: "2.0",
      appName: "SmartInvoice",
      exportedAt: new Date().toISOString(),
      business,
      config,
      storeConfig: storeConfig || defaultStoreApiConfig,
      invoices,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SmartInvoice_Backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File cadangan JSON berhasil diunduh!");
  };

  const handleBackupSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !parsed.business ||
          typeof parsed.business !== "object" ||
          !Array.isArray(parsed.invoices) ||
          !parsed.config ||
          typeof parsed.config !== "object" ||
          (parsed.storeConfig != null &&
            typeof parsed.storeConfig !== "object")
        ) {
          throw new Error("Struktur file backup tidak sesuai.");
        }
        const invalidInvoice = parsed.invoices.some(
          (invoice: Partial<Invoice>) =>
            !invoice ||
            typeof invoice.id !== "string" ||
            typeof invoice.invoiceNumber !== "string",
        );
        if (invalidInvoice) {
          throw new Error("Daftar invoice di file backup tidak valid.");
        }
        if (
          new Set(parsed.invoices.map((invoice: Invoice) => invoice.id)).size !==
          parsed.invoices.length
        ) {
          throw new Error("File backup berisi ID invoice yang duplikat.");
        }
        setBackupToRestore(parsed as InvoiceBackup);
        setBackupFileName(file.name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Format file tidak valid.";
        toast.error(`Gagal membaca file backup: ${message}`);
      }
    };
    reader.onerror = () => toast.error("Gagal membaca file backup.");
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!backupToRestore || isRestoring) return;
    setIsRestoring(true);
    try {
      await onRestoreData(backupToRestore);
      setIsRestoreDialogOpen(false);
      setBackupToRestore(null);
      setBackupFileName("");
      toast.success(
        `Backup berhasil dipulihkan (${backupToRestore.invoices.length} invoice).`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan tidak diketahui.";
      toast.error(`Gagal memulihkan backup: ${message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await onResetData();
      setIsResetDialogOpen(false);
      toast.info("Data berhasil di-reset.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan tidak diketahui.";
      toast.error(`Gagal mereset data: ${message}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" /> Pencadangan &
          Pemulihan Data
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Simpan dan pulihkan riwayat invoice, profil usaha, serta pengaturan
          dalam berkas JSON. File gambar tidak disertakan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-600" /> Export JSON
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Unduh seluruh {invoices.length} tagihan, profil usaha, dan
              pengaturan gateway.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" /> Unduh JSON Sekarang
          </button>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-indigo-600" /> Pulihkan dari Backup
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Ganti data invoice, profil usaha, dan pengaturan dengan isi file
              backup JSON. File gambar tidak disertakan dalam backup.
            </p>
          </div>
          <label className="w-full cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100">
            <Upload className="w-4 h-4 text-slate-600" /> Pilih File Backup
            <input
              type="file"
              accept=".json"
              onChange={handleBackupSelection}
              className="hidden"
            />
          </label>
          {backupToRestore && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="break-all text-[11px] font-semibold text-indigo-900">
                {backupFileName}
              </p>
              <p className="text-[11px] text-indigo-800">
                {backupToRestore.invoices.length} invoice siap dipulihkan.
                Data yang ada saat ini akan diganti.
              </p>
              <button
                type="button"
                onClick={() => setIsRestoreDialogOpen(true)}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Pulihkan Data
              </button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={isRestoreDialogOpen}
        title="Pulihkan backup?"
        message={
          backupToRestore
            ? `Data invoice saat ini akan diganti dengan ${backupToRestore.invoices.length} invoice dari file "${backupFileName}", termasuk profil usaha dan pengaturan. Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmLabel={isRestoring ? "Memulihkan..." : "Ya, pulihkan"}
        confirmDisabled={isRestoring}
        onCancel={() => {
          if (!isRestoring) {
            setIsRestoreDialogOpen(false);
          }
        }}
        onConfirm={() => void handleRestore()}
      />

      <div className="pt-4 border-t border-slate-200">
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Zona Berbahaya:
              Reset Data
            </div>
            <p className="text-[11px] text-rose-700 mt-0.5">
              Mengembalikan seluruh data ke sampel awal aplikasi.
            </p>
          </div>
          <button
            onClick={() => setIsResetDialogOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shrink-0"
          >
            Reset Data
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title="Reset seluruh data?"
        message="Invoice akan diganti dengan data sampel, dan profil usaha serta pengaturan akan dikembalikan ke nilai awal. Tindakan ini tidak dapat dibatalkan."
        confirmLabel={isResetting ? "Mereset..." : "Reset data"}
        confirmDisabled={isResetting}
        onCancel={() => {
          if (!isResetting) setIsResetDialogOpen(false);
        }}
        onConfirm={() => void handleReset()}
      />
    </div>
  );
};
