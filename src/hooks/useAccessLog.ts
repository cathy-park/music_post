import { useEffect, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';
import { parseUserAgent } from '../lib/userAgent';

export function useAccessLog() {
  const sessionId = useRef(crypto.randomUUID());
  const startTime = useRef(Date.now());
  const hasInserted = useRef(false);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;

    const deviceInfo = parseUserAgent(navigator.userAgent);
    const sid = sessionId.current;

    // 1. 최초 진입 시 로그 생성
    if (!hasInserted.current) {
      hasInserted.current = true;
      supabase.from('access_logs').insert({
        id: sid,
        device_info: deviceInfo,
        duration_sec: 0,
      }).then(({ error }) => {
        if (error) console.error('Failed to insert access log:', error);
      });
    }

    // 2. 체류 시간 업데이트 함수
    const updateDuration = () => {
      const durationSec = Math.floor((Date.now() - startTime.current) / 1000);
      // Beacon API 방식은 아니지만, 모바일 대응을 위해 간단하게 처리
      supabase?.from('access_logs')
        .update({ duration_sec: durationSec })
        .eq('id', sid)
        .then(() => {});
    };

    // 3. 페이지 닫힘, 숨김 처리 이벤트 등록
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDuration();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateDuration);
    window.addEventListener('pagehide', updateDuration);

    // 언마운트 시(SPA 라우팅 전환 시)에도 업데이트
    return () => {
      updateDuration();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateDuration);
      window.removeEventListener('pagehide', updateDuration);
    };
  }, []);
}
