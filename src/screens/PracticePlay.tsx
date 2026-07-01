import { useEffect, useState } from 'react'
import {
  advanceSession,
  endSession,
  formatDuration,
  getAnsweredCount,
  getCurrentWord,
  getProgress,
  getRemainingMs,
  getTimerTotalMs,
  isSessionTimedOut,
  submitAnswer,
} from '../practice/session'
import { findDirection, getAnswerText, getPromptText } from '../practice/directions'
import { SmartInput } from '../components/SmartInput'
import { BigButton, Card, ScreenShell } from '../components/ui'
import { useApp } from '../context/AppContext'
import { useIsTouchDevice, useVisualViewport } from '../lib/useVisualViewport'

type PracticePlayProps = {
  sessionId: string
}

export function PracticePlay({ sessionId }: PracticePlayProps) {
  const { setView, getSession, updateSession, state } = useApp()
  const session = getSession(sessionId)
  const [answer, setAnswer] = useState('')
  const [now, setNow] = useState(Date.now())
  const isTouch = useIsTouchDevice()
  const { keyboardOpen } = useVisualViewport()

  const direction = session ? findDirection(session.config.directionId) : undefined
  const currentWord = session ? getCurrentWord(session) : undefined
  const progress = session ? getProgress(session) : { current: 0, total: 0 }
  const answered = session ? getAnsweredCount(session) : 0
  const progressPercent =
    progress.total === 0 ? 0 : Math.round((answered / progress.total) * 100)
  const remainingMs = session ? getRemainingMs(session, now) : undefined
  const timerTotalMs = session ? getTimerTotalMs(session) : undefined
  const timerFraction =
    remainingMs !== undefined && timerTotalMs
      ? Math.max(0, Math.min(1, remainingMs / timerTotalMs))
      : undefined
  const timerLow = timerFraction !== undefined && timerFraction <= 0.25

  useEffect(() => {
    if (!session || session.finishedAt) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [session])

  useEffect(() => {
    if (!session || session.showingFeedback || session.finishedAt) return
    if (isSessionTimedOut(session, now)) {
      if (session.config.timerId === 'timed-session') {
        updateSession(sessionId, (current) => endSession(current))
      } else {
        updateSession(sessionId, (current) => submitAnswer(current, answer, true))
      }
    }
  }, [answer, now, session, sessionId, updateSession])

  useEffect(() => {
    if (session?.finishedAt) {
      setView({ name: 'results', sessionId }, { replace: true })
    }
  }, [session?.finishedAt, sessionId, setView])

  const exitView: () => void = () =>
    setView(session?.catalogId ? { name: 'catalog', catalogId: session.catalogId } : { name: 'home' })

  if (!session || !direction) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Phiên luyện tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  if (session.finishedAt) {
    return (
      <ScreenShell title="Hoàn thành" onBack={() => setView({ name: 'results', sessionId })}>
        <Card className="text-center text-teal-700">Đang chuyển đến kết quả...</Card>
      </ScreenShell>
    )
  }

  if (!currentWord) {
    return (
      <ScreenShell title="Hoàn thành" onBack={exitView}>
        <Card className="text-center text-teal-700">Phiên luyện tập đã kết thúc.</Card>
      </ScreenShell>
    )
  }

  const prompt = currentWord ? getPromptText(currentWord, direction.promptField) : ''
  const correctAnswer = currentWord
    ? getAnswerText(currentWord, direction.answerField)
    : ''
  const lastAttempt = session.lastAttempt
  const isPinyinAnswer = direction.answerField === 'pinyin'
  const activeSession = session
  const compact = isTouch

  function handleSubmit() {
    if (activeSession.showingFeedback) {
      updateSession(sessionId, advanceSession)
      setAnswer('')
      return
    }

    updateSession(sessionId, (current) => submitAnswer(current, answer))
  }

  const promptCard = (
    <Card
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'min-h-0 p-4' : 'min-h-[220px]'
      }`}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-teal-600">
        {direction.label}
      </p>
      <p
        className={`mt-2 font-bold text-teal-950 ${
          direction.promptField === 'hanzi'
            ? compact
              ? 'text-4xl'
              : 'text-5xl'
            : compact
              ? 'text-2xl'
              : 'text-3xl'
        }`}
      >
        {prompt}
      </p>
    </Card>
  )

  const answerInput = !session.showingFeedback ? (
    <SmartInput
      label={direction.answerLabel}
      value={answer}
      onChange={setAnswer}
      placeholder={
        direction.answerField === 'meaning'
          ? 'Một hoặc vài nghĩa, cách nhau dấu phẩy'
          : undefined
      }
      pinyin={isPinyinAnswer}
      toneNumberInput={state.settings.toneNumberInput}
      lang={direction.inputLang}
      autoFocus
      onSubmit={handleSubmit}
    />
  ) : null

  const submitButton = (
    <BigButton onClick={handleSubmit}>
      {session.showingFeedback ? 'Tiếp theo' : 'Kiểm tra'}
    </BigButton>
  )

  return (
    <ScreenShell
      title={activeSession.title}
      subtitle={`${progress.current}/${progress.total}`}
      keyboardAvoiding={isTouch}
      onBack={() => {
        if (window.confirm('Thoát phiên luyện tập?')) {
          exitView()
        }
      }}
      backLabel="Thoát"
      footer={isTouch ? undefined : submitButton}
    >
      <div className={`flex flex-col ${compact ? 'min-h-0 flex-1 gap-3' : 'gap-4'}`}>
        {!compact || !keyboardOpen ? (
          <>
            <div className="h-2 shrink-0 overflow-hidden rounded-full bg-teal-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {remainingMs !== undefined && timerFraction !== undefined ? (
              <div className="shrink-0 space-y-1">
                <div className="flex items-center justify-between text-sm font-medium text-teal-700">
                  <span>Thời gian</span>
                  <span className={timerLow ? 'text-red-600' : 'text-teal-900'}>
                    {formatDuration(remainingMs)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-teal-100">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                      timerLow ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${timerFraction * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {compact && !session.showingFeedback ? (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {promptCard}
            </div>
            <div className="shrink-0 space-y-2 overflow-y-auto">
              {answerInput}
              {!keyboardOpen ? submitButton : null}
            </div>
          </>
        ) : (
          <>
            {promptCard}
            {answerInput}
            {isTouch && !session.showingFeedback ? submitButton : null}
          </>
        )}

        {session.showingFeedback ? (
          <Card
            className={`shrink-0 text-center ${
              lastAttempt?.correct
                ? 'bg-emerald-50 ring-emerald-200'
                : 'bg-red-50 ring-red-200'
            }`}
          >
            <div
              className={`text-3xl ${lastAttempt?.correct ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {lastAttempt?.correct ? '✓' : '✗'}
            </div>
            <p
              className={`mt-2 text-lg font-semibold ${
                lastAttempt?.correct ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {lastAttempt?.correct ? 'Đúng rồi!' : 'Chưa đúng'}
            </p>
            {!lastAttempt?.correct ? (
              <div className="mt-3 space-y-1 text-red-700">
                {lastAttempt?.timedOut ? <p>Hết thời gian</p> : null}
                <p>
                  Đáp án: <span className="font-semibold text-red-900">{correctAnswer}</span>
                </p>
                {lastAttempt?.userAnswer ? (
                  <p className="text-sm text-red-600">Bạn nhập: {lastAttempt.userAnswer}</p>
                ) : null}
              </div>
            ) : null}
          </Card>
        ) : null}

        {isTouch && session.showingFeedback ? (
          <div className="shrink-0">{submitButton}</div>
        ) : null}
      </div>
    </ScreenShell>
  )
}
