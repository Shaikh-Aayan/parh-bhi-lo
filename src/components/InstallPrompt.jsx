import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show our custom UI
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="mx-4 mt-4 mb-2 bg-[var(--color-accent)] text-white p-4 rounded-2xl shadow-lg relative overflow-hidden flex items-center gap-4">
      {/* Background decoration */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full" />
      
      <div className="bg-white/20 p-2.5 rounded-xl flex-shrink-0">
        <Download className="w-6 h-6 text-white" />
      </div>
      
      <div className="flex-1 pr-6">
        <h3 className="font-bold text-sm mb-0.5 leading-tight">Install App</h3>
        <p className="text-xs text-white/80 font-medium">Add to home screen for quick access.</p>
      </div>

      <button
        onClick={handleInstall}
        className="px-4 py-2 bg-white text-[var(--color-accent)] text-xs font-black uppercase tracking-wider rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-transform"
      >
        Get
      </button>

      <button
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 right-2 p-1 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
