import { useEffect, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';
import { parseUserAgent } from '../lib/userAgent';

export function useAccessLog() {
  const sessionId = useRef(crypto.randomUUID());
  const startTime = useRef(Date.now());
  const hasInserted = useRef(false);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;

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
          if (data.city && data.country_code) {
            locationStr = ` [${data.city}, ${data.country_code}]`;
          }
        }
      } catch (err) {
        console.warn('위치 정보 가져오기 실패:', err);
      }

      const finalDeviceInfo = baseDevice + locationStr;

      supabase.from('access_logs').insert({
        id: sid,
        device_info: finalDeviceInfo,
        duration_sec: 0,
      }).then(({ error }) => {
        if (error) console.error('Failed to insert access log:', error);
      });
    };

    initLog();

    // 2. 체류 시간 업데이트 함수
    const updateDuration = () => {
      const durationSec = Math.floor((Date.now() - startTime.current) / 1000);
      supabase?.from('access_logs')
        .update({ duration_sec: durationSec })
        .eq('id', sid)
        .then(() => {});
    };

    // 모바일 등에서 페이지 닫힘 이벤트가 불안정하므로 10초 주기로 핑(Ping) 날리기
    const intervalId = setInterval(updateDuration, 10000);

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
