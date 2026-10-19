import { Invoice } from '../types/invoice';
import { formatIndoDate } from './formatters';

export function exportInvoicesToCsv(invoices: Invoice[], fileName = 'Laporan_Invoice'): void {
  const headers = [
    'No. Invoice',
    'Tanggal Terbit',
    'Jatuh Tempo',
    'Status Pembayaran',
    'Nama Customer',
    'Perusahaan',
    'No. WhatsApp',
    'Email',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'PPN (Rp)',
    'Biaya Lain / Ongkir (Rp)',
    'Total Tagihan (Rp)',
    'Tanggal Lunas',
    'Metode Bayar',
    'Status WhatsApp',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = invoices.map((inv) => [
    escapeCsv(inv.invoiceNumber),
    escapeCsv(inv.issueDate),
    escapeCsv(inv.dueDate),
    escapeCsv(
      inv.status === 'paid'
        ? 'LUNAS'
        : inv.status === 'overdue'
        ? 'JATUH TEMPO'
        : inv.status === 'unpaid'
        ? 'BELUM BAYAR'
        : 'DRAFT'
    ),
    escapeCsv(inv.client.name),
    escapeCsv(inv.client.company || '-'),
    escapeCsv(inv.client.phone),
    escapeCsv(inv.client.email || '-'),
    escapeCsv(inv.subtotal),
    escapeCsv(inv.discountAmount),
    escapeCsv(inv.taxAmount),
    escapeCsv(inv.shippingFee),
    escapeCsv(inv.total),
    escapeCsv(inv.paidAt ? formatIndoDate(inv.paidAt) : '-'),
    escapeCsv(inv.paidMethod || '-'),
    escapeCsv(inv.whatsappStatus === 'sent' ? 'Terkirim' : 'Belum'),
  ]);

  // Add UTF-8 BOM so Microsoft Excel opens special characters and Indonesian formatting correctly
  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
