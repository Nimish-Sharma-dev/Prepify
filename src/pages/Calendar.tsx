import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'
import { ErrorMessage } from '../components/ErrorMessage'
import {
  daysInMonth,
  firstWeekdayOfMonth,
  monthLabel,
  toDateKey,
  formatNiceDate,
} from '../utils/date'
import type { CalendarEvent, StudyLog } from '../types/database'

interface DayInfo {
  hasStudy: boolean
  events: CalendarEvent[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Calendar() {
  const { profile } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyDates, setStudyDates] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    loadMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  async function loadMonth() {
    setLoading(true)
    setError(null)
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    const startKey = toDateKey(start)
    const endKey = toDateKey(end)

    const [logsRes, eventsRes] = await Promise.all([
      supabase
        .from('study_logs')
        .select('log_date')
        .gte('log_date', startKey)
        .lte('log_date', endKey),
      supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', startKey)
        .lte('event_date', endKey),
    ])

    if (logsRes.error || eventsRes.error) {
      setError('Could not load calendar data. Please try again.')
      setLoading(false)
      return
    }

    const dates = new Set<string>((logsRes.data as Pick<StudyLog, 'log_date'>[]).map((l) => l.log_date))
    setStudyDates(dates)
    setEvents((eventsRes.data as CalendarEvent[]) ?? [])
    setLoading(false)
  }

  const dayMap = useMemo(() => {
    const map = new Map<string, DayInfo>()
    studyDates.forEach((date) => {
      map.set(date, { hasStudy: true, events: [] })
    })
    events.forEach((ev) => {
      const existing = map.get(ev.event_date)
      if (existing) {
        existing.events.push(ev)
      } else {
        map.set(ev.event_date, { hasStudy: false, events: [ev] })
      }
    })
    return map
  }, [studyDates, events])

  function goPrevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  const totalDays = daysInMonth(year, month)
  const leadingBlanks = firstWeekdayOfMonth(year, month)
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => toDateKey(new Date(year, month, i + 1))),
  ]
  const todayStr = toDateKey(now)

  const selectedInfo = selectedDate ? dayMap.get(selectedDate) : undefined

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Hello, {profile?.username}</h1>
        <p className="text-sm text-ink-500">Your study calendar</p>
      </div>

      <div className="rounded border border-line bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            className="rounded border border-line px-2 py-1 text-sm text-ink-700 hover:bg-ink-900/5"
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-ink-900">{monthLabel(year, month)}</h2>
            <button onClick={goToday} className="text-xs text-accent-600 hover:underline">
              Today
            </button>
          </div>
          <button
            onClick={goNextMonth}
            className="rounded border border-line px-2 py-1 text-sm text-ink-700 hover:bg-ink-900/5"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <ErrorMessage message={error} />
        {loading ? (
          <Loading label="Loading calendar…" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-500">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dateKey, idx) => {
                if (!dateKey) return <div key={`blank-${idx}`} />
                const info = dayMap.get(dateKey)
                const isToday = dateKey === todayStr
                const isSelected = dateKey === selectedDate
                const dayNum = Number(dateKey.split('-')[2])

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`flex h-14 flex-col items-center justify-start rounded border px-1 pt-1 text-sm transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent-50'
                        : isToday
                          ? 'border-accent-500 bg-white'
                          : 'border-transparent hover:border-line'
                    } ${info?.hasStudy ? 'bg-accent-50' : ''}`}
                  >
                    <span className={isToday ? 'font-semibold text-accent-700' : 'text-ink-900'}>
                      {dayNum}
                    </span>
                    <span className="mt-1 flex gap-0.5">
                      {info?.hasStudy && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-500" title="Study activity" />
                      )}
                      {info?.events.some((e) => e.event_type === 'exam') && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Exam" />
                      )}
                      {info?.events.some((e) => e.event_type === 'main_exam') && (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" title="Main exam" />
                      )}
                      {info?.events.some((e) => e.event_type === 'rest_day') && (
                        <span className="h-1.5 w-1.5 rounded-full bg-ink-300" title="Rest day" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-ink-500">
              <LegendItem color="bg-accent-500" label="Study activity" />
              <LegendItem color="bg-amber-500" label="Exam" />
              <LegendItem color="bg-red-600" label="Main exam" />
              <LegendItem color="bg-ink-300" label="Rest day" />
            </div>
          </>
        )}
      </div>

      {selectedDate && (
        <div className="mt-4 rounded border border-line bg-white p-4">
          <h3 className="text-sm font-medium text-ink-900">{formatNiceDate(selectedDate)}</h3>
          <div className="mt-2 space-y-1 text-sm text-ink-700">
            {selectedInfo?.hasStudy && <p>• Study activity logged</p>}
            {selectedInfo?.events.map((ev) => (
              <p key={ev.id}>
                •{' '}
                {ev.event_type === 'exam'
                  ? `Exam — ${ev.title}`
                  : ev.event_type === 'main_exam'
                    ? `Main exam — ${ev.title}`
                    : 'Rest day'}
              </p>
            ))}
            {!selectedInfo?.hasStudy && !selectedInfo?.events.length && (
              <p className="text-ink-500">Nothing recorded for this date.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
