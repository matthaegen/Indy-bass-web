import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity, earnMilestone } from '../db/database';
import { Play, Pause, Plus, Settings, Trash2, X, Edit3 } from 'lucide-react';

function MetronomeView() {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [beatsPerMeasure] = useState(4);
  const [showPresets, setShowPresets] = useState(false);
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);

  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const timerIdRef = useRef(null);
  const beatRef = useRef(0);

  const presets = useLiveQuery(() => db.metronomePresets.orderBy('sortOrder').toArray());

  const playClick = useCallback((time, isAccent) => {
    if (!audioContextRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();

    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);

    osc.frequency.value = isAccent ? 1000 : 800;
    gain.gain.value = isAccent ? 0.3 : 0.2;

    osc.start(time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.stop(time + 0.1);
  }, []);

  const scheduler = useCallback(() => {
    if (!audioContextRef.current) return;

    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) {
      const isAccent = beatRef.current % beatsPerMeasure === 0;
      playClick(nextNoteTimeRef.current, isAccent);

      setCurrentBeat(beatRef.current % beatsPerMeasure);
      beatRef.current++;

      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;
    }
  }, [bpm, beatsPerMeasure, playClick]);

  useEffect(() => {
    if (isPlaying) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      nextNoteTimeRef.current = audioContextRef.current.currentTime;
      beatRef.current = 0;

      timerIdRef.current = setInterval(scheduler, 25);

      logActivity('metronome');
      earnMilestone('In the Groove');
    } else {
      clearInterval(timerIdRef.current);
      setCurrentBeat(0);
    }

    return () => clearInterval(timerIdRef.current);
  }, [isPlaying, scheduler]);

  const handleBpmChange = (newBpm) => {
    setBpm(Math.max(40, Math.min(220, newBpm)));
  };

  const handleSelectPreset = (preset) => {
    setBpm(preset.bpm);
    setShowPresets(false);
  };

  if (showPresets) {
    return (
      <PresetListView
        presets={presets}
        onClose={() => setShowPresets(false)}
        onSelect={handleSelectPreset}
        onAdd={() => setShowAddPreset(true)}
        onEdit={setEditingPreset}
      />
    );
  }

  if (showAddPreset) {
    return (
      <PresetForm
        initialBpm={bpm}
        onClose={() => setShowAddPreset(false)}
        onSave={async (preset) => {
          const maxOrder = presets?.length ? Math.max(...presets.map(p => p.sortOrder)) + 1 : 0;
          await db.metronomePresets.add({
            ...preset,
            sortOrder: maxOrder,
            createdAt: new Date(),
          });
          setShowAddPreset(false);
        }}
      />
    );
  }

  if (editingPreset) {
    return (
      <PresetForm
        preset={editingPreset}
        onClose={() => setEditingPreset(null)}
        onSave={async (updates) => {
          await db.metronomePresets.update(editingPreset.id, updates);
          setEditingPreset(null);
        }}
        onDelete={async () => {
          await db.metronomePresets.delete(editingPreset.id);
          setEditingPreset(null);
        }}
      />
    );
  }

  return (
    <div className="metronome-view">
      <header className="view-header">
        <h1>Metronome</h1>
        <button onClick={() => setShowPresets(true)} className="icon-button">
          <Settings size={24} />
        </button>
      </header>

      <div className="metronome-content">
        <div className="bpm-display">
          <span className="bpm-value">{bpm}</span>
          <span className="bpm-label">BPM</span>
        </div>

        <div className="beat-indicator">
          {Array.from({ length: beatsPerMeasure }).map((_, i) => (
            <div
              key={i}
              className={`beat-dot ${i === currentBeat && isPlaying ? 'active' : ''} ${i === 0 ? 'accent' : ''}`}
            />
          ))}
        </div>

        <div className="bpm-controls">
          <button onClick={() => handleBpmChange(bpm - 5)} className="bpm-button">-5</button>
          <button onClick={() => handleBpmChange(bpm - 1)} className="bpm-button">-1</button>
          <input
            type="range"
            min="40"
            max="220"
            value={bpm}
            onChange={e => setBpm(parseInt(e.target.value))}
            className="bpm-slider"
          />
          <button onClick={() => handleBpmChange(bpm + 1)} className="bpm-button">+1</button>
          <button onClick={() => handleBpmChange(bpm + 5)} className="bpm-button">+5</button>
        </div>

        <button
          className={`play-button large ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={48} /> : <Play size={48} />}
        </button>

        {presets && presets.length > 0 && (
          <div className="preset-quick-select">
            <h3>Quick Presets</h3>
            <div className="preset-chips">
              {presets.slice(0, 4).map(preset => (
                <button
                  key={preset.id}
                  className={`preset-chip ${preset.bpm === bpm ? 'active' : ''}`}
                  onClick={() => setBpm(preset.bpm)}
                >
                  {preset.songName} ({preset.bpm})
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="add-preset-button" onClick={() => setShowAddPreset(true)}>
          <Plus size={18} />
          Save as Preset
        </button>
      </div>
    </div>
  );
}

function PresetListView({ presets, onClose, onSelect, onAdd, onEdit }) {
  return (
    <div className="preset-list-view">
      <header className="view-header">
        <button onClick={onClose}>
          <X size={24} />
        </button>
        <h1>Presets</h1>
        <button onClick={onAdd} className="icon-button">
          <Plus size={24} />
        </button>
      </header>

      <div className="presets-list">
        {presets?.map(preset => (
          <div key={preset.id} className="preset-row" onClick={() => onSelect(preset)}>
            <div className="preset-info">
              <h3>{preset.songName}</h3>
              <span className="preset-bpm">{preset.bpm} BPM</span>
            </div>
            <button
              className="edit-button"
              onClick={(e) => { e.stopPropagation(); onEdit(preset); }}
            >
              <Edit3 size={18} />
            </button>
          </div>
        ))}
        {(!presets || presets.length === 0) && (
          <div className="empty-state">
            <p>No presets yet</p>
            <button onClick={onAdd} className="primary-button">
              Add Your First Preset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PresetForm({ preset, initialBpm, onClose, onSave, onDelete }) {
  const [songName, setSongName] = useState(preset?.songName || '');
  const [bpm, setBpm] = useState(preset?.bpm || initialBpm || 100);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!songName.trim()) return;
    onSave({ songName: songName.trim(), bpm });
  };

  return (
    <div className="preset-form">
      <header className="form-header">
        <button onClick={onClose}>
          <X size={24} />
        </button>
        <h2>{preset ? 'Edit Preset' : 'Add Preset'}</h2>
        <button onClick={handleSubmit} className="save-button" disabled={!songName.trim()}>
          Save
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Song Name</label>
          <input
            type="text"
            value={songName}
            onChange={e => setSongName(e.target.value)}
            placeholder="e.g., Seven Nation Army"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>BPM: {bpm}</label>
          <input
            type="range"
            min="40"
            max="220"
            value={bpm}
            onChange={e => setBpm(parseInt(e.target.value))}
          />
          <div className="bpm-input-row">
            <button type="button" onClick={() => setBpm(Math.max(40, bpm - 1))}>-</button>
            <input
              type="number"
              value={bpm}
              onChange={e => setBpm(Math.max(40, Math.min(220, parseInt(e.target.value) || 40)))}
              min="40"
              max="220"
            />
            <button type="button" onClick={() => setBpm(Math.min(220, bpm + 1))}>+</button>
          </div>
        </div>

        {preset && onDelete && (
          <button type="button" className="delete-button" onClick={onDelete}>
            <Trash2 size={18} />
            Delete Preset
          </button>
        )}
      </form>
    </div>
  );
}

export default MetronomeView;
