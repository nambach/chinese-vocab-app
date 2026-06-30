import type { Word } from '../models/types'

export type OrderStrategyId = 'sequential' | 'random'

export type OrderStrategy = {
  id: OrderStrategyId
  label: string
  orderWords: (words: Word[]) => Word[]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const ORDER_STRATEGIES: OrderStrategy[] = [
  {
    id: 'sequential',
    label: 'Theo thứ tự',
    orderWords: (words) => [...words],
  },
  {
    id: 'random',
    label: 'Ngẫu nhiên',
    orderWords: (words) => shuffle(words),
  },
]

export function getOrderStrategy(id: OrderStrategyId): OrderStrategy {
  const strategy = ORDER_STRATEGIES.find((item) => item.id === id)
  if (!strategy) {
    throw new Error(`Unknown order strategy: ${id}`)
  }
  return strategy
}
