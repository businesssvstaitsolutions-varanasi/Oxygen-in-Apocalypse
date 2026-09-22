import React from 'react';
import { PlayerController } from '../player/PlayerController';
import { ZombieManager } from '../zombies/ZombieManager';
import { MissionManager } from '../missions/MissionManager';
import { SaveManager } from '../core/SaveManager';

interface DebugOverlayProps {
  fps: number;
  player: PlayerController;
  zombieManager: ZombieManager;
  missionManager: MissionManager;
  onRefreshData: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  fps,
  player,
  zombieManager,
  missionManager,
  onRefreshData,
}) => {
  return (
    <div className="absolute top-2 left-2 z-50 bg-black/90 border border-green-500/80 p-3 rounded font-mono text-[11px] text-green-400 pointer-events-auto shadow-2xl space-y-1.5 max-w-xs">
      <div className="flex justify-between font-bold border-b border-green-800 pb-1 text-xs">
        <span>TACTICAL DEBUG (F3)</span>
        <span className="text-white font-bold">{fps} FPS</span>
      </div>

      <div>POS: X={player.position.x.toFixed(1)} Y={player.position.y.toFixed(1)} Z={player.position.z.toFixed(1)}</div>
      <div>ACTIVE ZOMBIES: {zombieManager.activeZombieCount}</div>
      <div>HP: {Math.ceil(player.hp)} / 100</div>
      <div>WEAPON: {player.equippedWeaponKey.toUpperCase()} (MAG: {player.currentMag})</div>
      <div>CREDITS: ${SaveManager.get().credits}</div>

      <div className="pt-2 border-t border-green-800/80 grid grid-cols-2 gap-1.5 font-teko text-xs">
        <button
          onClick={() => zombieManager.spawnZombie('walker')}
          className="bg-green-950 hover:bg-green-900 border border-green-700 text-green-200 px-2 py-0.5 rounded"
        >
          + SPAWN WALKER
        </button>
        <button
          onClick={() => zombieManager.spawnZombie('brute')}
          className="bg-green-950 hover:bg-green-900 border border-green-700 text-green-200 px-2 py-0.5 rounded"
        >
          + SPAWN BRUTE
        </button>
        <button
          onClick={() => zombieManager.spawnZombie('colossus')}
          className="bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 px-2 py-0.5 rounded"
        >
          + SPAWN BOSS
        </button>
        <button
          onClick={() => {
            zombieManager.zombies.forEach((z) => {
              z.hp = 0;
              z.isDead = true;
            });
            zombieManager.activeZombieCount = 0;
          }}
          className="bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-200 px-2 py-0.5 rounded"
        >
          KILL ALL
        </button>
        <button
          onClick={() => {
            SaveManager.addCredits(1000);
            onRefreshData();
          }}
          className="bg-yellow-950 hover:bg-yellow-900 border border-yellow-700 text-yellow-200 px-2 py-0.5 rounded"
        >
          + $1000 CREDITS
        </button>
        <button
          onClick={() => player.heal(50)}
          className="bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-200 px-2 py-0.5 rounded"
        >
          RESTORE HP
        </button>
      </div>
    </div>
  );
};
