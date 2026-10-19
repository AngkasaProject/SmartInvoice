import React, { useState, useEffect, useMemo } from 'react';
import { BusinessProfile, ClientInfo, Invoice, InvoiceItem, InvoiceStatus } from '../types/invoice';
import { formatIndoDate, formatRupiah } from '../utils/formatters';
import { InvoicePrintable } from './InvoicePrintable';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Eye,
  Edit3,
  Calendar,
  Sparkles,
  DollarSign,
  Layers,
} from 'lucide-react';

interface InvoiceFormProps {
  initialInvoice?: Invoice | null;
  business: BusinessProfile;
  existingInvoices: Invoice[];
  onSave: (invoice: Invoice, isEditing: boolean) => void;
  onCancel: () => void;
}

const COMMON_UNITS = ['Pcs', 'Paket', 'Bulan', 'Jam', 'Hari', 'Unit', 'Proyek', 'Sesi', 'Box'];

const PRESET_ITEMS: Array<Omit<InvoiceItem, 'id' | 'amount'>> = [
  {
    name: 'Pengembangan Aplikasi Web Custom',
    description: 'Frontend React + Backend API & database',
    quantity: 1,
    unit: 'Paket',
    unitPrice: 8500000,
    discountPercent: 0,
  },
  {
    name: 'Jasa Desain Identitas Visual & Logo',
    description: 'Master file vektor AI, EPS, SVG, dan buku panduan brand',
    quantity: 1,
    unit: 'Paket',
    unitPrice: 3200000,
    discountPercent: 0,
  },
  {
    name: 'Pemeliharaan & Support Sistem (Maintenance)',
    description: 'Monitoring 24/7, perbaikan bug, dan update rutin bulanan',
    quantity: 1,
    unit: 'Bulan',
    unitPrice: 1500000,
    discountPercent: 0,
  },
  {
    name: 'Penyediaan Lisensi & Setup WhatsApp Gateway',
    description: 'Integrasi OpenWA API dengan nomor usaha aktif',
    quantity: 1,
    unit: 'Lisensi',
    unitPrice: 2000000,
    discountPercent: 0,
  },
];

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  initialInvoice,
  business,
  existingInvoices,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialInvoice);

  // Extract distinct saved clients from previous invoices for fast auto-complete
  const savedClients = useMemo(() => {
    const map = new Map<string, ClientInfo>();
    existingInvoices.forEach((inv) => {
      if (inv.client && inv.client.name && inv.client.phone) {
        const key = `${inv.client.name.trim().toLowerCase()}-${inv.client.phone.replace(/\D/g, '')}`;
        if (!map.has(key)) {
          map.set(key, inv.client);
        }
      }
    });
    return Array.from(map.values());
  }, [existingInvoices]);
  const generateNewInvoiceNumber = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = business.invoicePrefix || 'INV';
    const count = existingInvoices.length + 1;
    const num = String(count).padStart(3, '0');
    return `${prefix}-${year}${month}-${num}`;
  };

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const getDefaultDueDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 14 days default
    return d.toISOString().split('T')[0];
  };

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice ? initialInvoice.invoiceNumber : generateNewInvoiceNumber()
  );
  const [issueDate, setIssueDate] = useState(
    initialInvoice ? initialInvoice.issueDate : getTodayDateStr()
  );
  const [dueDate, setDueDate] = useState(
    initialInvoice ? initialInvoice.dueDate : getDefaultDueDateStr()
  );
  const [status, setStatus] = useState<InvoiceStatus>(
    initialInvoice ? initialInvoice.status : 'unpaid'
  );

  // Client info
  const [client, setClient] = useState<ClientInfo>(
    initialInvoice
      ? initialInvoice.client
      : {
          name: '',
          company: '',
          phone: '',
          email: '',
          address: '',
          npwp: '',
        }
  );

  // Items
  const [items, setItems] = useState<InvoiceItem[]>(
    initialInvoice && initialInvoice.items.length > 0
      ? initialInvoice.items
      : [
          {
            id: 'item_' + Date.now(),
            name: '',
            description: '',
            quantity: 1,
            unit: 'Paket',
            unitPrice: 0,
            discountPercent: 0,
            amount: 0,
          },
        ]
  );

  // Summary adjustments
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    initialInvoice?.discountType || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<number>(
    initialInvoice ? initialInvoice.discountValue : 0
  );
  const [taxRate, setTaxRate] = useState<number>(
    initialInvoice ? initialInvoice.taxRate : business.defaultTaxRate ?? 11
  );
  const [shippingFee, setShippingFee] = useState<number>(
    initialInvoice ? initialInvoice.shippingFee : 0
  );

  const [notes, setNotes] = useState(
    initialInvoice ? initialInvoice.notes ?? '' : business.defaultNotes
  );
  const [terms, setTerms] = useState(
    initialInvoice ? initialInvoice.terms ?? '' : business.defaultTerms
  );

  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  // Calculations
  const calculateItemAmount = (item: InvoiceItem): number => {
    const base = item.quantity * item.unitPrice;
    const discount = (base * (item.discountPercent || 0)) / 100;
    return Math.max(0, base - discount);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    item.amount = calculateItemAmount(item);
    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: 'item_' + Date.now() + Math.random(),
      name: '',
      description: '',
      quantity: 1,
      unit: 'Pcs',
      unitPrice: 0,
      discountPercent: 0,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const handleAddPreset = (preset: Omit<InvoiceItem, 'id' | 'amount'>) => {
    const newItem: InvoiceItem = {
      id: 'item_' + Date.now() + Math.random(),
      ...preset,
      amount: preset.quantity * preset.unitPrice,
    };
    // If only one empty item exists, replace it
    if (items.length === 1 && !items[0].name && items[0].unitPrice === 0) {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning('Invoice harus memiliki minimal 1 baris item.');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Totals
  const subtotal = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const discountAmount =
    discountType === 'percentage'
      ? (subtotal * (discountValue || 0)) / 100
      : Math.min(subtotal, discountValue || 0);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
  const grandTotal = Math.max(0, taxableAmount + taxAmount + (shippingFee || 0));

  // Current draft object for live preview
  const currentInvoiceDraft: Invoice = {
    id: initialInvoice ? initialInvoice.id : 'inv_' + Date.now(),
    invoiceNumber: invoiceNumber.trim() || 'INV-DRAFT',
    issueDate,
    dueDate,
    status,
    client: {
      ...client,
      name: client.name || 'Nama Pelanggan / Klien',
    },
    items,
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    taxRate,
    taxAmount,
    shippingFee,
    total: grandTotal,
    notes,
    terms,
    whatsappStatus: initialInvoice?.whatsappStatus || 'not_sent',
    whatsappSentAt: initialInvoice?.whatsappSentAt,
    whatsappRecipient: initialInvoice?.whatsappRecipient,
    whatsappLastLog: initialInvoice?.whatsappLastLog,
    createdAt: initialInvoice?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      toast.error('Nomor invoice tidak boleh kosong.');
      return;
    }
    if (!client.name.trim()) {
      toast.error('Nama klien / customer harus diisi.');
      return;
    }
    if (!client.phone.trim()) {
      toast.error('Nomor WhatsApp customer harus diisi untuk pengiriman dokumen via OpenWA.');
      return;
    }
    if (items.some((i) => !i.name.trim() || isNaN(i.unitPrice) || i.unitPrice < 0)) {
      toast.error('Semua baris barang/jasa harus memiliki nama dan harga per unit yang valid (tidak boleh minus).');
      return;
    }

    onSave(currentInvoiceDraft, isEditing);
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {isEditing ? `Edit Invoice: ${initialInvoice?.invoiceNumber}` : 'Buat Invoice Baru'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Perbarui rincian barang, klien, atau tanggal jatuh tempo'
                : 'Lengkapi data pelanggan dan rincian item pekerjaan/barang'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'form'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Form Edit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Invoice
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            Simpan Invoice
          </button>
        </div>
      </div>

      {activeTab === 'preview' ? (
        <div className="bg-slate-200/60 p-2 sm:p-4 md:p-8 rounded-2xl border border-slate-300 overflow-x-auto">
          <div className="mb-4 text-center">
            <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full shadow-xs border border-slate-200">
              Tampilan langsung sesuai format cetak & PDF
            </span>
          </div>
          <div className="min-w-[620px] sm:min-w-0 max-w-[820px] mx-auto">
            <InvoicePrintable
              id="printable-invoice-element"
              invoice={currentInvoiceDraft}
              business={business}
              className="shadow-xl"
            />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Meta & Dates */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Informasi Nomor & Tanggal
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Invoice *
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  placeholder="INV-202610-001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Terbit *
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jatuh Tempo (Due Date) *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Pembayaran
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="unpaid">Belum Dibayar (Unpaid)</option>
                  <option value="paid">Lunas (Paid)</option>
                  <option value="overdue">Jatuh Tempo (Overdue)</option>
                  <option value="draft">Draft</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Data Pelanggan / Klien (Ditagihkan Kepada)
              </h2>

              {/* Repeat Client Quick Select */}
              {savedClients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Pelanggan Sebelumnya:</span>
                  {savedClients.slice(0, 4).map((saved, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setClient({ ...saved });
                        toast.success(`Data pelanggan ${saved.name} berhasil dimuat!`);
                      }}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition border border-indigo-100"
                    >
                      {saved.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Klien / Kontak *
                </label>
                <input
                  type="text"
                  required
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No. WhatsApp Klien * (Untuk kirim PDF)
                </label>
                <input
                  type="text"
                  required
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="08123456789 atau 62812..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Perusahaan / Instansi (Opsional)
                </label>
                <input
                  type="text"
                  value={client.company || ''}
                  onChange={(e) => setClient({ ...client, company: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contoh: PT Cipta Karya Mandiri"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Klien (Opsional)
                </label>
                <input
                  type="email"
                  value={client.email || ''}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="klien@perusahaan.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPWP Klien (Opsional)
                </label>
                <input
                  type="text"
                  value={client.npwp || ''}
                  onChange={(e) => setClient({ ...client, npwp: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="01.234.567.8-000.000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Klien
                </label>
                <textarea
                  rows={1}
                  value={client.address || ''}
                  onChange={(e) => setClient({ ...client, address: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Jl. Thamrin No. 10, Jakarta"
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Rincian Barang & Jasa (Line Items)
                </h2>
                <p className="text-xs text-slate-500">
                  Tambahkan nama item, jumlah, satuan, dan harga per unit
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Contoh Item Cepat:</span>
                {PRESET_ITEMS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="px-2 py-1 text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition border border-indigo-100 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    {preset.name.slice(0, 18)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Items Table Form */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:border-indigo-200 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1">
                      {/* Name */}
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nama Barang / Jasa *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          placeholder="Nama layanan atau barang"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-xs text-center font-bold p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Unit */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Satuan
                        </label>
                        <input
                          type="text"
                          list="units-list"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full text-xs text-center p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          placeholder="Pcs/Paket"
                        />
                        <datalist id="units-list">
                          {COMMON_UNITS.map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </div>

                      {/* Unit Price */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Harga Satuan (Rp) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          required
                          value={item.unitPrice || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-xs font-mono font-bold text-right p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description & subtotal preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pl-9 items-center">
                    <div className="sm:col-span-8">
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full text-[11px] p-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 bg-white"
                        placeholder="Deskripsi detail atau spesifikasi (opsional)..."
                      />
                    </div>
                    <div className="sm:col-span-4 text-right text-xs">
                      <span className="text-slate-400 mr-2">Total Item:</span>
                      <span className="font-mono font-bold text-indigo-950">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah Baris Barang / Jasa
              </button>
            </div>
          </div>

          {/* Pricing Adjustments & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Notes & Terms */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Catatan & Syarat Ketentuan
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan untuk Klien (Notes)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Contoh: Pekerjaan telah diuji bersama. Terima kasih atas kepercayaannya."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Syarat & Ketentuan (Terms & Conditions)
                </label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Klausul pembayaran dan garansi layanan..."
                />
              </div>
            </div>

            {/* Total Calculation Card */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Rincian Pembayaran</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </h2>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal Items:</span>
                <span className="font-mono font-bold text-slate-900">{formatRupiah(subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-6 flex items-center gap-1.5">
                  <span className="text-slate-600">Diskon:</span>
                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as 'percentage' | 'fixed')
                    }
                    className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50"
                  >
                    <option value="fixed">Rp</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
                <div className="col-span-6 flex items-center justify-end">
                  <input
                    type="number"
                    min="0"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right text-xs font-mono p-1 rounded border border-slate-200"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tax / PPN */}
              <div className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-6 flex items-center gap-1.5">
                  <span className="text-slate-600">PPN:</span>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50"
                  >
                    <option value="0">0% (Bebas)</option>
                    <option value="11">11% (Standar)</option>
                    <option value="12">12%</option>
                  </select>
                </div>
                <div className="col-span-6 text-right font-mono font-medium text-slate-800">
                  {formatRupiah(taxAmount)}
                </div>
              </div>

              {/* Shipping fee */}
              <div className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-6 text-slate-600">Ongkos Kirim / Lain:</div>
                <div className="col-span-6 flex justify-end">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={shippingFee || ''}
                    onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right text-xs font-mono p-1 rounded border border-slate-200"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total Akhir:</span>
                <span className="text-xl font-extrabold text-indigo-700 font-mono">
                  {formatRupiah(grandTotal)}
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Perbarui Invoice' : 'Simpan & Terbitkan Invoice'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
