import { AppProvider, useApp } from './context/AppContext'
import { CatalogScreen } from './screens/Catalog'
import { CombinePractice } from './screens/CombinePractice'
import { CreateCollection } from './screens/CreateCollection'
import { EditWord } from './screens/EditWord'
import { GuidedAdd } from './screens/GuidedAdd'
import { Home } from './screens/Home'
import { ManageWords } from './screens/ManageWords'
import { PracticeHistory } from './screens/PracticeHistory'
import { PracticePlay } from './screens/PracticePlay'
import { PracticeSetup } from './screens/PracticeSetup'
import { QuickPractice } from './screens/QuickPractice'
import { Results } from './screens/Results'
import { Settings } from './screens/Settings'
import { Study } from './screens/Study'

function Router() {
  const { view } = useApp()

  switch (view.name) {
    case 'settings':
      return <Settings />
    case 'quickPractice':
      return <QuickPractice />
    case 'combinePractice':
      return <CombinePractice />
    case 'createCollection':
      return <CreateCollection />
    case 'catalog':
      return <CatalogScreen catalogId={view.catalogId} />
    case 'practiceHistory':
      return <PracticeHistory catalogId={view.catalogId} />
    case 'guidedAdd':
      return <GuidedAdd catalogId={view.catalogId} />
    case 'study':
      return <Study catalogId={view.catalogId} wordIndex={view.wordIndex} />
    case 'manageWords':
      return <ManageWords catalogId={view.catalogId} />
    case 'editWord':
      return <EditWord catalogId={view.catalogId} wordId={view.wordId} />
    case 'practiceSetup':
      return <PracticeSetup catalogId={view.catalogId} />
    case 'practicePlay':
      return <PracticePlay sessionId={view.sessionId} />
    case 'results':
      return <Results sessionId={view.sessionId} />
    case 'home':
    default:
      return <Home />
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-dvh bg-teal-100 md:flex md:justify-center md:px-4 md:py-6 lg:px-8 lg:py-8">
        <div className="flex min-h-dvh w-full flex-col md:min-h-[calc(100dvh-3rem)] md:max-w-2xl md:overflow-hidden md:rounded-3xl md:shadow-xl md:ring-1 md:ring-teal-200/80 lg:max-w-4xl">
          <Router />
        </div>
      </div>
    </AppProvider>
  )
}
