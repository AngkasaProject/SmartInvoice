import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceStatus, BusinessProfile, OpenWaConfig } from '../types/invoice';
import { formatIndoDate, formatIndoDateFull, formatRupiah, formatDisplayPhone } from '../utils/formatters';
import { exportInvoicesToCsv } from '../utils/csvExport';
import {
  History,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Eye,
  Receipt,
  Calendar,
  Phone,
  FileText,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface HistoryViewProps {
  invoices: Invoice[];
  business: BusinessProfile;
  config: OpenWaConfig;
  onOpenDetail: (invoice: Invoice) => void;
  onOpenWhatsApp: (invoice: Invoice) => void;
  onOpenEdit: (invoice: Invoice) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  invoices,
  business,
  config,
  onOpenDetail,
  onOpenWhatsApp,
  onOpenEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [waFilter, setWaFilter] = useState<'all' | 'sent' | 'not_sent'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '30days' | 'thisMonth'>('all');

  // Filtered invoices
  const filteredList = useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

      // WhatsApp filter
      if (waFilter === 'sent' && inv.whatsappStatus !== 'sent') return false;
      if (waFilter === 'not_sent' && inv.whatsappStatus === 'sent') return false;

      // Date filter
      if (dateFilter !== 'all') {
        const invDate = new Date(inv.issueDate);
        const now = new Date();
        if (dateFilter === 'thisMonth') {
          if (
            invDate.getMonth() !== now.getMonth() ||
            invDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        } else if (dateFilter === '30days') {
          const diffMs = now.getTime() - invDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 30) return false;
        }
      }

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.client.name.toLowerCase().includes(q) ||
        (inv.client.company && inv.client.company.toLowerCase().includes(q)) ||
        (inv.client.phone && inv.client.phone.includes(q))
      );
    });
  }, [invoices, statusFilter, waFilter, dateFilter, searchQuery]);

  // Statistics
  const totalSentWa = useMemo(
    () => invoices.filter((i) => i.whatsappStatus === 'sent').length,
    [invoices]
  );
  const totalLunas = useMemo(
    () => invoices.filter((i) => i.status === 'paid').length,
    [invoices]
  );
  const totalNominalLunas = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + i.total, 0),
    [invoices]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            Arsip & Riwayat Transaksi
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Riwayat Invoice & Pengiriman Dokumen
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lacak seluruh rekaman penerbitan tagihan, status pembayaran, dan riwayat kirim WhatsApp ke customer
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            exportInvoicesToCsv(filteredList, 'Riwayat_Transaksi_Invoice');
            toast.success(`Berhasil mengekspor ${filteredList.length} data riwayat ke file CSV!`);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs shrink-0"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          Ekspor Riwayat (CSV)
        </button>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total Seluruh Invoice</div>
            <div className="text-lg font-extrabold text-slate-900 font-mono">
              {invoices.length} Berkas
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Pelunasan Berhasil</div>
            <div className="text-lg font-extrabold text-emerald-700 font-mono">
              {totalLunas} Lunas ({formatRupiah(totalNominalLunas)})
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">PDF Terkirim ke WhatsApp</div>
            <div className="text-lg font-extrabold text-teal-700 font-mono">
              {totalSentWa} dari {invoices.length} Customer
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan No. Invoice, Customer, No. WhatsApp..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Status Bayar</option>
              <option value="paid">Lunas (Paid)</option>
              <option value="unpaid">Belum Bayar</option>
              <option value="overdue">Jatuh Tempo</option>
              <option value="draft">Draft</option>
            </select>

            {/* WA Filter Dropdown */}
            <select
              value={waFilter}
              onChange={(e) => setWaFilter(e.target.value as any)}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Status WA</option>
              <option value="sent">Sudah Kirim WA</option>
              <option value="not_sent">Belum Kirim WA</option>
            </select>

            {/* Date Range Dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Semua Waktu</option>
              <option value="thisMonth">Bulan Ini</option>
              <option value="30days">30 Hari Terakhir</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="text-center py-12 px-4">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Tidak ada riwayat transaksi</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? `Tidak ada data yang cocok dengan pencarian "${searchQuery}".`
                : 'Belum ada rekaman riwayat invoice yang sesuai dengan filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Tanggal & No. Invoice</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Riwayat WhatsApp</th>
                  <th className="py-3 px-4">Riwayat Pelunasan</th>
                  <th className="py-3 px-4 text-right">Total Tagihan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => onOpenDetail(inv)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    {/* Invoice & Date */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-indigo-900">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Terbit: {formatIndoDate(inv.issueDate)}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{inv.client.name}</div>
                      {inv.client.company && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          {inv.client.company}
                        </div>
                      )}
                      <div className="text-[11px] font-mono text-emerald-700 mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        {formatDisplayPhone(inv.client.phone)}
                      </div>
                    </td>

                    {/* WhatsApp Dispatch Log */}
                    <td className="py-3.5 px-4">
                      {inv.whatsappStatus === 'sent' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            <Send className="w-3 h-3" /> Terkirim ke WA
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {inv.whatsappSentAt ? formatIndoDateFull(inv.whatsappSentAt) : 'Terkirim'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-slate-400" /> Belum Dikirim
                        </span>
                      )}
                    </td>

                    {/* Payment Status Record */}
                    <td className="py-3.5 px-4">
                      {inv.status === 'paid' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                            <CheckCircle2 className="w-3 h-3" /> LUNAS
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {inv.paidAt ? formatIndoDate(inv.paidAt) : '-'} ({inv.paidMethod || 'Transfer'})
                          </div>
                        </div>
                      ) : inv.status === 'overdue' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold">
                          <AlertTriangle className="w-3 h-3" /> Jatuh Tempo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                          <Clock className="w-3 h-3" /> Belum Dibayar
                        </span>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatRupiah(inv.total)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetail(inv)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                          title="Lihat Pratinjau & Kwitansi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenWhatsApp(inv)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                          title="Kirim Salinan PDF via WhatsApp OpenWA"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
