import { useState, useEffect } from 'react';
import { seedStarterSongs } from './db/database';
import Navigation from './components/Navigation';
import SongsView from './views/SongsView';
import MetronomeView from './views/MetronomeView';
import TunerView from './views/TunerView';
import ProgressView from './views/ProgressView';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('songs');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await seedStarterSongs();
      setIsLoading(false);
    }
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main-content">
        {activeTab === 'tuner' && <TunerView />}
        {activeTab === 'metronome' && <MetronomeView />}
        {activeTab === 'songs' && <SongsView />}
        {activeTab === 'progress' && <ProgressView />}
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
