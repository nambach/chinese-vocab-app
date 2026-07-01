import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  addWordToCatalog,
  createCatalog,
  createId,
  createWord,
  deleteCatalog,
  deleteWordFromCatalog,
  loadState,
  moveWordInCatalog,
  saveState,
  setCatalogLastResult,
  updateSettings,
  updateWordInCatalog,
  upsertCatalog,
} from '../data/store'
import { importCatalogFromText } from '../lib/txt'
import { parseHash, serializeView } from '../lib/router'
import { trackPageView } from '../lib/analytics'
import {
  createPracticeSession,
  defaultPracticeConfig,
  type PracticeConfig,
  type PracticeSessionInput,
  type PracticeSessionSnapshot,
} from '../practice/session'
import type {
  AppState,
  Catalog,
  PracticeResult,
  QuickSuite,
  Settings,
  View,
  Word,
  WordDraft,
} from '../models/types'

type AppContextValue = {
  state: AppState
  view: View
  sessions: Record<string, PracticeSessionSnapshot>
  quickSuite: QuickSuite | null
  setQuickSuite: (suite: QuickSuite | null) => void
  setView: (view: View, opts?: { replace?: boolean }) => void
  goBack: (fallback: View) => void
  addCatalog: (name: string) => Catalog
  createCollection: (name: string, words: WordDraft[]) => Catalog
  importCatalog: (text: string, fallbackName?: string) => { catalog: Catalog; errors: string[] }
  updateCatalog: (catalog: Catalog) => void
  removeCatalog: (catalogId: string) => void
  addWord: (catalogId: string, draft: WordDraft) => void
  updateWord: (catalogId: string, word: Word) => void
  removeWord: (catalogId: string, wordId: string) => void
  moveWord: (catalogId: string, wordId: string, direction: 'up' | 'down') => void
  patchSettings: (patch: Partial<Settings>) => void
  recordPracticeResult: (catalogId: string, result: Omit<PracticeResult, 'id'>) => void
  startPractice: (input: PracticeSessionInput) => string | null
  getSession: (sessionId: string) => PracticeSessionSnapshot | undefined
  updateSession: (
    sessionId: string,
    updater: (session: PracticeSessionSnapshot) => PracticeSessionSnapshot,
  ) => void
  defaultPracticeConfig: () => PracticeConfig
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [view, setViewState] = useState<View>(() => parseHash(window.location.hash))
  const [sessions, setSessions] = useState<Record<string, PracticeSessionSnapshot>>({})
  const [quickSuite, setQuickSuite] = useState<QuickSuite | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', serializeView({ name: 'home' }))
    }
    const onHashChange = () => setViewState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    trackPageView(window.location.hash || '#/')
  }, [view])

  const setView = useCallback((next: View, opts?: { replace?: boolean }) => {
    const hash = serializeView(next)
    if (opts?.replace) {
      window.history.replaceState(null, '', hash)
      setViewState(next)
      return
    }
    if (hash === window.location.hash || (hash === '#/' && !window.location.hash)) {
      setViewState(next)
    } else {
      window.location.hash = hash
    }
  }, [])

  const goBack = useCallback(
    (fallback: View) => {
      setView(fallback)
    },
    [setView],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      view,
      sessions,
      quickSuite,
      setQuickSuite,
      setView,
      goBack,
      addCatalog: (name) => {
        const catalog = createCatalog(name)
        setState((current) => upsertCatalog(current, catalog))
        return catalog
      },
      createCollection: (name, words) => {
        const catalog = createCatalog(name)
        catalog.words = words.map((word) => createWord(word))
        setState((current) => upsertCatalog(current, catalog))
        return catalog
      },
      importCatalog: (text, fallbackName) => {
        const { catalog, errors } = importCatalogFromText(text, fallbackName)
        setState((current) => upsertCatalog(current, catalog))
        return { catalog, errors }
      },
      updateCatalog: (catalog) => {
        setState((current) =>
          upsertCatalog(current, { ...catalog, updatedAt: Date.now() }),
        )
      },
      removeCatalog: (catalogId) => {
        setState((current) => deleteCatalog(current, catalogId))
        if ('catalogId' in view && view.catalogId === catalogId) {
          setView({ name: 'home' })
        }
      },
      addWord: (catalogId, draft) => {
        setState((current) => addWordToCatalog(current, catalogId, draft))
      },
      updateWord: (catalogId, word) => {
        setState((current) => updateWordInCatalog(current, catalogId, word))
      },
      removeWord: (catalogId, wordId) => {
        setState((current) => deleteWordFromCatalog(current, catalogId, wordId))
      },
      moveWord: (catalogId, wordId, direction) => {
        setState((current) => moveWordInCatalog(current, catalogId, wordId, direction))
      },
      patchSettings: (patch) => {
        setState((current) => updateSettings(current, patch))
      },
      recordPracticeResult: (catalogId, result) => {
        setState((current) => setCatalogLastResult(current, catalogId, result))
      },
      startPractice: (input) => {
        const sessionId = createId()
        const session = createPracticeSession(sessionId, input)
        if (!session) return null

        setSessions((current) => ({ ...current, [sessionId]: session }))
        return sessionId
      },
      getSession: (sessionId) => sessions[sessionId],
      updateSession: (sessionId, updater) => {
        setSessions((current) => {
          const existing = current[sessionId]
          if (!existing) return current
          return { ...current, [sessionId]: updater(existing) }
        })
      },
      defaultPracticeConfig,
    }),
    [state, view, sessions, quickSuite, setView, goBack],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

export function useCatalog(catalogId: string): Catalog | undefined {
  const { state } = useApp()
  return state.catalogs.find((catalog) => catalog.id === catalogId)
}
