import { addDays, todayKey } from './date'

/**
 * Study streak = consecutive calendar dates (ending today, or ending at the
 * most recent logged date if today has no log yet) that have at least one
 * study log. Rest days and missing days break the streak.
 */
export function calculateStreak(loggedDateSet: Set<string>): number {
  const today = todayKey()
  let cursor = loggedDateSet.has(today) ? today : addDays(today, -1)

  // If neither today nor yesterday has a log, streak is 0.
  if (!loggedDateSet.has(cursor)) return 0

  let streak = 0
  while (loggedDateSet.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function sumHours(hours: number[]): number {
  return Math.round(hours.reduce((a, b) => a + b, 0) * 100) / 100
}
