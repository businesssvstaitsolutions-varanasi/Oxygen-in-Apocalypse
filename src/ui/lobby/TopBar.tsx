import React from 'react';
import { Volume2, Skull } from 'lucide-react';

interface TopBarProps {
  credits: number;
}

export const TopBar: React.FC<TopBarProps> = ({ credits }) => {
  const xpCurrent = 5760;
  const xpMax = 8500;
  const xpPercent = (xpCurrent / xpMax) * 100;

  return (
    <div className="relative z-20 flex items-start justify-between px-3 sm:px-5 pt-3 sm:pt-4 gap-2 sm:gap-4">
      {/* LEFT: Game Title */}
      <div className="flex flex-col gap-1 shrink-0">
        <h1 className="font-oswald text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          <span className="text-[#E8E8E8]" style={{ textShadow: '0 0 30px rgba(255,255,255,0.15)' }}>DEADZONE:</span>
          <span className="text-[#FF1717] ml-1 sm:ml-2" style={{ textShadow: '0 0 20px rgba(255,23,23,0.4)' }}>OUTBREAK</span>
        </h1>
        <div className="flex items-center gap-2">
          <div className="warning-stripes px-2 py-0.5 rounded-sm">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#FF9D18] font-bold tracking-widest uppercase">
              ⚠ BIOHAZARD PROTOCOL
            </span>
          </div>
          <div className="border border-[#C91010]/60 bg-[#C91010]/15 px-2 py-0.5 rounded-sm">
            <span className="font-mono text-[9px] sm:text-[10px] text-[#FF1717] font-bold tracking-wider">
              V2.4.0 CLASSIFIED
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Operator Progression */}
      <div className="hidden md:flex items-center gap-3 bg-[#0A0D0F]/80 border border-[#73787C]/30 px-4 py-2.5 rounded tactical-panel backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full bg-[#111518] border border-[#73787C]/40 flex items-center justify-center">
          <Skull className="w-5 h-5 text-[#E8E8E8]" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-rajdhani text-xs sm:text-sm text-[#E8E8E8] font-bold tracking-wider uppercase">
              SPECIAL OPERATOR
            </span>
            <span className="font-mono text-[10px] text-[#FF9D18] bg-[#FF9D18]/10 px-1.5 py-0.5 rounded border border-[#FF9D18]/30">
              RANK 5
            </span>
          </div>
          {/* Segmented XP Bar */}
          <div className="w-40 sm:w-48 h-2.5 bg-[#111518] rounded-sm border border-[#73787C]/20 overflow-hidden progress-segment">
            <div
              className="h-full bg-gradient-to-r from-[#C91010] to-[#FF1717] xp-bar-fill"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <span className="font-mono text-[9px] text-[#73787C]">
            {xpCurrent.toLocaleString()} / {xpMax.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* RIGHT: Credits + Now Playing */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Credits */}
        <div className="bg-[#0A0D0F]/80 border border-[#F5B83D]/40 px-3 py-2 rounded tactical-panel-right backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#111518] border border-[#F5B83D]/30 flex items-center justify-center">
              <span className="text-[#F5B83D] text-lg">💰</span>
            </div>
            <div className="flex flex-col">
              <span className="font-oswald text-lg sm:text-xl text-[#F5B83D] font-bold leading-none">
                +${credits.toLocaleString()}
              </span>
              <span className="font-mono text-[8px] sm:text-[9px] text-[#73787C] tracking-wider uppercase">
                REQUISITION CREDITS
              </span>
            </div>
          </div>
        </div>

        {/* Now Playing */}
        <div className="hidden lg:flex bg-[#0A0D0F]/80 border border-[#73787C]/20 px-3 py-2 rounded tactical-panel backdrop-blur-sm items-center gap-2">
          <Volume2 className="w-4 h-4 text-[#70E35C]" />
          <div className="flex flex-col">
            <span className="font-mono text-[8px] text-[#73787C] tracking-wider uppercase">NOW PLAYING:</span>
            <span className="font-rajdhani text-[10px] sm:text-xs text-[#70E35C] font-bold tracking-wide uppercase">
              O² IN APOCALYPSE
            </span>
          </div>
          {/* Equalizer Bars */}
          <div className="flex items-end gap-[2px] h-4 ml-1">
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
            <div className="eq-bar" />
          </div>
        </div>
      </div>
    </div>
  );
};
