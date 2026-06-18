import { Heart, LockKeyhole, Music2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AudioPlayer from '../components/AudioPlayer';
import EmptyAudio from '../components/EmptyAudio';
import EntryCard from '../components/EntryCard';
import { sampleBook } from '../data';
import { getViewerData } from '../lib/repository';
import type { DiaryBook, DiaryEntry } from '../types';

export default function ViewerPage() {
  const { token = sampleBook.shareToken } = useParams();
  const [book, setBook] = useState<DiaryBook | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getViewerData(token)
      .then((data) => {
        setBook(data.book);
        setEntries(data.entries);
        setActiveId(data.entries[0]?.id ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) ?? entries[0],
    [entries, activeId],
  );

  if (error) {
    return (
      <main className="center-state viewer-state">
        <LockKeyhole size={32} />
        <h1>링크를 확인해줘</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!book) {
    return <main className="center-state viewer-state"><div className="loader" /></main>;
  }

  return (
    <main className="viewer-page">
      <div className="viewer-shell">
        <header className="viewer-header">
          <div className="viewer-title-block">
            <span className="viewer-kicker">100 DAYS · MUSIC DIARY</span>
            <h1>{book.title}<span aria-hidden="true">💌</span></h1>
            <p>{book.subtitle}</p>
          </div>
          <div className="viewer-meta">
            <span>TO. {book.recipientName}</span>
            <span>FROM. {book.senderName}</span>
          </div>
        </header>

        <section className="diary-board">
          <aside className="playlist-panel">
            <div className="playlist-heading">
              <div className="playlist-sticker"><Music2 size={18} /></div>
              <div className="playlist-heading-copy">
                <span>PLAYLIST</span>
                <h2>우리의 장면들</h2>
              </div>
              <strong className="playlist-count">{entries.length}곡</strong>
            </div>

            <div className="entry-list" aria-label="음악일기 목록">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  active={entry.id === activeEntry?.id}
                  onClick={() => setActiveId(entry.id)}
                />
              ))}
            </div>

            <div className="playlist-note">
              <LockKeyhole size={12} />
              링크를 받은 사람만 볼 수 있어요
            </div>
          </aside>

          <section className="detail-panel">
            {activeEntry ? (
              <>
                <div className="song-heading">
                  <div className="song-title-wrap">
                    <span className="day-pill">{activeEntry.dateLabel}</span>
                    <h2>{activeEntry.title}</h2>
                    <p>{activeEntry.subtitle}</p>
                  </div>
                  <div className="days-badge" aria-label={`${book.dayCount}일 기념`}>
                    <strong>{book.dayCount}</strong>
                    <span>DAYS</span>
                  </div>
                </div>

                <div className="player-zone">
                  {activeEntry.audioUrl ? (
                    <AudioPlayer src={activeEntry.audioUrl} title={activeEntry.title} />
                  ) : (
                    <EmptyAudio />
                  )}
                </div>

                <div className="reading-scroll">
                  <section className="lyrics-card">
                    <div className="content-card-heading">
                      <span>가사</span>
                      <small>LYRICS</small>
                    </div>
                    <pre className="lyrics">{activeEntry.lyrics}</pre>
                  </section>

                  <aside className="comment-card">
                    <div className="comment-icon" aria-hidden="true">💭</div>
                    <div className="comment-copy">
                      <span>소연의 짧은 코멘트</span>
                      <p>{activeEntry.comment}</p>
                      <small>— {book.senderName}</small>
                    </div>
                  </aside>

                  <div className="detail-footnote">
                    <Heart size={13} fill="currentColor" />
                    <span>말로 다 못한 날들을 노래로 남겼어</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="center-state compact-state"><p>아직 공개된 음악일기가 없어요.</p></div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
