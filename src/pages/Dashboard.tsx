import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { todayKey, startOfWeek, endOfWeek } from '../utils/date'
import { calculateStreak, sumHours } from '../utils/calculations'
import type { Chapter, StudyLog, Subject } from '../types/database'

interface SubjectStats {
  subject: Subject
  total: number
  completed: number
  revised: number
  perfected: number
}

export function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dailyTarget, setDailyTarget] = useState(0)
  const [weeklyTarget, setWeeklyTarget] = useState(0)
  const [dailyInput, setDailyInput] = useState('')
  const [weeklyInput, setWeeklyInput] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [todayHours, setTodayHours] = useState(0)
  const [weekHours, setWeekHours] = useState(0)
  const [streak, setStreak] = useState(0)
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([])

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)

    const today = todayKey()
    const weekStart = startOfWeek(today)
    const weekEnd = endOfWeek(today)

    const [settingsRes, allLogsRes, weekLogsRes, subjectsRes, chaptersRes] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', profile!.id).maybeSingle(),
      supabase.from('study_logs').select('log_date, hours'),
      supabase.from('study_logs').select('hours').gte('log_date', weekStart).lte('log_date', weekEnd),
      supabase.from('subjects').select('*').order('created_at'),
      supabase.from('chapters').select('*'),
    ])

    if (settingsRes.error || allLogsRes.error || weekLogsRes.error || subjectsRes.error || chaptersRes.error) {
      setError('Could not load dashboard data.')
      setLoading(false)
      return
    }

    setDailyTarget(settingsRes.data?.daily_target_hours ?? 0)
    setWeeklyTarget(settingsRes.data?.weekly_target_hours ?? 0)
    setDailyInput(String(settingsRes.data?.daily_target_hours ?? 0))
    setWeeklyInput(String(settingsRes.data?.weekly_target_hours ?? 0))

    const allLogs = (allLogsRes.data as Pick<StudyLog, 'log_date' | 'hours'>[]) ?? []
    const dateSet = new Set(allLogs.map((l) => l.log_date))
    setStreak(calculateStreak(dateSet))
    setTodayHours(sumHours(allLogs.filter((l) => l.log_date === today).map((l) => l.hours)))
    setWeekHours(sumHours(((weekLogsRes.data as Pick<StudyLog, 'hours'>[]) ?? []).map((l) => l.hours)))

    const subjects = (subjectsRes.data as Subject[]) ?? []
    const chapters = (chaptersRes.data as Chapter[]) ?? []
    const stats: SubjectStats[] = subjects.map((s) => {
      const subjectChapters = chapters.filter((c) => c.subject_id === s.id)
      return {
        subject: s,
        total: subjectChapters.length,
        completed: subjectChapters.filter((c) => c.progress_level >= 1).length,
        revised: subjectChapters.filter((c) => c.progress_level >= 2).length,
        perfected: subjectChapters.filter((c) => c.progress_level >= 3).length,
      }
    })
    setSubjectStats(stats)

    setLoading(false)
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSettingsSaved(false)

    const parsedDaily = parseFloat(dailyInput)
    const parsedWeekly = parseFloat(weeklyInput)

    if (isNaN(parsedDaily) || parsedDaily < 0 || isNaN(parsedWeekly) || parsedWeekly < 0) {
      setError('Targets must be zero or a positive number.')
      return
    }

    setSavingSettings(true)
    const { error: upsertError } = await supabase.from('user_settings').upsert(
      {
        user_id: profile!.id,
        daily_target_hours: parsedDaily,
        weekly_target_hours: parsedWeekly,
      },
      { onConflict: 'user_id' }
    )
    setSavingSettings(false)

    if (upsertError) {
      setError('Could not save targets.')
      return
    }

    setDailyTarget(parsedDaily)
    setWeeklyTarget(parsedWeekly)
    setSettingsSaved(true)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Loading label="Loading dashboard…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500">Your progress at a glance</p>
      </div>

      <ErrorMessage message={error} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatBox label="Daily progress" value={`${todayHours} / ${dailyTarget || '—'} h`} />
        <StatBox label="Weekly progress" value={`${weekHours} / ${weeklyTarget || '—'} h`} />
        <StatBox label="Study streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
      </div>

      <div className="mb-5 rounded border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-900">Targets</h2>
        <form onSubmit={handleSaveSettings} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Daily target (hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={dailyInput}
              onChange={(e) => setDailyInput(e.target.value)}
              className="w-32 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Weekly target (hours)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={weeklyInput}
              onChange={(e) => setWeeklyInput(e.target.value)}
              className="w-32 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {savingSettings ? 'Saving…' : 'Save targets'}
          </button>
          {settingsSaved && <span className="text-sm text-green-700">Saved.</span>}
        </form>
      </div>

      <div className="rounded border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-900">Syllabus progress</h2>
        {subjectStats.length === 0 ? (
          <EmptyState message="No subjects yet." />
        ) : (
          <ul className="divide-y divide-line">
            {subjectStats.map((s) => (
              <li key={s.subject.id} className="py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-900">{s.subject.name}</span>
                  <span className="text-xs text-ink-500">
                    {s.completed} / {s.total} chapters completed
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-ink-500">
                  <span>Revised: {s.revised}</span>
                  <span>Perfected: {s.perfected}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-line">
                  <div
                    className="h-full bg-accent-500"
                    style={{ width: `${s.total > 0 ? (s.completed / s.total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-900">{value}</p>
    </div>
  )
}
