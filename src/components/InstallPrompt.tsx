import { useEffect, useRef, useState } from 'react';
import { X, Share, Download } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 이미 설치됐거나 닫은 적 있으면 표시 안 함
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS는 3초 후 배너 표시
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    // Android/Chrome: beforeinstallprompt 이벤트 캐치
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      deferredPrompt.current = null;
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-icon">
        <img src="/apple-touch-icon.png" alt="앱 아이콘" width={48} height={48} />
      </div>
      <div className="install-prompt-body">
        <p className="install-prompt-title">홈 화면에 추가하기</p>
        {isIOS ? (
          <p className="install-prompt-desc">
            <Share size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            공유 버튼 → <strong>'홈 화면에 추가'</strong> 를 탭하세요
          </p>
        ) : (
          <p className="install-prompt-desc">앱처럼 설치해서 더 편하게 즐겨요 💌</p>
        )}
      </div>
      {!isIOS && (
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
