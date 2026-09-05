import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { todayKey, formatNiceDate } from '../utils/date'
import { calculateStreak, sumHours } from '../utils/calculations'
import type { StudyLog } from '../types/database'

export function Log() {
  const { profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [logsForDate, setLogsForDate] = useState<StudyLog[]>([])
  const [allLogDates, setAllLogDates] = useState<Set<string>>(new Set())
  const [dailyTarget, setDailyTarget] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadLogsForDate(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  async function loadEverything() {
    setLoading(true)
    setError(null)

    const [datesRes, settingsRes, dateLogsRes] = await Promise.all([
      supabase.from('study_logs').select('log_date'),
      supabase.from('user_settings').select('daily_target_hours').eq('user_id', profile!.id).maybeSingle(),
      supabase.from('study_logs').select('*').eq('log_date', selectedDate).order('created_at'),
    ])

    if (datesRes.error) {
      setError('Could not load study logs.')
      setLoading(false)
      return
    }

    setAllLogDates(new Set((datesRes.data as Pick<StudyLog, 'log_date'>[]).map((d) => d.log_date)))
    setDailyTarget(settingsRes.data?.daily_target_hours ?? 0)
    setLogsForDate((dateLogsRes.data as StudyLog[]) ?? [])
    setLoading(false)
  }

  async function loadLogsForDate(date: string) {
    const { data, error: logsError } = await supabase
      .from('study_logs')
      .select('*')
      .eq('log_date', date)
      .order('created_at')

    if (!logsError) {
      setLogsForDate((data as StudyLog[]) ?? [])
    }
  }

  async function handleAddLog(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const parsedHours = parseFloat(hours)
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setError('Enter a valid number of hours greater than 0.')
      return
    }
    if (parsedHours > 24) {
      setError('Hours cannot exceed 24.')
      return
    }

    setSaving(true)
    const { data, error: insertError } = await supabase
      .from('study_logs')
      .insert({
        user_id: profile!.id,
        log_date: selectedDate,
        hours: parsedHours,
        notes: notes.trim() || null,
      })
      .select()
      .single()

    setSaving(false)

    if (insertError) {
      setError('Could not save study log. Please try again.')
      return
    }

    setLogsForDate((prev) => [...prev, data as StudyLog])
    setAllLogDates((prev) => new Set(prev).add(selectedDate))
    setHours('')
    setNotes('')
  }

  async function handleDeleteLog(id: string) {
    const { error: deleteError } = await supabase.from('study_logs').delete().eq('id', id)
    if (deleteError) {
      setError('Could not delete log.')
      return
    }
    const remaining = logsForDate.filter((l) => l.id !== id)
    setLogsForDate(remaining)
    if (remaining.length === 0) {
      setAllLogDates((prev) => {
        const next = new Set(prev)
        next.delete(selectedDate)
        return next
      })
    }
  }

  const totalHoursToday = sumHours(logsForDate.map((l) => l.hours))
  const targetReached = dailyTarget > 0 && totalHoursToday >= dailyTarget
  const streak = calculateStreak(allLogDates)
  const isToday = selectedDate === todayKey()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Daily log</h1>
        <p className="text-sm text-ink-500">Record what you studied</p>
      </div>

      {loading ? (
        <Loading label="Loading…" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label={isToday ? "Today's hours" : 'Hours logged'} value={`${totalHoursToday}h`} />
            <StatBox label="Daily target" value={dailyTarget > 0 ? `${dailyTarget}h` : 'Not set'} />
            <StatBox
              label="Target status"
              value={dailyTarget === 0 ? '—' : targetReached ? 'Reached ✓' : 'Not reached'}
              accent={targetReached}
            />
            <StatBox label="Study streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
          </div>

          <div className="mb-5 rounded border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="log-date" className="text-sm font-medium text-ink-700">
                Date
              </label>
              <input
                id="log-date"
                type="date"
                value={selectedDate}
                max={todayKey()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded border border-line px-2 py-1 text-sm outline-none focus:border-accent"
              />
            </div>

            <form onSubmit={handleAddLog} className="space-y-3">
              <div>
                <label htmlFor="hours" className="mb-1 block text-sm font-medium text-ink-700">
                  Hours studied
                </label>
                <input
                  id="hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label htmlFor="notes" className="mb-1 block text-sm font-medium text-ink-700">
                  What I studied / notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Completed Kinematics and revised Laws of Motion."
                  className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <ErrorMessage message={error} />
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add log entry'}
              </button>
            </form>
          </div>

          <div className="rounded border border-line bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-ink-900">
              Entries for {formatNiceDate(selectedDate)}
            </h2>
            {logsForDate.length === 0 ? (
              <EmptyState message="No study logs yet." />
            ) : (
              <ul className="divide-y divide-line">
                {logsForDate.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{log.hours}h</p>
                      {log.notes && <p className="mt-0.5 text-sm text-ink-500">{log.notes}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-line bg-white p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-1 text-base font-semibold ${accent ? 'text-accent-600' : 'text-ink-900'}`}>
        {value}
      </p>
    </div>
  )
}
