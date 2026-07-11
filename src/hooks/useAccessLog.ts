import { useEffect, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';
import { parseUserAgent } from '../lib/userAgent';

export function useAccessLog(listenedSongs: string[] = []) {
  const sessionId = useRef(crypto.randomUUID());
  const startTime = useRef(Date.now());
  const hasInserted = useRef(false);
  
  // 최신 들은 노래 목록을 계속 유지
  const listenedSongsRef = useRef(listenedSongs);
  useEffect(() => {
    listenedSongsRef.current = listenedSongs;
  }, [listenedSongs]);

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
      
      let baseDevice = parseUserAgent(navigator.userAgent);
      let locationStr = '';
      
      try {
        // IP API를 이용해 대략적인 위치 파악
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const region = data.region ? `${data.region} ` : '';
          const city = data.city ? `${data.city}` : '';
          if (region || city) {
            locationStr = ` [${region}${city}]`;
          }
        }
      } catch (err) {
        console.warn('위치 정보 가져오기 실패:', err);
      }

      const finalDeviceInfo = baseDevice + locationStr;

      supabase?.from('access_logs').insert({
        id: sid,
        device_info: finalDeviceInfo,
        duration_sec: 0,
      }).then(({ error }) => {
        if (error) console.error('Failed to insert access log:', error);
      });
    };

    initLog();

    // 2. 체류 시간 및 들은 노래 업데이트 함수
    const updateDuration = () => {
      const durationSec = Math.floor((Date.now() - startTime.current) / 1000);
      const songsStr = listenedSongsRef.current.length > 0 ? listenedSongsRef.current.join(', ') : null;
      
      supabase?.from('access_logs')
        .update({ 
          duration_sec: durationSec,
          listened_songs: songsStr
        })
        .eq('id', sid)
        .then(() => {});
    };

    // 모바일 등에서 페이지 닫힘 이벤트가 불안정하므로 5초 주기로 핑(Ping) 날리기
    const intervalId = setInterval(updateDuration, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDuration();
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
