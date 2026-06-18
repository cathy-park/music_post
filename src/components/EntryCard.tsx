import { Headphones, Music2 } from 'lucide-react';
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
      <div className="entry-index"><Music2 size={15} /></div>
      <div className="entry-copy">
        <span className="entry-day">{entry.dateLabel}</span>
        <strong>{entry.title}</strong>
        <small>{entry.subtitle}</small>
      </div>
      <Headphones size={17} className="entry-action" />
    </button>
  );
}
