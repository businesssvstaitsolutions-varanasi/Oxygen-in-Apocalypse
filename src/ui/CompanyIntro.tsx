import React, { useEffect, useState } from 'react';

interface CompanyIntroProps {
  onComplete: () => void;
}

export const CompanyIntro: React.FC<CompanyIntroProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'fadein' | 'hold' | 'fadeout' | 'done'>('fadein');
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Phase 1: Fade in over 1s
    const fadeInTimer = setTimeout(() => {
      setOpacity(1);
      setPhase('hold');
    }, 50);

    // Phase 2: Hold for 3.5s (starts after 1s fade-in)
    const holdTimer = setTimeout(() => {
      setPhase('fadeout');
      setOpacity(0);
    }, 4000);

    // Phase 3: Fade out completes, transition
    const completeTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(holdTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer select-none"
      onClick={onComplete}
    >
      <div
        className="flex flex-col items-center gap-2 sm:gap-4 px-4"
        style={{
          opacity,
          transition: 'opacity 1s ease-in-out',
        }}
      >
        {/* Company Logo Emblem */}
        <img
          src="/assets/ui/company-logo.png"
          alt="Red Chair Games"
          className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain drop-shadow-[0_0_40px_rgba(220,38,38,0.3)]"
          draggable={false}
        />

        {/* Company Text Logo */}
        <img
          src="/assets/ui/company-text.png"
          alt="Red Chair Games"
          className="w-64 sm:w-80 md:w-96 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          draggable={false}
        />
      </div>
    </div>
  );
};
