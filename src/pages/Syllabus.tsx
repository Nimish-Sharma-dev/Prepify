import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Loading } from '../components/Loading'
import { ErrorMessage } from '../components/ErrorMessage'
import { EmptyState } from '../components/EmptyState'
import type { Chapter, Subject } from '../types/database'

interface ChapterExamInfo {
  examName: string
  examDate: string
  marksScored: number | null
  marksPossible: number | null
}

export function Syllabus() {
  const { profile } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, Chapter[]>>({})
  const [examInfoByChapter, setExamInfoByChapter] = useState<Record<string, ChapterExamInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)

    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: true })

    if (subjectError) {
      setError('Could not load subjects.')
      setLoading(false)
      return
    }

    const subjectsList = (subjectData as Subject[]) ?? []
    setSubjects(subjectsList)

    if (subjectsList.length > 0) {
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .order('position', { ascending: true })

      if (chapterError) {
        setError('Could not load chapters.')
        setLoading(false)
        return
      }

      const grouped: Record<string, Chapter[]> = {}
      for (const ch of (chapterData as Chapter[]) ?? []) {
        if (!grouped[ch.subject_id]) grouped[ch.subject_id] = []
        grouped[ch.subject_id].push(ch)
      }
      setChaptersBySubject(grouped)

      const chapterIds = (chapterData as Chapter[])?.map((c) => c.id) ?? []
      if (chapterIds.length > 0) {
        const { data: examChapterData } = await supabase
          .from('exam_chapters')
          .select('chapter_id, marks_scored, marks_possible, exams(name, exam_date)')
          .in('chapter_id', chapterIds)

        const examMap: Record<string, ChapterExamInfo> = {}
        for (const row of (examChapterData as any[]) ?? []) {
          const exam = row.exams
          if (!exam) continue
          const existing = examMap[row.chapter_id]
          if (!existing || exam.exam_date > existing.examDate) {
            examMap[row.chapter_id] = {
              examName: exam.name,
              examDate: exam.exam_date,
              marksScored: row.marks_scored,
              marksPossible: row.marks_possible,
            }
          }
        }
        setExamInfoByChapter(examMap)
      }
    }

    setLoading(false)
    if (subjectsList.length > 0 && !expandedSubject) {
      setExpandedSubject(subjectsList[0].id)
    }
  }

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault()
    const name = newSubjectName.trim()
    if (!name) return
    setAddingSubject(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('subjects')
      .insert({ user_id: profile!.id, name })
      .select()
      .single()

    setAddingSubject(false)
    if (insertError) {
      if (insertError.code === '23505') {
        setError('A subject with that name already exists.')
      } else {
        setError('Could not add subject.')
      }
      return
    }
    setSubjects((prev) => [...prev, data as Subject])
    setNewSubjectName('')
    setExpandedSubject((data as Subject).id)
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm('Delete this subject and all its chapters?')) return
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', id)
    if (deleteError) {
      setError('Could not delete subject.')
      return
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id))
  }

  function updateChapterInState(subjectId: string, chapter: Chapter) {
    setChaptersBySubject((prev) => ({
      ...prev,
      [subjectId]: prev[subjectId].map((c) => (c.id === chapter.id ? chapter : c)),
    }))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Syllabus</h1>
        <p className="text-sm text-ink-500">Manage subjects and chapters</p>
      </div>

      <form onSubmit={handleAddSubject} className="mb-5 flex gap-2">
        <input
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          placeholder="New subject name (e.g. Physics)"
          className="flex-1 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={addingSubject || !newSubjectName.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          Add subject
        </button>
      </form>

      <ErrorMessage message={error} />

      {loading ? (
        <Loading label="Loading syllabus…" />
      ) : subjects.length === 0 ? (
        <EmptyState message="No subjects yet." />
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              chapters={chaptersBySubject[subject.id] ?? []}
              examInfoByChapter={examInfoByChapter}
              expanded={expandedSubject === subject.id}
              onToggle={() =>
                setExpandedSubject(expandedSubject === subject.id ? null : subject.id)
              }
              onDeleteSubject={() => handleDeleteSubject(subject.id)}
              onChaptersChange={(chapters) =>
                setChaptersBySubject((prev) => ({ ...prev, [subject.id]: chapters }))
              }
              onChapterUpdate={(ch) => updateChapterInState(subject.id, ch)}
              userId={profile!.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SubjectCard({
  subject,
  chapters,
  examInfoByChapter,
  expanded,
  onToggle,
  onDeleteSubject,
  onChaptersChange,
  onChapterUpdate,
  userId,
}: {
  subject: Subject
  chapters: Chapter[]
  examInfoByChapter: Record<string, ChapterExamInfo>
  expanded: boolean
  onToggle: () => void
  onDeleteSubject: () => void
  onChaptersChange: (chapters: Chapter[]) => void
  onChapterUpdate: (chapter: Chapter) => void
  userId: string
}) {
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [singleName, setSingleName] = useState('')
  const [savingBulk, setSavingBulk] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const completed = chapters.filter((c) => c.progress_level >= 1).length

  async function handleBulkSave() {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) return

    setSavingBulk(true)
    setLocalError(null)
    const startPosition = chapters.length > 0 ? Math.max(...chapters.map((c) => c.position)) + 1 : 0

    const rows = lines.map((name, idx) => ({
      subject_id: subject.id,
      user_id: userId,
      name,
      position: startPosition + idx,
    }))

    const { data, error } = await supabase.from('chapters').insert(rows).select()
    setSavingBulk(false)

    if (error) {
      setLocalError('Could not add chapters.')
      return
    }

    onChaptersChange([...chapters, ...((data as Chapter[]) ?? [])])
    setBulkText('')
    setShowBulk(false)
  }

  async function handleAddSingle(e: FormEvent) {
    e.preventDefault()
    const name = singleName.trim()
    if (!name) return
    const position = chapters.length > 0 ? Math.max(...chapters.map((c) => c.position)) + 1 : 0

    const { data, error } = await supabase
      .from('chapters')
      .insert({ subject_id: subject.id, user_id: userId, name, position })
      .select()
      .single()

    if (error) {
      setLocalError('Could not add chapter.')
      return
    }
    onChaptersChange([...chapters, data as Chapter])
    setSingleName('')
  }

  async function handleRename(chapter: Chapter, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === chapter.name) return
    const { data, error } = await supabase
      .from('chapters')
      .update({ name: trimmed })
      .eq('id', chapter.id)
      .select()
      .single()
    if (!error && data) {
      onChapterUpdate(data as Chapter)
    }
  }

  async function handleDeleteChapter(chapter: Chapter) {
    const { error } = await supabase.from('chapters').delete().eq('id', chapter.id)
    if (!error) {
      onChaptersChange(chapters.filter((c) => c.id !== chapter.id))
    }
  }

  async function handleMove(chapter: Chapter, direction: -1 | 1) {
    const sorted = [...chapters].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex((c) => c.id === chapter.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]

    const [res1, res2] = await Promise.all([
      supabase.from('chapters').update({ position: other.position }).eq('id', chapter.id).select().single(),
      supabase.from('chapters').update({ position: chapter.position }).eq('id', other.id).select().single(),
    ])
    if (res1.data && res2.data) {
      onChaptersChange(
        chapters.map((c) => {
          if (c.id === chapter.id) return res1.data as Chapter
          if (c.id === other.id) return res2.data as Chapter
          return c
        })
      )
    }
  }

  async function handleTickClick(chapter: Chapter, tickIndex: number) {
    // tickIndex is 0, 1, or 2 representing the 1st, 2nd, 3rd tick.
    const targetLevel = tickIndex + 1
    const newLevel = chapter.progress_level >= targetLevel ? tickIndex : targetLevel

    const { data, error } = await supabase
      .from('chapters')
      .update({ progress_level: newLevel })
      .eq('id', chapter.id)
      .select()
      .single()

    if (!error && data) {
      onChapterUpdate(data as Chapter)
    }
  }

  return (
    <div className="rounded border border-line bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="font-medium text-ink-900">{subject.name}</span>
          <span className="ml-2 text-xs text-ink-500">
            {completed}/{chapters.length} completed
          </span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onToggle} className="text-xs text-ink-500 hover:text-accent-600">
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={onDeleteSubject} className="text-xs text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line px-4 py-3">
          <ErrorMessage message={localError} />

          {chapters.length === 0 ? (
            <EmptyState message="No chapters yet." />
          ) : (
            <ul className="mb-3 divide-y divide-line">
              {chapters
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((chapter, idx, arr) => {
                  const examInfo = examInfoByChapter[chapter.id]
                  return (
                    <li key={chapter.id} className="flex flex-col gap-1 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-2">
                          <button
                            onClick={() => handleMove(chapter, -1)}
                            disabled={idx === 0}
                            className="text-ink-300 hover:text-ink-700 disabled:opacity-30"
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMove(chapter, 1)}
                            disabled={idx === arr.length - 1}
                            className="text-ink-300 hover:text-ink-700 disabled:opacity-30"
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <input
                            defaultValue={chapter.name}
                            onBlur={(e) => handleRename(chapter, e.target.value)}
                            className="w-full min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-ink-900 hover:border-line focus:border-accent focus:outline-none"
                          />
                        </div>

                        <TickGroup
                          progressLevel={chapter.progress_level}
                          onTickClick={(i) => handleTickClick(chapter, i)}
                        />

                        <button
                          onClick={() => handleDeleteChapter(chapter)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                      {examInfo && (
                        <p className="pl-12 text-xs text-ink-500">
                          Latest exam: {examInfo.examName} — Score:{' '}
                          {examInfo.marksScored ?? '—'}/{examInfo.marksPossible ?? '—'}
                        </p>
                      )}
                    </li>
                  )
                })}
            </ul>
          )}

          <form onSubmit={handleAddSingle} className="mb-2 flex gap-2">
            <input
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Add a single chapter"
              className="flex-1 rounded border border-line px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded border border-line px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-900/5"
            >
              Add
            </button>
          </form>

          {!showBulk ? (
            <button
              onClick={() => setShowBulk(true)}
              className="text-sm text-accent-600 hover:underline"
            >
              Paste a list of chapters
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'One chapter per line, e.g.\nKinematics\nLaws of Motion\nWork Energy and Power'}
                rows={5}
                className="w-full rounded border border-line px-2 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSave}
                  disabled={savingBulk || !bulkText.trim()}
                  className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
                >
                  {savingBulk ? 'Saving…' : 'Save chapters'}
                </button>
                <button
                  onClick={() => {
                    setShowBulk(false)
                    setBulkText('')
                  }}
                  className="rounded border border-line px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-900/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TickGroup({
  progressLevel,
  onTickClick,
}: {
  progressLevel: number
  onTickClick: (tickIndex: number) => void
}) {
  const labels = ['Completed', 'Revised', 'Perfected']
  return (
    <div className="flex shrink-0 items-center gap-1">
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          onClick={() => onTickClick(i)}
          title={labels[i]}
          className={`flex h-6 w-6 items-center justify-center rounded border text-xs font-medium transition-colors ${
            progressLevel >= i + 1
              ? 'border-accent-500 bg-accent-500 text-white'
              : 'border-line bg-white text-ink-300'
          }`}
        >
          ✓
        </button>
      ))}
    </div>
  )
}
