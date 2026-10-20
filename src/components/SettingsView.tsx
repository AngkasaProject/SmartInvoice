import React, { useState, useEffect } from 'react';
import {
  BusinessProfile,
  DatabaseConfig,
  DatabaseDriver,
  Invoice,
  WhatsAppConfig,
  WhatsAppProvider,
  StoreApiConfig,
} from '../types/invoice';
import {
  testWhatsAppGateway,
  formatCaptionTemplate,
} from '../services/whatsapp';
import {
  defaultDatabaseConfig,
  fetchDatabaseConfig,
  generateSupabaseSqlSchema,
  migrateDatabase,
  saveDatabaseConfig,
  testDatabaseConnection,
  fetchStoreApiConfig,
  saveStoreApiConfig,
} from '../services/dbAdapter';
import { defaultStoreApiConfig } from '../services/storage';
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
  ShieldAlert,
  Eye,
  EyeOff,
  Image as ImageIcon,
  QrCode,
  Sliders,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsViewProps {
  business: BusinessProfile;
  config: WhatsAppConfig;
  invoices: Invoice[];
  onSaveBusiness: (updated: BusinessProfile) => void;
  onSaveConfig: (updated: WhatsAppConfig) => void;
  onImportData: (data: { invoices: Invoice[]; business: BusinessProfile; config: WhatsAppConfig }) => void;
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
  const [activeTab, setActiveTab] = useState<'business' | 'store' | 'whatsapp' | 'database' | 'data'>('business');

  // Business Profile local state
  const [bizForm, setBizForm] = useState<BusinessProfile>(business);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);

  // WhatsApp Gateway config state (OpenWA / Fonnte)
  const [waForm, setWaForm] = useState<WhatsAppConfig>({
    provider: config.provider || 'openwa',
    serverUrl: config.serverUrl || 'http://localhost:8080',
    apiKey: config.apiKey || '',
    sessionName: config.sessionName || 'default',
    fonnteToken: config.fonnteToken || '',
    endpointType: config.endpointType || 'sendPdf',
    customEndpointPath: config.customEndpointPath || '/sendPdf',
    autoSendCaption: config.autoSendCaption || '',
    directWhatsappFallback: config.directWhatsappFallback ?? true,
  });

  // Store Webhook API config local state
  const [storeForm, setStoreForm] = useState<StoreApiConfig>(defaultStoreApiConfig);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Database settings state (Sensitive)
  const [dbSettings, setDbSettings] = useState<DatabaseConfig>(defaultDatabaseConfig);
  const [showMariaPassword, setShowMariaPassword] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  // Test states
  const [waTestStatus, setWaTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waTestMsg, setWaTestMsg] = useState('');
  const [waTestLatency, setWaTestLatency] = useState<number | null>(null);

  const [sqliteTestStatus, setSqliteTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sqliteTestMsg, setSqliteTestMsg] = useState('');
  const [mariaTestStatus, setMariaTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mariaTestMsg, setMariaTestMsg] = useState('');
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [supabaseTestMsg, setSupabaseTestMsg] = useState('');

  const [migrateFrom, setMigrateFrom] = useState<DatabaseDriver>('sqlite');
  const [migrateTo, setMigrateTo] = useState<DatabaseDriver>('mariadb');
  const [isMigrating, setIsMigrating] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setBizForm(business);
  }, [business]);

  useEffect(() => {
    setWaForm({
      ...config,
      provider: config.provider || 'openwa',
      fonnteToken: config.fonnteToken || '',
    });
  }, [config]);

  useEffect(() => {
    fetchDatabaseConfig().then((cfg) => setDbSettings(cfg));
    fetchStoreApiConfig().then((sc) => setStoreForm(sc));
  }, []);

  // 1. Save Business Profile
  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBusiness(bizForm);
    toast.success('Profil ID Usaha & Invoice berhasil disimpan ke database!');
  };

  // Image Uploader Helper (Saves to server disk data/uploads to keep DB lightweight)
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'qris'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'logo') setIsUploadingLogo(true);
    else setIsUploadingQris(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, filename: file.name }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.url) {
          if (type === 'logo') {
            setBizForm((prev) => ({ ...prev, logoUrl: data.url }));
            toast.success('Logo berhasil disimpan di penyimpanan server lokal!');
          } else {
            setBizForm((prev) => ({ ...prev, qrisImageUrl: data.url }));
            toast.success('Gambar QRIS berhasil disimpan di penyimpanan server lokal!');
          }
        } else {
          // Fallback to base64
          if (type === 'logo') setBizForm((prev) => ({ ...prev, logoUrl: base64Data }));
          else setBizForm((prev) => ({ ...prev, qrisImageUrl: base64Data }));
          toast.info('Gambar disimpan dalam format data lokal.');
        }
      } catch {
        if (type === 'logo') setBizForm((prev) => ({ ...prev, logoUrl: base64Data }));
        else setBizForm((prev) => ({ ...prev, qrisImageUrl: base64Data }));
        toast.info('Gambar disimpan dalam format data lokal.');
      } finally {
        if (type === 'logo') setIsUploadingLogo(false);
        else setIsUploadingQris(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 2. Save WhatsApp Gateway
  const handleSaveWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(waForm);
    toast.success(`Pengaturan Gateway WhatsApp (${waForm.provider === 'fonnte' ? 'Fonnte' : 'OpenWA'}) berhasil disimpan!`);
  };

  const handleTestWhatsApp = async () => {
    setWaTestStatus('loading');
    setWaTestMsg('');
    setWaTestLatency(null);

    const res = await testWhatsAppGateway(waForm);
    if (res.success) {
      setWaTestStatus('success');
      setWaTestMsg(res.message);
      if (res.latencyMs !== undefined) setWaTestLatency(res.latencyMs);
      toast.success(res.message);
    } else {
      setWaTestStatus('error');
      setWaTestMsg(res.message);
      toast.error(res.message);
    }
  };

  // 3. Save Store Webhook
  const handleSaveStoreApi = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveStoreApiConfig(storeForm);
    toast.success('Pengaturan API Webhook Toko berhasil disimpan ke database!');
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
          description: 'Data invoice telah dicatat ke database aktif.',
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

  // 4. Save Database Settings
  const handleSaveDbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveDatabaseConfig(dbSettings);
    if (res.success) {
      toast.success(
        `Pengaturan database server disimpan! Mode aktif: ${
          dbSettings.activeDriver === 'sqlite'
            ? 'SQLite Lokal File'
            : dbSettings.activeDriver === 'mariadb'
            ? 'MariaDB / MySQL Server'
            : 'Supabase Cloud'
        }`
      );
      if (onRefreshData) onRefreshData();
    } else {
      toast.error(res.message);
    }
  };

  const handleTestSqlite = async () => {
    setSqliteTestStatus('loading');
    setSqliteTestMsg('');
    const res = await testDatabaseConnection('sqlite');
    if (res.success) {
      setSqliteTestStatus('success');
      setSqliteTestMsg(res.message);
      toast.success(res.message);
    } else {
      setSqliteTestStatus('error');
      setSqliteTestMsg(res.message);
      toast.error(res.message);
    }
  };

  const handleTestMariaDb = async () => {
    setMariaTestStatus('loading');
    setMariaTestMsg('');
    const res = await testDatabaseConnection('mariadb', dbSettings.mariadb);
    if (res.success) {
      setMariaTestStatus('success');
      setMariaTestMsg(res.message);
      toast.success(res.message);
    } else {
      setMariaTestStatus('error');
      setMariaTestMsg(res.message);
      toast.error(res.message);
    }
  };

  const handleTestSupabase = async () => {
    setSupabaseTestStatus('loading');
    setSupabaseTestMsg('');
    const res = await testDatabaseConnection('supabase', dbSettings.supabase);
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

  const handleMigrateBetweenDrivers = async () => {
    if (migrateFrom === migrateTo) {
      toast.error('Driver asal dan driver tujuan tidak boleh sama.');
      return;
    }
    setIsMigrating(true);
    toast.info(`Memulai migrasi data dari ${migrateFrom.toUpperCase()} ke ${migrateTo.toUpperCase()}...`);
    const res = await migrateDatabase(migrateFrom, migrateTo);
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

  const handleExportBackup = () => {
    const backupData = {
      version: '2.0',
      appName: 'SmartInvoice',
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
    a.download = `SmartInvoice_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File cadangan JSON SmartInvoice berhasil diunduh!');
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

  const webhookEndpointUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/orders/webhook`
      : '/api/orders/webhook';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Pengaturan SmartInvoice
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi identitas usaha, integrasi toko online, WhatsApp Gateway (OpenWA / Fonnte), dan database server.
          </p>
        </div>
      </div>

      {/* Modern Two-Group Tabs Header */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex border-b border-slate-100 pb-1.5 mb-1.5 overflow-x-auto scrollbar-none gap-1 sm:gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center">
            Konfigurasi Toko:
          </span>
          <button
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === 'business'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Profil Usaha & Rekening
          </button>

          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === 'store'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Integrasi Toko (Webhook)
          </button>
        </div>

        <div className="flex overflow-x-auto scrollbar-none gap-1 sm:gap-2 pt-0.5">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
            <Key className="w-3 h-3" /> Sistem & Gateway:
          </span>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Server className="w-4 h-4" />
            WhatsApp Gateway
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === 'database'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            Database Server
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${
              activeTab === 'data'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Download className="w-4 h-4" />
            Cadangan & Data
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PROFIL USAHA & REKENING (CONFIG TOKO)             */}
      {/* ======================================================== */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Identitas Bisnis & Pembayaran
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data ini dicetak otomatis pada kepala dokumen faktur invoice dan kwitansi resmi.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Save className="w-4 h-4" />
              Simpan Profil Usaha
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Usaha / Toko *</label>
              <input
                type="text"
                required
                value={bizForm.businessName}
                onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: SmartInvoice Digital Studio"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tagline / Bidang Jasa</label>
              <input
                type="text"
                value={bizForm.tagline}
                onChange={(e) => setBizForm({ ...bizForm, tagline: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: Solusi Perangkat Lunak & Desain Kreatif"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Penanggung Jawab</label>
              <input
                type="text"
                value={bizForm.ownerName}
                onChange={(e) => setBizForm({ ...bizForm, ownerName: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: Yoga Saputra"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor WhatsApp Usaha</label>
              <input
                type="text"
                value={bizForm.phone}
                onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: 081288991234"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Resmi</label>
              <input
                type="email"
                value={bizForm.email}
                onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: halo@smartinvoice.id"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">NPWP / NIB (Opsional)</label>
              <input
                type="text"
                value={bizForm.taxId || ''}
                onChange={(e) => setBizForm({ ...bizForm, taxId: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Contoh: 01.234.567.8-901.000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Alamat Kantor / Toko</label>
              <textarea
                rows={2}
                value={bizForm.address}
                onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jl. Jend. Sudirman No. 45, Gedung Graha Pratama Lt. 4"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Kota / Kabupaten</label>
              <input
                type="text"
                value={bizForm.city}
                onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jakarta Selatan"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Website (Opsional)</label>
              <input
                type="text"
                value={bizForm.website || ''}
                onChange={(e) => setBizForm({ ...bizForm, website: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://smartinvoice.id"
              />
            </div>
          </div>

          {/* Image Uploaders: Logo & QRIS */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              Gambar Logo & QRIS (Tersimpan Ringan di Server Lokal)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo Uploader */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Logo Usaha</span>
                <p className="text-[11px] text-slate-500">
                  Ditampilkan di faktur invoice dan sudut kiri atas aplikasi.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  {bizForm.logoUrl ? (
                    <img
                      src={bizForm.logoUrl}
                      alt="Logo Usaha"
                      className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}

                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition">
                    {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-500" />}
                    {isUploadingLogo ? 'Mengunggah...' : 'Unggah Logo Baru'}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" />
                  </label>
                  {bizForm.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setBizForm({ ...bizForm, logoUrl: '' })}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              {/* QRIS Uploader */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-slate-600" /> Gambar Barcode QRIS Usaha
                </span>
                <p className="text-[11px] text-slate-500">
                  Dicetak di bagian instruksi pembayaran invoice agar pelanggan bisa scan QRIS langsung.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  {bizForm.qrisImageUrl ? (
                    <img
                      src={bizForm.qrisImageUrl}
                      alt="QRIS Barcode"
                      className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white">
                      <QrCode className="w-5 h-5" />
                    </div>
                  )}

                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition">
                    {isUploadingQris ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-slate-500" />}
                    {isUploadingQris ? 'Mengunggah...' : 'Unggah Gambar QRIS'}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'qris')} className="hidden" />
                  </label>
                  {bizForm.qrisImageUrl && (
                    <button
                      type="button"
                      onClick={() => setBizForm({ ...bizForm, qrisImageUrl: '' })}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">Rekening Bank Pembayaran</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Bank Utama</label>
                <input
                  type="text"
                  value={bizForm.bankName}
                  onChange={(e) => setBizForm({ ...bizForm, bankName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Contoh: BCA / Mandiri / BRI"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={bizForm.bankAccountNumber}
                  onChange={(e) => setBizForm({ ...bizForm, bankAccountNumber: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Contoh: 8291038472"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Atas Nama Rekening</label>
                <input
                  type="text"
                  value={bizForm.bankAccountHolder}
                  onChange={(e) => setBizForm({ ...bizForm, bankAccountHolder: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Contoh: Yoga Saputra"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INTEGRASI TOKO ONLINE & WEBHOOK (CONFIG TOKO)     */}
      {/* ======================================================== */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveStoreApi} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-600" />
                Konfigurasi Webhook Toko Online (WooCommerce / Shopify / Custom)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatis konversi setiap pesanan masuk dari toko online Anda menjadi invoice resmi di database.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Save className="w-4 h-4" />
              Simpan Webhook Toko
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Webhook Endpoint URL (Target POST Toko):
              </label>
              <div className="flex items-center gap-2">
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
                    setCopiedWebhookUrl(true);
                    setTimeout(() => setCopiedWebhookUrl(false), 2000);
                  }}
                  className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                  title="Salin URL Webhook"
                >
                  {copiedWebhookUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Webhook Secret Key (Bearer Token):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={storeForm.webhookSecret}
                  onChange={(e) => setStoreForm({ ...storeForm, webhookSecret: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  onClick={handleGenerateNewSecret}
                  className="px-3 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap"
                >
                  Acak Baru
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Prefix Nomor Invoice Toko</label>
              <input
                type="text"
                value={storeForm.invoicePrefix || 'INV-STORE'}
                onChange={(e) => setStoreForm({ ...storeForm, invoicePrefix: e.target.value })}
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
                placeholder="INV-STORE"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status Awal Pesanan Toko</label>
              <select
                value={storeForm.defaultOrderStatus || 'unpaid'}
                onChange={(e) => setStoreForm({ ...storeForm, defaultOrderStatus: e.target.value as any })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
              >
                <option value="unpaid">Belum Lunas (Unpaid / Menunggu Transfer)</option>
                <option value="paid">Langsung Lunas (Paid via Payment Gateway)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSimulateStoreOrder}
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition shadow-xs disabled:opacity-50"
            >
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Kirim Pesanan Uji Coba (Simulasi Order Toko)
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 3: GATEWAY WHATSAPP (OPENWA & FONNTE)                */}
      {/* ======================================================== */}
      {activeTab === 'whatsapp' && (
        <form onSubmit={handleSaveWhatsApp} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" />
                Gateway WhatsApp Otomatis (Pilihan OpenWA / Fonnte)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kirim invoice PDF resmi langsung ke chat WhatsApp pelanggan dengan pilihan provider OpenWA atau Fonnte.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
            >
              <Save className="w-4 h-4" />
              Simpan Gateway
            </button>
          </div>

          {/* Provider Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Pilih Provider WhatsApp Aktif:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: OpenWA */}
              <div
                onClick={() => setWaForm({ ...waForm, provider: 'openwa' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  waForm.provider === 'openwa'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    waForm.provider === 'openwa' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Server className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>OpenWA (rmyndharis/OpenWA)</span>
                    {waForm.provider === 'openwa' && (
                      <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Self-hosted OpenWA REST API server (dukungan UUID session, API key, multi-device).
                  </p>
                </div>
              </div>

              {/* Option 2: Fonnte */}
              <div
                onClick={() => setWaForm({ ...waForm, provider: 'fonnte' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  waForm.provider === 'fonnte'
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    waForm.provider === 'fonnte' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>Fonnte (fonnte.com)</span>
                    {waForm.provider === 'fonnte' && (
                      <span className="text-[10px] text-blue-700 font-extrabold bg-blue-100 px-1.5 py-0.2 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Layanan cloud WhatsApp Gateway populer di Indonesia. Cukup masukkan API token device Anda.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Form: OpenWA */}
          {waForm.provider === 'openwa' && (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-4">
              <div className="text-xs font-bold text-emerald-950 flex items-center justify-between">
                <span>Konfigurasi Server OpenWA (rmyndharis/OpenWA):</span>
                <a
                  href="https://github.com/rmyndharis/OpenWA"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-700 hover:underline"
                >
                  Dokumentasi GitHub
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">URL Server OpenWA</label>
                  <input
                    type="text"
                    value={waForm.serverUrl}
                    onChange={(e) => setWaForm({ ...waForm, serverUrl: e.target.value })}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: http://localhost:8080 atau https://wa.domainanda.id"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Session ID (UUID)</label>
                  <input
                    type="text"
                    value={waForm.sessionName}
                    onChange={(e) => setWaForm({ ...waForm, sessionName: e.target.value })}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="UUID Sesi OpenWA"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">API Key OpenWA</label>
                  <input
                    type="password"
                    value={waForm.apiKey}
                    onChange={(e) => setWaForm({ ...waForm, apiKey: e.target.value })}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="API Key atau secret token OpenWA"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Configuration Form: Fonnte */}
          {waForm.provider === 'fonnte' && (
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-4">
              <div className="text-xs font-bold text-blue-950 flex items-center justify-between">
                <span>Konfigurasi Token Fonnte (fonnte.com):</span>
                <a
                  href="https://fonnte.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-700 hover:underline"
                >
                  Dashboard Fonnte
                </a>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Device API Token Fonnte *
                </label>
                <input
                  type="password"
                  value={waForm.fonnteToken || ''}
                  onChange={(e) => setWaForm({ ...waForm, fonnteToken: e.target.value })}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Contoh: aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Dapatkan token perangkat dari menu Device di dashboard Fonnte Anda.
                </p>
              </div>
            </div>
          )}

          {/* Caption Template (Shared) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Template Caption Teks Pesan Pengantar PDF:
            </label>
            <textarea
              rows={5}
              value={waForm.autoSendCaption}
              onChange={(e) => setWaForm({ ...waForm, autoSendCaption: e.target.value })}
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tag otomatis: <code className="text-slate-600">{"{client_name}"}</code>, <code className="text-slate-600">{"{invoice_no}"}</code>, <code className="text-slate-600">{"{total}"}</code>, <code className="text-slate-600">{"{due_date}"}</code>, <code className="text-slate-600">{"{company_name}"}</code>, <code className="text-slate-600">{"{bank_info}"}</code>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={waTestStatus === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
            >
              {waTestStatus === 'loading' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menguji {waForm.provider === 'fonnte' ? 'Fonnte' : 'OpenWA'}...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  Tes Koneksi {waForm.provider === 'fonnte' ? 'Fonnte' : 'OpenWA'} Sekarang
                </>
              )}
            </button>
          </div>

          {waTestMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                waTestStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {waTestMsg}
            </div>
          )}
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 4: DATABASE SERVER (KONFIGURASI SENSITIF & SISTEM)    */}
      {/* ======================================================== */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveDbSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Database Server (Konfigurasi Sensitif & Sistem)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilihan real working database server: SQLite lokal file, MariaDB/MySQL server, atau Supabase Cloud.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-slate-500">Mode Saat Ini:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    dbSettings.activeDriver === 'sqlite'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : dbSettings.activeDriver === 'mariadb'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {dbSettings.activeDriver === 'sqlite'
                    ? 'SQLite (Lokal File)'
                    : dbSettings.activeDriver === 'mariadb'
                    ? 'MariaDB / MySQL Server'
                    : 'Supabase Cloud'}
                </span>
              </div>
            </div>

            {/* 3 Driver Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Option 1: SQLite */}
              <div
                onClick={() => setDbSettings({ ...dbSettings, activeDriver: 'sqlite' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  dbSettings.activeDriver === 'sqlite'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    dbSettings.activeDriver === 'sqlite' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>SQLite Lokal</span>
                    {dbSettings.activeDriver === 'sqlite' && (
                      <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.2 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    File database SQLite di server (<span className="font-mono text-[10px]">data/smartinvoice.db</span>). Zero-config, cepat &amp; offline.
                  </p>
                </div>
              </div>

              {/* Option 2: MariaDB / MySQL */}
              <div
                onClick={() => setDbSettings({ ...dbSettings, activeDriver: 'mariadb' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  dbSettings.activeDriver === 'mariadb'
                    ? 'border-amber-600 bg-amber-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    dbSettings.activeDriver === 'mariadb' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Server className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>MariaDB / MySQL</span>
                    {dbSettings.activeDriver === 'mariadb' && (
                      <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100 px-1.5 py-0.2 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Koneksi ke server database MariaDB / MySQL (XAMPP, Laragon, Docker, atau VPS).
                  </p>
                </div>
              </div>

              {/* Option 3: Supabase Cloud */}
              <div
                onClick={() => setDbSettings({ ...dbSettings, activeDriver: 'supabase' })}
                className={`cursor-pointer p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  dbSettings.activeDriver === 'supabase'
                    ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    dbSettings.activeDriver === 'supabase' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>Supabase Cloud</span>
                    {dbSettings.activeDriver === 'supabase' && (
                      <span className="text-[10px] text-blue-700 font-extrabold bg-blue-100 px-1.5 py-0.2 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cloud PostgreSQL Supabase. Sinkronisasi data real-time multi-perangkat via internet.
                  </p>
                </div>
              </div>
            </div>

            {/* Panel: SQLite */}
            {dbSettings.activeDriver === 'sqlite' && (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    Konfigurasi SQLite (Database File Lokal)
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium">Bawaan Bun (Native bun:sqlite)</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Lokasi File Database di Server:
                  </label>
                  <input
                    type="text"
                    value={dbSettings.sqlite?.filePath || './data/smartinvoice.db'}
                    onChange={(e) =>
                      setDbSettings({
                        ...dbSettings,
                        sqlite: { ...dbSettings.sqlite, filePath: e.target.value },
                      })
                    }
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="./data/smartinvoice.db"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Database SQLite ini otomatis dibuat jika belum ada, tidak memerlukan instalasi server terpisah, dan tersimpan aman di server lokal.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSqlite}
                    disabled={sqliteTestStatus === 'loading'}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
                  >
                    {sqliteTestStatus === 'loading' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menguji SQLite...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        Tes Database SQLite
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Mode SQLite
                  </button>
                </div>

                {sqliteTestMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium ${
                      sqliteTestStatus === 'success'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {sqliteTestMsg}
                  </div>
                )}
              </div>
            )}

            {/* Panel: MariaDB */}
            {dbSettings.activeDriver === 'mariadb' && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-amber-600" />
                    Kredensial Server MariaDB / MySQL
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium">Driver mysql2 (Portabel)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Host Server</label>
                    <input
                      type="text"
                      value={dbSettings.mariadb?.host || 'localhost'}
                      onChange={(e) =>
                        setDbSettings({
                          ...dbSettings,
                          mariadb: { ...dbSettings.mariadb, host: e.target.value },
                        })
                      }
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={dbSettings.mariadb?.port || 3306}
                      onChange={(e) =>
                        setDbSettings({
                          ...dbSettings,
                          mariadb: { ...dbSettings.mariadb, port: parseInt(e.target.value, 10) || 3306 },
                        })
                      }
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="3306"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Database</label>
                    <input
                      type="text"
                      value={dbSettings.mariadb?.database || 'smartinvoice'}
                      onChange={(e) =>
                        setDbSettings({
                          ...dbSettings,
                          mariadb: { ...dbSettings.mariadb, database: e.target.value },
                        })
                      }
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="smartinvoice"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={dbSettings.mariadb?.user || 'root'}
                      onChange={(e) =>
                        setDbSettings({
                          ...dbSettings,
                          mariadb: { ...dbSettings.mariadb, user: e.target.value },
                        })
                      }
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="root"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showMariaPassword ? 'text' : 'password'}
                        value={dbSettings.mariadb?.password || ''}
                        onChange={(e) =>
                          setDbSettings({
                            ...dbSettings,
                            mariadb: { ...dbSettings.mariadb, password: e.target.value },
                          })
                        }
                        className="w-full text-xs font-mono p-2.5 pr-9 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Kosongkan jika tanpa password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMariaPassword(!showMariaPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showMariaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestMariaDb}
                    disabled={mariaTestStatus === 'loading'}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
                  >
                    {mariaTestStatus === 'loading' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menguji MariaDB...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                        Tes Koneksi MariaDB/MySQL
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Mode MariaDB
                  </button>
                </div>

                {mariaTestMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium ${
                      mariaTestStatus === 'success'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {mariaTestMsg}
                  </div>
                )}
              </div>
            )}

            {/* Panel: Supabase */}
            {dbSettings.activeDriver === 'supabase' && (
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Kredensial Supabase Project:</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Dapatkan dari menu Settings &gt; API di dashboard Supabase
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Project URL (VITE_SUPABASE_URL)
                    </label>
                    <input
                      type="text"
                      value={dbSettings.supabase?.url || ''}
                      onChange={(e) =>
                        setDbSettings({
                          ...dbSettings,
                          supabase: { ...dbSettings.supabase, url: e.target.value },
                        })
                      }
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="https://xyzcompany.supabase.co"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Anon Public Key (VITE_SUPABASE_ANON_KEY)
                    </label>
                    <div className="relative">
                      <input
                        type={showSupabaseKey ? 'text' : 'password'}
                        value={dbSettings.supabase?.anonKey || ''}
                        onChange={(e) =>
                          setDbSettings({
                            ...dbSettings,
                            supabase: { ...dbSettings.supabase, anonKey: e.target.value },
                          })
                        }
                        className="w-full text-xs font-mono p-2.5 pr-9 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={supabaseTestStatus === 'loading'}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
                  >
                    {supabaseTestStatus === 'loading' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menguji Supabase...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                        Tes Koneksi Supabase
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Mode Supabase
                  </button>
                </div>

                {supabaseTestMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium ${
                      supabaseTestStatus === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {supabaseTestMsg}
                  </div>
                )}
              </div>
            )}

            {/* Migration Tool Box */}
            <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-blue-50/40 rounded-xl border border-indigo-100 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  Alat Migrasi Antar-Database Sekali Klik
                </h3>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">
                  Salin seluruh data invoice dan profil usaha Anda dari satu database ke database lain dengan 1 klik.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dari (Sumber):</label>
                  <select
                    value={migrateFrom}
                    onChange={(e) => setMigrateFrom(e.target.value as DatabaseDriver)}
                    className="w-full text-xs font-semibold p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="sqlite">SQLite Lokal File</option>
                    <option value="mariadb">MariaDB / MySQL Server</option>
                    <option value="supabase">Supabase Cloud (PostgreSQL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ke (Tujuan):</label>
                  <select
                    value={migrateTo}
                    onChange={(e) => setMigrateTo(e.target.value as DatabaseDriver)}
                    className="w-full text-xs font-semibold p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="sqlite">SQLite Lokal File</option>
                    <option value="mariadb">MariaDB / MySQL Server</option>
                    <option value="supabase">Supabase Cloud (PostgreSQL)</option>
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleMigrateBetweenDrivers}
                    disabled={isMigrating || migrateFrom === migrateTo}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
                  >
                    {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    Jalankan Migrasi Database
                  </button>
                </div>
              </div>
            </div>

            {/* SQL Schema Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-slate-600" />
                    Skrip SQL Skema Tabel Supabase (DDL)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Jalankan di Supabase Dashboard &gt; SQL Editor jika tabel belum dibuat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Salin Skrip SQL
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[10px] font-mono bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto max-h-40 leading-relaxed">
                {generateSupabaseSqlSchema()}
              </pre>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: CADANGAN & DATA (BACKUP & RESTORE)                */}
      {/* ======================================================== */}
      {activeTab === 'data' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Pencadangan & Pemulihan Berkas JSON
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simpan dan pulihkan seluruh riwayat invoice dan pengaturan dalam berkas JSON mandiri.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-600" /> Unduh Cadangan (Export JSON)
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Unduh seluruh daftar {invoices.length} tagihan, profil usaha, dan pengaturan gateway dalam 1 berkas JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
              >
                <Download className="w-4 h-4" /> Unduh Berkas JSON Sekarang
              </button>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-600" /> Pulihkan Data (Import JSON)
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Impor data invoice dan profil usaha dari berkas cadangan JSON yang telah Anda unduh sebelumnya.
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition shadow-xs">
                <Upload className="w-4 h-4 text-slate-600" /> Pilih File JSON Cadangan
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          {/* Danger Zone: Reset Data */}
          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Zona Berbahaya: Reset ke Data Sampel Default
                </div>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Tindakan ini akan mengembalikan data invoice dan profil usaha ke sampel awal aplikasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Yakin ingin mereset seluruh data kembali ke sampel awal? Data Anda saat ini akan ditimpa!')) {
                    onResetData();
                    toast.info('Data berhasil di-reset ke sampel default.');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition shadow-xs whitespace-nowrap shrink-0"
              >
                Reset Data Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
