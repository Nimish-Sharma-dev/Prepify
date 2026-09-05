import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import { todayKey, formatNiceDate } from '../utils/date'
import type { Chapter, Exam, ExamChapter, ExamType, Subject } from '../types/database'

const TYPE_LABEL: Record<ExamType, string> = {
  exam: 'Exam',
  main_exam: 'Main exam',
  rest_day: 'Rest day',
}

export function Exams() {
  const { profile } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, Chapter[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedExam, setExpandedExam] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)

    const [examsRes, subjectsRes, chaptersRes] = await Promise.all([
      supabase.from('exams').select('*').order('exam_date', { ascending: false }),
      supabase.from('subjects').select('*').order('created_at'),
      supabase.from('chapters').select('*').order('position'),
    ])

    if (examsRes.error || subjectsRes.error || chaptersRes.error) {
      setError('Could not load exams.')
      setLoading(false)
      return
    }

    setExams((examsRes.data as Exam[]) ?? [])
    setSubjects((subjectsRes.data as Subject[]) ?? [])

    const grouped: Record<string, Chapter[]> = {}
    for (const ch of (chaptersRes.data as Chapter[]) ?? []) {
      if (!grouped[ch.subject_id]) grouped[ch.subject_id] = []
      grouped[ch.subject_id].push(ch)
    }
    setChaptersBySubject(grouped)
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Exams</h1>
          <p className="text-sm text-ink-500">Upcoming exams, results, and rest days</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
        >
          {showForm ? 'Cancel' : 'New entry'}
        </button>
      </div>

      <ErrorMessage message={error} />

      {showForm && (
        <ExamForm
          subjects={subjects}
          chaptersBySubject={chaptersBySubject}
          userId={profile!.id}
          onCreated={(exam) => {
            setExams((prev) => [exam, ...prev])
            setShowForm(false)
          }}
        />
      )}

      {loading ? (
        <Loading label="Loading exams…" />
      ) : exams.length === 0 ? (
        <EmptyState message="No exams yet." />
      ) : (
        <ul className="space-y-2">
          {exams.map((exam) => (
            <ExamRow
              key={exam.id}
              exam={exam}
              expanded={expandedExam === exam.id}
              onToggle={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
              onDelete={() => {
                setExams((prev) => prev.filter((e) => e.id !== exam.id))
              }}
              onUpdate={(updated) =>
                setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ExamForm({
  subjects,
  chaptersBySubject,
  userId,
  onCreated,
}: {
  subjects: Subject[]
  chaptersBySubject: Record<string, Chapter[]>
  userId: string
  onCreated: (exam: Exam) => void
}) {
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState(todayKey())
  const [totalMarks, setTotalMarks] = useState('')
  const [examType, setExamType] = useState<ExamType>('exam')
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function toggleChapter(id: string) {
    setSelectedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Enter a name for this entry.')
      return
    }
    if (!examDate) {
      setFormError('Select a date.')
      return
    }
    const parsedTotal = totalMarks ? parseFloat(totalMarks) : null
    if (examType !== 'rest_day' && parsedTotal !== null && parsedTotal < 0) {
      setFormError('Total marks cannot be negative.')
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('exams')
      .insert({
        user_id: userId,
        name: trimmedName,
        exam_date: examDate,
        total_marks: examType === 'rest_day' ? null : parsedTotal,
        exam_type: examType,
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      setFormError('Could not save. Please try again.')
      return
    }

    const exam = data as Exam

    if (examType !== 'rest_day' && selectedChapters.size > 0) {
      const rows = Array.from(selectedChapters).map((chapter_id) => ({
        exam_id: exam.id,
        chapter_id,
      }))
      await supabase.from('exam_chapters').insert(rows)
    }

    setSaving(false)
    onCreated(exam)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded border border-line bg-white p-4">
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Type</label>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
            className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="exam">Exam</option>
            <option value="main_exam">Main exam</option>
            <option value="rest_day">Rest day</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700">Date</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            required
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-ink-700">
          {examType === 'rest_day' ? 'Label (optional)' : 'Name'}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={examType === 'rest_day' ? 'e.g. Rest day' : 'e.g. JEE Mock Test 1'}
          className="w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {examType !== 'rest_day' && (
        <>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-ink-700">Total marks</label>
            <input
              type="number"
              min="0"
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
              placeholder="e.g. 300"
              className="w-full max-w-xs rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {subjects.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-ink-700">Syllabus</label>
              <div className="max-h-52 overflow-y-auto rounded border border-line p-2">
                {subjects.map((subject) => (
                  <div key={subject.id} className="mb-2">
                    <p className="mb-1 text-xs font-semibold text-ink-700">{subject.name}</p>
                    {(chaptersBySubject[subject.id] ?? []).map((ch) => (
                      <label key={ch.id} className="flex items-center gap-2 py-0.5 pl-2 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={selectedChapters.has(ch.id)}
                          onChange={() => toggleChapter(ch.id)}
                          className="accent-accent"
                        />
                        {ch.name}
                      </label>
                    ))}
                    {(chaptersBySubject[subject.id] ?? []).length === 0 && (
                      <p className="pl-2 text-xs text-ink-500">No chapters in this subject.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ErrorMessage message={formError} />

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

function ExamRow({
  exam,
  expanded,
  onToggle,
  onDelete,
  onUpdate,
}: {
  exam: Exam
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdate: (exam: Exam) => void
}) {
  const [examChapters, setExamChapters] = useState<(ExamChapter & { chapterName: string })[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [scored, setScored] = useState(exam.marks_scored?.toString() ?? '')
  const [resultError, setResultError] = useState<string | null>(null)
  const [savingResult, setSavingResult] = useState(false)

  useEffect(() => {
    if (expanded && exam.exam_type !== 'rest_day') {
      loadDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  async function loadDetail() {
    setLoadingDetail(true)
    const { data, error } = await supabase
      .from('exam_chapters')
      .select('*, chapters(name)')
      .eq('exam_id', exam.id)

    if (!error) {
      setExamChapters(
        ((data as any[]) ?? []).map((row) => ({
          ...row,
          chapterName: row.chapters?.name ?? 'Unknown chapter',
        }))
      )
    }
    setLoadingDetail(false)
  }

  async function handleSaveResult() {
    setResultError(null)
    const parsedScored = parseFloat(scored)
    if (isNaN(parsedScored) || parsedScored < 0) {
      setResultError('Enter a valid non-negative score.')
      return
    }
    if (exam.total_marks !== null && parsedScored > exam.total_marks) {
      setResultError('Score cannot exceed total marks.')
      return
    }

    setSavingResult(true)
    const { data, error } = await supabase
      .from('exams')
      .update({ marks_scored: parsedScored })
      .eq('id', exam.id)
      .select()
      .single()
    setSavingResult(false)

    if (error) {
      setResultError('Could not save result.')
      return
    }
    onUpdate(data as Exam)
  }

  async function handleChapterScoreChange(
    examChapterId: string,
    field: 'marks_scored' | 'marks_possible',
    value: string
  ) {
    const parsed = value === '' ? null : parseFloat(value)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return

    const { data, error } = await supabase
      .from('exam_chapters')
      .update({ [field]: parsed })
      .eq('id', examChapterId)
      .select('*, chapters(name)')
      .single()

    if (!error && data) {
      setExamChapters((prev) =>
        prev.map((ec) =>
          ec.id === examChapterId
            ? { ...(data as any), chapterName: (data as any).chapters?.name ?? ec.chapterName }
            : ec
        )
      )
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this entry?')) return
    const { error } = await supabase.from('exams').delete().eq('id', exam.id)
    if (!error) onDelete()
  }

  const isPast = exam.exam_date <= todayKey()
  const badgeColor =
    exam.exam_type === 'main_exam'
      ? 'bg-red-100 text-red-700'
      : exam.exam_type === 'rest_day'
        ? 'bg-ink-100 text-ink-500'
        : 'bg-amber-100 text-amber-700'

  return (
    <li className="rounded border border-line bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
            {TYPE_LABEL[exam.exam_type]}
          </span>
          <span className="text-sm font-medium text-ink-900">{exam.name || 'Untitled'}</span>
          <span className="text-xs text-ink-500">{formatNiceDate(exam.exam_date)}</span>
          {exam.exam_type !== 'rest_day' && exam.marks_scored !== null && (
            <span className="text-xs text-ink-500">
              {exam.marks_scored}/{exam.total_marks ?? '—'}
            </span>
          )}
        </button>
        <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">
          Delete
        </button>
      </div>

      {expanded && exam.exam_type !== 'rest_day' && (
        <div className="border-t border-line px-4 py-3">
          {isPast && (
            <div className="mb-4 flex items-end gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">Marks scored</label>
                <input
                  type="number"
                  min="0"
                  value={scored}
                  onChange={(e) => setScored(e.target.value)}
                  className="w-32 rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <span className="pb-2 text-sm text-ink-500">/ {exam.total_marks ?? '—'}</span>
              <button
                onClick={handleSaveResult}
                disabled={savingResult}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {savingResult ? 'Saving…' : 'Save result'}
              </button>
            </div>
          )}
          <ErrorMessage message={resultError} />

          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Syllabus
          </h4>
          {loadingDetail ? (
            <Loading label="Loading syllabus…" />
          ) : examChapters.length === 0 ? (
            <p className="text-sm text-ink-500">No chapters assigned to this exam.</p>
          ) : (
            <ul className="space-y-1.5">
              {examChapters.map((ec) => (
                <li key={ec.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-ink-700">{ec.chapterName}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Score"
                    defaultValue={ec.marks_scored ?? ''}
                    onBlur={(e) => handleChapterScoreChange(ec.id, 'marks_scored', e.target.value)}
                    className="w-16 rounded border border-line px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                  <span className="text-ink-500">/</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Total"
                    defaultValue={ec.marks_possible ?? ''}
                    onBlur={(e) => handleChapterScoreChange(ec.id, 'marks_possible', e.target.value)}
                    className="w-16 rounded border border-line px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
