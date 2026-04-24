import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GamePage } from './pages/GamePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/AdminPage';
import { StrategyEmbedPage } from './pages/StrategyEmbedPage';
import { NavigationMessageBridge } from './components/NavigationMessageBridge';
import { LovableOauthRedirect } from './components/LovableOauthRedirect';

const App = () => {
  return (
    <BrowserRouter>
      <NavigationMessageBridge />
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/~oauth/*" element={<LovableOauthRedirect />} />
        <Route path="/strategy" element={<StrategyEmbedPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
