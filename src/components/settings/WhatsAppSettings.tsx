import React, { useState, useEffect } from "react";
import { WhatsAppConfig } from "../../types/invoice";
import { testWhatsAppGateway } from "../../services/whatsapp";
import { Server, Save, RefreshCw, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppSettingsProps {
  config: WhatsAppConfig;
  onSaveConfig: (updated: WhatsAppConfig) => void;
}

export const WhatsAppSettings: React.FC<WhatsAppSettingsProps> = ({
  config,
  onSaveConfig,
}) => {
  const [waForm, setWaForm] = useState<WhatsAppConfig>(config);
  const [waTestStatus, setWaTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [waTestMsg, setWaTestMsg] = useState("");

  useEffect(() => {
    setWaForm(config);
  }, [config]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(waForm);
    toast.success(
      `Pengaturan Gateway WhatsApp (${waForm.provider === "fonnte" ? "Fonnte" : "OpenWA"}) berhasil disimpan!`,
    );
  };

  const handleTest = async () => {
    setWaTestStatus("loading");
    setWaTestMsg("");
    const res = await testWhatsAppGateway(waForm);
    if (res.success) {
      setWaTestStatus("success");
      setWaTestMsg(res.message);
      toast.success(res.message);
    } else {
      setWaTestStatus("error");
      setWaTestMsg(res.message);
      toast.error(res.message);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" /> Gateway WhatsApp
            Otomatis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kirim invoice PDF resmi langsung ke chat pelanggan.
          </p>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
        >
          <Save className="w-4 h-4" /> Simpan Gateway
        </button>
      </div>

      {/* Provider Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => setWaForm({ ...waForm, provider: "openwa" })}
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${waForm.provider === "openwa" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="text-xs font-bold text-slate-900">
            OpenWA (Self-Hosted)
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Server mandiri, dukungan UUID session & API Key.
          </p>
        </div>
        <div
          onClick={() => setWaForm({ ...waForm, provider: "fonnte" })}
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${waForm.provider === "fonnte" ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="text-xs font-bold text-slate-900">Fonnte (Cloud)</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Layanan cloud praktis, cukup masukkan Device Token.
          </p>
        </div>
      </div>

      {/* Form OpenWA */}
      {waForm.provider === "openwa" && (
        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              URL Server OpenWA
            </label>
            <input
              type="text"
              value={waForm.serverUrl}
              onChange={(e) =>
                setWaForm({ ...waForm, serverUrl: e.target.value })
              }
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
              placeholder="http://localhost:8080"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Session ID (UUID)
              </label>
              <input
                type="text"
                value={waForm.sessionName}
                onChange={(e) =>
                  setWaForm({ ...waForm, sessionName: e.target.value })
                }
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
                placeholder="UUID Sesi"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={waForm.apiKey}
                onChange={(e) =>
                  setWaForm({ ...waForm, apiKey: e.target.value })
                }
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
                placeholder="API Key"
              />
            </div>
          </div>
        </div>
      )}

      {/* Form Fonnte */}
      {waForm.provider === "fonnte" && (
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Device API Token Fonnte
            </label>
            <input
              type="password"
              value={waForm.fonnteToken}
              onChange={(e) =>
                setWaForm({ ...waForm, fonnteToken: e.target.value })
              }
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
              placeholder="Token Fonnte"
            />
          </div>
        </div>
      )}

      {/* Caption Template */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Template Pesan Pengantar (Caption):
        </label>
        <textarea
          rows={5}
          value={waForm.autoSendCaption}
          onChange={(e) =>
            setWaForm({ ...waForm, autoSendCaption: e.target.value })
          }
          className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Tag: {"{client_name}"}, {"{invoice_no}"}, {"{total}"}, {"{due_date}"},{" "}
          {"{bank_info}"}
        </p>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={waTestStatus === "loading"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
        >
          {waTestStatus === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          )}
          Tes Koneksi
        </button>
        {waTestMsg && (
          <div
            className={`p-2 rounded-lg text-xs font-medium ${waTestStatus === "success" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
          >
            {waTestMsg}
          </div>
        )}
      </div>
    </form>
  );
};
