export type ExamType = 'exam' | 'main_exam' | 'rest_day'
export type CalendarEventType = 'exam' | 'main_exam' | 'rest_day'

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Subject {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Chapter {
  id: string
  subject_id: string
  user_id: string
  name: string
  position: number
  progress_level: 0 | 1 | 2 | 3
  created_at: string
}

export interface StudyLog {
  id: string
  user_id: string
  log_date: string
  hours: number
  notes: string | null
  created_at: string
}

export interface Exam {
  id: string
  user_id: string
  name: string
  exam_date: string
  total_marks: number | null
  exam_type: ExamType
  marks_scored: number | null
  notes: string | null
  created_at: string
}

export interface ExamChapter {
  id: string
  exam_id: string
  chapter_id: string
  marks_scored: number | null
  marks_possible: number | null
}

export interface CalendarEvent {
  id: string
  user_id: string
  event_date: string
  event_type: CalendarEventType
  title: string | null
  exam_id: string | null
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  daily_target_hours: number
  weekly_target_hours: number
  created_at: string
  updated_at: string
}

// Minimal Database type for supabase-js generics (not exhaustive Postgres codegen,
// but keeps table names / row shapes type-checked at call sites).
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      subjects: { Row: Subject; Insert: Partial<Subject>; Update: Partial<Subject> }
      chapters: { Row: Chapter; Insert: Partial<Chapter>; Update: Partial<Chapter> }
      study_logs: { Row: StudyLog; Insert: Partial<StudyLog>; Update: Partial<StudyLog> }
      exams: { Row: Exam; Insert: Partial<Exam>; Update: Partial<Exam> }
      exam_chapters: { Row: ExamChapter; Insert: Partial<ExamChapter>; Update: Partial<ExamChapter> }
      calendar_events: { Row: CalendarEvent; Insert: Partial<CalendarEvent>; Update: Partial<CalendarEvent> }
      user_settings: { Row: UserSettings; Insert: Partial<UserSettings>; Update: Partial<UserSettings> }
    }
  }
}
