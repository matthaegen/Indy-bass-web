import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getTodayString } from '../db/database';
import { Award, Music, Activity, Zap, Star, Calendar, TrendingUp } from 'lucide-react';

const ICON_MAP = {
  music: Music,
  activity: Activity,
  zap: Zap,
  award: Award,
  star: Star,
};

function ProgressView() {
  const milestones = useLiveQuery(() => db.milestones.toArray());
  const practiceDays = useLiveQuery(() => db.practiceDays.orderBy('dateString').reverse().toArray());
  const songs = useLiveQuery(() => db.songs.toArray());

  const stats = useMemo(() => {
    if (!practiceDays || !songs) return null;

    const totalDays = practiceDays.length;
    const totalSongs = songs.filter(s => !s.isArchived).length;
    const earnedMilestones = milestones?.filter(m => m.dateEarned).length || 0;

    // Calculate current streak
    let streak = 0;
    const today = getTodayString();
    const sortedDays = [...(practiceDays || [])].sort((a, b) =>
      b.dateString.localeCompare(a.dateString)
    );

    for (let i = 0; i < sortedDays.length; i++) {
      const dayDate = new Date(sortedDays[i].dateString);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedString = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;

      if (sortedDays[i].dateString === expectedString) {
        streak++;
      } else if (i === 0 && sortedDays[i].dateString !== today) {
        // If today hasn't been logged yet, check from yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        if (sortedDays[i].dateString !== yesterdayString) {
          break;
        }
        streak++;
      } else {
        break;
      }
    }

    return { totalDays, totalSongs, earnedMilestones, streak };
  }, [practiceDays, songs, milestones]);

  const recentActivity = useMemo(() => {
    if (!practiceDays) return [];
    return practiceDays.slice(0, 7);
  }, [practiceDays]);

  return (
    <div className="progress-view">
      <header className="view-header">
        <h1>Progress</h1>
      </header>

      <div className="progress-content">
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <Calendar size={24} />
              <span className="stat-value">{stats.totalDays}</span>
              <span className="stat-label">Practice Days</span>
            </div>
            <div className="stat-card">
              <TrendingUp size={24} />
              <span className="stat-value">{stats.streak}</span>
              <span className="stat-label">Day Streak</span>
            </div>
            <div className="stat-card">
              <Music size={24} />
              <span className="stat-value">{stats.totalSongs}</span>
              <span className="stat-label">Active Songs</span>
            </div>
            <div className="stat-card">
              <Award size={24} />
              <span className="stat-value">{stats.earnedMilestones}</span>
              <span className="stat-label">Milestones</span>
            </div>
          </div>
        )}

        <section className="milestones-section">
          <h2>Milestones</h2>
          <div className="milestones-grid">
            {milestones?.map(milestone => {
              const Icon = ICON_MAP[milestone.iconName] || Award;
              const isEarned = !!milestone.dateEarned;

              return (
                <div
                  key={milestone.id}
                  className={`milestone-card ${isEarned ? 'earned' : 'locked'}`}
                >
                  <div className="milestone-icon">
                    <Icon size={32} />
                  </div>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                  {isEarned && (
                    <span className="earned-date">
                      {new Date(milestone.dateEarned).toLocaleDateString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {recentActivity.map(day => (
              <div key={day.id} className="activity-row">
                <span className="activity-date">
                  {new Date(day.dateString).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
                <div className="activity-icons">
                  {day.activities?.includes('tuner') && (
                    <span className="activity-badge tuner" title="Used Tuner">
                      <Music size={16} />
                    </span>
                  )}
                  {day.activities?.includes('metronome') && (
                    <span className="activity-badge metronome" title="Used Metronome">
                      <Activity size={16} />
                    </span>
                  )}
                  {day.activities?.includes('songs') && (
                    <span className="activity-badge songs" title="Practiced Songs">
                      <Zap size={16} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="empty-state">
                <p>No practice activity yet</p>
                <p className="hint">Start practicing to track your progress!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default ProgressView;
