import { AblyClientProvider } from './components/ably-provider';
import GameDashboard from './components/game';

function App() {
  return (
    <AblyClientProvider>
      <GameDashboard />
    </AblyClientProvider>
  );
}

export default App;