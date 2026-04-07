const App = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', background: '#002843' }}>
      <iframe
        src="/game/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title="Benji Pays: Invoice Rover"
        allow="autoplay"
      />
    </div>
  );
};

export default App;
