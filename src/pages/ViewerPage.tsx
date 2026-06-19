import { Heart, LockKeyhole, Music2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AudioPlayer from '../components/AudioPlayer';
import EmptyAudio from '../components/EmptyAudio';
import EntryCard from '../components/EntryCard';
import { sampleBook } from '../data';
import { getViewerData } from '../lib/repository';
import type { DiaryBook, DiaryEntry } from '../types';

// ── LRC 파서 ─────────────────────────────────────────
type LRCLine = { time: number; text: string };

function parseLRC(text: string): LRCLine[] {
  const result: LRCLine[] = [];
  for (const raw of text.split('\n')) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
      result.push({ time, text: match[3].trim() });
    }
  }
  return result;
}

function isLRC(text: string): boolean {
  return /^\[\d+:\d+/.test(text.trim());
}

// ── LRC 현재 라인 인덱스 ──────────────────────────────
function getLRCIndex(lines: LRCLine[], current: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (current >= lines[i].time) idx = i;
    else break;
  }
  return idx;
}

// ── SyncedLyrics 컴포넌트 ────────────────────────────
function SyncedLyrics({
  lyrics,
  current,
  duration,
}: {
  lyrics: string;
  current: number;
  duration: number;
}) {
  const activeRef = useRef<HTMLSpanElement | null>(null);

  const { lines, activeIdx } = useMemo(() => {
    if (isLRC(lyrics)) {
      const lrcLines = parseLRC(lyrics);
      return { lines: lrcLines.map((l) => l.text), activeIdx: getLRCIndex(lrcLines, current) };
    }
    // 비례 모드: 빈 줄 포함 전체 줄
    const rawLines = lyrics.split('\n');
    const nonEmpty = rawLines.filter((l) => l.trim()).length;
    if (duration <= 0 || current <= 0 || nonEmpty === 0) {
      return { lines: rawLines, activeIdx: -1 };
    }
    // 빈 줄 제외 기준으로 현재 위치 계산
    const progress = current / duration;
    const targetNonEmpty = Math.floor(progress * nonEmpty);
    let count = 0;
    let aIdx = -1;
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim()) {
        if (count === targetNonEmpty) { aIdx = i; break; }
        count++;
      }
    }
    return { lines: rawLines, activeIdx: aIdx };
  }, [lyrics, current, duration]);

  // 현재 라인으로 부드럽게 스크롤
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  return (
    <div className="lyrics-synced">
      {lines.map((line, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const isEmpty = !line.trim();
        return isEmpty ? (
          <span key={i} className="lyrics-line-gap" />
        ) : (
          <span
            key={i}
            ref={isActive ? activeRef : null}
            className={`lyrics-line${isActive ? ' active' : isPast ? ' past' : ''}`}
          >
            {line}
          </span>
        );
      })}
    </div>
  );
}

// ── ViewerPage ───────────────────────────────────────
export default function ViewerPage() {
  const { token = sampleBook.shareToken } = useParams();
  const [book, setBook] = useState<DiaryBook | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });

  useEffect(() => {
    getViewerData(token)
      .then((data) => {
        setBook(data.book);
        setEntries(data.entries);
        setActiveId(data.entries[0]?.id ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  // 곡이 바뀌면 진행도 초기화
  useEffect(() => {
    setAudioProgress({ current: 0, duration: 0 });
  }, [activeId]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) ?? entries[0],
    [entries, activeId],
  );

  const handleProgress = useCallback((current: number, duration: number) => {
    setAudioProgress({ current, duration });
  }, []);

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
        <section className="diary-board">
          {/* 모바일: 플레이리스트 드로어 토글 버튼 */}
          <button
            className="playlist-drawer-toggle"
            onClick={() => setPlaylistOpen((prev) => !prev)}
            aria-expanded={playlistOpen}
            aria-label="플레이리스트 열기/닫기"
          >
            <div className="drawer-toggle-left">
              <div className="playlist-sticker"><Music2 size={16} /></div>
              <div className="drawer-toggle-info">
                <span className="drawer-label">PLAYLIST</span>
                <span className="drawer-active-title">
                  {activeEntry ? activeEntry.icon || '🎵' : ''} {activeEntry?.title ?? '재생 목록'}
                </span>
              </div>
            </div>
            <div className="drawer-toggle-right">
              <span className="playlist-count">{entries.length}곡</span>
              {playlistOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          <aside className={`playlist-panel${playlistOpen ? ' drawer-open' : ''}`}>
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
                  onClick={() => {
                    setActiveId(entry.id);
                    setPlaylistOpen(false);
                  }}
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
                    <AudioPlayer
                      src={activeEntry.audioUrl}
                      title={activeEntry.title}
                      onProgress={handleProgress}
                    />
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
                    <SyncedLyrics
                      lyrics={activeEntry.lyrics}
                      current={audioProgress.current}
                      duration={audioProgress.duration}
                    />
                  </section>

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

      {/* 관리자 페이지 버튼 (우측 하단 플로팅) */}
      <Link to="/admin" className="admin-fab" aria-label="관리자 페이지로 이동">
        <Settings size={18} />
      </Link>
    </main>
  );
}
