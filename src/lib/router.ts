import type { View } from '../models/types'

function decodePart(value: string | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Hash-based routing so the app works on static hosting (GitHub Pages) and
// survives refresh / browser back-forward without server rewrites.

export function serializeView(view: View): string {
  switch (view.name) {
    case 'home':
      return '#/'
    case 'search':
      return '#/search'
    case 'settings':
      return '#/settings'
    case 'quickPractice':
      return '#/quick'
    case 'combinePractice':
      return '#/combine'
    case 'createCollection':
      return '#/create'
    case 'catalog':
      if (view.focus && 'segmentId' in view.focus) {
        return `#/c/${view.catalogId}/at/${encodeURIComponent(view.focus.segmentId)}`
      }
      if (view.focus && 'wordId' in view.focus) {
        return `#/c/${view.catalogId}/word/${encodeURIComponent(view.focus.wordId)}`
      }
      return `#/c/${view.catalogId}`
    case 'practiceHistory':
      return `#/c/${view.catalogId}/history`
    case 'guidedAdd':
      return `#/c/${view.catalogId}/add`
    case 'study':
      return view.wordIndex !== undefined
        ? `#/c/${view.catalogId}/study/${view.wordIndex}`
        : `#/c/${view.catalogId}/study`
    case 'manageWords':
      return `#/c/${view.catalogId}/words`
    case 'editWord':
      return `#/c/${view.catalogId}/words/${view.wordId}`
    case 'practiceSetup':
      return view.catalogId ? `#/c/${view.catalogId}/setup` : '#/setup'
    case 'practicePlay':
      return `#/play/${view.sessionId}`
    case 'results':
      return `#/results/${view.sessionId}`
    case 'shadowingList':
      return '#/shadow'
    case 'editKewen':
      return view.segmentId
        ? `#/c/${view.catalogId}/kewen/${view.segmentId}`
        : `#/c/${view.catalogId}/kewen`
  }
}

export function parseHash(hash: string): View {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'home' }

  switch (parts[0]) {
    case 'search':
      return { name: 'search' }
    case 'settings':
      return { name: 'settings' }
    case 'quick':
      return { name: 'quickPractice' }
    case 'combine':
      return { name: 'combinePractice' }
    case 'create':
      return { name: 'createCollection' }
    case 'setup':
      return { name: 'practiceSetup' }
    case 'play':
      return parts[1] ? { name: 'practicePlay', sessionId: parts[1] } : { name: 'home' }
    case 'results':
      return parts[1] ? { name: 'results', sessionId: parts[1] } : { name: 'home' }
    case 'shadow':
      return { name: 'shadowingList' }
    case 'c': {
      const catalogId = parts[1]
      if (!catalogId) return { name: 'home' }
      const sub = parts[2]
      if (!sub) return { name: 'catalog', catalogId }
      if (sub === 'add') return { name: 'guidedAdd', catalogId }
      if (sub === 'study') {
        const wordIndex = parts[3] !== undefined ? Number(parts[3]) : undefined
        return {
          name: 'study',
          catalogId,
          wordIndex: Number.isFinite(wordIndex) ? wordIndex : undefined,
        }
      }
      if (sub === 'setup') return { name: 'practiceSetup', catalogId }
      if (sub === 'history') return { name: 'practiceHistory', catalogId }
      if (sub === 'words') {
        const wordId = parts[3]
        return wordId
          ? { name: 'editWord', catalogId, wordId }
          : { name: 'manageWords', catalogId }
      }
      if (sub === 'word') {
        const wordId = decodePart(parts[3])
        return wordId ? { name: 'catalog', catalogId, focus: { wordId } } : { name: 'catalog', catalogId }
      }
      if (sub === 'at') {
        const segmentId = decodePart(parts[3])
        return segmentId
          ? { name: 'catalog', catalogId, focus: { segmentId } }
          : { name: 'catalog', catalogId }
      }
      if (sub === 'kewen') {
        const segmentId = parts[3]
        return segmentId
          ? { name: 'editKewen', catalogId, segmentId }
          : { name: 'editKewen', catalogId }
      }
      return { name: 'catalog', catalogId }
    }
    default:
      return { name: 'home' }
  }
}
