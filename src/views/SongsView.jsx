import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity, earnMilestone } from '../db/database';
import {
  Plus, Edit3, Archive, Trash2, Check, X, ChevronDown, Hourglass, CheckCircle,
} from 'lucide-react';

// Helper to get today's date string
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Encouraging messages for in-progress practice
const encouragements = [
  "Keep going!",
  "You're doing great!",
  "Almost there!",
  "Nice work!",
  "Keep it up!",
  "Sounding good!",
];

// Load YouTube IFrame API
let youtubeApiReady = false;
let youtubeApiCallbacks = [];

if (typeof window !== 'undefined' && !window.YT) {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  window.onYouTubeIframeAPIReady = () => {
    youtubeApiReady = true;
    youtubeApiCallbacks.forEach(cb => cb());
    youtubeApiCallbacks = [];
  };
} else if (window.YT && window.YT.Player) {
  youtubeApiReady = true;
}

function useYouTubeApi() {
  const [ready, setReady] = useState(youtubeApiReady);

  useEffect(() => {
    if (youtubeApiReady) {
      setReady(true);
    } else {
      const callback = () => setReady(true);
      youtubeApiCallbacks.push(callback);
      return () => {
        youtubeApiCallbacks = youtubeApiCallbacks.filter(cb => cb !== callback);
      };
    }
  }, []);

  return ready;
}

