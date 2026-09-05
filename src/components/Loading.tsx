export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-ink-500">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-300 border-t-accent" />
      {label}
    </div>
  )
}
