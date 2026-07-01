import type { View } from '../models/types'

// Hash-based routing so the app works on static hosting (GitHub Pages) and
// survives refresh / browser back-forward without server rewrites.

export function serializeView(view: View): string {
  switch (view.name) {
    case 'home':
      return '#/'
    case 'settings':
      return '#/settings'
    case 'quickPractice':
      return '#/quick'
    case 'combinePractice':
      return '#/combine'
    case 'createCollection':
      return '#/create'
    case 'catalog':
      return `#/c/${view.catalogId}`
    case 'practiceHistory':
      return `#/c/${view.catalogId}/history`
    case 'guidedAdd':
      return `#/c/${view.catalogId}/add`
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
  }
}

export function parseHash(hash: string): View {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'home' }

  switch (parts[0]) {
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
    case 'c': {
      const catalogId = parts[1]
      if (!catalogId) return { name: 'home' }
      const sub = parts[2]
      if (!sub) return { name: 'catalog', catalogId }
      if (sub === 'add') return { name: 'guidedAdd', catalogId }
      if (sub === 'setup') return { name: 'practiceSetup', catalogId }
      if (sub === 'history') return { name: 'practiceHistory', catalogId }
      if (sub === 'words') {
        const wordId = parts[3]
        return wordId
          ? { name: 'editWord', catalogId, wordId }
          : { name: 'manageWords', catalogId }
      }
      return { name: 'catalog', catalogId }
    }
    default:
      return { name: 'home' }
  }
}
