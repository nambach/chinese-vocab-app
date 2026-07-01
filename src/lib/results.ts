import { findDirection } from '../practice/directions'
import { formatDuration } from '../practice/session'
import type { PracticeResult } from '../models/types'

export function resultPercent(result: PracticeResult): number {
  if (result.total === 0) return 0
  return Math.round((result.correct / result.total) * 100)
}

export function resultDirectionLabel(result: PracticeResult): string {
  return findDirection(result.directionId)?.label ?? 'Luyện tập'
}

export function resultDurationLabel(result: PracticeResult): string {
  return formatDuration(result.durationMs)
}

export function formatResultDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function resultScoreTone(result: PracticeResult): 'good' | 'ok' | 'low' {
  const percent = resultPercent(result)
  if (percent >= 80) return 'good'
  if (percent >= 50) return 'ok'
  return 'low'
}
