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
  const { state, setView, goBack, startPractice, patchSettings, quickSuite } = useApp()
  const catalog = useCatalog(catalogId ?? '')
  const [config, setConfig] = useState<PracticeConfig>(() => state.settings.practiceConfig)

  function updateConfig(updater: (current: PracticeConfig) => PracticeConfig) {
    setConfig((current) => {
      const next = updater(current)
      patchSettings({ practiceConfig: next })
      return next
    })
  }

  const source = catalogId
    ? catalog
      ? { title: catalog.name, words: catalog.words, catalogId }
      : null
    : quickSuite
      ? { title: quickSuite.title, words: quickSuite.words, catalogId: undefined }
      : null

  const backView = () =>
    goBack(catalogId ? { name: 'catalog', catalogId } : { name: 'quickPractice' })

  if (!source) {
    return (
      <ScreenShell title="Không tìm thấy" onBack={() => setView({ name: 'home' })}>
        <Card className="text-center text-teal-700">Không có dữ liệu để luyện tập.</Card>
      </ScreenShell>
    )
  }

  const activeSource = source

  function handleStart() {
    patchSettings({ practiceConfig: config })

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
      <Card className="grid gap-4 md:grid-cols-2">
        <Select
          label="Loại dịch"
          value={config.directionId}
          options={QUIZ_DIRECTIONS.map((direction) => ({
            value: direction.id,
            label: direction.label,
          }))}
          onChange={(value) =>
            updateConfig((current) => ({
              ...current,
              directionId: value as PracticeConfig['directionId'],
            }))
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
            updateConfig((current) => ({ ...current, orderId: value as PracticeConfig['orderId'] }))
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
            updateConfig((current) => ({
              ...current,
              timerId: value as PracticeConfig['timerId'],
              timerSeconds: strategy?.defaultSeconds ?? current.timerSeconds,
            }))
          }}
        />

        {config.timerId !== 'untimed' ? (
          <label className="flex flex-col gap-2 md:col-span-2 md:max-w-xs">
            <span className="text-sm font-medium text-teal-800">Giây</span>
            <input
              type="number"
              min={5}
              max={600}
              value={config.timerSeconds}
              onChange={(event) =>
                updateConfig((current) => ({
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
