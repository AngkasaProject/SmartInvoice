import React, { useState, useEffect } from "react";
import {
  Invoice,
  InvoiceItem,
  InvoiceItemVariant,
  BusinessProfile,
} from "../types/invoice";
import { Plus, Trash2, Save, X, PlusCircle } from "lucide-react";
import { formatRupiah } from "../utils/formatters";
import { toast } from "sonner";

interface InvoiceFormProps {
  initialInvoice: Invoice | null;
  business: BusinessProfile;
  existingInvoices: Invoice[];
  onSave: (invoice: Invoice, isEditing: boolean) => void;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  initialInvoice,
  business,
  existingInvoices,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialInvoice);

  // State Form Utama
  const [clientName, setClientName] = useState(
    initialInvoice?.client?.name || "",
  );
  const [clientCompany, setClientCompany] = useState(
    initialInvoice?.client?.company || "",
  );
  const [clientPhone, setClientPhone] = useState(
    initialInvoice?.client?.phone || "",
  );
  const [clientAddress, setClientAddress] = useState(
    initialInvoice?.client?.address || "",
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice?.invoiceNumber || "",
  );
  const [issueDate, setIssueDate] = useState(
    initialInvoice?.issueDate || new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState(initialInvoice?.dueDate || "");
  const [notes, setNotes] = useState(initialInvoice?.notes || "");

  // State Pembayaran & DP
  const [paymentMethod, setPaymentMethod] = useState(
    initialInvoice?.paymentMethod || "",
  );
  const [paymentAccountNumber, setPaymentAccountNumber] = useState(
    initialInvoice?.paymentAccountNumber || "",
  );
  const [downPayment, setDownPayment] = useState<number | string>(
    initialInvoice?.downPayment || "",
  );

  // State Keuangan (PPN & Diskon)
  const [items, setItems] = useState<InvoiceItem[]>(
    initialInvoice?.items || [
      {
        id: "item_1",
        name: "",
        quantity: 1,
        unitPrice: 0,
        unit: "Pcs",
        amount: 0,
      },
    ],
  );
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">(
    initialInvoice?.discountType || "fixed",
  );
  const [discountValue, setDiscountValue] = useState<number | string>(
    initialInvoice?.discountValue || "",
  );
  const [taxRate, setTaxRate] = useState<number | string>(
    initialInvoice?.taxRate ?? business.defaultTaxRate ?? 11,
  );
  const [shippingFee, setShippingFee] = useState<number | string>(
    initialInvoice?.shippingFee || "",
  );

  // Generate Invoice Number Otomatis jika baru
  useEffect(() => {
    if (!isEditing && !invoiceNumber) {
      const dateStr = new Date().toISOString().slice(0, 7).replace("-", ""); // YYYYMM
      const count =
        existingInvoices.filter((inv) => inv.invoiceNumber.includes(dateStr))
          .length + 1;
      const seq = count.toString().padStart(3, "0");

      // GUNAKAN PREFIX DARI BUSINESS PROFILE (Default: INV)
      const prefix = business.invoicePrefix || "INV";
      setInvoiceNumber(`${prefix}-${dateStr}-${seq}`);
    }
  }, [isEditing, existingInvoices, invoiceNumber, business.invoicePrefix]);

  // Helper untuk input angka agar bisa kosong (tidak memaksa 0)
  const handleNumericInput = (value: string): number | string => {
    if (value === "") return "";
    const num = Number(value);
    return isNaN(num) ? "" : num;
  };

  // Fungsi Tambah/Hapus Baris Produk
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item_${Date.now()}`,
        name: "",
        quantity: 1,
        unitPrice: 0,
        unit: "Pcs",
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error("Minimal harus ada 1 barang.");
      return;
    }
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: any,
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      newItems[index].amount =
        (Number(newItems[index].quantity) || 0) *
        (Number(newItems[index].unitPrice) || 0);
    }
    setItems(newItems);
  };

  // ==========================================
  // LOGIKA VARIAN
  // ==========================================
  const handleAddVariant = (itemIndex: number) => {
    const updatedItems = [...items];
    const newVariant: InvoiceItemVariant = {
      id: `var_${Date.now()}`,
      name: "",
      quantity: 1,
      price: Number(updatedItems[itemIndex].unitPrice) || 0,
    };

    if (!updatedItems[itemIndex].variants) {
      updatedItems[itemIndex].variants = [];
    }
    updatedItems[itemIndex].variants!.push(newVariant);

    recalculateItemTotals(updatedItems, itemIndex);
    setItems(updatedItems);
  };

  const handleUpdateVariant = (
    itemIndex: number,
    variantIndex: number,
    field: keyof InvoiceItemVariant,
    value: any,
  ) => {
    const updatedItems = [...items];
    if (updatedItems[itemIndex].variants) {
      updatedItems[itemIndex].variants![variantIndex] = {
        ...updatedItems[itemIndex].variants![variantIndex],
        [field]: value,
      };

      if (field === "price" && variantIndex === 0) {
        updatedItems[itemIndex].unitPrice = Number(value);
      }
      recalculateItemTotals(updatedItems, itemIndex);
      setItems(updatedItems);
    }
  };

  const handleRemoveVariant = (itemIndex: number, variantIndex: number) => {
    const updatedItems = [...items];
    if (updatedItems[itemIndex].variants) {
      updatedItems[itemIndex].variants!.splice(variantIndex, 1);

      if (updatedItems[itemIndex].variants!.length === 0) {
        delete updatedItems[itemIndex].variants;
      } else {
        recalculateItemTotals(updatedItems, itemIndex);
      }
      setItems(updatedItems);
    }
  };

  const recalculateItemTotals = (itemsArray: InvoiceItem[], index: number) => {
    const item = itemsArray[index];
    if (item.variants && item.variants.length > 0) {
      const totalQty = item.variants.reduce(
        (sum, v) => sum + (Number(v.quantity) || 0),
        0,
      );
      const totalAmount = item.variants.reduce(
        (sum, v) => sum + (Number(v.quantity) || 0) * (Number(v.price) || 0),
        0,
      );

      item.quantity = totalQty;
      item.amount = totalAmount;
      item.unitPrice = item.variants[0].price || 0;
    } else {
      item.amount =
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    }
  };

  // ==========================================
  // KALKULASI BOTTOM
  // ==========================================
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  let discountAmount = 0;
  const dVal = Number(discountValue) || 0;
  if (discountType === "fixed") {
    discountAmount = dVal;
  } else {
    discountAmount = (subtotal * dVal) / 100;
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tRate = Number(taxRate) || 0;
  const taxAmount = (taxableAmount * tRate) / 100;
  const total = taxableAmount + taxAmount + (Number(shippingFee) || 0);

  const remainingBalance = Math.max(0, total - (Number(downPayment) || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((item) => !item.name || item.quantity <= 0)) {
      toast.error("Nama barang tidak boleh kosong dan Qty harus lebih dari 0.");
      return;
    }

    const finalInvoice: Invoice = {
      id: initialInvoice?.id || `inv_${Date.now()}`,
      invoiceNumber,
      issueDate,
      dueDate,
      client: {
        name: clientName,
        company: clientCompany,
        phone: clientPhone,
        address: clientAddress,
      },
      items,
      subtotal,
      discountType,
      discountValue: Number(discountValue) || 0,
      discountAmount,
      taxRate: tRate,
      taxAmount,
      shippingFee: Number(shippingFee) || 0,
      total,
      downPayment: Number(downPayment) || 0,
      remainingBalance,
      notes,
      status: initialInvoice?.status || "unpaid",
      paymentMethod,
      paymentAccountNumber,
      whatsappStatus: initialInvoice?.whatsappStatus || "not_sent",
      createdAt: initialInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(finalInvoice, isEditing);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header Form */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditing ? "Edit Invoice" : "Buat Invoice Baru"}
          </h1>
          <p className="text-sm text-slate-500">
            Isi detail pelanggan dan produk di bawah ini.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" /> Simpan Invoice
          </button>
        </div>
      </div>

      {/* Info Pelanggan & Invoice */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kiri: Pelanggan */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">
            Informasi Pelanggan
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nama Pelanggan *
            </label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Nama Lengkap"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              No. WhatsApp *
            </label>
            <input
              type="text"
              required
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="081234567890"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Alamat / Instansi (Opsional)
            </label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Alamat lengkap"
            />
          </div>
        </div>

        {/* Kanan: Detail Invoice */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">
            Detail Invoice
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nomor Invoice
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full text-sm font-mono p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tanggal Terbit
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Jatuh Tempo
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          {/* METODE PEMBAYARAN DROPDOWN */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Metode Pembayaran
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                const selectedBank = business.bankAccounts?.find(
                  (b) => b.bankName === e.target.value,
                );
                setPaymentAccountNumber(selectedBank?.accountNumber || "");
              }}
              className="w-full text-sm p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Pilih Metode (Opsional) --</option>
              {business.bankAccounts?.map((bank) => (
                <option key={bank.id} value={bank.bankName}>
                  {bank.bankName} - {bank.accountNumber} (a.n.{" "}
                  {bank.accountHolder})
                </option>
              ))}
              <option value="QRIS">QRIS</option>
              <option value="Cash / Tunai">Cash / Tunai</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Produk */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Daftar Produk / Jasa
          </h2>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Baris Produk
          </button>
        </div>

        <div className="p-4 space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative p-4 border border-slate-200 rounded-xl bg-white group hover:border-emerald-300 transition"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Nama & Varian (Col 5) */}
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    required
                    value={item.name}
                    onChange={(e) =>
                      handleUpdateItem(index, "name", e.target.value)
                    }
                    className="w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                    placeholder="Cth: Kaos Polos Premium"
                  />

                  {/* TOMBOL TAMBAH VARIAN */}
                  <button
                    type="button"
                    onClick={() => handleAddVariant(index)}
                    className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> + Tambah Varian
                  </button>

                  {/* LIST VARIAN */}
                  {item.variants && item.variants.length > 0 && (
                    <div className="mt-2 space-y-2 pl-2 border-l-2 border-indigo-300">
                      {item.variants.map((variant, vIdx) => (
                        <div
                          key={variant.id || vIdx}
                          className="flex gap-1.5 items-center"
                        >
                          <input
                            type="text"
                            placeholder="Nama Varian"
                            value={variant.name}
                            onChange={(e) =>
                              handleUpdateVariant(
                                index,
                                vIdx,
                                "name",
                                e.target.value,
                              )
                            }
                            className="flex-1 text-xs p-1.5 border rounded bg-indigo-50/30"
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            value={variant.quantity}
                            onChange={(e) =>
                              handleUpdateVariant(
                                index,
                                vIdx,
                                "quantity",
                                Number(e.target.value),
                              )
                            }
                            className="w-14 text-xs p-1.5 border rounded bg-indigo-50/30 text-center"
                          />
                          {/* INPUT HARGA VARIAN */}
                          <input
                            type="number"
                            placeholder="Harga"
                            value={variant.price}
                            onChange={(e) =>
                              handleUpdateVariant(
                                index,
                                vIdx,
                                "price",
                                Number(e.target.value),
                              )
                            }
                            className="w-24 text-xs p-1.5 border rounded bg-indigo-50/30 text-right font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(index, vIdx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qty (Col 2) */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateItem(
                        index,
                        "quantity",
                        handleNumericInput(e.target.value),
                      )
                    }
                    className="w-full text-sm p-2 border rounded-lg text-center bg-slate-50"
                    readOnly={Boolean(
                      item.variants && item.variants.length > 0,
                    )}
                    title={
                      item.variants && item.variants.length > 0
                        ? "Qty otomatis dihitung dari total varian"
                        : ""
                    }
                  />
                  <div className="text-[10px] text-slate-400 text-center mt-1">
                    {item.variants && item.variants.length > 0
                      ? "Auto dari Varian"
                      : "Satuan"}
                  </div>
                </div>

                {/* Harga (Col 2) */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={item.unitPrice === 0 ? "" : item.unitPrice}
                    onChange={(e) =>
                      handleUpdateItem(
                        index,
                        "unitPrice",
                        handleNumericInput(e.target.value),
                      )
                    }
                    className="w-full text-sm p-2 border rounded-lg text-right font-mono bg-slate-50"
                    readOnly={Boolean(
                      item.variants && item.variants.length > 0,
                    )}
                    title={
                      item.variants && item.variants.length > 0
                        ? "Harga mengikuti varian"
                        : ""
                    }
                    placeholder="0"
                  />
                  {item.variants && item.variants.length > 0 && (
                    <div className="text-[10px] text-slate-400 text-right mt-1">
                      Ikuti varian 1
                    </div>
                  )}
                </div>

                {/* Total Harga (Col 3) */}
                <div className="md:col-span-3 flex flex-col justify-end">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 text-right">
                    Total (Rp)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-full text-sm p-2 border border-slate-200 rounded-lg text-right font-bold bg-slate-50 font-mono">
                      {formatRupiah(item.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                      title="Hapus Baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kalkulasi & Catatan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Catatan (Kiri) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-bold text-slate-800 mb-2">
            Catatan Invoice
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full text-sm p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            placeholder="Terima kasih atas kepercayaan Anda..."
          />
        </div>

        {/* Kalkulasi (Kanan) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-mono font-semibold">
              {formatRupiah(subtotal)}
            </span>
          </div>

          {/* Diskon */}
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-slate-600 whitespace-nowrap">Diskon</span>
            <div className="flex items-center gap-1 flex-1 justify-end">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="text-xs p-1.5 border rounded"
              >
                <option value="fixed">Rp</option>
                <option value="percentage">%</option>
              </select>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) =>
                  setDiscountValue(handleNumericInput(e.target.value))
                }
                className="w-24 text-sm p-1.5 border rounded text-right font-mono"
                placeholder="0"
              />
            </div>
          </div>

          {/* PPN DINAMIS */}
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-slate-600 whitespace-nowrap">PPN (%)</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(handleNumericInput(e.target.value))}
                className="w-20 text-sm p-1.5 border rounded text-right font-mono"
                placeholder="0"
              />
            </div>
          </div>

          {/* Ongkir */}
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-slate-600 whitespace-nowrap">
              Ongkos Kirim
            </span>
            <input
              type="number"
              min="0"
              value={shippingFee}
              onChange={(e) =>
                setShippingFee(handleNumericInput(e.target.value))
              }
              className="w-32 text-sm p-1.5 border rounded text-right font-mono"
              placeholder="0"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-between items-center mt-2">
            <span className="font-bold text-slate-800 uppercase">
              Total Tagihan
            </span>
            <span className="text-xl font-black text-emerald-700 font-mono">
              {formatRupiah(total)}
            </span>
          </div>

          {/* TAMBAHKAN INPUT DP DI SINI */}
          <div className="flex justify-between items-center text-sm gap-2 pt-2 border-t border-slate-100">
            <span className="text-slate-600 whitespace-nowrap">
              Uang Muka (DP)
            </span>
            <input
              type="number"
              min="0"
              max={total}
              value={downPayment}
              onChange={(e) =>
                setDownPayment(handleNumericInput(e.target.value))
              }
              className="w-32 text-sm p-1.5 border rounded text-right font-mono text-emerald-700 font-bold"
              placeholder="0"
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="font-bold text-slate-800 uppercase">
              Sisa Tagihan
            </span>
            <span className="text-xl font-black text-rose-600 font-mono">
              {formatRupiah(remainingBalance)}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
};
