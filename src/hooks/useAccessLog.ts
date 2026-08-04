import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';
import { parseUserAgent } from '../lib/userAgent';

/** 각 곡의 실제 재생 시간(초)을 추적하는 Map: title → 누적 재생 초 */
export type SongPlayMap = Map<string, number>;

/**
 * 재생 시간 맵을 DB 저장용 문자열로 변환
 * 형식: "곡제목 - 1분 23초\n곡제목2 - 45초" (줄바꿈 구분)
 */
function formatSongPlayMap(map: SongPlayMap): string | null {
  if (map.size === 0) return null;
  const lines: string[] = [];
  for (const [title, sec] of map) {
    if (sec < 1) continue; // 1초 미만은 무시
    if (sec < 60) {
      lines.push(`${title} - ${Math.floor(sec)}초`);
    } else {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      lines.push(`${title} - ${m}분 ${s}초`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

export function useAccessLog(songPlayMapRef: React.RefObject<SongPlayMap>, token?: string) {
  const sessionId = useRef(crypto.randomUUID());
  const hasInserted = useRef(false);
  // 탭이 화면에 보이는(포그라운드) 시간만 누적한다 — 백그라운드로 가 있는 동안은 세지 않는다.
  const accumulatedSec = useRef(0);
  const activeStart = useRef<number | null>(
    typeof document !== 'undefined' && document.visibilityState === 'visible' ? Date.now() : null
  );

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

    // 5초 주기로 업데이트
    const intervalId = setInterval(updateDuration, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 백그라운드로 전환되는 시점까지의 포그라운드 시간을 누적하고 카운트를 멈춘다
        if (activeStart.current !== null) {
          accumulatedSec.current += (Date.now() - activeStart.current) / 1000;
          activeStart.current = null;
        }
        updateDuration();
      } else {
        // 다시 포그라운드로 돌아오면 카운트를 재개한다
        activeStart.current = Date.now();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateDuration);
    window.addEventListener('pagehide', updateDuration);

    return () => {
      clearInterval(intervalId);
      updateDuration();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateDuration);
      window.removeEventListener('pagehide', updateDuration);
    };
  }, []);
}
