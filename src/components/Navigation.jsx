import { Music, Activity, Radio, TrendingUp } from 'lucide-react';

const tabs = [
  { id: 'tuner', label: 'Tuner', icon: Radio },
  { id: 'metronome', label: 'Metronome', icon: Activity },
  { id: 'songs', label: 'Songs', icon: Music },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
];

function Navigation({ activeTab, onTabChange }) {
  return (
    <nav className="navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-tab ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
        >
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default Navigation;
