import { useState } from 'react'
import { QUIZ_DIRECTIONS } from '../practice/directions'
import { ORDER_STRATEGIES } from '../practice/orderStrategies'
import { TIMER_STRATEGIES } from '../practice/timerStrategies'
import { BigButton, Card, ScreenShell, Select } from '../components/ui'
import { useApp, useCatalog } from '../context/AppContext'
import type { PracticeConfig } from '../practice/session'

type PracticeSetupProps = {
  catalogId?: string
}

export function PracticeSetup({ catalogId }: PracticeSetupProps) {
  const { setView, startPractice, defaultPracticeConfig, quickSuite } = useApp()
  const catalog = useCatalog(catalogId ?? '')
  const [config, setConfig] = useState<PracticeConfig>(defaultPracticeConfig())

  const source = catalogId
    ? catalog
      ? { title: catalog.name, words: catalog.words, catalogId }
      : null
    : quickSuite
      ? { title: quickSuite.title, words: quickSuite.words, catalogId: undefined }
      : null

  const backView = () =>
    setView(catalogId ? { name: 'catalog', catalogId } : { name: 'quickPractice' })

  if (!source) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Không có dữ liệu để luyện tập.</Card>
      </ScreenShell>
    )
  }

  const activeSource = source

  function handleStart() {
    const sessionId = startPractice({
      title: activeSource.title,
      words: activeSource.words,
      config,
      catalogId: activeSource.catalogId,
    })
    if (!sessionId) return
    setView({ name: 'practicePlay', sessionId })
  }

  return (
    <ScreenShell
      title="Luyện tập"
      subtitle={`${activeSource.title} · ${activeSource.words.length} từ`}
      onBack={backView}
    >
      <Card className="space-y-4">
        <Select
          label="Loại dịch"
          value={config.directionId}
          options={QUIZ_DIRECTIONS.map((direction) => ({
            value: direction.id,
            label: direction.label,
          }))}
          onChange={(value) =>
            setConfig((current) => ({ ...current, directionId: value as PracticeConfig['directionId'] }))
          }
        />

        <Select
          label="Thứ tự"
          value={config.orderId}
          options={ORDER_STRATEGIES.map((strategy) => ({
            value: strategy.id,
            label: strategy.label,
          }))}
          onChange={(value) =>
            setConfig((current) => ({ ...current, orderId: value as PracticeConfig['orderId'] }))
          }
        />

        <Select
          label="Thời gian"
          value={config.timerId}
          options={TIMER_STRATEGIES.map((strategy) => ({
            value: strategy.id,
            label: strategy.label,
          }))}
          onChange={(value) => {
            const strategy = TIMER_STRATEGIES.find((item) => item.id === value)
            setConfig((current) => ({
              ...current,
              timerId: value as PracticeConfig['timerId'],
              timerSeconds: strategy?.defaultSeconds ?? current.timerSeconds,
            }))
          }}
        />

        {config.timerId !== 'untimed' ? (
          <label className="flex flex-col gap-2">
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

      <BigButton onClick={handleStart} disabled={activeSource.words.length === 0}>
        Bắt đầu
      </BigButton>
    </ScreenShell>
  )
}
