export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCurrency(value: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currencyCode} ${formatNumber(value, 2)}`;
  }
}

export function formatAge(timestamp: number | null): string {
  if (!timestamp) return 'No live data';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 2) return 'Updated now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}

export function formatTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp);
}
