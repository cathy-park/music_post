import { Music } from 'lucide-react';

export default function EmptyAudio() {
  return (
    <div className="empty-audio">
      <Music size={22} />
      <span>관리자 화면에서 음원을 올리면 여기에 재생 버튼이 활성화돼.</span>
    </div>
  );
}
