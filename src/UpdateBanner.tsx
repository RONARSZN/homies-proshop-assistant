import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Homies service worker registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <aside className="release-banner" role="status" aria-live="polite">
      <span>New version available — Reload</span>
      <div className="release-banner-actions">
        <button className="button button-primary" type="button" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
        <button className="release-dismiss" type="button" onClick={() => setNeedRefresh(false)}>
          Dismiss
        </button>
      </div>
    </aside>
  );
}
