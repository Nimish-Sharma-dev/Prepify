// All dates are handled as local calendar dates in 'YYYY-MM-DD' form to
// match Postgres `date` columns without timezone drift.

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, delta: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

export function startOfWeek(key: string): string {
  // Monday-start week
  const d = parseDateKey(key)
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateKey(d)
}

export function endOfWeek(key: string): string {
  return addDays(startOfWeek(key), 6)
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function firstWeekdayOfMonth(year: number, month: number): number {
  // 0 = Sunday ... shift so Monday = 0
  const jsDay = new Date(year, month, 1).getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export function formatNiceDate(key: string): string {
  return parseDateKey(key).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
