import { Headphones } from 'lucide-react';
import type { DiaryEntry } from '../types';

type Props = {
  entry: DiaryEntry;
  active: boolean;
  onClick: () => void;
};

export default function EntryCard({ entry, active, onClick }: Props) {
  return (
    <button
      className={`entry-card tone-${entry.coverTone} ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="entry-index">
        <span className="entry-emoji">{entry.icon || '🎵'}</span>
      </div>
      <div className="entry-copy">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="entry-day">{entry.dateLabel}</span>
          {entry.dateLabel && (
            <span style={{ fontSize: '8px', color: '#a1837f', fontWeight: 600 }}>
              {(() => {
                const match = entry.dateLabel.match(/DAY\s*(\d+)/);
                if (!match) return '';
                const d = new Date(new Date('2025-05-30T00:00:00+09:00').getTime() + (parseInt(match[1], 10) - 1) * 24 * 60 * 60 * 1000);
                const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`;
              })()}
            </span>
          )}
        </div>
        <strong>{entry.title}</strong>
        <small>{entry.subtitle}</small>
      </div>
      <Headphones size={17} className="entry-action" />
    </button>
  );
}
