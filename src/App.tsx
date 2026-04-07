import { BrowserRouter, Routes, Route } from 'react-router-dom';

const IframePage = ({ src, title }: { src: string; title: string }) => (
  <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', background: '#002843' }}>
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title={title}
      allow="autoplay"
    />
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IframePage src="/game/index.html" title="Benji Pays: Invoice Rover" />} />
        <Route path="/game" element={<IframePage src="/game/index.html" title="Benji Pays: Invoice Rover" />} />
        <Route path="/leaderboard" element={<IframePage src="/leaderboard/index.html" title="Leaderboard" />} />
        <Route path="/admin" element={<IframePage src="/admin/index.html" title="Admin Panel" />} />
        <Route path="/strategy" element={<IframePage src="/strategy/index.html" title="Strategy" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
