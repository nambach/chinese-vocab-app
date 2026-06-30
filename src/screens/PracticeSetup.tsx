import { useState } from 'react'
import { QUIZ_DIRECTIONS } from '../practice/directions'
import { ORDER_STRATEGIES } from '../practice/orderStrategies'
import { TIMER_STRATEGIES } from '../practice/timerStrategies'
import { BigButton, Card, OptionButton, ScreenShell } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import type { PracticeConfig } from '../practice/session'

type PracticeSetupProps = {
  catalogId: string
}

export function PracticeSetup({ catalogId }: PracticeSetupProps) {
  const { setView, startPractice, defaultPracticeConfig } = useApp()
  const catalog = useCatalog(catalogId)
  const [config, setConfig] = useState<PracticeConfig>(defaultPracticeConfig())

  if (!catalog) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Bộ sưu tập không tồn tại.</Card>
      </ScreenShell>
    )
  }

  function handleStart() {
    const sessionId = startPractice(catalogId, config)
    if (!sessionId) return
    setView({ name: 'practicePlay', sessionId })
  }

  return (
    <ScreenShell
      title="Luyện tập"
      subtitle={`${catalog.name} · ${catalog.words.length} từ`}
      onBack={() => setView({ name: 'catalog', catalogId })}
    >
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-teal-900">Loại dịch</h2>
        <div className="grid gap-2">
          {QUIZ_DIRECTIONS.map((direction) => (
            <OptionButton
              key={direction.id}
              selected={config.directionId === direction.id}
              label={direction.label}
              description={direction.description}
              onClick={() => setConfig((current) => ({ ...current, directionId: direction.id }))}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-teal-900">Thứ tự</h2>
        <div className="grid gap-2">
          {ORDER_STRATEGIES.map((strategy) => (
            <OptionButton
              key={strategy.id}
              selected={config.orderId === strategy.id}
              label={strategy.label}
              onClick={() => setConfig((current) => ({ ...current, orderId: strategy.id }))}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-teal-900">Thời gian</h2>
        <div className="grid gap-2">
          {TIMER_STRATEGIES.map((strategy) => (
            <OptionButton
              key={strategy.id}
              selected={config.timerId === strategy.id}
              label={strategy.label}
              description={strategy.description}
              onClick={() =>
                setConfig((current) => ({
                  ...current,
                  timerId: strategy.id,
                  timerSeconds: strategy.defaultSeconds ?? current.timerSeconds,
                }))
              }
            />
          ))}
        </div>

        {config.timerId !== 'untimed' ? (
          <label className="mt-2 flex flex-col gap-2">
            <span className="text-sm font-medium text-teal-800">Giây</span>
            <input
              type="number"
              min={5}
              max={600}
              value={config.timerSeconds}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  timerSeconds: Number(event.target.value) || current.timerSeconds,
                }))
              }
              className="rounded-2xl border border-teal-200 px-4 py-3 text-lg outline-none focus:border-teal-500"
            />
          </label>
        ) : null}
      </Card>

      <BigButton onClick={handleStart} disabled={catalog.words.length === 0}>
        Bắt đầu
      </BigButton>
    </ScreenShell>
  )
}
