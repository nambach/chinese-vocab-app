import { useEffect, useMemo, useRef } from 'react'
import { getScore, getWrongWords, formatDuration } from '../practice/session'
import { BigButton, Card, ScreenShell } from '../components/ui'
import { useApp } from '../context/AppContext'

type ResultsProps = {
  sessionId: string
}

export function Results({ sessionId }: ResultsProps) {
  const { state, setView, getSession, startPractice, recordPracticeResult } = useApp()
  const session = getSession(sessionId)
  const recordedRef = useRef(false)

  const wrongWords = useMemo(() => (session ? getWrongWords(session) : []), [session])

  const nextCombineCatalog = useMemo(() => {
    if (!session?.combineQueue) return undefined
    const nextIndex = session.combineQueue.index + 1
    if (nextIndex >= session.combineQueue.catalogIds.length) return undefined
    const nextCatalogId = session.combineQueue.catalogIds[nextIndex]
    return state.catalogs.find((catalog) => catalog.id === nextCatalogId)
  }, [session, state.catalogs])

  const combineProgress =
    session?.combineQueue && session.combineQueue.catalogIds.length > 1
      ? ` · Bài ${session.combineQueue.index + 1}/${session.combineQueue.catalogIds.length}`
      : ''

  useEffect(() => {
    if (recordedRef.current || !session || !session.finishedAt || !session.catalogId) return
    recordedRef.current = true
    const score = getScore(session)
    recordPracticeResult(session.catalogId, {
      directionId: session.config.directionId,
      correct: score.correct,
      total: score.total,
      durationMs: session.finishedAt - session.startedAt,
      finishedAt: session.finishedAt,
    })
  }, [session, recordPracticeResult])

  if (!session) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Kết quả không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const activeSession = session
  const score = getScore(activeSession)
  const duration = formatDuration((activeSession.finishedAt ?? Date.now()) - activeSession.startedAt)

  function exit() {
    setView(
      activeSession.combineQueue
        ? { name: 'combinePractice' }
        : activeSession.catalogId
          ? { name: 'catalog', catalogId: activeSession.catalogId }
          : { name: 'home' },
    )
  }

  function continueCombine() {
    const queue = activeSession.combineQueue
    if (!queue || !nextCombineCatalog) {
      exit()
      return
    }

    const nextIndex = queue.index + 1
    const nextSessionId = startPractice({
      title: nextCombineCatalog.name,
      words: nextCombineCatalog.words,
      config: activeSession.config,
      catalogId: nextCombineCatalog.id,
      combineQueue: { ...queue, index: nextIndex },
    })
    if (nextSessionId) {
      setView({ name: 'practicePlay', sessionId: nextSessionId })
    }
  }

  function retryWrongOnly() {
    const nextSessionId = startPractice({
      title: activeSession.title,
      words: getWrongWords(activeSession),
      config: activeSession.config,
      catalogId: activeSession.catalogId,
      combineQueue: activeSession.combineQueue,
    })
    if (nextSessionId) {
      setView({ name: 'practicePlay', sessionId: nextSessionId })
    }
  }

  function retryAll() {
    const nextSessionId = startPractice({
      title: activeSession.title,
      words: activeSession.words,
      config: activeSession.config,
      catalogId: activeSession.catalogId,
      combineQueue: activeSession.combineQueue,
    })
    if (nextSessionId) {
      setView({ name: 'practicePlay', sessionId: nextSessionId })
    }
  }

  return (
    <ScreenShell
      title="Kết quả"
      subtitle={`${activeSession.title}${combineProgress}`}
      onBack={exit}
      backLabel={nextCombineCatalog ? 'Dừng' : 'Xong'}
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="text-center lg:py-8">
          <div className="text-5xl font-bold text-teal-900 md:text-6xl">
            {score.correct}/{score.total}
          </div>
          <p className="mt-2 text-teal-700">Thời gian: {duration}</p>
        </Card>

        {wrongWords.length > 0 ? (
          <Card>
            <h2 className="text-sm font-semibold text-teal-900 md:text-base">Từ chưa đúng</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
              {wrongWords.map((word) => (
                <li key={word.id} className="border-b border-teal-50 pb-3 last:border-none last:pb-0">
                  <div className="text-xl font-semibold">{word.hanzi}</div>
                  <div className="text-teal-800">{word.pinyin}</div>
                  <div className="text-sm text-teal-700">{word.meaning}</div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="flex items-center justify-center text-center text-teal-700 lg:min-h-[12rem]">
            Tuyệt vời! Bạn trả lời đúng hết.
          </Card>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {nextCombineCatalog ? (
          <BigButton onClick={continueCombine}>
            Bài tiếp theo: {nextCombineCatalog.name}
          </BigButton>
        ) : null}
        {wrongWords.length > 0 ? (
          <BigButton onClick={retryWrongOnly} variant={nextCombineCatalog ? 'secondary' : 'primary'}>
            Luyện lại từ sai
          </BigButton>
        ) : null}
        <BigButton variant="secondary" onClick={retryAll}>
          Luyện lại từ đầu
        </BigButton>
      </div>
    </ScreenShell>
  )
}