// Extract YouTube video ID from URL
function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function SongsView() {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [expandedSongId, setExpandedSongId] = useState(null);
  const [showAddSong, setShowAddSong] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
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

  const handleExpandSong = async (song) => {
    if (expandedSongId === song.id) {
      setExpandedSongId(null);
    } else {
      setExpandedSongId(song.id);
      await db.songs.update(song.id, {
        timesOpened: song.timesOpened + 1,
        lastPracticed: new Date()
      });
      await logActivity('songs');
      await earnMilestone('Song Explorer');
    }
  };

  const exitEditMode = () => {
    setIsEditing(false);
    setSelectedIds(new Set());
  };

  if (showAddSong) {
    return (
      <AddSongForm
        onClose={() => setShowAddSong(false)}
        onSave={async (songData) => {
          const maxOrder = songs?.length ? Math.max(...songs.map(s => s.sortOrder)) + 1 : 0;
          const songId = await db.songs.add({
            title: songData.title,
            artist: songData.artist,
            youtubeURL: songData.youtubeURL,
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
          <SongCard
            key={song.id}
            song={song}
            isEditing={isEditing}
            isSelected={selectedIds.has(song.id)}
            isExpanded={expandedSongId === song.id}
            onToggleSelect={() => handleToggleSelect(song.id)}
            onToggleExpand={() => handleExpandSong(song)}
            onEdit={() => setEditingSong(song)}
            showArchived={showArchived}
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

function SongCard({ song, isEditing, isSelected, isExpanded, onToggleSelect, onToggleExpand, onEdit, showArchived }) {
  const [speed, setSpeed] = useState(song.lastSpeed);
  const [videoDuration, setVideoDuration] = useState(song.duration || 0);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const lastTimeRef = useRef(0);
  const apiReady = useYouTubeApi();

  const notes = useLiveQuery(
    () => db.practiceNotes.where('songId').equals(song.id).reverse().sortBy('date'),
    [song.id]
  );

  const latestNote = notes?.[0];
  const olderNotes = notes?.slice(1) || [];

  const videoId = getYouTubeId(song.youtubeURL);

  // Get today's practice time (reset if different day)
  const todayString = getTodayString();
  const todayPracticeTime = song.practiceTimeDate === todayString ? (song.todayPracticeTime || 0) : 0;

  // Calculate practice status
  const practiceStatus = videoDuration > 0
    ? todayPracticeTime >= videoDuration
      ? 'complete'
      : todayPracticeTime > 0
        ? 'in-progress'
        : 'not-started'
    : 'no-video';

  // Get random encouragement
  const encouragement = encouragements[Math.floor(song.id % encouragements.length)];

  // Initialize YouTube player when expanded
  useEffect(() => {
    if (!isExpanded || !videoId || !apiReady || !playerContainerRef.current) return;

    const playerId = `player-${song.id}`;
    playerContainerRef.current.id = playerId;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player(playerId, {
      videoId: videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        iv_load_policy: 3,
        fs: 1,
      },
      events: {
        onReady: async (event) => {
          event.target.setPlaybackRate(speed);
          // Get video duration
          const duration = event.target.getDuration();
          if (duration && duration !== videoDuration) {
            setVideoDuration(duration);
            await db.songs.update(song.id, { duration });
          }
        },
        onStateChange: (event) => {
          // YT.PlayerState.PLAYING = 1
          if (event.data === 1) {
            // Start tracking playback time
            lastTimeRef.current = playerRef.current.getCurrentTime();
            trackingIntervalRef.current = setInterval(async () => {
              if (!playerRef.current) return;
              try {
                const currentTime = playerRef.current.getCurrentTime();
                const elapsed = currentTime - lastTimeRef.current;

                // Only count if actually progressing (handles seeks/repeats)
                if (elapsed > 0 && elapsed < 2) {
                  const today = getTodayString();
                  const currentPractice = song.practiceTimeDate === today
                    ? (song.todayPracticeTime || 0)
                    : 0;

                  await db.songs.update(song.id, {
                    todayPracticeTime: currentPractice + elapsed,
                    practiceTimeDate: today,
                  });
                }
                lastTimeRef.current = currentTime;
              } catch (e) {
                // Player might be destroyed
              }
            }, 1000);
          } else {
            // Paused, ended, or buffering - stop tracking
            if (trackingIntervalRef.current) {
              clearInterval(trackingIntervalRef.current);
              trackingIntervalRef.current = null;
            }
          }
        },
      },
    });

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [isExpanded, videoId, apiReady, song.id]);

  // Update playback rate when speed changes
  useEffect(() => {
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch (e) {
        // Player might not be ready yet
      }
    }
  }, [speed]);

  const handleSpeedChange = async (newSpeed) => {
    setSpeed(newSpeed);
    await db.songs.update(song.id, { lastSpeed: newSpeed });
  };

  return (
    <div className={`song-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="song-header" onClick={isEditing ? onToggleSelect : onToggleExpand}>
        {isEditing && (
          <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && <Check size={16} />}
          </div>
        )}

        {/* Practice status indicator - only show for non-archived songs */}
        {!isEditing && !showArchived && practiceStatus !== 'no-video' && practiceStatus !== 'not-started' && (
          <div className={`practice-status ${practiceStatus}`}>
            {practiceStatus === 'complete' ? (
              <CheckCircle size={24} />
            ) : (
              <Hourglass size={22} />
            )}
          </div>
        )}

        <div className="song-info">
          <h3>{song.title}</h3>
          <p className="artist">{song.artist}</p>
          {/* Show encouragement for in-progress */}
          {!isEditing && !showArchived && practiceStatus === 'in-progress' && (
            <p className="encouragement">{encouragement}</p>
          )}
        </div>
        <div className="song-actions">
          {!isEditing && (
            <>
              <button
                className="edit-song-button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
              >
                <Edit3 size={18} />
              </button>
              <button className={`expand-button ${isExpanded ? 'expanded' : ''}`}>
                <ChevronDown size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview note when collapsed */}
      {!isExpanded && latestNote && (
        <div className="song-notes-section" style={{ padding: '0 16px 16px' }}>
          <p className="notes-preview-text">{latestNote.content}</p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="song-expanded">
          {/* Speed Control */}
          <div className="speed-control-inline">
            <label>Playback Speed</label>
            <div className="speed-slider-row">
              <input
                type="range"
                min="0.25"
                max="1"
                step="0.05"
                value={speed}
                onChange={e => handleSpeedChange(parseFloat(e.target.value))}
              />
              <span className="speed-value-badge">{speed.toFixed(2)}x</span>
            </div>
          </div>

          {/* Embedded YouTube Video */}
          {videoId ? (
            <div className="video-container">
              <div ref={playerContainerRef} style={{ width: '100%', aspectRatio: '16/9' }} />
            </div>
          ) : (
            <div className="no-video-message">
              No video link added yet. Edit this song to add a YouTube URL.
            </div>
          )}

          {/* Notes Section */}
          <div className="song-notes-section">
            <h4>Practice Notes</h4>
            {latestNote && (
              <p className="notes-preview-text" style={{ marginBottom: '12px' }}>
                {latestNote.content}
              </p>
            )}
            <NoteThread songId={song.id} notes={olderNotes} />
          </div>
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
      {notes && notes.length > 0 && (
        <div className="notes-list">
          {notes.map(note => (
            <div key={note.id} className="note-item">
              <p>{note.content}</p>
              <span className="note-date">
                {new Date(note.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
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
