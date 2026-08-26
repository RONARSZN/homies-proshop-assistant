import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_KEY = 'homies-install-prompt-dismissed-until';
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 14;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIosSafari = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  && /safari/i.test(navigator.userAgent)
  && !/crios|fxios|edgios/i.test(navigator.userAgent);

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const snoozedUntil = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (snoozedUntil > Date.now()) {
      setDismissed(true);
      return;
    }
    setIos(isIosSafari());
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  if (dismissed || (!installEvent && !ios)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_MS));
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <aside className="install-banner" role="dialog" aria-label="Install Homies Proshop Assistant">
      <div>
        <strong>Install Homies Ops</strong>
        {ios
          ? <span>Use Share → Add to Home Screen in Safari.</span>
          : <span>Keep the shop workspace one tap away.</span>}
      </div>
      <div className="install-banner-actions">
        {installEvent && <button className="button button-primary" type="button" onClick={() => void install()}>Install</button>}
        <button className="release-dismiss" type="button" onClick={dismiss}>Later</button>
      </div>
    </aside>
  );
}
