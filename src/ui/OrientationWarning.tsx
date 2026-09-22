import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

interface OrientationWarningProps {
  currentScreen?: string;
}

export const OrientationWarning: React.FC<OrientationWarningProps> = ({ currentScreen = 'MENU' }) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouch && window.innerHeight > window.innerWidth) {
        setIsPortrait(true);
      } else {
        setIsPortrait(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Never block menu, arsenal, missions, or settings screens on mobile!
  if (!isPortrait || dismissed || currentScreen !== 'PLAYING') return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
      <div className="relative mb-5">
        <Smartphone className="w-14 h-14 text-zinc-500 animate-pulse" />
        <RotateCw className="w-7 h-7 text-red-500 absolute -top-2 -right-2 animate-spin" />
      </div>

      <h2 className="font-teko text-3xl md:text-4xl font-bold text-white tracking-wider mb-1.5">
        LANDSCAPE RECOMMENDED
      </h2>
      <p className="font-military text-xs text-zinc-300 max-w-xs leading-relaxed mb-6">
        Turn your phone sideways for wider tactical field-of-view and dual thumb joystick controls.
      </p>

      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <div className="font-mono text-[11px] text-red-400 bg-red-950/70 border border-red-800/80 px-4 py-2 rounded">
          ROTATE PHONE FOR WIDE FOV
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 border border-zinc-700 rounded font-teko text-lg tracking-wider transition-colors cursor-pointer"
        >
          CONTINUE IN PORTRAIT MODE
        </button>
      </div>
    </div>
  );
};
