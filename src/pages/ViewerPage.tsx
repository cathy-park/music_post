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
type LRCLine = { time: number | null; text: string };

function parseLRC(text: string): LRCLine[] {
  const result: LRCLine[] = [];
  for (const raw of text.split('\n')) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
      result.push({ time, text: match[3].trim() });
    } else {
      result.push({ time: null, text: raw.trim() });
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
    if (lines[i].time !== null) {
      if (current >= lines[i].time!) idx = i;
      else break;
    }
  }
  return idx;
}

// ── SyncedLyrics 컴포넌트 & 훅 ────────────────────────────
/** [Intro], [Verse 1] 같은 섹션 헤더 판별 */
const isSectionHeader = (l: string) => /^\[.+\]$/.test(l.trim());

/**
 * 비례 싱크: 각 줄에 가중치를 부여해 재생 시간 배분
 *  - 실제 가사 줄: 1.0
 *  - 빈 줄 (일시 정지): 0.4
 *  - [섹션 헤더]: 0 (시간 배분 없음)
 */
function getProportionalIndex(rawLines: string[], current: number, duration: number): number {
  if (duration <= 0 || current <= 0) return -1;

  const weights: number[] = rawLines.map((l) => {
    if (!l.trim()) return 0.4;
    if (isSectionHeader(l)) return 0;
    return 1.0;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return -1;

  const targetWeight = (current / duration) * totalWeight;
  let accumulated = 0;
  let lastLyricIdx = -1;

  for (let i = 0; i < rawLines.length; i++) {
    accumulated += weights[i];
    // 섹션 헤더·빈줄은 하이라이트 대상에서 제외
    if (rawLines[i].trim() && !isSectionHeader(rawLines[i])) {
      lastLyricIdx = i;
    }
    if (accumulated >= targetWeight) return lastLyricIdx;
  }
  return lastLyricIdx;
}

function useLyricsSync(lyrics: string, current: number, duration: number) {
  return useMemo(() => {
    if (isLRC(lyrics)) {
      const lrcLines = parseLRC(lyrics);
      return { lines: lrcLines.map((l) => l.text), activeIdx: getLRCIndex(lrcLines, current) };
    }
    const rawLines = lyrics.split('\n');
    return { lines: rawLines, activeIdx: getProportionalIndex(rawLines, current, duration) };
  }, [lyrics, current, duration]);
}

function SyncedLyrics({ lines, activeIdx }: { lines: string[]; activeIdx: number }) {
  const activeRef = useRef<HTMLSpanElement | null>(null);

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
  // 모바일에서는 플레이리스트 아코디언이 기본으로 열려 있도록 강제 설정
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });
  const [autoPlayNext, setAutoPlayNext] = useState(false);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) ?? entries[0],
    [entries, activeId]
  );

  const syncData = useLyricsSync(
    activeEntry?.lyrics || '',
    audioProgress.current,
    audioProgress.duration
  );

  useEffect(() => {
    getViewerData(token)
      .then((data) => {
        setBook(data.book);
        setEntries(data.entries);
        setActiveId(data.entries[0]?.id ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  // 브라우저 탭(문서) 제목을 카테고리 이름으로 동적 설정
  useEffect(() => {
    if (book) {
      document.title = book.title || '나의 음악일기';
    }
  }, [book]);

  // 곡이 바뀌면 진행도 초기화
  useEffect(() => {
    setAudioProgress({ current: 0, duration: 0 });
  }, [activeId]);

  const handleProgress = useCallback((current: number, duration: number) => {
    setAudioProgress({ current, duration });
  }, []);

  const currentIndex = entries.findIndex(e => e.id === activeId);
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const nextEntry = currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  const handleNext = useCallback(() => {
    if (nextEntry) {
      setActiveId(nextEntry.id);
      setAutoPlayNext(true);
    }
  }, [nextEntry]);

  const handlePrev = useCallback(() => {
    if (prevEntry) {
      setActiveId(prevEntry.id);
      setAutoPlayNext(true);
    }
  }, [prevEntry]);

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
                  {book?.title ? `${book.title} 재생 목록` : '재생 목록'}
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
                </div>

                <div className="player-zone">
                  {activeEntry.audioUrl ? (
                    <AudioPlayer
                      src={activeEntry.audioUrl}
                      title={activeEntry.title}
                      autoPlay={autoPlayNext}
                      onProgress={handleProgress}
                      onEnded={handleNext}
                    />
                  ) : (
                    <EmptyAudio />
                  )}
                </div>

                <div className="player-nav-zone">
                  {prevEntry && (
                    <button className="nav-card prev-card" onClick={handlePrev}>
                      <span className="nav-dir">이전 곡</span>
                      <div className="nav-info">
                        <span className="day-pill outline">{prevEntry.dateLabel}</span>
                        <strong>{prevEntry.title}</strong>
                      </div>
                    </button>
                  )}
                  
                  {nextEntry && (
                    <button className="nav-card next-card" onClick={handleNext}>
                      <span className="nav-dir">다음 곡</span>
                      <div className="nav-info">
                        <span className="day-pill outline">{nextEntry.dateLabel}</span>
                        <strong>{nextEntry.title}</strong>
                      </div>
                    </button>
                  )}
                </div>

                <div className="reading-scroll">
                  <div className="sticky-lyric-header">
                    {activeEntry.lyrics.trim() && (
                      <div className="current-lyric-banner">
                        {(() => {
                          const { lines, activeIdx } = syncData;
                          
                          if (activeIdx < 0) {
                            const firstLine = lines.find(l => l.trim());
                            if (firstLine) {
                              return <p className="lyric-pop" style={{ opacity: 0.35, transform: 'none', animation: 'none' }}>{firstLine}</p>;
                            }
                            return <p style={{ opacity: 0.3 }}>🎵</p>;
                          }

                          const activeLine = lines[activeIdx]?.trim();
                          if (activeLine) {
                            return <p key={activeIdx} className="lyric-pop">{activeLine}</p>;
                          }
                          return <p style={{ opacity: 0.3 }}>🎵</p>;
                        })()}
                      </div>
                    )}
                    <div className="content-card-heading sticky-title">
                      <span>가사</span>
                      <small>LYRICS</small>
                    </div>
                  </div>

                  <section className="lyrics-card">
                    <SyncedLyrics lines={syncData.lines} activeIdx={syncData.activeIdx} />
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
