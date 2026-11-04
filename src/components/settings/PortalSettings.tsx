import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Globe,
  Instagram,
  Link2,
  MessageCircle,
  Plus,
  Save,
  ShoppingBag,
  Trash2,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { PortalConfig, PortalLink } from "../../types/portal";

interface PortalSettingsProps {
  config: PortalConfig;
  onSave: (config: PortalConfig) => Promise<void>;
}

function detectIcon(url: string) {
  const host = url.toLowerCase();
  if (host.includes("whatsapp") || host.includes("wa.me")) return MessageCircle;
  if (host.includes("instagram")) return Instagram;
  if (host.includes("youtube")) return Youtube;
  if (host.includes("shopee") || host.includes("tokopedia")) return ShoppingBag;
  if (host.includes("http")) return Globe;
  return Link2;
}

export const PortalSettings: React.FC<PortalSettingsProps> = ({
  config,
  onSave,
}) => {
  const [draft, setDraft] = useState(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const updateLink = (id: string, patch: Partial<PortalLink>) => {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, ...patch } : link,
      ),
    }));
  };

  const updateStage = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      workflowStages: current.workflowStages.map((stage, stageIndex) =>
        stageIndex === index ? value : stage,
      ),
    }));
  };

  const handleSave = async () => {
    if (draft.workflowStages.some((stage) => !stage.trim())) {
      toast.error("Nama setiap tahap pesanan wajib diisi.");
      return;
    }
    if (
      draft.links.some((link) => {
        try {
          const url = new URL(link.url);
          return (
            !link.label.trim() ||
            (url.protocol !== "http:" && url.protocol !== "https:")
          );
        } catch {
          return true;
        }
      })
    ) {
      toast.error("Periksa nama dan URL tautan. URL harus diawali http:// atau https://.");
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Portal publik berhasil disimpan.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan portal.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">Landing page toko</h2>
          <p className="mt-1 text-xs text-slate-500">
            Atur sapaan dan daftar tautan yang tampil di halaman publik.
          </p>
        </div>
        <label className="mb-4 block text-xs font-semibold text-slate-700">
          Judul sambutan
          <input
            value={draft.welcomeTitle}
            onChange={(event) =>
              setDraft({ ...draft, welcomeTitle: event.target.value })
            }
            maxLength={80}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="mb-5 block text-xs font-semibold text-slate-700">
          Pesan sambutan
          <textarea
            value={draft.welcomeMessage}
            onChange={(event) =>
              setDraft({ ...draft, welcomeMessage: event.target.value })
            }
            maxLength={240}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
          />
        </label>

        <div className="space-y-3">
          {draft.links.map((link) => {
            const Icon = detectIcon(link.url);
            return (
              <div
                key={link.id}
                className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[auto_1fr_1.4fr_auto]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon className="h-4 w-4" />
                </div>
                <input
                  aria-label="Nama tautan"
                  placeholder="Nama tautan"
                  value={link.label}
                  onChange={(event) =>
                    updateLink(link.id, { label: event.target.value })
                  }
                  className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  aria-label="URL tautan"
                  placeholder="https://..."
                  value={link.url}
                  onChange={(event) =>
                    updateLink(link.id, { url: event.target.value })
                  }
                  className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      links: draft.links.filter((item) => item.id !== link.id),
                    })
                  }
                  className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                  aria-label={`Hapus tautan ${link.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                links: [
                  ...draft.links,
                  { id: crypto.randomUUID(), label: "", url: "" },
                ],
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Tambah tautan
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">Alur pesanan</h2>
          <p className="mt-1 text-xs text-slate-500">
            Tahap-tahap ini ditampilkan sebagai progres kepada pelanggan.
          </p>
        </div>
        <div className="space-y-2">
          {draft.workflowStages.map((stage, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                {index + 1}
              </span>
              <input
                aria-label={`Tahap ${index + 1}`}
                value={stage}
                onChange={(event) => updateStage(index, event.target.value)}
                maxLength={40}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={draft.workflowStages.length <= 1}
                onClick={() =>
                  setDraft({
                    ...draft,
                    workflowStages: draft.workflowStages.filter(
                      (_, stageIndex) => stageIndex !== index,
                    ),
                  })
                }
                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                aria-label={`Hapus tahap ${stage}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={draft.workflowStages.length >= 12}
            onClick={() =>
              setDraft({
                ...draft,
                workflowStages: [...draft.workflowStages, "Tahap baru"],
              })
            }
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Tambah tahap
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          Di halaman publik, tahap selesai berwarna hijau, tahap berjalan
          berwarna oranye, dan tahap berikutnya berwarna abu-abu.
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 xl:col-span-2">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
        >
          <ArrowUpRight className="h-4 w-4" /> Lihat landing page
        </a>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Menyimpan..." : "Simpan portal"}
        </button>
      </div>
    </div>
  );
};
