import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resolveAudioUrl } from '../lib/idb';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

type Props = {
  src: string;
  title: string;
  autoPlay?: boolean;
  onProgress?: (current: number, duration: number) => void;
  onEnded?: () => void;
};

export default function AudioPlayer({ src, title, autoPlay, onProgress, onEnded }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

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
    setCurrent(0);
    setDuration(0);
    if (ref.current) {
      ref.current.pause();
      ref.current.load();
    }
  }, [resolvedSrc]);

  const toggle = async () => {
    if (!resolvedSrc || !ref.current) return;
    if (playing) ref.current.pause();
    else await ref.current.play();
  };

  return (
    <div className="player-shell" aria-label={`${title} 오디오 플레이어`}>
      <audio
        ref={ref}
        src={resolvedSrc || undefined}
        autoPlay={autoPlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
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
        {playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
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
              onChange={(event) => {
                const next = Number(event.target.value);
                setCurrent(next);
                if (ref.current) ref.current.currentTime = next;
              }}
            />
            <span className="player-time">{formatTime(current)} / {formatTime(duration)}</span>
          </>
        )}
      </div>
      <Volume2 size={18} className="volume-icon" />
    </div>
  );
}
