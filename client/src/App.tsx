import { AblyClientProvider } from './components/ably-provider';
import GameDashboard from './components/game';
import { DemoBanner } from './components/demo-banner';

function App() {
  return (
    <AblyClientProvider>
      <div className="min-h-screen flex flex-col">
        <DemoBanner />
        <div className="flex-1">
          <GameDashboard />
        </div>
      </div>
    </AblyClientProvider>
  );
}

export default App;