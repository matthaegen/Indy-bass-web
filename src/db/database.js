import Dexie from 'dexie';

export const db = new Dexie('PracticeTrackerDB');

db.version(1).stores({
  songs: '++id, title, artist, sortOrder, isArchived, createdAt',
  practiceNotes: '++id, songId, content, date',
  metronomePresets: '++id, songName, bpm, sortOrder, createdAt',
  practiceDays: '++id, &dateString, date',
  milestones: '++id, &title, dateEarned',
});

// Initialize default milestones
db.on('populate', () => {
  db.milestones.bulkAdd([
    { title: 'First Tune', description: 'Used the tuner for the first time', iconName: 'music', dateEarned: null },
    { title: 'In the Groove', description: 'Used the metronome for the first time', iconName: 'activity', dateEarned: null },
    { title: '3 Day Streak', description: 'Practiced for 3 days in a row', iconName: 'zap', dateEarned: null },
    { title: 'Week Warrior', description: 'Practiced for 7 days in a row', iconName: 'award', dateEarned: null },
    { title: 'Song Explorer', description: 'Added your first practice song', iconName: 'music', dateEarned: null },
    { title: 'All-Rounder', description: 'Used tuner, metronome, and songs in one day', iconName: 'star', dateEarned: null },
  ]);
});

// Seed starter songs if empty
export async function seedStarterSongs() {
  const count = await db.songs.count();
  if (count === 0) {
    const starterSongs = [
      {
        title: 'Seven Nation Army',
        artist: 'The White Stripes',
        youtubeURL: 'https://www.youtube.com/watch?v=0J2QdDbelmY',
        sortOrder: 0,
        isArchived: false,
        lastSpeed: 0.5,
        fastestSpeed: 0,
        duration: 0,
        todayPracticeTime: 0,
        practiceTimeDate: null,
        lastPracticed: null,
        timesOpened: 0,
        createdAt: new Date(),
      },
      {
        title: 'Another One Bites the Dust',
        artist: 'Queen',
        youtubeURL: 'https://www.youtube.com/watch?v=rY0WxgSXdEE',
        sortOrder: 1,
        isArchived: false,
        lastSpeed: 0.5,
        fastestSpeed: 0,
        duration: 0,
        todayPracticeTime: 0,
        practiceTimeDate: null,
        lastPracticed: null,
        timesOpened: 0,
        createdAt: new Date(),
      },
      {
        title: 'Come Together',
        artist: 'The Beatles',
        youtubeURL: 'https://www.youtube.com/watch?v=45cYwDMibGo',
        sortOrder: 2,
        isArchived: false,
        lastSpeed: 0.5,
        fastestSpeed: 0,
        duration: 0,
        todayPracticeTime: 0,
        practiceTimeDate: null,
        lastPracticed: null,
        timesOpened: 0,
        createdAt: new Date(),
      },
      {
        title: 'Under Pressure',
        artist: 'Queen & David Bowie',
        youtubeURL: 'https://www.youtube.com/watch?v=a01QQZyl-_I',
        sortOrder: 3,
        isArchived: false,
        lastSpeed: 0.5,
        fastestSpeed: 0,
        duration: 0,
        todayPracticeTime: 0,
        practiceTimeDate: null,
        lastPracticed: null,
        timesOpened: 0,
        createdAt: new Date(),
      },
      {
        title: 'Feel Good Inc.',
        artist: 'Gorillaz',
        youtubeURL: 'https://www.youtube.com/watch?v=HyHNuVaZJ-k',
        sortOrder: 4,
        isArchived: false,
        lastSpeed: 0.5,
        fastestSpeed: 0,
        duration: 0,
        todayPracticeTime: 0,
        practiceTimeDate: null,
        lastPracticed: null,
        timesOpened: 0,
        createdAt: new Date(),
      },
    ];

    // Add songs with initial notes
    for (const song of starterSongs) {
      const songId = await db.songs.add(song);
      await db.practiceNotes.add({
        songId,
        content: getStarterNote(song.title),
        date: new Date(),
      });
    }
  }
}

function getStarterNote(title) {
  const notes = {
    'Seven Nation Army': 'Classic bass riff! Try at 0.75x speed first.',
    'Another One Bites the Dust': 'Focus on the groove. Use 0.5x speed for the verse pattern.',
    'Come Together': 'Learn the intro slide first at 0.5x speed.',
    'Under Pressure': 'Iconic bass line! Start at 0.75x speed.',
    'Feel Good Inc.': 'Funky rhythm - practice the verse riff at 0.5x speed.',
  };
  return notes[title] || '';
}

// Helper to get today's date string
export function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Log activity for today
export async function logActivity(activityType) {
  const dateString = getTodayString();
  let practiceDay = await db.practiceDays.get({ dateString });

  if (!practiceDay) {
    const id = await db.practiceDays.add({
      dateString,
      date: new Date(),
      activities: [activityType],
      songsPracticedCount: 0,
      totalSongsCount: 0,
    });
    practiceDay = await db.practiceDays.get(id);
  } else {
    const activities = practiceDay.activities || [];
    if (!activities.includes(activityType)) {
      activities.push(activityType);
      await db.practiceDays.update(practiceDay.id, { activities });
    }
  }

  // Check for All-Rounder milestone
  const updatedDay = await db.practiceDays.get({ dateString });
  if (updatedDay?.activities?.includes('tuner') &&
      updatedDay?.activities?.includes('metronome') &&
      updatedDay?.activities?.includes('songs')) {
    await earnMilestone('All-Rounder');
  }
}

// Earn a milestone
export async function earnMilestone(title) {
  const milestone = await db.milestones.get({ title });
  if (milestone && !milestone.dateEarned) {
    await db.milestones.update(milestone.id, { dateEarned: new Date() });
  }
}
