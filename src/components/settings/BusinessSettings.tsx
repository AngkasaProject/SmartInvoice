import React, { useState } from "react";
import { BusinessProfile, BankAccount } from "../../types/invoice";
import {
  Save,
  Upload,
  Image as ImageIcon,
  QrCode,
  Loader2,
  Trash2,
  Plus,
  Building2,
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBusiness(bizForm);
    toast.success("Profil ID Usaha & Invoice berhasil disimpan ke database!");
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "qris",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "logo") setIsUploadingLogo(true);
    else setIsUploadingQris(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Data, filename: file.name }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.url) {
          if (type === "logo")
            setBizForm((prev) => ({ ...prev, logoUrl: data.url }));
          else setBizForm((prev) => ({ ...prev, qrisImageUrl: data.url }));
          toast.success(
            "Gambar berhasil disimpan di penyimpanan server lokal!",
          );
        } else {
          if (type === "logo")
            setBizForm((prev) => ({ ...prev, logoUrl: base64Data }));
          else setBizForm((prev) => ({ ...prev, qrisImageUrl: base64Data }));
          toast.info("Gambar disimpan dalam format data lokal.");
        }
      } catch {
        if (type === "logo")
          setBizForm((prev) => ({ ...prev, logoUrl: base64Data }));
        else setBizForm((prev) => ({ ...prev, qrisImageUrl: base64Data }));
        toast.info("Gambar disimpan dalam format data lokal.");
      } finally {
        if (type === "logo") setIsUploadingLogo(false);
        else setIsUploadingQris(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
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
            onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
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
            onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
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
            onChange={(e) => setBizForm({ ...bizForm, taxId: e.target.value })}
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
                {isUploadingLogo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                )}{" "}
                Unggah Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "logo")}
                  className="hidden"
                />
              </label>
            </div>
          </div>
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
                {isUploadingQris ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                )}{" "}
                Unggah QRIS
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "qris")}
                  className="hidden"
                />
              </label>
            </div>
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
                const updated = [...(bizForm.bankAccounts || [])];
                updated.splice(index, 1);
                setBizForm({ ...bizForm, bankAccounts: updated });
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
  );
};
