export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-ink-500">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
