import React from "react";
import {
  Invoice,
  BusinessProfile,
  WhatsAppConfig,
  StoreApiConfig,
} from "../../types/invoice";
import { Database, Download, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BackupSettingsProps {
  invoices: Invoice[];
  business: BusinessProfile;
  config: WhatsAppConfig;
  storeConfig?: StoreApiConfig | null;
  onImportData: (data: any) => void;
  onResetData: () => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
  invoices,
  business,
  config,
  storeConfig,
  onImportData,
  onResetData,
}) => {
  const handleExport = () => {
    const backupData = {
      version: "2.0",
      appName: "SmartInvoice",
      exportedAt: new Date().toISOString(),
      business,
      config,
      storeConfig,
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.invoices && parsed.business) {
          onImportData(parsed);
          toast.success("Data cadangan berhasil dipulihkan!");
        } else {
          toast.error("Format berkas cadangan JSON tidak valid.");
        }
      } catch (err: any) {
        toast.error("Gagal membaca file JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" /> Pencadangan &
          Pemulihan Data
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Simpan dan pulihkan seluruh riwayat invoice dan pengaturan dalam
          berkas JSON mandiri.
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
              <Upload className="w-4 h-4 text-indigo-600" /> Import JSON
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Impor data invoice dan profil usaha dari berkas cadangan JSON.
            </p>
          </div>
          <label className="w-full cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100">
            <Upload className="w-4 h-4 text-slate-600" /> Pilih File JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

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
            onClick={() => {
              if (confirm("Yakin ingin mereset seluruh data?")) {
                onResetData();
                toast.info("Data berhasil di-reset.");
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shrink-0"
          >
            Reset Data
          </button>
        </div>
      </div>
    </div>
  );
};
