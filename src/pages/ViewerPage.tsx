import { Heart, LockKeyhole, Music2, Settings, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import EmptyAudio from '../components/EmptyAudio';
import EntryCard from '../components/EntryCard';
import InstallPrompt from '../components/InstallPrompt';
import { sampleBook } from '../data';
import { getViewerData } from '../lib/repository';
import { downloadStrippedAudio } from '../lib/download';
import { useAccessLog, emptySongPlayStats, BUCKET_SEC, type SongPlayMap } from '../hooks/useAccessLog';
import type { DiaryBook, DiaryEntry } from '../types';
import AudioPlayer, { type AudioPlayerRef } from '../components/AudioPlayer';

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

function getProportionalTimes(rawLines: string[], duration: number): number[] {
  const weights: number[] = rawLines.map((l) => {
    if (!l.trim()) return 0.4;
    if (isSectionHeader(l)) return 0;
    return 1.0;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let accumulated = 0;
  return rawLines.map((_, i) => {
    const t = totalWeight === 0 ? 0 : (accumulated / totalWeight) * duration;
    accumulated += weights[i];
    return t;
  });
}

function useLyricsSync(lyrics: string, current: number, duration: number) {
  return useMemo(() => {
    if (isLRC(lyrics)) {
      const lrcLines = parseLRC(lyrics);
      return { lines: lrcLines, activeIdx: getLRCIndex(lrcLines, current) };
    }
    const rawLines = lyrics.split('\n');
    const pTimes = getProportionalTimes(rawLines, duration);
    const combined = rawLines.map((text, i) => ({ text, time: pTimes[i] }));
    return { lines: combined, activeIdx: getProportionalIndex(rawLines, current, duration) };
  }, [lyrics, current, duration]);
}

function SyncedLyrics({
  lines,
  activeIdx,
  scrollContainer,
  onLineClick,
}: {
  lines: { text: string; time: number | null }[];
  activeIdx: number;
  scrollContainer?: React.RefObject<HTMLDivElement>;
  onLineClick?: (time: number) => void;
}) {
  const activeRef = useRef<HTMLSpanElement | null>(null);

  // 현재 라인으로 부드럽게 스크롤 — reading-scroll 컨테이너 내부로만 한정
  useEffect(() => {
    const el = activeRef.current;
    const container = scrollContainer?.current;
    if (!el || !container) return;

    // getBoundingClientRect()로 뷰포트 기준 상대 위치 계산 → offsetParent 중첩 오차 없음
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - containerRect.top; // 현재 화면에서 el이 container 상단으로부터 얼마나 떨어졌는지
    const targetScrollTop = container.scrollTop + relativeTop - container.clientHeight / 2 + elRect.height / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [activeIdx, scrollContainer]);

  return (
    <div className="lyrics-synced">
      {lines.map((line, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const isEmpty = !line.text.trim();
        return isEmpty ? (
          <span key={i} className="lyrics-line-gap" />
        ) : (
          <span
            key={i}
            ref={isActive ? activeRef : null}
            className={`lyrics-line${isActive ? ' active' : isPast ? ' past' : ''}${onLineClick && line.time !== null ? ' clickable' : ''}`}
            onClick={() => {
              if (onLineClick && line.time !== null) onLineClick(line.time);
            }}
            style={{ cursor: onLineClick && line.time !== null ? 'pointer' : 'default' }}
          >
            {line.text}
          </span>
        );
      })}
    </div>
  );
}

// ── ViewerPage ───────────────────────────────────────
export default function ViewerPage() {
  const { token = sampleBook.shareToken } = useParams();
  
  // 곡별 실제 재생 시간(초) 추적 Map
  const songPlayMapRef = useRef<SongPlayMap>(new Map());
  const lastTimeRef = useRef<{ title: string; time: number } | null>(null);
  // 곡별로 마지막에 지나간 구간 인덱스 (반복 구간 탐지용 — 같은 구간에 머무는 동안 중복 집계 방지)
  const lastBucketRef = useRef<{ title: string; bucket: number } | null>(null);

  // 방문자 접속 및 체류 시간 기록 (화면이 안 보여도 음악이 재생 중이면 계속 "체류"로 집계됨)
  const { notifyPlaying } = useAccessLog(songPlayMapRef, token);

  const [book, setBook] = useState<DiaryBook | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState('');
  // 모바일에서는 플레이리스트 아코디언이 기본으로 열려 있도록 강제 설정
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const readingScrollRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AudioPlayerRef>(null);

  const handleLineClick = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time);
    }
  }, []);

  useEffect(() => {
    if (readingScrollRef.current) {
      readingScrollRef.current.scrollTop = 0;
    }
  }, [activeId]);

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
    async function load() {
      try {
        const data = await getViewerData(token);
        setBook(data.book);
        const published = data.entries.filter(e => e.published).sort((a, b) => a.order - b.order);
        setEntries(published);
        if (published.length > 0) {
          setActiveId(published[0].id);
        }
      } catch (err: any) {
        setError(err.message || '데이터를 불러오지 못했습니다.');
      }
    }
    load();
  }, [token]);

  // 실제 재생 시간 추적: onTimeUpdate 콜백에서 곡별 누적 재생 시간 기록
  const handlePlayTimeTrack = useCallback((current: number, duration: number) => {
    setAudioProgress({ current, duration });

    if (!activeEntry?.title) return;
    const map = songPlayMapRef.current;

    const last = lastTimeRef.current;
    if (last && last.title === activeEntry.title) {
      const delta = current - last.time;
      // 정상적인 재생 진행일 때만 누적 (0~2초 범위, seek 제외)
      if (delta > 0 && delta < 2) {
        const prev = map.get(activeEntry.title) || emptySongPlayStats();
        map.set(activeEntry.title, { ...prev, seconds: prev.seconds + delta });
      }
    }
    lastTimeRef.current = { title: activeEntry.title, time: current };

    // 반복 구간 추적: 재생 위치가 새로운 구간으로 넘어갈 때마다 그 구간의 통과 횟수를 올린다.
    // 특정 구간을 되감아 다시 들으면 그 구간만 통과 횟수가 유독 높아진다.
    const bucket = Math.floor(current / BUCKET_SEC);
    const lastBucket = lastBucketRef.current;
    if (!lastBucket || lastBucket.title !== activeEntry.title || lastBucket.bucket !== bucket) {
      const prev = map.get(activeEntry.title) || emptySongPlayStats();
      const buckets = new Map(prev.buckets);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      map.set(activeEntry.title, { ...prev, buckets });
      lastBucketRef.current = { title: activeEntry.title, bucket };
    }
  }, [activeEntry?.title]);

  // 재생 횟수 추적: 재생 버튼을 누르거나(재개 포함) 오디오가 재생을 시작할 때마다 카운트
  const handlePlayStart = useCallback(() => {
    if (!activeEntry?.title) return;
    const map = songPlayMapRef.current;
    const prev = map.get(activeEntry.title) || emptySongPlayStats();
    map.set(activeEntry.title, { ...prev, count: prev.count + 1 });
  }, [activeEntry?.title]);

  // 완청 추적: 스킵이 아니라 곡이 끝까지 자연 재생됐을 때만 카운트
  const handleCompleted = useCallback(() => {
    if (!activeEntry?.title) return;
    const map = songPlayMapRef.current;
    const prev = map.get(activeEntry.title) || emptySongPlayStats();
    map.set(activeEntry.title, { ...prev, completed: prev.completed + 1 });
  }, [activeEntry?.title]);

  // 브라우저 탭(문서) 제목을 카테고리 이름으로 동적 설정 + PWA manifest 동적 주입
  useEffect(() => {
    if (book) {
      document.title = book.title || '나의 음악일기';

      // 동적 manifest: 뷰어 토큰과 책 제목으로 start_url / 앱 이름 설정
      const manifestUrl = `/api/manifest?token=${encodeURIComponent(token)}&title=${encodeURIComponent(book.title || '음악일기')}`;
      let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.href = manifestUrl;
    }
  }, [book, token]);

  // 곡이 바뀌면 진행도 초기화
  useEffect(() => {
    setAudioProgress({ current: 0, duration: 0 });
    lastTimeRef.current = null; // 곡 변경 시 추적 리셋
  }, [activeId]);

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
                <h2>{book?.title || '재생 목록'}</h2>
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
                  }}
                />
              ))}
            </div>
          </aside>

          <section className="detail-panel">
            {activeEntry ? (
              <>
                <div className="song-heading">
                  <div className="song-title-wrap">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="day-pill">{activeEntry.dateLabel}</span>
                      {activeEntry.dateLabel && (
                        <span style={{ fontSize: '10px', color: '#a1837f', fontWeight: 600, letterSpacing: '0.02em' }}>
                          {(() => {
                            const match = activeEntry.dateLabel.match(/DAY\s*(\d+)/);
                            if (!match) return '';
                            const d = new Date(new Date('2026-05-30T00:00:00+09:00').getTime() + (parseInt(match[1], 10) - 1) * 24 * 60 * 60 * 1000);
                            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                            return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')}`;
                          })()}
                        </span>
                      )}
                    </div>
                    <h2>{activeEntry.title}</h2>
                    <p>{activeEntry.subtitle}</p>
                  </div>
                  {activeEntry.audioUrl && (
                    <button 
                      className="download-button" 
                      onClick={() => downloadStrippedAudio(activeEntry.audioUrl!, activeEntry.title)}
                      aria-label="음악 파일 다운로드"
                      title="음악 파일 다운로드"
                    >
                      <Download size={18} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                <div className="player-zone">
                  {activeEntry.audioUrl ? (
                    <AudioPlayer
                      ref={playerRef}
                      src={activeEntry.audioUrl}
                      title={activeEntry.title}
                      subtitle={activeEntry.subtitle}
                      albumTitle={book?.title}
                      autoPlay={autoPlayNext}
                      onProgress={handlePlayTimeTrack}
                      onPlayStart={handlePlayStart}
                      onPlayingChange={notifyPlaying}
                      onCompleted={handleCompleted}
                      onEnded={handleNext}
                      onPrev={prevEntry ? handlePrev : null}
                      onNext={nextEntry ? handleNext : null}
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

                <div className="lyric-header-static">
                  {activeEntry.lyrics.trim() && (
                    <div className="current-lyric-banner">
                      {(() => {
                        const { lines, activeIdx } = syncData;
                        
                        if (activeIdx < 0) {
                          const firstLine = lines.find(l => l.text.trim());
                          if (firstLine) {
                            return <p className="lyric-pop" style={{ opacity: 0.35, transform: 'none', animation: 'none' }}>{firstLine.text}</p>;
                          }
                          return <p style={{ opacity: 0.3 }}>🎵</p>;
                        }

                        const activeLine = lines[activeIdx]?.text.trim();
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

                <div className="reading-scroll" ref={readingScrollRef}>
                  <section className="lyrics-card">
                    <SyncedLyrics
                      lines={syncData.lines}
                      activeIdx={syncData.activeIdx}
                      scrollContainer={readingScrollRef}
                      onLineClick={handleLineClick}
                    />
                  </section>
                </div>
              </>
            ) : (
              <div className="center-state compact-state"><p>아직 공개된 음악일기가 없어요.</p></div>
            )}
          </section>
        </section>
      </div>
      <InstallPrompt />
    </main>
  );
}
