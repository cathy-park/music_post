import { useEffect, useState } from 'react';
import { X, Share, Compass } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isKakao, setIsKakao] = useState(false);

  useEffect(() => {
    // 이미 앱으로 실행 중이거나(standalone), 닫은 적이 있으면 표시 안 함
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent.toLowerCase();
    const kakao = /kakaotalk/i.test(ua);
    const ios = /ipad|iphone|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const android = /android/.test(ua);

    setIsIOS(ios);
    setIsKakao(kakao);

    // 1. 카카오톡 인앱 브라우저 처리
    if (kakao) {
      if (android) {
        // 안드로이드 카톡: 외부 브라우저(크롬)로 즉시 강제 이동
        window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
        return;
      } else {
        // iOS 카톡: 자동 이동이 어려우므로 안내 배너 띄움
        const t = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(t);
      }
    }

    // 2. 일반 브라우저 처리
    if (ios) {
      // 일반 iOS 사파리: 설치 안내 배너 띄움
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    } else {
      // 일반 안드로이드(크롬/삼성인터넷 등): 
      // 브라우저 자체적으로 설치 팝업/인포바가 상단/하단에 뜨므로, 커스텀 배너를 띄우지 않아 2중 표시 방지
      // 아무것도 하지 않음 (show = false)
      return;
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">
        <img src="/apple-touch-icon.png" alt="앱 아이콘" width={48} height={48} />
      </div>
      <div className="install-prompt-body">
        {isKakao ? (
          <>
            <p className="install-prompt-title">사파리(Safari)로 열어주세요!</p>
            <p className="install-prompt-desc">
              카카오톡에서는 앱 설치가 안 돼요. 우측 하단 <Compass size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> 버튼을 눌러 <strong>'다른 브라우저로 열기'</strong>를 선택해주세요.
            </p>
          </>
        ) : (
          <>
            <p className="install-prompt-title">홈 화면에 추가하기</p>
            <p className="install-prompt-desc">
              <Share size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              공유 버튼 → <strong>'홈 화면에 추가'</strong> 를 탭하세요
            </p>
          </>
        )}
      </div>
      <button className="install-prompt-close" onClick={handleDismiss} aria-label="닫기">
        <X size={16} />
      </button>
    </div>
  );
}
