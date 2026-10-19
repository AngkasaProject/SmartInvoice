/**
 * Formatting utilities for Indonesian currency, dates, numbers, and WhatsApp phone numbers
 */

export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndoDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatIndoDateFull(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Normalizes phone numbers to standard Indonesian WhatsApp format (e.g. 628123456789)
 */
export function cleanWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function formatDisplayPhone(phone: string): string {
  const cleaned = cleanWhatsAppNumber(phone);
  if (!cleaned) return phone || '-';
  if (cleaned.startsWith('62')) {
    const part1 = cleaned.slice(0, 4);
    const part2 = cleaned.slice(4, 8);
    const part3 = cleaned.slice(8);
    return `+${part1}-${part2}-${part3}`.replace(/-$/, '');
  }
  return phone;
}

/**
 * Calculates due date status: days remaining or days overdue
 */
export function getDueDateInfo(dueDateStr: string, status: string): { label: string; isOverdue: boolean; daysDiff: number } {
  if (status === 'paid') {
    return { label: 'Sudah Lunas', isOverdue: false, daysDiff: 0 };
  }
  if (!dueDateStr) {
    return { label: '-', isOverdue: false, daysDiff: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Terlambat ${Math.abs(diffDays)} hari`,
      isOverdue: true,
      daysDiff: diffDays,
    };
  } else if (diffDays === 0) {
    return {
      label: 'Jatuh tempo hari ini',
      isOverdue: false,
      daysDiff: 0,
    };
  } else {
    return {
      label: `${diffDays} hari lagi`,
      isOverdue: false,
      daysDiff: diffDays,
    };
  }
}

/**
 * Indonesian number to words conversion (Terbilang)
 * e.g. 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function terbilang(n: number): string {
  if (isNaN(n) || !isFinite(n)) return 'Nol Rupiah';
  if (n < 0) return 'Minus ' + terbilang(Math.abs(n));
  if (n === 0) return 'Nol Rupiah';

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function toWords(num: number): string {
    if (num < 12) {
      return satuan[num];
    } else if (num < 20) {
      return toWords(num - 10) + ' Belas';
    } else if (num < 100) {
      return toWords(Math.floor(num / 10)) + ' Puluh ' + toWords(num % 10);
    } else if (num < 200) {
      return 'Seratus ' + toWords(num - 100);
    } else if (num < 1000) {
      return toWords(Math.floor(num / 100)) + ' Ratus ' + toWords(num % 100);
    } else if (num < 2000) {
      return 'Seribu ' + toWords(num - 1000);
    } else if (num < 1000000) {
      return toWords(Math.floor(num / 1000)) + ' Ribu ' + toWords(num % 1000);
    } else if (num < 1000000000) {
      return toWords(Math.floor(num / 1000000)) + ' Juta ' + toWords(num % 1000000);
    } else if (num < 1000000000000) {
      return toWords(Math.floor(num / 1000000000)) + ' Milyar ' + toWords(num % 1000000000);
    } else if (num < 1000000000000000) {
      return toWords(Math.floor(num / 1000000000000)) + ' Triliun ' + toWords(num % 1000000000000);
    }
    return '';
  }

  const result = toWords(Math.floor(n)).replace(/\s+/g, ' ').trim();
  return result ? `${result} Rupiah` : 'Nol Rupiah';
}
