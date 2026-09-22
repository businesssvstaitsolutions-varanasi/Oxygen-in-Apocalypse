import * as THREE from 'three';
import { MissionConfig, ObjectiveStep, GameStats, ZombieTypeKey } from '../types';
import { CAMPAIGN_MISSIONS } from '../data/missions';
import { ZombieManager } from '../zombies/ZombieManager';
import { soundFx } from '../audio/SoundEffects';
import { SaveManager } from '../core/SaveManager';

interface QueuedSpawn {
  type: ZombieTypeKey;
  delayTimer: number;
  forceNarrowPath: boolean;
  bossOverride?: { isBoss: boolean; name: string; maxHp: number; scale?: number };
}

export const MISSION_BOSS_DEFINITIONS: Record<number, { type: ZombieTypeKey; name: string; maxHp: number; scale: number }> = {
  1: { type: 'brute', name: 'GOLIATH DREAD BRUTE', maxHp: 950, scale: 1.8 },
  2: { type: 'stalker', name: 'ELECTRO-STALKER OVERSEER', maxHp: 1250, scale: 1.85 },
  3: { type: 'bloater', name: 'DEPOT FLESH-GORGER', maxHp: 1600, scale: 1.9 },
  4: { type: 'enforcer', name: 'COMMANDER GRAVES', maxHp: 2000, scale: 2.0 },
  5: { type: 'colossus', name: 'THE ABOMINATION', maxHp: 2400, scale: 2.1 },
  6: { type: 'bloater', name: 'PLAGUE TOXIC TITAN', maxHp: 2800, scale: 2.1 },
  7: { type: 'enforcer', name: 'CARNIFEX JUGGERNAUT', maxHp: 3200, scale: 2.2 },
  8: { type: 'brute', name: 'SIEGE DREADNAUGHT', maxHp: 3600, scale: 2.2 },
  9: { type: 'stalker', name: 'NIGHTMARE APEX', maxHp: 4000, scale: 2.3 },
  10: { type: 'colossus', name: 'THE SUPREME COLOSSUS', maxHp: 5000, scale: 2.5 },
};

export class MissionManager {
  private zombieManager: ZombieManager;
  public currentMission: MissionConfig = CAMPAIGN_MISSIONS[0];
  public currentObjectiveIndex: number = 0;
  public currentWaveIndex: number = 0;
  public waveTimer: number = 0;
  public surviveTimer: number = 0;
  public isMissionActive: boolean = false;
  public isMissionComplete: boolean = false;
  public isMissionFailed: boolean = false;

  private spawnQueue: QueuedSpawn[] = [];
  public onVictoryCallback: ((stats: GameStats) => void) | null = null;

  public stats: GameStats = {
    kills: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageTaken: 0,
    creditsEarned: 0,
    missionTime: 0,
  };

  constructor(zombieManager: ZombieManager) {
    this.zombieManager = zombieManager;
  }

