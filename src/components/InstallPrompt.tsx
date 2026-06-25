import { useEffect, useRef, useState } from 'react';
import { X, Share, Compass, Download } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isKakao, setIsKakao] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

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
    setIsAndroid(android);

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
      // 일반 iOS 사파리: 3초 후 안내 배너 띄움
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    } 
    
    // 일반 안드로이드(크롬 등): beforeinstallprompt 이벤트 대기
    const handler = (e: Event) => {
      // 브라우저 기본 설치 배너(미니 인포바)가 뜨는 것을 막음!
      e.preventDefault(); 
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      
      // 우리 커스텀 배너를 3초 후 띄움
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      // 사용자가 우리 버튼을 누르면, 브라우저 시스템 진짜 설치 다이얼로그 호출
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      localStorage.setItem(DISMISSED_KEY, '1'); // 설치 수락/거절 모두 영구 저장
      setShow(false);
      deferredPrompt.current = null;
    }
  };

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
              {isIOS ? (
                <><Share size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />공유 버튼 → <strong>'홈 화면에 추가'</strong> 를 탭하세요</>
              ) : (
                <>앱처럼 설치해서 더 편하게 즐겨요 💌</>
              )}
            </p>
          </>
        )}
      </div>
      {/* 안드로이드이고 카톡이 아닐 때만 실제 설치 버튼 표시 */}
      {isAndroid && !isKakao && (
        <button className="install-prompt-btn" onClick={handleInstall}>
          <Download size={14} />
          설치
        </button>
      )}
      <button className="install-prompt-close" onClick={handleDismiss} aria-label="닫기">
        <X size={16} />
      </button>
    </div>
  );
}
