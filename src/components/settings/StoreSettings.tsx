import React, { useState } from "react";
import { StoreApiConfig } from "../../types/invoice";
import {
  ShoppingBag,
  Save,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface StoreSettingsProps {
  storeConfig: StoreApiConfig;
  onSaveStoreApi: (updated: StoreApiConfig) => Promise<void>;
}

export const StoreSettings: React.FC<StoreSettingsProps> = ({
  storeConfig,
  onSaveStoreApi,
}) => {
  const [storeForm, setStoreForm] = useState<StoreApiConfig>(storeConfig);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const webhookEndpointUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/orders/webhook`
      : "/api/orders/webhook";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveStoreApi(storeForm);
    toast.success("Pengaturan API Webhook Toko berhasil disimpan!");
  };

  const handleGenerateSecret = () => {
    const newSec = "sec_store_" + Math.random().toString(36).substring(2, 12);
    setStoreForm({ ...storeForm, webhookSecret: newSec });
    toast.info("Secret Key baru dihasilkan. Jangan lupa simpan!");
  };

  // (Opsional) Simulasi order bisa Anda pindahkan ke sini
  const handleSimulate = async () => {
    setIsSimulating(true);
    // ... logika simulasi order (bisa Anda salin dari file lama)
    setTimeout(() => {
      toast.success("Simulasi order berhasil dikirim!");
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-600" /> Integrasi Toko
            Online & Webhook
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Otomatis konversi pesanan menjadi invoice resmi.
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition"
        >
          <Save className="w-4 h-4" /> Simpan Webhook
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Webhook Endpoint URL:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={webhookEndpointUrl}
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(webhookEndpointUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
              }}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              {copiedUrl ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Webhook Secret Key:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={storeForm.webhookSecret}
              onChange={(e) =>
                setStoreForm({ ...storeForm, webhookSecret: e.target.value })
              }
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
            />
            <button
              type="button"
              onClick={handleGenerateSecret}
              className="px-3 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Acak
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Prefix Invoice Toko
          </label>
          <input
            type="text"
            value={storeForm.invoicePrefix}
            onChange={(e) =>
              setStoreForm({ ...storeForm, invoicePrefix: e.target.value })
            }
            className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Status Awal Pesanan
          </label>
          <select
            value={storeForm.defaultOrderStatus}
            onChange={(e) =>
              setStoreForm({
                ...storeForm,
                defaultOrderStatus: e.target.value as any,
              })
            }
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200"
          >
            <option value="unpaid">Belum Lunas</option>
            <option value="paid">Langsung Lunas</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleSimulate}
          disabled={isSimulating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isSimulating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Kirim Simulasi Order
        </button>
      </div>
    </form>
  );
};