  public startMission(missionId: number) {
    const mission = CAMPAIGN_MISSIONS.find((m) => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.currentMission = JSON.parse(JSON.stringify(mission)); // clone
    this.currentObjectiveIndex = 0;
    this.currentWaveIndex = 0;
    this.waveTimer = 2.5; // Initial breathing room before first wave triggers
    this.surviveTimer = 0;
    this.isMissionActive = true;
    this.isMissionComplete = false;
    this.isMissionFailed = false;
    this.spawnQueue = [];

    this.stats = {
      kills: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageTaken: 0,
      creditsEarned: 0,
      missionTime: 0,
    };

    this.zombieManager.clearAll();

    // Spawn dormant ambient sentries in the district so the world feels alive and populated
    this.spawnInitialSentries(missionId);

    // Check if initial objective has a survival timer
    const curObj = this.getCurrentObjective();
    if (curObj && curObj.type === 'survive_time' && curObj.timerSeconds) {
      this.surviveTimer = curObj.timerSeconds;
    }
  }

  private spawnInitialSentries(missionId: number) {
    // Street sentries in dormant idle/wander mode
    this.zombieManager.spawnZombie('walker', undefined, false);
    this.zombieManager.spawnZombie('walker', undefined, false);
    // Alley / narrow path sentries
    this.zombieManager.spawnZombie('walker', undefined, true);
    this.zombieManager.spawnZombie('walker', undefined, true);

    if (missionId >= 2) {
      this.zombieManager.spawnZombie('runner', undefined, true);
    }
    if (missionId >= 3) {
      this.zombieManager.spawnZombie('brute', undefined, false);
    }
  }

  public getCurrentObjective(): ObjectiveStep | null {
    if (!this.currentMission || this.currentObjectiveIndex >= this.currentMission.objectives.length) {
      return null;
    }
    return this.currentMission.objectives[this.currentObjectiveIndex];
  }

  public getDistanceToCurrentObjective(playerPos: THREE.Vector3): number | null {
    const obj = this.getCurrentObjective();
    if (!obj || !obj.targetPosition) return null;
    const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
    return Math.round(playerPos.distanceTo(target));
  }

  public update(delta: number, playerPos: THREE.Vector3, onVictory: (stats: GameStats) => void) {
    this.onVictoryCallback = onVictory;

    if (!this.isMissionActive) return;
    if (this.isMissionComplete) {
      if (this.onVictoryCallback) {
        this.onVictoryCallback(this.stats);
      }
      return;
    }
    if (this.isMissionFailed) return;

    this.stats.missionTime += delta;

    // Process staggered spawn queue
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].delayTimer -= delta;
      if (this.spawnQueue[i].delayTimer <= 0) {
        const item = this.spawnQueue[i];
        this.zombieManager.spawnZombie(item.type, undefined, item.forceNarrowPath, item.bossOverride);
        this.spawnQueue.splice(i, 1);
      }
    }

