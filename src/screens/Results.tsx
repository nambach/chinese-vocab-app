import { useEffect, useMemo, useRef } from 'react'
import { formatDuration, getScore, getWrongWordIds } from '../practice/session'
import { BigButton, Card, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'

type ResultsProps = {
  sessionId: string
}

export function Results({ sessionId }: ResultsProps) {
  const { setView, getSession, startPractice, recordPracticeResult } = useApp()
  const session = getSession(sessionId)
  const catalog = useCatalog(session?.catalogId ?? '')
  const recordedRef = useRef(false)

  const wrongWords = useMemo(() => {
    if (!session || !catalog) return []
    const wrongIds = new Set(getWrongWordIds(session))
    return catalog.words.filter((word) => wrongIds.has(word.id))
  }, [catalog, session])

  useEffect(() => {
    if (recordedRef.current || !session || !session.finishedAt) return
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

  if (!session || !catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Kết quả không tồn tại.</Card>
      </ScreenShell>
    )
  }

  const activeSession = session

  const score = getScore(activeSession)
  const duration = formatDuration((activeSession.finishedAt ?? Date.now()) - activeSession.startedAt)

  function retryWrongOnly() {
    const wrongIds = new Set(getWrongWordIds(activeSession))
    const nextSessionId = startPractice(
      activeSession.catalogId,
      activeSession.config,
      (word) => wrongIds.has(word.id),
    )
    if (nextSessionId) {
      setView({ name: 'practicePlay', sessionId: nextSessionId })
    }
  }

  return (
    <ScreenShell
      title="Kết quả"
      subtitle={catalog.name}
      onBack={() => setView({ name: 'catalog', catalogId: catalog.id })}
      backLabel="← Về bộ sưu tập"
    >
      <Card className="text-center">
        <div className="text-5xl font-bold text-teal-900">
          {score.correct}/{score.total}
        </div>
        <p className="mt-2 text-teal-700">Thời gian: {duration}</p>
      </Card>

      {wrongWords.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-teal-900">Từ chưa đúng</h2>
          <ul className="mt-3 space-y-3">
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
        <Card className="text-center text-teal-700">Tuyệt vời! Bạn trả lời đúng hết.</Card>
      )}

      <div className="grid gap-3">
        {wrongWords.length > 0 ? (
          <BigButton onClick={retryWrongOnly}>Luyện lại từ sai</BigButton>
        ) : null}
        <BigButton
          variant="secondary"
          onClick={() => setView({ name: 'practiceSetup', catalogId: catalog.id })}
        >
          Luyện lại
        </BigButton>
      </div>
    </ScreenShell>
  )
}
