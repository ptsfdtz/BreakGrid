import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let updateWaiting = false;
const updateApp = registerSW({
  immediate: true,
  onNeedRefresh() { updateWaiting = true; window.dispatchEvent(new Event('breakgrid-update')); },
  onRegisterError(error) { console.warn('Offline registration unavailable:', error); },
});
function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function usePwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(installed);
  const [updateReady, setUpdateReady] = useState(() => updateWaiting);
  const [installHelp, setInstallHelp] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstall = () => { setPrompt(null); setStandalone(true); setInstallHelp(false); };
    const onDisplay = () => setStandalone(installed());
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstall);
    window.addEventListener('breakgrid-update', onUpdate);
    media.addEventListener('change', onDisplay);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstall);
      window.removeEventListener('breakgrid-update', onUpdate);
      media.removeEventListener('change', onDisplay);
    };
  }, []);
  const install = async () => {
    if (!prompt) { setInstallHelp(value => !value); return; }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstallHelp(false);
    } catch { setInstallHelp(true); }
    finally { setPrompt(null); }
  };
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return { standalone, updateReady, installHelp, install, update: () => updateApp(true), isIos };
}
