import { getDirection, type QuizDirectionId } from './directions'
import { getOrderStrategy, type OrderStrategyId } from './orderStrategies'
import {
  getTimerDeadline,
  getTimerStrategy,
  type TimerStrategyId,
} from './timerStrategies'
import type { Word } from '../models/types'

export type PracticeConfig = {
  directionId: QuizDirectionId
  orderId: OrderStrategyId
  timerId: TimerStrategyId
  timerSeconds: number
}

export type PracticeAttempt = {
  wordId: string
  userAnswer: string
  correct: boolean
  timedOut: boolean
}

export type PracticeSessionSnapshot = {
  id: string
  title: string
  catalogId?: string
  config: PracticeConfig
  words: Word[]
  currentIndex: number
  attempts: PracticeAttempt[]
  startedAt: number
  wordStartedAt: number
  finishedAt?: number
  showingFeedback: boolean
  feedbackStartedAt?: number
  lastAttempt?: PracticeAttempt
}

export type PracticeSessionInput = {
  title: string
  words: Word[]
  config: PracticeConfig
  catalogId?: string
}

export function createPracticeSession(
  sessionId: string,
  input: PracticeSessionInput,
): PracticeSessionSnapshot | null {
  if (input.words.length === 0) {
    return null
  }

  const orderStrategy = getOrderStrategy(input.config.orderId)
  const now = Date.now()

  return {
    id: sessionId,
    title: input.title,
    catalogId: input.catalogId,
    config: input.config,
    words: orderStrategy.orderWords(input.words),
    currentIndex: 0,
    attempts: [],
    startedAt: now,
    wordStartedAt: now,
    showingFeedback: false,
  }
}

export function getCurrentWord(session: PracticeSessionSnapshot): Word | undefined {
  return session.words[session.currentIndex]
}

export function getProgress(session: PracticeSessionSnapshot): {
  current: number
  total: number
} {
  return {
    current: Math.min(session.currentIndex + 1, session.words.length),
    total: session.words.length,
  }
}

export function getScore(session: PracticeSessionSnapshot): {
  correct: number
  total: number
} {
  const total = session.attempts.length
  const correct = session.attempts.filter((attempt) => attempt.correct).length
  return { correct, total }
}

export function getDeadline(session: PracticeSessionSnapshot): number | undefined {
  return getTimerDeadline(
    session.config.timerId,
    session.startedAt,
    session.config.timerSeconds,
    session.wordStartedAt,
  )
}

export function getTimerTotalMs(session: PracticeSessionSnapshot): number | undefined {
  if (session.config.timerId === 'untimed') {
    return undefined
  }
  return session.config.timerSeconds * 1000
}

export function getRemainingMs(
  session: PracticeSessionSnapshot,
  now = Date.now(),
): number | undefined {
  const deadline = getDeadline(session)
  if (deadline === undefined) {
    return undefined
  }

  // Freeze the per-word countdown once the user has answered (feedback shown),
  // so it stops the moment they finish the word.
  const reference =
    session.config.timerId === 'timed-per-word' &&
    session.showingFeedback &&
    session.feedbackStartedAt !== undefined
      ? session.feedbackStartedAt
      : now

  return Math.max(0, deadline - reference)
}

export function isSessionTimedOut(session: PracticeSessionSnapshot, now = Date.now()): boolean {
  const deadline = getDeadline(session)
  return deadline !== undefined && now >= deadline && !session.showingFeedback
}

export function submitAnswer(
  session: PracticeSessionSnapshot,
  userAnswer: string,
  timedOut = false,
): PracticeSessionSnapshot {
  const word = getCurrentWord(session)
  if (!word || session.showingFeedback || session.finishedAt) {
    return session
  }

  const direction = getDirection(session.config.directionId)
  const trimmed = userAnswer.trim()
  const correct = !timedOut && direction.checkAnswer(word, trimmed)
  const attempt: PracticeAttempt = {
    wordId: word.id,
    userAnswer: trimmed,
    correct,
    timedOut,
  }

  return {
    ...session,
    showingFeedback: true,
    feedbackStartedAt: Date.now(),
    lastAttempt: attempt,
    attempts: [...session.attempts, attempt],
  }
}

export function advanceSession(session: PracticeSessionSnapshot): PracticeSessionSnapshot {
  if (!session.showingFeedback || session.finishedAt) {
    return session
  }

  const nextIndex = session.currentIndex + 1
  if (nextIndex >= session.words.length) {
    return {
      ...session,
      currentIndex: nextIndex,
      finishedAt: Date.now(),
      showingFeedback: false,
      feedbackStartedAt: undefined,
      lastAttempt: undefined,
    }
  }

  const now = Date.now()
  return {
    ...session,
    currentIndex: nextIndex,
    wordStartedAt: now,
    showingFeedback: false,
    feedbackStartedAt: undefined,
    lastAttempt: undefined,
  }
}

export function getAnsweredCount(session: PracticeSessionSnapshot): number {
  return session.attempts.length
}

export function endSession(session: PracticeSessionSnapshot): PracticeSessionSnapshot {
  if (session.finishedAt) {
    return session
  }
  return {
    ...session,
    finishedAt: Date.now(),
    showingFeedback: false,
    feedbackStartedAt: undefined,
    lastAttempt: undefined,
  }
}

export function getWrongWordIds(session: PracticeSessionSnapshot): string[] {
  return session.attempts.filter((attempt) => !attempt.correct).map((attempt) => attempt.wordId)
}

export function getWrongWords(session: PracticeSessionSnapshot): Word[] {
  const wrongIds = new Set(getWrongWordIds(session))
  return session.words.filter((word) => wrongIds.has(word.id))
}

export function defaultPracticeConfig(): PracticeConfig {
  const timerStrategy = getTimerStrategy('timed-per-word')
  return {
    directionId: 'hanzi-to-pinyin',
    orderId: 'random',
    timerId: timerStrategy.id,
    timerSeconds: timerStrategy.defaultSeconds ?? 15,
  }
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
