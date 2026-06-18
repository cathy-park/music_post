import { Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

type Props = {
  src: string;
  title: string;
};

export default function AudioPlayer({ src, title }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    if (ref.current) {
      ref.current.pause();
      ref.current.load();
    }
  }, [src]);

  const toggle = async () => {
    if (!src || !ref.current) return;
    if (playing) ref.current.pause();
    else await ref.current.play();
  };

  return (
    <div className="player-shell" aria-label={`${title} 오디오 플레이어`}>
      <audio
        ref={ref}
        src={src || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <button className="play-button" onClick={toggle} disabled={!src} aria-label={playing ? '일시정지' : '재생'}>
        {playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
      </button>
      <div className="player-main">
        <div className="player-topline">
          <strong>{src ? '노래일기 듣기' : '음원 준비 중'}</strong>
          <span>{formatTime(current)} / {formatTime(duration)}</span>
        </div>
        <input
          className="progress"
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={current}
          disabled={!src}
          onChange={(event) => {
            const next = Number(event.target.value);
            setCurrent(next);
            if (ref.current) ref.current.currentTime = next;
          }}
        />
      </div>
      <Volume2 size={18} className="volume-icon" />
    </div>
  );
}
