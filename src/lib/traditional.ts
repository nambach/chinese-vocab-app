import { useEffect, useState } from 'react'
import { TRADITIONAL_OVERRIDES } from './traditional.overrides'

type GeneratedModule = typeof import('./traditional.data.generated')

let charMap: Map<string, string> | null = null
let phraseMap: Map<string, string> | null = null

let maxWindow = 3
for (const key of Object.keys(TRADITIONAL_OVERRIDES)) {
  if (key.length > maxWindow) maxWindow = key.length
}

function buildMaps(mod: GeneratedModule) {
  const cm = new Map<string, string>()
  for (let i = 0; i < mod.CHAR_KEYS.length; i++) {
    cm.set(mod.CHAR_KEYS[i], mod.CHAR_VALUES[i])
  }

  const pm = new Map<string, string>()
  if (mod.PHRASE_DATA) {
    for (const line of mod.PHRASE_DATA.split('\n')) {
      const tab = line.indexOf('\t')
      if (tab === -1) continue
      const key = line.slice(0, tab)
      pm.set(key, line.slice(tab + 1))
      if (key.length > maxWindow) maxWindow = key.length
    }
  }

  charMap = cm
  phraseMap = pm
}

let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = import('./traditional.data.generated').then((mod) => {
      buildMaps(mod)
      for (const listener of listeners) listener()
    })
  }
  return loadPromise
}

const memo = new Map<string, string>()

function convert(text: string): string {
  if (!charMap || !phraseMap) return text
  const cached = memo.get(text)
  if (cached !== undefined) return cached

  let result = ''
  let i = 0
  while (i < text.length) {
    let matched = false
    const upper = Math.min(maxWindow, text.length - i)
    for (let len = upper; len >= 1; len--) {
      const sub = text.slice(i, i + len)
      const hit =
        TRADITIONAL_OVERRIDES[sub] ?? phraseMap.get(sub) ?? (len === 1 ? charMap.get(sub) : undefined)
      if (hit !== undefined) {
        result += hit
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      result += text[i]
      i += 1
    }
  }

  memo.set(text, result)
  return result
}

/**
 * Converts simplified Chinese to Taiwan-standard traditional Chinese, via
 * longest-match lookup: manual overrides -> generated phrase table ->
 * generated character table -> left unchanged. The conversion tables are
 * dynamically imported on first call and cached; until they finish loading,
 * this returns `text` unchanged (see `useHanziVariant` for the React-facing
 * version that re-renders once loading completes).
 */
export function toTraditional(text: string): string {
  ensureLoaded()
  return convert(text)
}

/**
 * Resolves once the conversion tables have finished loading. Used to prime
 * the tables ahead of a synchronous `toTraditional` call that must not race
 * the lazy import (e.g. answer checking), and by tests.
 */
export function waitForTraditionalDataLoaded(): Promise<void> {
  return ensureLoaded()
}

/**
 * React hook returning `text` as-is for 'simplified', or its traditional
 * conversion for 'traditional'. Because the conversion tables load lazily,
 * this subscribes to the load event and re-renders once they're ready.
 */
export function useHanziVariant(variant: 'simplified' | 'traditional', text: string): string {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (variant !== 'traditional' || charMap) return undefined
    const listener = () => setTick((tick) => tick + 1)
    listeners.add(listener)
    ensureLoaded()
    return () => {
      listeners.delete(listener)
    }
  }, [variant])

  if (variant === 'simplified') return text
  return toTraditional(text)
}
