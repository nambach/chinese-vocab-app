import { AppProvider, useApp } from './context/AppContext'
import { CatalogScreen } from './screens/Catalog'
import { EditWord } from './screens/EditWord'
import { GuidedAdd } from './screens/GuidedAdd'
import { Home } from './screens/Home'
import { ManageWords } from './screens/ManageWords'
import { PracticePlay } from './screens/PracticePlay'
import { PracticeSetup } from './screens/PracticeSetup'
import { Results } from './screens/Results'
import { Settings } from './screens/Settings'

function Router() {
  const { view } = useApp()

  switch (view.name) {
    case 'settings':
      return <Settings />
    case 'catalog':
      return <CatalogScreen catalogId={view.catalogId} />
    case 'guidedAdd':
      return <GuidedAdd catalogId={view.catalogId} />
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
      <Router />
    </AppProvider>
  )
}