    // Handle Wave Spawner (staggered enqueueing so zombies do NOT all spawn together)
    if (this.currentMission.waves && this.currentWaveIndex < this.currentMission.waves.length) {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) {
        const wave = this.currentMission.waves[this.currentWaveIndex];
        const isFinalWave = this.currentWaveIndex === this.currentMission.waves.length - 1;
        
        let cumulativeDelay = 0;
        wave.enemies.forEach((enemyGroup) => {
          for (let i = 0; i < enemyGroup.count; i++) {
            // Distribute 40-50% to narrow paths (except bosses)
            const isNarrow = (i % 2 === 1) && enemyGroup.type !== 'colossus';
            // Stagger each spawn with 0.8s - 1.4s spacing
            cumulativeDelay += 0.85 + Math.random() * 0.45;
            this.spawnQueue.push({
              type: enemyGroup.type,
              delayTimer: cumulativeDelay,
              forceNarrowPath: isNarrow,
            });
          }
        });

        // INJECT FINAL BOSS ON EVERY MISSION (Heavy health, sudden fast running ability)
        if (isFinalWave) {
          const bossDef = MISSION_BOSS_DEFINITIONS[this.currentMission.id] || {
            type: 'colossus' as ZombieTypeKey,
            name: 'APEX CORRUPTOR',
            maxHp: 1200 + this.currentMission.id * 350,
            scale: 2.0,
          };
          this.spawnQueue.push({
            type: bossDef.type,
            delayTimer: cumulativeDelay + 1.2,
            forceNarrowPath: false,
            bossOverride: {
              isBoss: true,
              name: bossDef.name,
              maxHp: bossDef.maxHp,
              scale: bossDef.scale,
            },
          });
        }

        this.currentWaveIndex++;
        this.waveTimer = (wave.spawnDelay || 14.0) + cumulativeDelay;
      }
    }

    // Mission 4: Barricade defense check - if all waves spawned and all zombies eliminated, win!
    if (this.currentMission.id === 4 && this.currentWaveIndex >= (this.currentMission.waves?.length || 0)) {
      const activeEnemies = this.zombieManager.zombies.filter((z) => !z.isDead).length;
      if (activeEnemies === 0 && this.spawnQueue.length === 0) {
        this.completeMission(onVictory);
        return;
      }
    }

    // Handle Active Objective
    const obj = this.getCurrentObjective();
    if (!obj) {
      this.completeMission(onVictory);
      return;
    }

    if (obj.type === 'reach_zone' && obj.targetPosition) {
      if (obj.timerSeconds) {
        this.surviveTimer -= delta;
        if (this.surviveTimer <= 0) {
          this.surviveTimer = 0;
          this.isMissionFailed = true;
          soundFx.playPlayerDeath();
          return;
        }
      }
      const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
      const dist = playerPos.distanceTo(target);
      if (dist <= (obj.targetRadius || 4.5)) {
        this.advanceObjective(onVictory);
      }
    } else if (obj.type === 'interact_object' && obj.targetPosition) {
      const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
      const dist = playerPos.distanceTo(target);
      // Auto-trigger if standing directly at the generator console
      if (dist <= 2.4) {
        soundFx.playPickup();
        this.advanceObjective(onVictory);
      }
    } else if (obj.type === 'survive_time') {
      this.surviveTimer -= delta;
      if (this.surviveTimer <= 0) {
        this.advanceObjective(onVictory);
      }
    }
  }

  public recordKill(isHeadshot: boolean, reward: number, isBoss: boolean = false) {
    this.stats.kills++;
    if (isHeadshot) this.stats.headshots++;
    this.stats.creditsEarned += reward;

    SaveManager.addCredits(reward);

    if (isBoss) {
      const bossObj = this.currentMission.objectives.find((o) => o.type === 'defeat_boss');
      if (bossObj) {
        bossObj.currentCount = 1;
      }
    }

    const obj = this.getCurrentObjective();
    if (!obj) return;

    if (obj.type === 'kill_count' && obj.targetCount) {
      obj.currentCount = (obj.currentCount || 0) + 1;
      if (obj.currentCount >= obj.targetCount) {
        this.advanceObjective(this.onVictoryCallback || undefined);
      }
    } else if (obj.type === 'defeat_boss') {
      if (isBoss || (obj.currentCount && obj.currentCount >= (obj.targetCount || 1))) {
        this.advanceObjective(this.onVictoryCallback || undefined);
      }
    }
  }

  public tryInteractObjective(playerPos: THREE.Vector3): boolean {
    const obj = this.getCurrentObjective();
    if (!obj || obj.type !== 'interact_object' || !obj.targetPosition) return false;

    const target = new THREE.Vector3(obj.targetPosition[0], obj.targetPosition[1], obj.targetPosition[2]);
    if (playerPos.distanceTo(target) <= (obj.targetRadius || 5.5)) {
      soundFx.playPickup();
      this.advanceObjective(this.onVictoryCallback || undefined);
      return true;
    }
    return false;
  }

  // Trigger aggressive zombie horde rush whenever an objective is completed
  public triggerObjectiveHorde() {
    soundFx.playHordeSiren();
    const hordeTypes: ZombieTypeKey[] = [
      'runner', 'walker', 'stalker', 'bloater', 'screamer', 'enforcer', 'crawler', 'spitter', 'brute'
    ];
    let delay = 0.3;
    for (let i = 0; i < 11; i++) {
      const type = hordeTypes[Math.floor(Math.random() * hordeTypes.length)];
      delay += 0.45 + Math.random() * 0.35;
      this.spawnQueue.push({
        type,
        delayTimer: delay,
        forceNarrowPath: i % 2 === 1,
      });
    }
  }

  private advanceObjective(onVictory?: (stats: GameStats) => void) {
    soundFx.playClick();
    this.currentObjectiveIndex++;

    const callback = onVictory || this.onVictoryCallback;

    if (this.currentObjectiveIndex >= this.currentMission.objectives.length) {
      this.completeMission(callback || undefined);
    } else {
      const nextObj = this.getCurrentObjective();
      if (nextObj && nextObj.timerSeconds) {
        this.surviveTimer = nextObj.timerSeconds;
      }
      // Start another horde of zombies upon objective completion!
      this.triggerObjectiveHorde();
    }
  }

  private completeMission(onVictory?: (stats: GameStats) => void) {
    if (this.isMissionComplete) return;
    this.isMissionComplete = true;

    // Bonus mission reward
    const bonus = this.currentMission.baseRewardCredits;
    this.stats.creditsEarned += bonus;
    SaveManager.addCredits(bonus);

    // Unlock next mission
    SaveManager.completeMission(this.currentMission.id, this.currentMission.id + 1);

    soundFx.playVictory();
    const callback = onVictory || this.onVictoryCallback;
    if (callback) {
      callback(this.stats);
    }
  }
}
