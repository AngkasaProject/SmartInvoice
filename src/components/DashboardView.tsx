import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceStatus, BusinessProfile, OpenWaConfig } from '../types/invoice';
import { formatIndoDate, formatRupiah, getDueDateInfo, formatDisplayPhone } from '../utils/formatters';
import { exportInvoicesToCsv } from '../utils/csvExport';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Download,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Copy,
  Check,
  Eye,
  MessageSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DashboardViewProps {
  invoices: Invoice[];
  business: BusinessProfile;
  config: OpenWaConfig;
  onOpenCreate: () => void;
  onOpenDetail: (invoice: Invoice) => void;
  onOpenEdit: (invoice: Invoice) => void;
  onOpenWhatsApp: (invoice: Invoice) => void;
  onTogglePaid: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onDuplicateInvoice: (invoice: Invoice) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  business,
  config,
  onOpenCreate,
  onOpenDetail,
  onOpenEdit,
  onOpenWhatsApp,
  onTogglePaid,
  onDeleteInvoice,
  onDuplicateInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');

  // Stats calculation
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalOverdue = 0;

    let countPaid = 0;
    let countUnpaid = 0;
    let countOverdue = 0;
    let countDraft = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;

      totalRevenue += inv.total;

      if (inv.status === 'paid') {
        totalPaid += inv.total;
        countPaid++;
      } else if (inv.status === 'overdue') {
        totalOverdue += inv.total;
        countOverdue++;
      } else if (inv.status === 'unpaid') {
        totalUnpaid += inv.total;
        countUnpaid++;
      } else if (inv.status === 'draft') {
        countDraft++;
      }
    });

    const paidPercentage = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

    return {
      totalRevenue,
      totalPaid,
      totalUnpaid,
      totalOverdue,
      countAll: invoices.length,
      countPaid,
      countUnpaid,
      countOverdue,
      countDraft,
      paidPercentage,
    };
  }, [invoices]);

  // Urgent overdue or soon-due items
  const urgentInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      const dueInfo = getDueDateInfo(inv.dueDate, inv.status);
      return dueInfo.isOverdue || dueInfo.daysDiff <= 3;
    });
  }, [invoices]);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === 'all' ? true : inv.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.client.name.toLowerCase().includes(q) ||
        (inv.client.company && inv.client.company.toLowerCase().includes(q)) ||
        (inv.client.phone && inv.client.phone.includes(q));

      return matchStatus && matchSearch;
    });
  }, [invoices, statusFilter, searchQuery]);

  const handleQuickTogglePaid = (e: React.MouseEvent, inv: Invoice) => {
    e.stopPropagation();
    if (inv.status !== 'paid') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }
    }
    onTogglePaid(inv);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl shadow-md">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Dashboard Monitoring Real-Time
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {business.businessName || 'KirimInvoice'}
          </h1>
          <p className="text-xs text-indigo-200 mt-1 max-w-lg">
            Pantau arus kas, verifikasi pelunasan, dan kirim tagihan resmi langsung ke WhatsApp pelanggan secara otomatis.
          </p>
        </div>

        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold text-indigo-950 bg-white hover:bg-indigo-50 active:scale-95 transition shadow-lg shrink-0"
        >
          <Plus className="w-4 h-4 text-indigo-600" />
          Buat Invoice Baru
        </button>
      </div>

      {/* Real-time Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Omset Tagihan
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
              {formatRupiah(stats.totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Dari {stats.countAll} invoice terdaftar
            </div>
          </div>
        </div>

        {/* Sudah Lunas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Sudah Lunas (Paid)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 font-mono">
              {formatRupiah(stats.totalPaid)}
            </div>
            <div className="text-[11px] text-emerald-600/80 font-medium mt-1">
              {stats.countPaid} invoice ({stats.paidPercentage}% terbayar)
            </div>
          </div>
        </div>

        {/* Belum Bayar / Piutang */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Belum Bayar (Piutang)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-700 font-mono">
              {formatRupiah(stats.totalUnpaid)}
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">
              {stats.countUnpaid} invoice menunggu pelunasan
            </div>
          </div>
        </div>

        {/* Jatuh Tempo */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              Jatuh Tempo (Overdue)
            </span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-700 font-mono">
              {formatRupiah(stats.totalOverdue)}
            </div>
            <div className="text-[11px] text-rose-600 font-bold mt-1">
              {stats.countOverdue} invoice melewati batas waktu!
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Progress Bar Breakdown */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
          <span>Komposisi Status Pembayaran:</span>
          <span>{stats.paidPercentage}% Dana Masuk Terverifikasi</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            style={{ width: `${stats.paidPercentage}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Lunas: ${formatRupiah(stats.totalPaid)}`}
          />
          <div
            style={{
              width: `${
                stats.totalRevenue > 0
                  ? Math.round((stats.totalUnpaid / stats.totalRevenue) * 100)
                  : 0
              }%`,
            }}
            className="bg-amber-400 transition-all duration-500"
            title={`Belum Bayar: ${formatRupiah(stats.totalUnpaid)}`}
          />
          <div
            style={{
              width: `${
                stats.totalRevenue > 0
                  ? Math.round((stats.totalOverdue / stats.totalRevenue) * 100)
                  : 0
              }%`,
            }}
            className="bg-rose-500 transition-all duration-500"
            title={`Jatuh Tempo: ${formatRupiah(stats.totalOverdue)}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Lunas ({stats.countPaid})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Belum Dibayar ({stats.countUnpaid})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Jatuh Tempo ({stats.countOverdue})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Draft ({stats.countDraft})
          </span>
        </div>
      </div>

      {/* Urgent Overdue Alert Banner if any */}
      {urgentInvoices.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                Perhatian: Terdapat {urgentInvoices.length} tagihan yang jatuh tempo atau mendekati batas waktu pembayaran!
              </span>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Segera kirimkan pengingat ramah via WhatsApp OpenWA agar pembayaran segera diterima.
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenWhatsApp(urgentInvoices[0])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Kirim Pengingat WA ({urgentInvoices[0].invoiceNumber})
          </button>
        </div>
      )}

      {/* Invoices List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Semua', count: stats.countAll },
              { id: 'unpaid', label: 'Belum Bayar', count: stats.countUnpaid },
              { id: 'overdue', label: 'Jatuh Tempo', count: stats.countOverdue },
              { id: 'paid', label: 'Lunas', count: stats.countPaid },
              { id: 'draft', label: 'Draft', count: stats.countDraft },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id
                      ? 'bg-indigo-800 text-white'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari invoice / klien / no WA..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                exportInvoicesToCsv(filteredInvoices, 'Laporan_Invoice');
                toast.success(`Laporan ${filteredInvoices.length} invoice berhasil diekspor ke format CSV Excel!`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs shrink-0"
              title="Unduh laporan dalam format CSV (bisa dibuka di Microsoft Excel atau Google Sheets)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Tidak ada invoice ditemukan</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ada invoice yang sesuai dengan pencarian "${searchQuery}".`
                : 'Belum ada data invoice pada kategori ini.'}
            </p>
            <button
              onClick={onOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Buat Invoice Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-100 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Klien & Kontak</th>
                  <th className="py-3 px-4">Jatuh Tempo</th>
                  <th className="py-3 px-4 text-right">Total Tagihan</th>
                  <th className="py-3 px-4 text-center">Status Bayar</th>
                  <th className="py-3 px-4 text-center">OpenWA Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const dueInfo = getDueDateInfo(inv.dueDate, inv.status);

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onOpenDetail(inv)}
                      className="hover:bg-indigo-50/30 cursor-pointer transition"
                    >
                      {/* Invoice No */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-indigo-900 flex items-center gap-1.5">
                          <span>{inv.invoiceNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatIndoDate(inv.issueDate)}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{inv.client.name}</div>
                        {inv.client.company && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            {inv.client.company}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-emerald-700">
                          {formatDisplayPhone(inv.client.phone)}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">
                          {formatIndoDate(inv.dueDate)}
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${
                            dueInfo.isOverdue
                              ? 'text-rose-600'
                              : inv.status === 'paid'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {dueInfo.label}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                        {formatRupiah(inv.total)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'overdue'
                              ? 'bg-rose-100 text-rose-800'
                              : inv.status === 'unpaid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {inv.status === 'paid' ? (
                            <Check className="w-3 h-3" />
                          ) : inv.status === 'overdue' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {inv.status === 'paid'
                            ? 'Lunas'
                            : inv.status === 'overdue'
                            ? 'Jatuh Tempo'
                            : inv.status === 'unpaid'
                            ? 'Belum Bayar'
                            : 'Draft'}
                        </span>
                      </td>

                      {/* WhatsApp Status */}
                      <td className="py-3.5 px-4 text-center">
                        {inv.whatsappStatus === 'sent' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium"
                            title={`Terkirim pada: ${inv.whatsappSentAt || ''}`}
                          >
                            <Send className="w-3 h-3" /> Terkirim
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Belum Terkirim</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Quick Toggle Paid */}
                          <button
                            onClick={(e) => handleQuickTogglePaid(e, inv)}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                              inv.status === 'paid'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={inv.status === 'paid' ? 'Tandai Belum Lunas' : 'Tandai Lunas'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {/* Kirim WA */}
                          <button
                            onClick={() => onOpenWhatsApp(inv)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Kirim PDF via WhatsApp OpenWA"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onOpenEdit(inv)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit Invoice"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* View Detail */}
                          <button
                            onClick={() => onOpenDetail(inv)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                            title="Lihat Detail & Download"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus invoice ${inv.invoiceNumber}?`)) {
                                onDeleteInvoice(inv.id);
                              }
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
