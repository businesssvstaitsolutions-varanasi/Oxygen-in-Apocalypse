import { WeaponConfig, WeaponTypeKey } from '../types';

export const WEAPON_DEFINITIONS: Record<WeaponTypeKey, WeaponConfig> = {
  pistol: {
    id: 'pistol',
    name: 'TACTICAL 9MM',
    category: 'Sidearm',
    baseDamage: 32,
    fireRateRpm: 380,
    baseMagSize: 15,
    maxReserveAmmo: 120,
    baseReloadTime: 1.3,
    spread: 0.015,
    recoil: 0.04,
    headshotMultiplier: 2.2,
    range: 50,
    cost: 0,
    unlockedByDefault: true,
    description: 'High-reliability sidearm. Balanced damage with rapid reload speed and crisp headshot potential.',
  },
  shotgun: {
    id: 'shotgun',
    name: 'BREACHER 12G',
    category: 'Shotgun',
    baseDamage: 22, // per pellet
    pellets: 8, // total 176 dmg if all connect
    fireRateRpm: 75,
    baseMagSize: 8,
    maxReserveAmmo: 56,
    baseReloadTime: 2.2,
    spread: 0.055,
    recoil: 0.12,
    headshotMultiplier: 1.8,
    range: 22,
    cost: 650,
    unlockedByDefault: false,
    description: 'Devastating close-quarters pump shotgun. Fires 8 high-velocity pellets capable of tearing through swarms.',
  },
  rifle: {
    id: 'rifle',
    name: 'M4 OUTBREAK',
    category: 'Assault Rifle',
    baseDamage: 45,
    fireRateRpm: 600,
    baseMagSize: 30,
    maxReserveAmmo: 210,
    baseReloadTime: 1.8,
    spread: 0.02,
    recoil: 0.055,
    headshotMultiplier: 2.3,
    range: 80,
    cost: 1200,
    unlockedByDefault: false,
    description: 'Military-grade combat rifle with holographic optic. Exceptional stability, rate of fire, and lethality.',
  },
  smg: {
    id: 'smg',
    name: 'VECTOR-9 SUB',
    category: 'Submachine Gun',
    baseDamage: 28,
    fireRateRpm: 850,
    baseMagSize: 35,
    maxReserveAmmo: 245,
    baseReloadTime: 1.5,
    spread: 0.03,
    recoil: 0.045,
    headshotMultiplier: 2.0,
    range: 40,
    cost: 950,
    unlockedByDefault: false,
    description: 'High-cadence submachine gun designed for aggressive mobile sweep tactics in tight quarantine alleys.',
  },
  heavy: {
    id: 'heavy',
    name: 'TITAN .50 HMG',
    category: 'Heavy Weapon',
    baseDamage: 75,
    fireRateRpm: 500,
    baseMagSize: 75,
    maxReserveAmmo: 225,
    baseReloadTime: 3.2,
    spread: 0.04,
    recoil: 0.09,
    headshotMultiplier: 2.5,
    range: 90,
    cost: 2400,
    unlockedByDefault: false,
    description: 'Heavy belt-fed machine gun. Vaporizes mutated brutes and horde waves with sustained high-caliber suppression.',
  },
  sniper: {
    id: 'sniper',
    name: 'PHANTOM .338',
    category: 'Precision Rifle',
    baseDamage: 240,
    fireRateRpm: 45,
    baseMagSize: 5,
    maxReserveAmmo: 30,
    baseReloadTime: 2.5,
    spread: 0.003,
    recoil: 0.15,
    headshotMultiplier: 3.2,
    range: 150,
    cost: 1800,
    unlockedByDefault: false,
    description: 'Heavy anti-materiel precision rifle. One shot reliably decapitates any standard infected from safe distance.',
  },
};

export const UPGRADE_TIERS = {
  maxLevel: 5,
  damageMultiplierPerLevel: 0.15, // +15% per tier
  magBonusPerLevel: 0.20, // +20% capacity per tier
  fireRateBonusPerLevel: 0.10, // +10% RPM per tier
  reloadSpeedBonusPerLevel: 0.12, // -12% reload time per tier
  baseCost: 250,
  costMultiplier: 1.6, // Cost scales each tier
};

export function getUpgradeCost(currentTier: number): number {
  return Math.round(UPGRADE_TIERS.baseCost * Math.pow(UPGRADE_TIERS.costMultiplier, currentTier));
}
