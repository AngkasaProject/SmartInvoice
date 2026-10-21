import React, { useState } from "react";
import { BusinessProfile, BankAccount } from "../../types/invoice";
import {
  Save,
  Upload,
  Image as ImageIcon,
  QrCode,
  Trash2,
  Plus,
  Building2,
  AlertTriangle,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

interface BusinessSettingsProps {
  business: BusinessProfile;
  onSaveBusiness: (updated: BusinessProfile) => void;
}

export const BusinessSettings: React.FC<BusinessSettingsProps> = ({
  business,
  onSaveBusiness,
}) => {
  const [bizForm, setBizForm] = useState<BusinessProfile>(business);

  // State untuk Modal Konfirmasi Kustom
  const [deleteTarget, setDeleteTarget] = useState<{
    url: string;
    type: "logo" | "qris" | "bank";
    index?: number;
  } | null>(null);

  // Fungsi 1: Hanya menyimpan Base64 ke state (Preview)
  const handleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "qris",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      if (type === "logo")
        setBizForm((prev) => ({ ...prev, logoUrl: base64Data }));
      else setBizForm((prev) => ({ ...prev, qrisImageUrl: base64Data }));
      toast.info(
        'Gambar dipilih. Klik "Simpan Profil Usaha" untuk mengunggah.',
      );
    };
    reader.readAsDataURL(file);
  };

  // Fungsi 2: Upload saat Simpan
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalLogoUrl = bizForm.logoUrl;
    let finalQrisUrl = bizForm.qrisImageUrl;

    const uploadIfBase64 = async (
      base64: string | undefined,
      filename: string,
    ) => {
      if (base64 && base64.startsWith("data:image")) {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, filename }),
        });
        const data = await res.json();
        if (data.success) return data.url;
        throw new Error(data.message || "Gagal upload gambar");
      }
      return base64;
    };

    try {
      if (finalLogoUrl?.startsWith("data:image")) {
        toast.loading("Mengunggah logo...", { id: "upload" });
        finalLogoUrl = await uploadIfBase64(finalLogoUrl, "logo.png");
      }
      if (finalQrisUrl?.startsWith("data:image")) {
        toast.loading("Mengunggah QRIS...", { id: "upload" });
        finalQrisUrl = await uploadIfBase64(finalQrisUrl, "qris.png");
      }
      toast.dismiss("upload");

      const updatedProfile = {
        ...bizForm,
        logoUrl: finalLogoUrl,
        qrisImageUrl: finalQrisUrl,
      };
      setBizForm(updatedProfile);
      onSaveBusiness(updatedProfile);
      toast.success("Profil ID Usaha & Invoice berhasil disimpan!");
    } catch (err: any) {
      toast.dismiss("upload");
      toast.error("Gagal mengunggah gambar: " + err.message);
    }
  };

  // Fungsi 3: Eksekusi Hapus setelah Konfirmasi
  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { url, type, index } = deleteTarget;

    // Hapus file fisik (jika bukan Base64)
    if (url && (url.startsWith("/uploads/") || url.includes("supabase.co"))) {
      try {
        await fetch("/api/delete-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: url }),
        });
      } catch (e) {
        console.warn("Gagal hapus file fisik", e);
      }
    }

    // Update State
    if (type === "logo") setBizForm({ ...bizForm, logoUrl: "" });
    else if (type === "qris") setBizForm({ ...bizForm, qrisImageUrl: "" });
    else if (type === "bank" && index !== undefined) {
      const updated = [...(bizForm.bankAccounts || [])];
      updated.splice(index, 1);
      setBizForm({ ...bizForm, bankAccounts: updated });
    }

    toast.success("Data berhasil dihapus.");
    setDeleteTarget(null); // Tutup modal
  };

  return (
    <>
      <form
        onSubmit={handleSaveBusiness}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Identitas Bisnis & Pembayaran
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Data ini dicetak otomatis pada kepala dokumen faktur invoice dan
              kwitansi resmi.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
          >
            <Save className="w-4 h-4" /> Simpan Profil Usaha
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nama Usaha / Toko *
            </label>
            <input
              type="text"
              required
              value={bizForm.businessName}
              onChange={(e) =>
                setBizForm({ ...bizForm, businessName: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Tagline / Bidang Jasa
            </label>
            <input
              type="text"
              value={bizForm.tagline}
              onChange={(e) =>
                setBizForm({ ...bizForm, tagline: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nama Penanggung Jawab
            </label>
            <input
              type="text"
              value={bizForm.ownerName}
              onChange={(e) =>
                setBizForm({ ...bizForm, ownerName: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nomor WhatsApp Usaha
            </label>
            <input
              type="text"
              value={bizForm.phone}
              onChange={(e) =>
                setBizForm({ ...bizForm, phone: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Email Resmi
            </label>
            <input
              type="email"
              value={bizForm.email}
              onChange={(e) =>
                setBizForm({ ...bizForm, email: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              NPWP / NIB
            </label>
            <input
              type="text"
              value={bizForm.taxId || ""}
              onChange={(e) =>
                setBizForm({ ...bizForm, taxId: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Alamat Kantor / Toko
            </label>
            <textarea
              rows={2}
              value={bizForm.address}
              onChange={(e) =>
                setBizForm({ ...bizForm, address: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Kota / Kabupaten
            </label>
            <input
              type="text"
              value={bizForm.city}
              onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Website (Opsional)
            </label>
            <input
              type="text"
              value={bizForm.website || ""}
              onChange={(e) =>
                setBizForm({ ...bizForm, website: e.target.value })
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Image Uploaders */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
            <ImageIcon className="w-4 h-4 text-blue-600" /> Gambar Logo & QRIS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Logo Uploader */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Logo Usaha
              </span>
              <div className="flex items-center gap-3 pt-1">
                {bizForm.logoUrl ? (
                  <img
                    src={bizForm.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Pilih Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(e, "logo")}
                    className="hidden"
                  />
                </label>

                {bizForm.logoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ url: bizForm.logoUrl!, type: "logo" })
                    }
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            {/* QRIS Uploader */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-slate-600" /> Gambar QRIS
              </span>
              <div className="flex items-center gap-3 pt-1">
                {bizForm.qrisImageUrl ? (
                  <img
                    src={bizForm.qrisImageUrl}
                    alt="QRIS"
                    className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                    <QrCode className="w-5 h-5" />
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Pilih QRIS
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(e, "qris")}
                    className="hidden"
                  />
                </label>

                {bizForm.qrisImageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        url: bizForm.qrisImageUrl!,
                        type: "qris",
                      })
                    }
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* PENGATURAN DEFAULT INVOICE (BARU)          */}
        {/* ========================================== */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
            <Settings2 className="w-4 h-4 text-slate-600" />
            Pengaturan Default Invoice
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. PREFIX INVOICE */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Prefix Nomor Invoice
              </label>
              <input
                type="text"
                value={bizForm.invoicePrefix || "INV"}
                onChange={(e) =>
                  setBizForm({ ...bizForm, invoicePrefix: e.target.value })
                }
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="INV"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Contoh: INV, ASS, atau kode toko Anda.
              </p>
            </div>

            {/* 2. SIMBOL MATA UANG */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Simbol Mata Uang
              </label>
              <input
                type="text"
                value={bizForm.currencySymbol || "Rp"}
                onChange={(e) =>
                  setBizForm({ ...bizForm, currencySymbol: e.target.value })
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Rp"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Digunakan pada format harga di PDF.
              </p>
            </div>

            {/* 3. PPN DEFAULT */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                PPN Default (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={bizForm.defaultTaxRate ?? 11}
                onChange={(e) =>
                  setBizForm({
                    ...bizForm,
                    defaultTaxRate: Number(e.target.value),
                  })
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="11"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Nilai awal PPN saat buat invoice.
              </p>
            </div>
          </div>
        </div>

        {/* Bank Accounts Dinamis */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800">
              Rekening Bank Pembayaran
            </h3>
            <button
              type="button"
              onClick={() => {
                const newBank: BankAccount = {
                  id: `bank_${Date.now()}`,
                  bankName: "",
                  accountNumber: "",
                  accountHolder: "",
                };
                setBizForm({
                  ...bizForm,
                  bankAccounts: [...(bizForm.bankAccounts || []), newBank],
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Rekening
            </button>
          </div>

          {bizForm.bankAccounts?.map((bank, index) => (
            <div
              key={bank.id}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative group"
            >
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget({ url: "", type: "bank", index });
                }}
                className="absolute top-2 right-2 p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nama Bank *
                  </label>
                  <input
                    type="text"
                    required
                    value={bank.bankName}
                    onChange={(e) => {
                      const updated = [...(bizForm.bankAccounts || [])];
                      updated[index].bankName = e.target.value;
                      setBizForm({ ...bizForm, bankAccounts: updated });
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    No. Rekening *
                  </label>
                  <input
                    type="text"
                    required
                    value={bank.accountNumber}
                    onChange={(e) => {
                      const updated = [...(bizForm.bankAccounts || [])];
                      updated[index].accountNumber = e.target.value;
                      setBizForm({ ...bizForm, bankAccounts: updated });
                    }}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Atas Nama *
                  </label>
                  <input
                    type="text"
                    required
                    value={bank.accountHolder}
                    onChange={(e) => {
                      const updated = [...(bizForm.bankAccounts || [])];
                      updated[index].accountHolder = e.target.value;
                      setBizForm({ ...bizForm, bankAccounts: updated });
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </form>

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI KUSTOM                                  */}
      {/* ======================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Konfirmasi Hapus
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deleteTarget.type === "logo" &&
                  "Apakah Anda yakin ingin menghapus Logo Usaha ini? File akan dihapus secara permanen."}
                {deleteTarget.type === "qris" &&
                  "Apakah Anda yakin ingin menghapus Gambar QRIS ini? File akan dihapus secara permanen."}
                {deleteTarget.type === "bank" &&
                  "Apakah Anda yakin ingin menghapus rekening bank ini dari daftar?"}
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
