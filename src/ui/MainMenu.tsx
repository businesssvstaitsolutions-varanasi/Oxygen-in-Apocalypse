import React from 'react';
import { Shield, Crosshair, Wrench, Globe, Settings as SettingsIcon, DollarSign, Play, Smartphone, Skull, Coins } from 'lucide-react';
import { PlayerSaveData } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface MainMenuProps {
  saveData: PlayerSaveData;
  onPlay: () => void;
  onOpenArsenal: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
  onOpenSpecimen?: () => void;
  onOpenBuyCoins: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  onPlay,
  onOpenArsenal,
  onOpenMissions,
  onOpenSettings,
  onOpenSpecimen,
  onOpenBuyCoins,
}) => {
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024);

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto overflow-x-hidden bg-gradient-to-t from-black/90 via-black/50 to-black/75 pointer-events-auto select-none">
      <div className="min-h-full w-full flex flex-col justify-between p-4 sm:p-6 md:p-12 max-w-7xl mx-auto">
        {/* Top Header: Branding & Player Credits */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3.5 sm:gap-5 flex-1 pr-2">
            {/* App Logo Emblem */}
            <div className="relative shrink-0 group cursor-pointer">
              <div className="absolute inset-0 rounded-full bg-red-600/20 blur-md group-hover:bg-red-600/35 transition-all" />
              <img
                src="/app-logo.png"
                alt="Dead Zone Trigger Official Emblem Logo"
                className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] hover:scale-105 transition-transform select-none"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span className="font-mono text-[10px] sm:text-xs text-red-500 uppercase tracking-widest font-bold">
                  BIO-HAZARD PROTOCOL ACTIVE
                </span>
              </div>
              <h1 className="font-teko text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] leading-none">
                DEADZONE<span className="text-red-600">:</span> OUTBREAK
              </h1>
              <p className="font-military text-xs sm:text-sm text-zinc-300 max-w-md mt-1.5 leading-relaxed hidden sm:block">
                Quarantine Sector compromised. Neutralize mutated bio-threats, salvage tactical supplies, and secure critical sectors.
              </p>
            </div>
          </div>

          {/* Credits Badge with Quick Buy Action and PWA Install */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-end">
            <PWAInstallButton />

            <div className="flex items-center gap-2 bg-black/90 border border-amber-500/60 p-1.5 sm:px-3 sm:py-2 rounded-xl shadow-xl backdrop-blur-md shrink-0">
              <div className="flex items-center gap-1.5 px-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">CREDITS</span>
                  <span className="font-teko text-xl sm:text-2xl font-bold text-amber-400 leading-none">
                    {saveData.credits.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={onOpenBuyCoins}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white px-2.5 sm:px-3.5 py-1.5 rounded-lg font-teko text-base sm:text-lg font-bold tracking-wider uppercase cursor-pointer shadow-md shadow-emerald-950/60 transition-all border border-emerald-400/50 min-h-[38px] touch-manipulation"
                title="Get free coins for testing"
              >
                <Coins className="w-4 h-4 text-amber-300" />
                <span>+ BUY COINS</span>
                <span className="text-[9px] font-mono bg-black/40 px-1 py-0.2 rounded text-emerald-200 hidden sm:inline">
                  FREE
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Navigation Menu Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-sm sm:max-w-md my-auto py-3">
          {/* Play / Deploy Button */}
          <button
            onClick={onPlay}
            className="group relative flex items-center justify-between bg-red-600 hover:bg-red-500 active:bg-red-700 border-2 border-red-400 text-white px-5 sm:px-6 py-3.5 rounded-lg font-teko text-2xl sm:text-3xl font-bold tracking-wider shadow-2xl shadow-red-950/80 active:scale-[0.98] transition-all cursor-pointer min-h-[54px] touch-manipulation"
          >
            <div className="flex items-center gap-3">
              <Play className="w-6 h-6 fill-white" />
              <span>DEPLOY MISSION</span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-red-100 bg-red-800/90 border border-red-400/40 px-2.5 py-1 rounded font-bold">
              M-{saveData.highestMissionUnlocked}
            </span>
          </button>

          {/* Arsenal & Weapon Upgrades */}
          <button
            onClick={onOpenArsenal}
            className="flex items-center gap-3 bg-zinc-900/95 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-700 hover:border-amber-500/60 text-zinc-100 px-5 sm:px-6 py-3 rounded-lg font-teko text-xl sm:text-2xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[50px] touch-manipulation"
          >
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <span>ARSENAL & UPGRADES</span>
          </button>

          {/* Requisition / Buy Coins (Free Test) */}
          <button
            onClick={onOpenBuyCoins}
            className="flex items-center justify-between bg-gradient-to-r from-emerald-950/80 via-zinc-900/95 to-zinc-900/95 hover:from-emerald-900 active:from-emerald-950 border border-emerald-500/60 hover:border-emerald-400 text-zinc-100 px-5 sm:px-6 py-3 rounded-lg font-teko text-xl sm:text-2xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[50px] touch-manipulation group"
          >
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-emerald-300">BUY COINS / REQUISITION</span>
            </div>
            <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
              100% FREE
            </span>
          </button>

          {/* Campaign Missions Selector */}
          <button
            onClick={onOpenMissions}
            className="flex items-center gap-3 bg-zinc-900/95 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-700 hover:border-blue-500/60 text-zinc-100 px-5 sm:px-6 py-3 rounded-lg font-teko text-xl sm:text-2xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[50px] touch-manipulation"
          >
            <Globe className="w-5 h-5 text-blue-400 shrink-0" />
            <span>CAMPAIGN MISSIONS</span>
          </button>

          {/* Bio-Specimen Intel / Melty Zombie 3D Viewer */}
          {onOpenSpecimen && (
            <button
              onClick={onOpenSpecimen}
              className="flex items-center justify-between bg-zinc-900/95 hover:bg-zinc-800 active:bg-zinc-700 border border-red-900/80 hover:border-red-500 text-zinc-100 px-5 sm:px-6 py-3 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[50px] touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <Skull className="w-5 h-5 text-red-500 shrink-0" />
                <span>MUTANT INTEL: MELTY ZOMBIE</span>
              </div>
              <span className="font-mono text-[10px] bg-red-950 text-red-400 border border-red-700/80 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                3D VIEW
              </span>
            </button>
          )}

          {/* Settings & Controls */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 bg-zinc-900/95 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 text-zinc-100 px-5 sm:px-6 py-3 rounded-lg font-teko text-lg sm:text-xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all cursor-pointer min-h-[50px] touch-manipulation"
          >
            <SettingsIcon className="w-5 h-5 text-zinc-400 shrink-0" />
            <span>SETTINGS & CONTROLS</span>
          </button>
        </div>

        {/* Bottom Footer Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] sm:text-xs font-military text-zinc-400 pt-3 border-t border-zinc-800/80 mt-4">
          <div className="flex items-center gap-2">
            {isTouchDevice ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                MOBILE TOUCH CONTROLS ACTIVE: DUAL VIRTUAL JOYSTICKS & BUTTONS
              </span>
            ) : (
              <span>TACTICAL CONTROLS: [WASD] MOVE | [MOUSE] AIM | [L-CLICK] FIRE | [R] RELOAD | [E] USE | [F] FLASHLIGHT</span>
            )}
          </div>
          <span className="text-zinc-500 font-mono">SECTOR OPS V1.2.0 &bull; SECURE DEPLOYMENT</span>
        </div>
      </div>
    </div>
  );
};
