import type { View } from '../../App';

const TABS: { view: View; icon: string; label: string }[] = [
  { view: 'lib', icon: '☰', label: 'Library' },
  { view: 'item', icon: '+', label: 'Food item' },
  { view: 'recipe', icon: '✻', label: 'Recipe' },
  { view: 'goals', icon: '◎', label: 'Goals' },
];

export function NavBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <nav>
      {TABS.map((t) => (
        <button key={t.view} className={view === t.view ? 'on' : ''} onClick={() => onNavigate(t.view)}>
          <span className="ic">{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  );
}
