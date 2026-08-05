import { Pause, Play, Volume2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { resolveAudioUrl } from '../lib/idb';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export type AudioPlayerRef = {
  seekTo: (time: number) => void;
  play: () => void;
};

type Props = {
  src: string;
  title: string;
  subtitle?: string;
  albumTitle?: string;
  autoPlay?: boolean;
  /** true면 곡이 끝나도 onEnded를 호출하지 않고 브라우저가 같은 곡을 처음부터 반복 재생한다(한 곡 반복). */
  loop?: boolean;
  onProgress?: (current: number, duration: number) => void;
  onPlayStart?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  /** 스킵이 아니라 곡이 끝까지 자연 재생되어 끝났을 때만 호출됨 (완청 판별용) */
  onCompleted?: () => void;
  onEnded?: () => void;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
};

const AudioPlayer = forwardRef<AudioPlayerRef, Props>(({ src, title, subtitle, albumTitle, autoPlay, loop, onProgress, onPlayStart, onPlayingChange, onCompleted, onEnded, onPrev, onNext }, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    },
    play: () => {
      audioRef.current?.play();
    }
  }));

  useEffect(() => {
    let active = true;
    const loadSrc = async () => {
      const url = await resolveAudioUrl(src);
      if (active) setResolvedSrc(url);
    };
    loadSrc();
    return () => { active = false; };
  }, [src]);

  useEffect(() => {
    setPlaying(false);
    onPlayingChange?.(false);
    setCurrent(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc]);

  // ── Media Session API: 블루투스/잠금화면 미디어 컨트롤 ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: subtitle || '',
      album: albumTitle || '',
    });
  }, [title, subtitle, albumTitle]);

  // 재생 상태에 따른 Media Session playback state 업데이트
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  // Media Session 액션 핸들러 (이전/다음/재생/일시정지)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlePlay = async () => {
      if (audioRef.current && resolvedSrc) {
        await audioRef.current.play();
      }
    };
    const handlePause = () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
    const handleSeekBackward = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      }
    };
    const handleSeekForward = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + 10
        );
      }
    };

    navigator.mediaSession.setActionHandler('play', handlePlay);
    navigator.mediaSession.setActionHandler('pause', handlePause);
    navigator.mediaSession.setActionHandler('seekbackward', handleSeekBackward);
    navigator.mediaSession.setActionHandler('seekforward', handleSeekForward);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev || null);
    navigator.mediaSession.setActionHandler('nexttrack', onNext || null);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [resolvedSrc, onPrev, onNext]);

  // Media Session position state 업데이트
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration || !playing) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: Math.min(current, duration),
      });
    } catch {
      // 일부 브라우저에서 지원하지 않을 수 있음
    }
  }, [current, duration, playing]);

  const toggle = async () => {
    if (!resolvedSrc || !audioRef.current) return;
    if (playing) audioRef.current.pause();
    else await audioRef.current.play();
  };

  return (
    <div className="player-shell" aria-label={`${title} 오디오 플레이어`}>
      <audio
        ref={audioRef}
        src={resolvedSrc || undefined}
        autoPlay={autoPlay}
        loop={loop}
        onPlay={() => { setPlaying(true); onPlayStart?.(); onPlayingChange?.(true); }}
        onPause={() => { setPlaying(false); onPlayingChange?.(false); }}
        onEnded={() => {
          setPlaying(false);
          onPlayingChange?.(false);
          onCompleted?.();
          onEnded?.();
        }}
        onTimeUpdate={(event) => {
          const t = event.currentTarget.currentTime;
          const d = event.currentTarget.duration || 0;
          setCurrent(t);
          onProgress?.(t, d);
        }}
        onLoadedMetadata={(event) => {
          const d = event.currentTarget.duration;
          setDuration(d);
          onProgress?.(0, d);
        }}
      />
      <button className="play-button" onClick={toggle} disabled={!resolvedSrc} aria-label={playing ? '일시정지' : '재생'}>
        {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="player-main inline-player-main">
        {!resolvedSrc ? (
          <span className="player-status">음원 준비 중</span>
        ) : (
          <>
            <input
              className="progress"
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={current}
              style={{
                background: `linear-gradient(to right, #df7183 ${duration > 0 ? (current / duration) * 100 : 0}%, rgba(223,113,131,0.18) ${duration > 0 ? (current / duration) * 100 : 0}%)`
              }}
              onChange={(event) => {
                const next = Number(event.target.value);
                setCurrent(next);
                if (audioRef.current) audioRef.current.currentTime = next;
              }}
            />
            <span className="player-time">{formatTime(current)} / {formatTime(duration)}</span>
          </>
        )}
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
