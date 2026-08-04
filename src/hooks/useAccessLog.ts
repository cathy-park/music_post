import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';
import { parseUserAgent } from '../lib/userAgent';

/** 재생 위치를 나눠서 세는 구간 크기(초). 특정 구간만 반복재생했는지 감지하는 데 쓴다. */
export const BUCKET_SEC = 10;

/** 곡별 재생 통계: 누적 재생 초 + 재생(시작) 횟수 + 완청(끝까지 재생) 횟수 + 구간별 통과 횟수 */
export type SongPlayStats = {
  seconds: number;
  count: number;
  completed: number;
  /** 구간 인덱스(0, 1, 2...) → 그 구간을 지나간 횟수. 반복재생 구간 탐지용 */
  buckets: Map<number, number>;
};

/** 각 곡의 실제 재생 통계를 추적하는 Map: title → SongPlayStats */
export type SongPlayMap = Map<string, SongPlayStats>;

export function emptySongPlayStats(): SongPlayStats {
  return { seconds: 0, count: 0, completed: 0, buckets: new Map() };
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * 구간별 통과 횟수에서 "가장 많이 반복된 구간"을 찾아 "1:20-1:40(3회)" 형식으로 요약한다.
 * 모든 구간이 1회씩만 지나갔으면(반복 없음) null을 반환한다.
 */
function summarizeRepeatRange(buckets: Map<number, number>): string | null {
  if (buckets.size === 0) return null;
  const maxCount = Math.max(...buckets.values());
  if (maxCount < 2) return null; // 반복된 구간이 없음

  // 최댓값을 가진 구간들을 인접한 것끼리 묶는다.
  const hot = [...buckets.entries()].filter(([, c]) => c === maxCount).map(([b]) => b).sort((a, b) => a - b);
  const ranges: number[][] = [];
  let cur: number[] = [hot[0]];
  for (let i = 1; i < hot.length; i++) {
    if (hot[i] === cur[cur.length - 1] + 1) cur.push(hot[i]);
    else { ranges.push(cur); cur = [hot[i]]; }
  }
  ranges.push(cur);

  // 가장 긴(넓은) 구간 하나만 대표로 보여준다.
  ranges.sort((a, b) => b.length - a.length);
  const top = ranges[0];
  const startSec = top[0] * BUCKET_SEC;
  const endSec = (top[top.length - 1] + 1) * BUCKET_SEC;
  return `${formatMMSS(startSec)}-${formatMMSS(endSec)}(${maxCount}회)`;
}

/**
 * 재생 통계 맵을 DB 저장용 문자열로 변환
 * 형식: "곡제목 - 1분 23초 · 3회 재생 · 완청 1회 · 반복구간 1:20-1:40(3회)" (줄바꿈 구분)
 */
function formatSongPlayMap(map: SongPlayMap): string | null {
  if (map.size === 0) return null;
  const lines: string[] = [];
  for (const [title, stats] of map) {
    const sec = stats.seconds;
    const count = stats.count;
    const completed = stats.completed;
    if (sec < 1 && count < 1 && completed < 1) continue; // 아무 활동도 없으면 무시
    const timeStr = sec < 60
      ? `${Math.floor(sec)}초`
      : `${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}초`;
    const countStr = count > 0 ? ` · ${count}회 재생` : '';
    const completedStr = count > 0 ? ` · ${completed > 0 ? `완청 ${completed}회` : '미완청'}` : '';
    const repeatRange = summarizeRepeatRange(stats.buckets);
    const repeatStr = repeatRange ? ` · 반복구간 ${repeatRange}` : '';
    lines.push(`${title} - ${timeStr}${countStr}${completedStr}${repeatStr}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

export function useAccessLog(songPlayMapRef: React.RefObject<SongPlayMap>, token?: string) {
  const sessionId = useRef(crypto.randomUUID());
  const hasInserted = useRef(false);
  // 탭이 화면에 보이거나(포그라운드), 음악이 재생 중이면(백그라운드 재생 포함) 누적한다.
  // 화면도 안 보이고 재생도 안 하고 있을 때만 카운트를 멈춘다.
  const accumulatedSec = useRef(0);
  const isVisible = useRef(typeof document !== 'undefined' && document.visibilityState === 'visible');
  const isPlaying = useRef(false);
  const activeStart = useRef<number | null>(isVisible.current ? Date.now() : null);
  const flushRef = useRef<(() => void) | null>(null);

  // 화면 노출 상태·재생 상태 중 하나라도 바뀌면 타이머를 시작/정지한다.
  const syncEngagement = useCallback(() => {
    const shouldRun = isVisible.current || isPlaying.current;
    const isRunning = activeStart.current !== null;
    if (shouldRun && !isRunning) {
      activeStart.current = Date.now();
    } else if (!shouldRun && isRunning) {
      accumulatedSec.current += (Date.now() - activeStart.current!) / 1000;
      activeStart.current = null;
      flushRef.current?.(); // 카운트를 멈추는 시점 값을 즉시 반영
    }
  }, []);

  /** AudioPlayer 등 외부에서 재생/일시정지 상태가 바뀔 때 호출 */
  const notifyPlaying = useCallback((playing: boolean) => {
    isPlaying.current = playing;
    syncEngagement();
  }, [syncEngagement]);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;
    
    // 관리자(작성자)인 경우 로그 기록 안 함 (단, 토글을 켰을 때는 기록함)
    if (localStorage.getItem('diary_admin_token') && localStorage.getItem('admin_logging_enabled') !== 'true') {
      return;
    }

    const sid = sessionId.current;

    const initLog = async () => {
      if (hasInserted.current) return;
      hasInserted.current = true;
      
      const deviceInfo = parseUserAgent(navigator.userAgent);

      supabase?.from('access_logs').insert({
        id: sid,
        device_info: deviceInfo,
        duration_sec: 0,
        share_token: token || null,
      }).then(({ error }) => {
        if (error) console.error('Failed to insert access log:', error);
      });
    };

    initLog();

    // 현재까지의 포그라운드 체류 시간(초) 계산
    const currentDurationSec = () => {
      const activeExtra = activeStart.current !== null ? (Date.now() - activeStart.current) / 1000 : 0;
      return Math.floor(accumulatedSec.current + activeExtra);
    };

    // 체류 시간 및 들은 노래 업데이트 함수
    const updateDuration = () => {
      const durationSec = currentDurationSec();
      const currentMap = songPlayMapRef.current;
      const songsStr = currentMap ? formatSongPlayMap(currentMap) : null;

      supabase?.from('access_logs')
        .update({
          duration_sec: durationSec,
          listened_songs: songsStr
        })
        .eq('id', sid)
        .then(() => {});
    };
    flushRef.current = updateDuration;

    // 5초 주기로 업데이트
    const intervalId = setInterval(updateDuration, 5000);

    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === 'visible';
      syncEngagement();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateDuration);
    window.addEventListener('pagehide', updateDuration);

    return () => {
      clearInterval(intervalId);
      updateDuration();
      flushRef.current = null;
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateDuration);
      window.removeEventListener('pagehide', updateDuration);
    };
  }, [songPlayMapRef, token, syncEngagement]);

  return { notifyPlaying };
}
