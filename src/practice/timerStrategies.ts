export type TimerStrategyId = 'untimed' | 'timed-per-word' | 'timed-session'

export type TimerStrategy = {
  id: TimerStrategyId
  label: string
  description: string
  defaultSeconds?: number
}

export const TIMER_STRATEGIES: TimerStrategy[] = [
  {
    id: 'untimed',
    label: 'Không giới hạn',
    description: 'Luyện tập thoải mái, không đếm thời gian',
  },
  {
    id: 'timed-per-word',
    label: 'Giới hạn mỗi từ',
    description: 'Mỗi từ có thời gian riêng',
    defaultSeconds: 15,
  },
  {
    id: 'timed-session',
    label: 'Giới hạn cả phiên',
    description: 'Toàn bộ phiên luyện tập có thời gian chung',
    defaultSeconds: 120,
  },
]

export function getTimerStrategy(id: TimerStrategyId): TimerStrategy {
  const strategy = TIMER_STRATEGIES.find((item) => item.id === id)
  if (!strategy) {
    throw new Error(`Unknown timer strategy: ${id}`)
  }
  return strategy
}

export function getTimerDeadline(
  strategyId: TimerStrategyId,
  startedAt: number,
  timerSeconds: number,
  wordStartedAt?: number,
): number | undefined {
  if (strategyId === 'untimed') return undefined
  if (strategyId === 'timed-per-word') {
    return (wordStartedAt ?? startedAt) + timerSeconds * 1000
  }
  return startedAt + timerSeconds * 1000
}
