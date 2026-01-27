import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity, earnMilestone } from '../db/database';
import {
  Plus, Edit3, Archive, Trash2, Check, X, ChevronDown, ChevronUp,
  Play, Pause, SkipBack, SkipForward, ExternalLink, GripVertical
} from 'lucide-react';

function SongsView() {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [showAddSong, setShowAddSong] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [playingSong, setPlayingSong] = useState(null);
  const [showBatchSpeed, setShowBatchSpeed] = useState(false);
  const [batchSpeed, setBatchSpeed] = useState(0.75);

  const songs = useLiveQuery(
    () => db.songs.filter(song => song.isArchived === showArchived).sortBy('sortOrder'),
    [showArchived]
  );

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchArchive = async () => {
    const newArchived = !showArchived;
    await Promise.all(
      Array.from(selectedIds).map(id =>
        db.songs.update(id, { isArchived: newArchived })
      )
    );
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} song(s)?`)) return;
    await Promise.all(
      Array.from(selectedIds).map(async id => {
        await db.practiceNotes.where('songId').equals(id).delete();
        await db.songs.delete(id);
      })
    );
    setSelectedIds(new Set());
  };

  const handleBatchSpeed = async () => {
    await Promise.all(
      Array.from(selectedIds).map(id =>
        db.songs.update(id, { lastSpeed: batchSpeed })
      )
    );
    setShowBatchSpeed(false);
    setSelectedIds(new Set());
  };

  const handlePlaySong = async (song) => {
    setPlayingSong(song);
    await db.songs.update(song.id, {
      timesOpened: song.timesOpened + 1,
      lastPracticed: new Date()
    });
    await logActivity('songs');
    await earnMilestone('Song Explorer');
  };

  const exitEditMode = () => {
    setIsEditing(false);
    setSelectedIds(new Set());
  };

  if (playingSong) {
    return (
      <SongPlayer
        song={playingSong}
        onClose={() => setPlayingSong(null)}
      />
    );
  }

  if (showAddSong) {
    return (
      <AddSongForm
        onClose={() => setShowAddSong(false)}
        onSave={async (songData) => {
          const maxOrder = songs?.length ? Math.max(...songs.map(s => s.sortOrder)) + 1 : 0;
          const songId = await db.songs.add({
            ...songData,
            sortOrder: maxOrder,
            isArchived: false,
            lastSpeed: 0.5,
            fastestSpeed: 0,
            duration: 0,
            todayPracticeTime: 0,
            practiceTimeDate: null,
            lastPracticed: null,
            timesOpened: 0,
            createdAt: new Date(),
          });
          if (songData.initialNote) {
            await db.practiceNotes.add({
              songId,
              content: songData.initialNote,
              date: new Date(),
            });
          }
          setShowAddSong(false);
        }}
      />
    );
  }

  if (editingSong) {
    return (
      <EditSongForm
        song={editingSong}
        onClose={() => setEditingSong(null)}
        onSave={async (updates) => {
          await db.songs.update(editingSong.id, updates);
          setEditingSong(null);
        }}
        onDelete={async () => {
          if (!confirm('Delete this song?')) return;
          await db.practiceNotes.where('songId').equals(editingSong.id).delete();
          await db.songs.delete(editingSong.id);
          setEditingSong(null);
        }}
      />
    );
  }

  return (
    <div className="songs-view">
      <header className="view-header">
        <h1>{showArchived ? 'Archived Songs' : 'Practice Songs'}</h1>
        <div className="header-actions">
          {!isEditing && (
            <>
              <button onClick={() => setShowArchived(!showArchived)} className="text-button">
                {showArchived ? 'Active' : 'Archived'}
              </button>
              <button onClick={() => setIsEditing(true)} className="text-button">
                Edit
              </button>
              <button onClick={() => setShowAddSong(true)} className="icon-button">
                <Plus size={24} />
              </button>
            </>
          )}
          {isEditing && (
            <button onClick={exitEditMode} className="text-button">
              Done
            </button>
          )}
        </div>
      </header>

      <div className="songs-list">
        {songs?.map(song => (
          <SongRow
            key={song.id}
            song={song}
            isEditing={isEditing}
            isSelected={selectedIds.has(song.id)}
            onToggleSelect={() => handleToggleSelect(song.id)}
            onPlay={() => handlePlaySong(song)}
            onEdit={() => setEditingSong(song)}
            isNotesExpanded={expandedNotes.has(song.id)}
            onToggleNotes={() => {
              const newExpanded = new Set(expandedNotes);
              if (newExpanded.has(song.id)) {
                newExpanded.delete(song.id);
              } else {
                newExpanded.add(song.id);
              }
              setExpandedNotes(newExpanded);
            }}
          />
        ))}
        {songs?.length === 0 && (
          <div className="empty-state">
            <p>{showArchived ? 'No archived songs' : 'No songs yet'}</p>
            {!showArchived && (
              <button onClick={() => setShowAddSong(true)} className="primary-button">
                Add Your First Song
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing && selectedIds.size > 0 && (
        <div className="batch-action-bar">
          <span>{selectedIds.size} selected</span>
          <button onClick={handleBatchArchive}>
            <Archive size={20} />
            {showArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button onClick={() => setShowBatchSpeed(true)}>
            Set Speed
          </button>
          <button onClick={handleBatchDelete} className="danger">
            <Trash2 size={20} />
            Delete
          </button>
        </div>
      )}

      {showBatchSpeed && (
        <div className="modal-overlay" onClick={() => setShowBatchSpeed(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Set Playback Speed</h2>
            <div className="speed-slider">
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={batchSpeed}
                onChange={e => setBatchSpeed(parseFloat(e.target.value))}
              />
              <span>{batchSpeed.toFixed(2)}x</span>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowBatchSpeed(false)}>Cancel</button>
              <button onClick={handleBatchSpeed} className="primary-button">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SongRow({ song, isEditing, isSelected, onToggleSelect, onPlay, onEdit, isNotesExpanded, onToggleNotes }) {
  const notes = useLiveQuery(
    () => db.practiceNotes.where('songId').equals(song.id).reverse().sortBy('date'),
    [song.id]
  );

  const latestNote = notes?.[0];

  return (
    <div className={`song-row ${isSelected ? 'selected' : ''}`}>
      <div className="song-main" onClick={isEditing ? onToggleSelect : onPlay}>
        {isEditing && (
          <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && <Check size={16} />}
          </div>
        )}
        <div className="song-info">
          <h3>{song.title}</h3>
          <p className="artist">{song.artist}</p>
          <div className="song-meta">
            <span className="speed">{song.lastSpeed.toFixed(2)}x</span>
            {song.lastPracticed && (
              <span className="last-practiced">
                Last: {new Date(song.lastPracticed).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {!isEditing && (
          <button className="edit-song-button" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit3 size={18} />
          </button>
        )}
      </div>

      {latestNote && (
        <div className="song-notes">
          <div className="notes-preview" onClick={onToggleNotes}>
            <p className="note-content">{latestNote.content}</p>
            {notes && notes.length > 1 && (
              <button className="expand-notes">
                {isNotesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {notes.length} notes
              </button>
            )}
          </div>
          {isNotesExpanded && <NoteThread songId={song.id} notes={notes} />}
        </div>
      )}
    </div>
  );
}

function NoteThread({ songId, notes }) {
  const [newNote, setNewNote] = useState('');

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await db.practiceNotes.add({
      songId,
      content: newNote.trim(),
      date: new Date(),
    });
    setNewNote('');
  };

  return (
    <div className="note-thread">
      <div className="add-note">
        <input
          type="text"
          placeholder="Add a note..."
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddNote()}
        />
        <button onClick={handleAddNote} disabled={!newNote.trim()}>
          <Plus size={18} />
        </button>
      </div>
      <div className="notes-list">
        {notes?.map(note => (
          <div key={note.id} className="note-item">
            <p>{note.content}</p>
            <span className="note-date">
              {new Date(note.date).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SongPlayer({ song, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(song.lastSpeed);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Update speed in database when changed
    db.songs.update(song.id, { lastSpeed: speed });
  }, [speed, song.id]);

  useEffect(() => {
    // Track practice time
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(t => t + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenYoutube = () => {
    if (song.youtubeURL) {
      window.open(song.youtubeURL, '_blank');
    }
  };

  return (
    <div className="song-player">
      <header className="player-header">
        <button onClick={onClose} className="back-button">
          <X size={24} />
        </button>
        <div className="player-title">
          <h2>{song.title}</h2>
          <p>{song.artist}</p>
        </div>
      </header>

      <div className="player-content">
        <div className="player-time">{formatTime(currentTime)}</div>

        <div className="speed-control">
          <label>Playback Speed</label>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
          />
          <span className="speed-value">{speed.toFixed(2)}x</span>
        </div>

        <div className="player-controls">
          <button onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}>
            <SkipBack size={32} />
          </button>
          <button className="play-button" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause size={48} /> : <Play size={48} />}
          </button>
          <button onClick={() => setCurrentTime(currentTime + 10)}>
            <SkipForward size={32} />
          </button>
        </div>

        {song.youtubeURL && (
          <button className="youtube-link" onClick={handleOpenYoutube}>
            <ExternalLink size={18} />
            Open in YouTube
          </button>
        )}
      </div>
    </div>
  );
}

function AddSongForm({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeURL, setYoutubeURL] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      artist: artist.trim(),
      youtubeURL: youtubeURL.trim(),
      initialNote: initialNote.trim(),
    });
  };

  return (
    <div className="song-form">
      <header className="form-header">
        <button onClick={onClose}>
          <X size={24} />
        </button>
        <h2>Add Song</h2>
        <button onClick={handleSubmit} className="save-button" disabled={!title.trim()}>
          Save
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Song title"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Artist</label>
          <input
            type="text"
            value={artist}
            onChange={e => setArtist(e.target.value)}
            placeholder="Artist name"
          />
        </div>

        <div className="form-group">
          <label>YouTube URL (optional)</label>
          <input
            type="url"
            value={youtubeURL}
            onChange={e => setYoutubeURL(e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>

        <div className="form-group">
          <label>Initial Note (optional)</label>
          <textarea
            value={initialNote}
            onChange={e => setInitialNote(e.target.value)}
            placeholder="Practice tips, notes..."
            rows={3}
          />
        </div>
      </form>
    </div>
  );
}

function EditSongForm({ song, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [youtubeURL, setYoutubeURL] = useState(song.youtubeURL || '');
  const [newNote, setNewNote] = useState('');

  const notes = useLiveQuery(
    () => db.practiceNotes.where('songId').equals(song.id).reverse().sortBy('date'),
    [song.id]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      artist: artist.trim(),
      youtubeURL: youtubeURL.trim(),
    });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await db.practiceNotes.add({
      songId: song.id,
      content: newNote.trim(),
      date: new Date(),
    });
    setNewNote('');
  };

  return (
    <div className="song-form">
      <header className="form-header">
        <button onClick={onClose}>
          <X size={24} />
        </button>
        <h2>Edit Song</h2>
        <button onClick={handleSubmit} className="save-button" disabled={!title.trim()}>
          Save
        </button>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Artist</label>
          <input
            type="text"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>YouTube URL</label>
          <input
            type="url"
            value={youtubeURL}
            onChange={e => setYoutubeURL(e.target.value)}
          />
        </div>

        <div className="form-group notes-section">
          <label>Practice Notes</label>
          <div className="add-note">
            <input
              type="text"
              placeholder="Add a note..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNote())}
            />
            <button type="button" onClick={handleAddNote} disabled={!newNote.trim()}>
              <Plus size={18} />
            </button>
          </div>
          <div className="notes-list">
            {notes?.map(note => (
              <div key={note.id} className="note-item">
                <p>{note.content}</p>
                <span className="note-date">
                  {new Date(note.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="delete-button" onClick={onDelete}>
          <Trash2 size={18} />
          Delete Song
        </button>
      </form>
    </div>
  );
}

export default SongsView;
