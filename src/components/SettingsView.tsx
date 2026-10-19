import React, { useState, useEffect } from 'react';
import { BusinessProfile, Invoice, OpenWaConfig, StoreApiConfig } from '../types/invoice';
import { testOpenWaConnection } from '../services/openwa';
import {
  DatabaseSettings,
  generateSupabaseSqlSchema,
  loadDatabaseSettings,
  migrateLocalToSupabase,
  migrateSupabaseToLocal,
  saveDatabaseSettings,
  testSupabaseConnection,
} from '../services/dbAdapter';
import {
  loadStoreApiConfigFromStorage,
  saveStoreApiConfigToStorage,
} from '../services/storage';
import {
  Building2,
  Server,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  RefreshCw,
  Database,
  Download,
  Copy,
  Check,
  FileCode,
  HelpCircle,
  Cloud,
  HardDrive,
  ArrowRightLeft,
  Sparkles,
  ShoppingBag,
  Key,
  Webhook,
  Code2,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsViewProps {
  business: BusinessProfile;
  config: OpenWaConfig;
  invoices: Invoice[];
  onSaveBusiness: (updated: BusinessProfile) => void;
  onSaveConfig: (updated: OpenWaConfig) => void;
  onImportData: (data: { invoices: Invoice[]; business: BusinessProfile; config: OpenWaConfig }) => void;
  onResetData: () => void;
  onRefreshData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  business,
  config,
  invoices,
  onSaveBusiness,
  onSaveConfig,
  onImportData,
  onResetData,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'business' | 'openwa' | 'database' | 'store' | 'data'>('business');

  // Business Profile local state
  const [bizForm, setBizForm] = useState<BusinessProfile>(business);

  // OpenWA config local state
  const [waForm, setWaForm] = useState<OpenWaConfig>(config);

  // Store Webhook API config local state
  const [storeForm, setStoreForm] = useState<StoreApiConfig>(loadStoreApiConfigFromStorage);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Database settings state
  const [dbSettings, setDbSettings] = useState<DatabaseSettings>(loadDatabaseSettings);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [supabaseTestMsg, setSupabaseTestMsg] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // OpenWA Connection test states
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResultMsg, setTestResultMsg] = useState('');
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBusiness(bizForm);
    toast.success('Profil ID Usaha berhasil disimpan!');
  };

  const handleSaveOpenWa = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(waForm);
    toast.success('Pengaturan OpenWA API berhasil disimpan!');
  };

  const handleSaveStoreApi = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreApiConfigToStorage(storeForm);
    toast.success('Pengaturan API Webhook Toko berhasil disimpan!');
  };

  const handleGenerateNewSecret = () => {
    const newSec = 'sec_store_' + Math.random().toString(36).substring(2, 12);
    setStoreForm({ ...storeForm, webhookSecret: newSec });
    toast.info('Secret Key baru dihasilkan. Jangan lupa simpan pengaturan!');
  };

  const handleSimulateStoreOrder = async () => {
    setIsSimulating(true);
    const sampleOrderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const sampleOrder = {
      orderId: sampleOrderId,
      customer: {
        name: 'Rahmat Hidayat (Pelanggan Toko)',
        phone: '081298765432',
        email: 'rahmat.store@customer.id',
        address: 'Jl. Riau No. 88, Pekanbaru',
        company: 'Online Order Checkout',
      },
      items: [
        {
          name: 'Jaket Denim Casual Pria Premium',
          quantity: 1,
          unit: 'Pcs',
          unitPrice: 320000,
          description: 'Ukuran XL, Warna Dark Blue',
        },
        {
          name: 'Kaos Polos Cotton Combed 30s',
          quantity: 2,
          unit: 'Pcs',
          unitPrice: 65000,
          description: 'Ukuran L, Warna Hitam & Putih',
        },
      ],
      discount: 20000,
      shippingFee: 18000,
      taxRate: 11,
      notes: `Pesanan otomatis dari Toko Online (Checkout Web #${sampleOrderId})`,
      status: storeForm.defaultOrderStatus || 'unpaid',
    };

    try {
      const res = await fetch('/api/orders/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${storeForm.webhookSecret}`,
        },
        body: JSON.stringify(sampleOrder),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Pesanan toko #${sampleOrderId} berhasil masuk & diubah menjadi ${data.invoiceNumber}!`, {
          description: 'Data invoice telah ditambahkan ke Dashboard dan Riwayat.',
        });
        if (onRefreshData) onRefreshData();
      } else {
        toast.error('Gagal memproses pesanan simulasi: ' + (data.message || res.statusText));
      }
    } catch (err: any) {
      toast.error('Error saat mengirim simulasi pesanan: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveDbSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveDatabaseSettings(dbSettings);
    toast.success(`Pengaturan database disimpan! Mode aktif: ${dbSettings.activeDriver === 'supabase' ? 'Supabase Cloud' : 'Database Lokal'}`);
    if (onRefreshData) onRefreshData();
  };

  const handleTestOpenWaConnection = async () => {
    setTestStatus('loading');
    setTestResultMsg('');
    setTestLatency(null);

    // PERBAIKAN: Menambahkan parameter ketiga (waForm.sessionName) agar UUID ikut terkirim
    const res = await testOpenWaConnection(
      waForm.serverUrl, 
      waForm.apiKey, 
      waForm.sessionName 
    );

    if (res.success) {
      setTestStatus('success');
      setTestResultMsg(res.message);
      if (res.latencyMs !== undefined) setTestLatency(res.latencyMs);
      toast.success(res.message);
    } else {
      setTestStatus('error');
      setTestResultMsg(res.message);
      toast.error(res.message);
    }
  };

  const handleTestSupabase = async () => {
    setSupabaseTestStatus('loading');
    setSupabaseTestMsg('');

    const res = await testSupabaseConnection(dbSettings.supabaseUrl, dbSettings.supabaseAnonKey);
    if (res.success) {
      setSupabaseTestStatus('success');
      setSupabaseTestMsg(res.message);
      toast.success(res.message);
    } else {
      setSupabaseTestStatus('error');
      setSupabaseTestMsg(res.message);
      toast.error(res.message);
    }
  };

  const handleMigrateToSupabase = async () => {
    if (!dbSettings.supabaseUrl || !dbSettings.supabaseAnonKey) {
      toast.error('Harap lengkapi URL Supabase dan Anon Key terlebih dahulu.');
      return;
    }
    setIsMigrating(true);
    toast.info('Memulai migrasi data lokal ke Supabase Cloud...');

    const res = await migrateLocalToSupabase();
    setIsMigrating(false);
    if (res.success) {
      toast.success(res.message);
      if (onRefreshData) onRefreshData();
    } else {
      toast.error(res.message);
    }
  };

  const handleMigrateToLocal = async () => {
    if (!dbSettings.supabaseUrl || !dbSettings.supabaseAnonKey) {
      toast.error('Harap lengkapi URL Supabase dan Anon Key terlebih dahulu.');
      return;
    }
    setIsMigrating(true);
    toast.info('Mengunduh data dari Supabase ke penyimpanan lokal...');

    const res = await migrateSupabaseToLocal();
    setIsMigrating(false);
    if (res.success) {
      toast.success(res.message);
      if (onRefreshData) onRefreshData();
    } else {
      toast.error(res.message);
    }
  };

  const handleCopySql = () => {
    const sql = generateSupabaseSqlSchema();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    toast.success('Skrip SQL berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBizForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
        toast.success('Logo berhasil diunggah.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      business: bizForm,
      config: waForm,
      storeConfig: storeForm,
      invoices,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KirimInvoice_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File cadangan JSON berhasil diunduh!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.invoices && parsed.business) {
          onImportData({
            invoices: parsed.invoices,
            business: parsed.business,
            config: parsed.config || waForm,
          });
          setBizForm(parsed.business);
          if (parsed.config) setWaForm(parsed.config);
          if (parsed.storeConfig) setStoreForm(parsed.storeConfig);
          toast.success('Data cadangan berhasil dipulihkan!');
        } else {
          toast.error('Format berkas cadangan JSON tidak valid.');
        }
      } catch (err: any) {
        toast.error('Gagal membaca file JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const webhookEndpointUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/orders/webhook`
    : '/api/orders/webhook';

  const sampleJsonCode = `{
  "orderId": "ORD-98214",
  "customer": {
    "name": "Budi Santoso",
    "phone": "081234567890",
    "email": "budi@email.com",
    "address": "Jl. Merdeka No. 10, Jakarta",
    "company": "PT Budi Karya"
  },
  "items": [
    {
      "name": "Kemeja Batik Katun Premium",
      "quantity": 2,
      "unit": "Pcs",
      "unitPrice": 150000,
      "description": "Ukuran L, Warna Hitam"
    }
  ],
  "discount": 10000,
  "shippingFee": 15000,
  "taxRate": 11,
  "status": "unpaid",
  "notes": "Pesanan dari Toko Online"
}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengaturan ID Usaha, OpenWA & API Toko</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola profil bisnis, integrasi OpenWA WhatsApp, webhook pesanan toko online, dan Supabase
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'business'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            ID Usaha
          </button>

          <button
            onClick={() => setActiveTab('openwa')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'openwa'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            OpenWA API
          </button>

          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'store'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
            API Toko & Webhook
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'database'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            Supabase & DB
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'data'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Backup JSON
          </button>
        </div>
      </div>

      {/* Tab 1: ID & Profil Usaha */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Identitas Resmi Bisnis / Perusahaan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden mb-3 shadow-xs">
                  {bizForm.logoUrl ? (
                    <img
                      src={bizForm.logoUrl}
                      alt="Logo Usaha"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="font-extrabold text-2xl text-indigo-600">
                      {bizForm.businessName.charAt(0) || 'K'}
                    </div>
                  )}
                </div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  Unggah Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {bizForm.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setBizForm({ ...bizForm, logoUrl: '' })}
                    className="text-[10px] text-rose-500 hover:underline mt-2"
                  >
                    Hapus Logo
                  </button>
                )}
              </div>

              <div className="sm:col-span-8 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Usaha / PT / CV / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.businessName}
                    onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Contoh: CV Solusi Digital Mandiri"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slogan / Tagline Usaha
                  </label>
                  <input
                    type="text"
                    value={bizForm.tagline}
                    onChange={(e) => setBizForm({ ...bizForm, tagline: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Contoh: Solusi Teknologi & Desain Terpercaya"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Pemilik / Direktur
                    </label>
                    <input
                      type="text"
                      value={bizForm.ownerName}
                      onChange={(e) => setBizForm({ ...bizForm, ownerName: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Yoga Saputra"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. WhatsApp Resmi Usaha *
                    </label>
                    <input
                      type="text"
                      required
                      value={bizForm.phone}
                      onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                      className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="081234567890"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Bisnis
                </label>
                <input
                  type="email"
                  value={bizForm.email}
                  onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Website Usaha
                </label>
                <input
                  type="text"
                  value={bizForm.website || ''}
                  onChange={(e) => setBizForm({ ...bizForm, website: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://bisnis.id"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPWP / NIB Usaha
                </label>
                <input
                  type="text"
                  value={bizForm.taxId || ''}
                  onChange={(e) => setBizForm({ ...bizForm, taxId: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="01.234.567.8-000.000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Kantor / Usaha
                </label>
                <input
                  type="text"
                  value={bizForm.address}
                  onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kota / Wilayah
                </label>
                <input
                  type="text"
                  value={bizForm.city}
                  onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Rekening Bank Resmi
            </h2>

            <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
              <div className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Bank Utama (Wajib):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nama Bank *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.bankName}
                    onChange={(e) => setBizForm({ ...bizForm, bankName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nomor Rekening *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.bankAccountNumber}
                    onChange={(e) =>
                      setBizForm({ ...bizForm, bankAccountNumber: e.target.value })
                    }
                    className="w-full text-xs font-mono font-bold p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Atas Nama *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.bankAccountHolder}
                    onChange={(e) =>
                      setBizForm({ ...bizForm, bankAccountHolder: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm"
            >
              <Save className="w-4 h-4" />
              Simpan Profil ID Usaha
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Integrasi OpenWA API */}
      {activeTab === 'openwa' && (
        <form onSubmit={handleSaveOpenWa} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  Konfigurasi Server OpenWA
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kirim salinan invoice PDF ke nomor customer yang diisi pada formulir invoice
                </p>
              </div>

              <div className="flex items-center gap-2">
                {testStatus === 'success' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung ({testLatency}ms)
                  </span>
                ) : testStatus === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <AlertCircle className="w-3.5 h-3.5" /> Gagal Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    Belum Dites
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Server OpenWA *
                </label>
                <input
                  type="text"
                  required
                  value={waForm.serverUrl}
                  onChange={(e) => setWaForm({ ...waForm, serverUrl: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                  placeholder="http://localhost:8080 atau https://wa.domain.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Key / Token Rahasia (Opsional)
                </label>
                <input
                  type="password"
                  value={waForm.apiKey}
                  onChange={(e) => setWaForm({ ...waForm, apiKey: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                  placeholder="Masukkan API Key jika ada"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode / Endpoint PDF
                </label>
                <select
                  value={waForm.endpointType}
                  onChange={(e) => setWaForm({ ...waForm, endpointType: e.target.value as any })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="sendPdf">POST /sendPdf (Standar OpenWA)</option>
                  <option value="sendFile">POST /sendFile</option>
                  <option value="sendMessageWithMedia">POST /sendMessageWithMedia</option>
                  <option value="custom">Custom Endpoint Path</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Sesi OpenWA (UUID)
                </label>
                <input
                  type="text"
                  value={waForm.sessionName}
                  onChange={(e) => setWaForm({ ...waForm, sessionName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestOpenWaConnection}
                disabled={testStatus === 'loading'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs disabled:opacity-50"
              >
                {testStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sedang Menguji Koneksi...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    Tes Koneksi OpenWA Sekarang
                  </>
                )}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Template Caption WhatsApp Otomatis
              </label>
              <textarea
                rows={5}
                value={waForm.autoSendCaption}
                onChange={(e) => setWaForm({ ...waForm, autoSendCaption: e.target.value })}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed bg-slate-50/50"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
            >
              <Save className="w-4 h-4" />
              Simpan Pengaturan OpenWA
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: API Toko & Webhook (Store Order Ingestion) */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveStoreApi} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                  Integrasi Webhook Pesanan Toko Online (Store API)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hubungkan toko online Anda (WooCommerce, Shopify, POS, atau Toko Custom) agar pesanan otomatis menjadi Invoice
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                <Webhook className="w-3.5 h-3.5" /> Webhook Endpoint Siap
              </span>
            </div>

            {/* Webhook Endpoint URL */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                URL Endpoint Webhook Toko Anda:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookEndpointUrl}
                  className="flex-1 text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookEndpointUrl);
                    setCopiedWebhookUrl(true);
