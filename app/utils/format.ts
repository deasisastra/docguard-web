export function money(v: string | number | null | undefined, currency?: string | null) {
  if (v === null || v === undefined || v === '') return '–'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  const s = n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${s}` : s
}

export function todayISO() {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fmtDateTime(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

export const statusLabel: Record<string, string> = {
  green: 'Hijau · Dapat diproses, tetap dikonfirmasi petugas',
  yellow: 'Kuning · Perlu diperiksa petugas',
  red: 'Merah · Tidak dapat dicatat',
}

export const statusShort: Record<string, string> = { green: 'Hijau', yellow: 'Kuning', red: 'Merah' }
