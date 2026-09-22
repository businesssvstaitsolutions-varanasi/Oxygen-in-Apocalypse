/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameScreen, PlayerSaveData, HitResult, GameStats, WeaponTypeKey, KillFeedEntry, AllyOrder } from './types';
import { SaveManager } from './core/SaveManager';
import { EnvironmentBuilder, EnvironmentResult } from './models/EnvironmentBuilder';
import { PlayerController, PlayerInput } from './player/PlayerController';
import { ZombieManager } from './zombies/ZombieManager';
import { MissionManager } from './missions/MissionManager';
import { ParticleSystem } from './effects/ParticleSystem';
import { WeatherSystem } from './effects/WeatherSystem';
import { soundFx } from './audio/SoundEffects';
import { HelicopterCutscene } from './cutscene/HelicopterCutscene';
import { GrenadeManager } from './tactical/GrenadeManager';
import { TurretManager } from './tactical/TurretManager';
import { AllySoldier } from './tactical/AllySoldier';
import { DroneManager } from './tactical/DroneManager';
import { Mission10EndingCutscene } from './cutscene/Mission10EndingCutscene';

// UI Components
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { ArsenalModal } from './ui/ArsenalModal';
import { MissionsModal } from './ui/MissionsModal';
import { SettingsModal } from './ui/SettingsModal';
import { MissionEndModal } from './ui/MissionEndModal';
import { SpecimenViewerModal } from './ui/SpecimenViewerModal';
import { BuyCoinsModal } from './ui/BuyCoinsModal';
import { MobileControls } from './ui/MobileControls';
import { OrientationWarning } from './ui/OrientationWarning';
import { DebugOverlay } from './ui/DebugOverlay';
import { CompanyIntro } from './ui/CompanyIntro';
import { Coins } from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Central Game State
  const [screen, setScreen] = useState<GameScreen>('COMPANY_INTRO');
  const screenRef = useRef<GameScreen>('COMPANY_INTRO');
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const lastLockExitTimeRef = useRef<number>(0);
  const [saveData, setSaveData] = useState<PlayerSaveData>(SaveManager.load());
  const [showBuyCoinsModal, setShowBuyCoinsModal] = useState<boolean>(false);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Robust pointer lock request handler that respects browser rate limits and handles rejection promises
  const safeRequestPointerLock = () => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;
    if (document.pointerLockElement === container) return;

    // Guard against browser rate-limiting: browsers enforce a ~1.2s cooldown after exiting pointer lock
    const elapsedSinceExit = performance.now() - lastLockExitTimeRef.current;
    if (elapsedSinceExit < 1250) {
      return;
    }

    try {
      const lockPromise = container.requestPointerLock?.();
      if (lockPromise && typeof (lockPromise as any).catch === 'function') {
        (lockPromise as Promise<void>).catch(() => {
          setIsPointerLocked(false);
        });
      }
    } catch (_) {
      setIsPointerLocked(false);
    }
  };

  // Safe pointer lock exit that records timestamp for browser rate-limit handling
  const safeExitPointerLock = () => {
    lastLockExitTimeRef.current = performance.now();
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch (_) {}
    setIsPointerLocked(false);
  };
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);
  const [isFlashlightOn, setIsFlashlightOn] = useState<boolean>(true);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [hitFeedback, setHitFeedback] = useState<{ hit: boolean; isHeadshot: boolean; timestamp: number }>({
    hit: false,
    isHeadshot: false,
    timestamp: 0,
  });
  const [endMissionStats, setEndMissionStats] = useState<{ isVictory: boolean; stats: GameStats } | null>(null);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);

  const addKillFeedEntry = (
    victim: string,
    weapon: string,
    isHeadshot: boolean,
    isBoss: boolean,
    killer: string = 'OPERATOR'
  ) => {
    const entry: KillFeedEntry = {
      id: `${Date.now()}_${Math.random()}`,
      killer,
      weapon,
      victim,
      isHeadshot,
      isBoss,
      timestamp: Date.now(),
    };
    setKillFeed((prev) => [...prev.slice(-5), entry]);
  };

  // Auto-prune stale killfeed entries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setKillFeed((prev) => {
        const filtered = prev.filter((k) => now - k.timestamp < 5000);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lobby soundtrack management: plays during menus/arsenal/lobby, stops during combat
  useEffect(() => {
    const isLobby = ['MENU', 'MISSIONS', 'ARSENAL', 'SETTINGS', 'SPECIMEN', 'BUY_COINS', 'COMPANY_INTRO'].includes(screen);
    if (isLobby) {
      soundFx.startLobbyMusic();
    } else {
      soundFx.stopLobbyMusic();
    }
    return () => {
      if (!isLobby) {
        soundFx.stopLobbyMusic();
      }
    };
  }, [screen]);

  // Core Engine Instances (persisted across renders)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const zombieManagerRef = useRef<ZombieManager | null>(null);
  const missionManagerRef = useRef<MissionManager | null>(null);
  const envResultRef = useRef<EnvironmentResult | null>(null);
  const cutsceneRef = useRef<HelicopterCutscene | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const [cutsceneSubtitle, setCutsceneSubtitle] = useState<string>('');
  const [mission10FlashAlpha, setMission10FlashAlpha] = useState<number>(0);
  const mission10CutsceneRef = useRef<Mission10EndingCutscene | null>(null);
  const [allyOrder, setAllyOrder] = useState<AllyOrder>('FOLLOW_ME');
  const [isDroneActive, setIsDroneActive] = useState<boolean>(false);
  const [, setDroneStatusTick] = useState<number>(0);

  // Input State
  const inputRef = useRef<PlayerInput>({
    forward: 0,
    strafe: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprint: false,
    jump: false,
    shoot: false,
    reload: false,
    interact: false,
    aimDownSights: false,
  });

  // Robust touch / mobile device detection
  useEffect(() => {
    const checkMobile = () => {
      const isTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024;
      setIsMobile(isTouch);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    const onFirstTouch = () => {
      setIsMobile(true);
      window.removeEventListener('touchstart', onFirstTouch);
    };
    window.addEventListener('touchstart', onFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
      window.removeEventListener('touchstart', onFirstTouch);
    };
  }, []);

  // Initialize Three.js Scene and Game Loop
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Create Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x182436); // Atmospheric twilight slate navy
    scene.fog = new THREE.Fog(0x182436, 50, 190); // Clear nearby, soft horizon depth
    sceneRef.current = scene;

    // Distant Atmospheric Starfield in Upper Sky
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 260;
      starPositions[i + 1] = Math.random() * 85 + 35; // high in the sky above buildings
      starPositions[i + 2] = (Math.random() - 0.5) * 260;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 1.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const initW = containerRef.current.clientWidth || window.innerWidth || 800;
    const initH = containerRef.current.clientHeight || window.innerHeight || 600;
    renderer.setSize(initW, initH);
    const dpr = Math.min(window.devicePixelRatio, saveData.settings.graphicsQuality === 'HIGH' ? 1.5 : 1.0);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = saveData.settings.graphicsQuality !== 'LOW';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    rendererRef.current = renderer;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';

    containerRef.current.appendChild(renderer.domElement);

    // 3. Atmospheric Lighting (Multi-tier illumination ensures pristine visibility)
    const ambientLight = new THREE.AmbientLight(0x404e63, 0.95);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0x8da7cc, 0x222b38, 1.25);
    scene.add(hemiLight);

    const moonLight = new THREE.DirectionalLight(0xdbe8ff, 1.85);
    moonLight.position.set(25, 55, 15);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 5;
    moonLight.shadow.camera.far = 160;
    moonLight.shadow.camera.left = -40;
    moonLight.shadow.camera.right = 40;
    moonLight.shadow.camera.top = 50;
    moonLight.shadow.camera.bottom = -50;
    scene.add(moonLight);
    moonLightRef.current = moonLight;

    // 4. Build Environment
    const envResult = EnvironmentBuilder.buildQuarantineDistrict();
    scene.add(envResult.sceneGroup);
    envResultRef.current = envResult;

    // 5. Init Systems
    ParticleSystem.init(scene);
    WeatherSystem.init(scene, moonLight, ambientLight);

    const player = new PlayerController();
    scene.add(player.camera);
    playerRef.current = player;

    cutsceneRef.current = new HelicopterCutscene(scene, player.camera);

    const zombieManager = new ZombieManager(scene);
    zombieManagerRef.current = zombieManager;

    // Connect acoustic gunshot alerts to dormant zombies
    player.onGunshot = (origin, radius) => {
      zombieManager.onGunshotFired(origin, radius);
    };

    const missionManager = new MissionManager(zombieManager);
    missionManagerRef.current = missionManager;

    // Initialize Tactical Deployables Managers
    GrenadeManager.init(scene);
    TurretManager.init(scene);
    DroneManager.init(scene);
    mission10CutsceneRef.current = new Mission10EndingCutscene(scene, player.camera);

    // Equip saved weapon and upgrades
    const currentSave = SaveManager.get();
    player.setWeapon(currentSave.equippedWeapon, currentSave.upgrades[currentSave.equippedWeapon]);
    player.setPowerfulFlashlight(Boolean(currentSave.hasPowerfulFlashlight));
    // Hide weapon container initially during menu
    if (player.weaponContainer) {
      player.weaponContainer.visible = false;
    }

    // 6. Animation Loop
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    let animationFrameId: number;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // FPS Calculation
      frameCount++;
      if (time - lastFpsUpdate >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsUpdate = time;
      }

      // Update Particles & Dynamic Weather Simulation
      ParticleSystem.update(delta);
      WeatherSystem.update(delta, player.position);

      // Check current screen mode using screenRef (avoids stale closures)
      if (screenRef.current === 'CUTSCENE') {
        if (player.weaponContainer && player.weaponContainer.visible) {
          player.weaponContainer.visible = false;
        }

        if (cutsceneRef.current) {
          const { isRunning, subtitle } = cutsceneRef.current.update(delta);
          setCutsceneSubtitle(subtitle);
          if (!isRunning) {
            screenRef.current = 'PLAYING';
            setScreen('PLAYING');
            if (player.weaponContainer) {
              player.weaponContainer.visible = true;
            }
          }
        }
      } else if (screenRef.current === 'MISSION10_ENDING') {
        if (player.weaponContainer && player.weaponContainer.visible) {
          player.weaponContainer.visible = false;
        }

        if (mission10CutsceneRef.current) {
          const { isRunning, subtitle, flashAlpha } = mission10CutsceneRef.current.update(delta);
          setCutsceneSubtitle(subtitle);
          setMission10FlashAlpha(flashAlpha);
          if (!isRunning) {
            safeExitPointerLock();
            screenRef.current = 'VICTORY';
            setScreen('VICTORY');
            setSaveData({ ...SaveManager.get() });
          }
        }
      } else if (screenRef.current === 'PLAYING') {
        if (player.weaponContainer && !player.weaponContainer.visible) {
          player.weaponContainer.visible = true;
        }

        const input = inputRef.current;

        // Current mission environment colliders & barrels (prevents collision overlap from previous maps)
        const currentEnv = envResultRef.current;
        const activeColliders = currentEnv ? currentEnv.colliderBoxes : [];
        const activeBarrels = currentEnv ? currentEnv.explosiveBarrels : [];

        // Update Player Movement & Shooting with active mission collision boundaries
        player.update(
          delta,
          input,
          activeColliders,
          zombieManager.getHitboxMeshes(),
          activeBarrels,
          (hitResult: HitResult) => {
            // Hit Zombie handler
            missionManager.stats.shotsHit++;
            const { isFatal, zombie } = zombieManager.applyDamage(hitResult, (killedZ, isHeadshot) => {
              missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
              const weaponName = player.weaponConfig.name.split(' ')[0] || 'WEAPON';
              const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
              addKillFeedEntry(victimName, weaponName, isHeadshot, Boolean(killedZ.isBoss), 'OPERATOR');
            });

            setHitFeedback({
              hit: true,
              isHeadshot: hitResult.zone === 'HEAD' || hitResult.zone === 'WEAKPOINT',
              timestamp: performance.now(),
            });
          },
          (barrel) => {
            // Explode barrel damage
            zombieManager.damageArea(barrel.position, 7.5, 220, (killedZ) => {
              missionManager.recordKill(false, killedZ.config.rewardCredits);
              const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
              addKillFeedEntry(victimName, 'BARREL', false, Boolean(killedZ.isBoss), 'OPERATOR');
            });
            // If player is too close, take blast damage
            const distToPlayer = player.position.distanceTo(barrel.position);
            if (distToPlayer < 6.0) {
              player.takeDamage(Math.round(40 * (1 - distToPlayer / 6.0)), barrel.position);
            }
          }
        );

        // Update Zombie AI & Attacks with field of view and flashlight detection
        const playerForward = new THREE.Vector3();
        player.camera.getWorldDirection(playerForward);
        zombieManager.update(
          delta,
          player.position,
          (dmg, attackerPos) => {
            player.takeDamage(dmg, attackerPos);
            if (player.isDead) {
              safeExitPointerLock();
              setEndMissionStats({
                isVictory: false,
                stats: { ...missionManager.stats },
              });
              screenRef.current = 'DEFEAT';
              setScreen('DEFEAT');
            }
          },
          playerForward,
          player.isFlashlightOn,
          DroneManager.isDeployed ? {
            isDeployed: true,
            position: DroneManager.position,
            onDamageDrone: (dmg) => {
              DroneManager.takeDamage(dmg);
            },
          } : undefined
        );

        // Update Tactical Deployables: Grenades, Turrets & Recruited Ally
        GrenadeManager.update(
          delta,
          zombieManager,
          (killedZ: any, isHeadshot: boolean) => {
            missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
            const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
            addKillFeedEntry(victimName, 'GRENADE', isHeadshot, Boolean(killedZ.isBoss), 'OPERATOR');
          },
          (shakeIntensity: number) => {
            player.camera.rotation.z += (Math.random() - 0.5) * 0.06 * shakeIntensity;
          }
        );

        TurretManager.update(
          delta,
          zombieManager,
          (killedZ: any, isHeadshot: boolean) => {
            missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
            const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
            addKillFeedEntry(victimName, 'SENTRY TURRET', isHeadshot, Boolean(killedZ.isBoss), 'TURRET');
          }
        );

        // Update Combat Recon Drone (aerial piloting or cooldown recharge)
        if (DroneManager.isDeployed) {
          DroneManager.update(
            delta,
            {
              forward: input.forward,
              strafe: input.strafe,
              lookDeltaX: input.lookDeltaX,
              lookDeltaY: input.lookDeltaY,
              shoot: input.shoot,
              ascend: input.ascend,
              descend: input.descend,
            },
            player.camera,
            zombieManager,
            (killedZ: any, isHeadshot: boolean) => {
              missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
              const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
              addKillFeedEntry(victimName, 'HE ROCKET', isHeadshot, Boolean(killedZ.isBoss), 'UAV DRONE');
            },
            player.position,
            (shakeIntensity: number) => {
              player.camera.position.x += (Math.random() - 0.5) * 0.15 * shakeIntensity;
              player.camera.position.y += (Math.random() - 0.5) * 0.15 * shakeIntensity;
              player.camera.rotation.z += (Math.random() - 0.5) * 0.08 * shakeIntensity;
            }
          );
          if (player.weaponContainer && player.weaponContainer.visible) {
            player.weaponContainer.visible = false;
          }
        } else {
          DroneManager.update(
            delta,
            { forward: 0, strafe: 0, lookDeltaX: 0, lookDeltaY: 0, shoot: false },
            player.camera,
            zombieManager,
            (killedZ: any, isHeadshot: boolean) => {
              missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
              const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
              addKillFeedEntry(victimName, 'HE ROCKET', isHeadshot, Boolean(killedZ.isBoss), 'UAV DRONE');
            },
            player.position,
            (shakeIntensity: number) => {
              player.camera.position.x += (Math.random() - 0.5) * 0.15 * shakeIntensity;
              player.camera.position.y += (Math.random() - 0.5) * 0.15 * shakeIntensity;
              player.camera.rotation.z += (Math.random() - 0.5) * 0.08 * shakeIntensity;
            }
          );
          if (player.weaponContainer && !player.weaponContainer.visible) {
            player.weaponContainer.visible = true;
          }
        }

        if (frameCount % 6 === 0) {
          setDroneStatusTick(time);
        }

        if (SaveManager.get().hasAllyRecruit && AllySoldier.isAlive) {
          AllySoldier.update(
            delta,
            player.position,
            zombieManager,
            (killedZ: any, isHeadshot: boolean) => {
              missionManager.recordKill(isHeadshot, killedZ.config.rewardCredits, killedZ.type === 'colossus');
              const victimName = killedZ.isBoss ? (killedZ.config.name || 'BOSS') : killedZ.config.name;
              addKillFeedEntry(victimName, 'M4A1 RIFLE', isHeadshot, Boolean(killedZ.isBoss), 'SQUAD ALLY');
            }
          );
        }

        // Check Pickups (Ammo & Medkits)
        zombieManager.checkPickups(player.position, (item) => {
          if (item.type === 'MEDKIT') {
            player.heal(item.value);
          } else if (item.type === 'AMMO') {
            player.addAmmo(item.value);
          } else {
            SaveManager.addCredits(item.value);
            soundFx.playCashEarned();
          }
          setSaveData({ ...SaveManager.get() });
        });

        // Update Mission Objectives & Waves
        missionManager.update(delta, player.position, (finalStats) => {
          safeExitPointerLock();
          setEndMissionStats({
            isVictory: true,
            stats: finalStats,
          });

          // Climax Mission 10 Ending: Helicopter takeoff & thermobaric detonation cutscene!
          if (missionManager.currentMission.id === 10 && mission10CutsceneRef.current) {
            screenRef.current = 'MISSION10_ENDING';
            setScreen('MISSION10_ENDING');
            mission10CutsceneRef.current.startCutscene(() => {
              screenRef.current = 'VICTORY';
              setScreen('VICTORY');
              setSaveData({ ...SaveManager.get() });
            });
          } else {
            screenRef.current = 'VICTORY';
            setScreen('VICTORY');
            setSaveData({ ...SaveManager.get() });
          }
        });

        // Reset frame deltas (shoot is sustained by mouse hold, not impulse)
        input.lookDeltaX = 0;
        input.lookDeltaY = 0;
        input.reload = false;
        input.interact = false;
      } else {
        // Hide weapon during menus
        if (player.weaponContainer && player.weaponContainer.visible) {
          player.weaponContainer.visible = false;
        }

        // MENU / ARSENAL / PAUSED background camera atmospheric pan
        const camOrbitAngle = time * 0.00012;
        player.camera.position.set(Math.sin(camOrbitAngle) * 8, 3.8, Math.cos(camOrbitAngle) * 8 - 15);
        player.camera.lookAt(0, 1.5, 5);
      }

      // Render Scene safely
      try {
        renderer.render(scene, player.camera);
      } catch (err) {
        console.error('WebGL render error:', err);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Dynamic Resize Handler with fallback
    const handleResize = () => {
      if (!renderer || !player) return;
      const w = containerRef.current?.clientWidth || window.innerWidth || 800;
      const h = containerRef.current?.clientHeight || window.innerHeight || 600;
      if (w > 0 && h > 0) {
        player.camera.aspect = w / h;
        player.camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  // Desktop Keyboard & Mouse Event Listeners
  useEffect(() => {
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === containerRef.current;
      setIsPointerLocked(isLocked);
      if (!isLocked) {
        lastLockExitTimeRef.current = performance.now();
      }
    };

    const handlePointerLockError = () => {
      setIsPointerLocked(false);
      lastLockExitTimeRef.current = performance.now();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason?.message || event.reason || '');
      if (
        reasonStr.includes('Pointer Lock') ||
        reasonStr.includes('pointer lock') ||
        reasonStr.includes('user gesture') ||
        reasonStr.includes('exited the lock')
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const handleKeyDown = (e: KeyboardEvent) => {
      soundFx.userInteracted();

      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputRef.current.forward = 1;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputRef.current.forward = -1;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputRef.current.strafe = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputRef.current.strafe = 1;

      if (e.code === 'Space') {
        if (screenRef.current === 'CUTSCENE') {
          cutsceneRef.current?.skip();
        } else if (screenRef.current === 'MISSION10_ENDING') {
          mission10CutsceneRef.current?.skip();
        } else if (DroneManager.isDeployed) {
          inputRef.current.ascend = true;
        } else {
          inputRef.current.jump = true;
        }
      }

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (DroneManager.isDeployed) {
          inputRef.current.descend = true;
        } else {
          inputRef.current.sprint = true;
          setIsSprinting(true);
        }
      }
      if (e.code === 'PageUp') {
        if (DroneManager.isDeployed) inputRef.current.ascend = true;
      }
      if (e.code === 'PageDown') {
        if (DroneManager.isDeployed) inputRef.current.descend = true;
      }
      if (e.code === 'KeyR') {
        inputRef.current.reload = true;
      }
      if (e.code === 'KeyF') {
        if (playerRef.current) {
          const state = playerRef.current.toggleFlashlight();
          setIsFlashlightOn(state);
        }
      }
      if (e.code === 'KeyE') {
        if (DroneManager.isDeployed) {
          inputRef.current.ascend = true;
        } else {
          inputRef.current.interact = true;
          // Check objective interaction
          if (playerRef.current && missionManagerRef.current) {
            missionManagerRef.current.tryInteractObjective(playerRef.current.position);
          }
        }
      }
      if (e.code === 'KeyG') {
        handleThrowGrenade();
      }
      if (e.code === 'KeyT') {
        handleDeployTurret();
      }
      if (e.code === 'KeyY' || e.code === 'KeyU') {
        handleDeployDrone();
      }
      if (e.code === 'KeyC') {
        if (DroneManager.isDeployed) {
          inputRef.current.descend = true;
        } else {
          handleToggleAllyOrder();
        }
      }
      if (e.code === 'KeyQ') {
        if (DroneManager.isDeployed) {
          inputRef.current.descend = true;
        } else {
          handleSwitchWeapon();
        }
      }
      if (e.code === 'Escape') {
        if (screenRef.current === 'PLAYING') {
          safeExitPointerLock();
          screenRef.current = 'PAUSED';
          setScreen('PAUSED');
        } else if (screenRef.current === 'PAUSED') {
          screenRef.current = 'PLAYING';
          setScreen('PLAYING');
          safeRequestPointerLock();
        }
      }
      if (e.code === 'F3') {
        e.preventDefault();
        setShowDebug((prev) => !prev);
      }

      // Quick weapon hotkeys 1-6
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        const weaponKeys: WeaponTypeKey[] = ['pistol', 'shotgun', 'rifle', 'smg', 'heavy', 'sniper'];
        const selected = weaponKeys[num - 1];
        if (selected && saveData.unlockedWeapons.includes(selected)) {
          SaveManager.equipWeapon(selected);
          if (playerRef.current) {
            playerRef.current.setWeapon(selected, saveData.upgrades[selected]);
          }
          setSaveData({ ...SaveManager.get() });
          soundFx.playClick();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === 'KeyW' || e.code === 'ArrowUp') && inputRef.current.forward > 0) inputRef.current.forward = 0;
      if ((e.code === 'KeyS' || e.code === 'ArrowDown') && inputRef.current.forward < 0) inputRef.current.forward = 0;
      if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && inputRef.current.strafe < 0) inputRef.current.strafe = 0;
      if ((e.code === 'KeyD' || e.code === 'ArrowRight') && inputRef.current.strafe > 0) inputRef.current.strafe = 0;

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        inputRef.current.sprint = false;
        inputRef.current.descend = false;
        setIsSprinting(false);
      }
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'PageUp') {
        inputRef.current.jump = false;
        inputRef.current.ascend = false;
      }
      if (e.code === 'KeyQ' || e.code === 'KeyC' || e.code === 'PageDown') {
        inputRef.current.descend = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      soundFx.userInteracted();

      if (screenRef.current === 'PLAYING') {
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Request pointer lock on desktop when clicking viewport
        if (!isMobile && document.pointerLockElement !== containerRef.current) {
          safeRequestPointerLock();
        }

        if (e.button === 0) {
          inputRef.current.shoot = true;
          if (missionManagerRef.current) {
            missionManagerRef.current.stats.shotsFired++;
          }
        } else if (e.button === 2) {
          inputRef.current.aimDownSights = true;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.shoot = false;
        isMouseDown = false;
      } else if (e.button === 2) {
        inputRef.current.aimDownSights = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (screenRef.current === 'PLAYING') {
        const sens = 0.0022 * saveData.settings.mouseSensitivity;
        const invertXMult = saveData.settings.invertX ? -1 : 1;
        const invertYMult = saveData.settings.invertY ? 1 : -1;

        if (document.pointerLockElement === containerRef.current) {
          inputRef.current.lookDeltaX += invertXMult * e.movementX * sens;
          inputRef.current.lookDeltaY += invertYMult * e.movementY * sens;
        } else if (isMouseDown) {
          const dx = e.clientX - lastMouseX;
          const dy = e.clientY - lastMouseY;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          inputRef.current.lookDeltaX += invertXMult * dx * sens * 1.2;
          inputRef.current.lookDeltaY += invertYMult * dy * sens * 1.2;
        }
      }
    };

    const handleBlur = () => {
      isMouseDown = false;
      inputRef.current.shoot = false;
      inputRef.current.forward = 0;
      inputRef.current.strafe = 0;
      inputRef.current.sprint = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (screenRef.current === 'PLAYING') e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      if (screenRef.current !== 'PLAYING') return;
      if (Math.abs(e.deltaY) < 10) return;
      const weapons = saveData.unlockedWeapons;
      if (weapons.length <= 1) return;
      const curIdx = weapons.indexOf(saveData.equippedWeapon);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (curIdx + dir + weapons.length) % weapons.length;
      const nextWeapon = weapons[nextIdx];
      SaveManager.equipWeapon(nextWeapon);
      if (playerRef.current) {
        playerRef.current.setWeapon(nextWeapon, saveData.upgrades[nextWeapon]);
      }
      setSaveData({ ...SaveManager.get() });
      soundFx.playClick();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('blur', handleBlur);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isMobile, saveData]);

  // Procedural Map & Atmospheric Lighting Loader per Mission
  const loadMissionEnvironment = (missionId: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing environment group
    if (envResultRef.current?.sceneGroup) {
      scene.remove(envResultRef.current.sceneGroup);
    }

    // Build designated unique map for this mission
    const newEnv = EnvironmentBuilder.buildForMission(missionId);
    scene.add(newEnv.sceneGroup);
    envResultRef.current = newEnv;

    // Update scene fog & sky background
    scene.fog = new THREE.Fog(newEnv.fogColor, 20, 160);
    scene.background = new THREE.Color(newEnv.fogColor);

    // Update ambient & directional lighting
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(newEnv.ambientColor);
      ambientLightRef.current.intensity = newEnv.ambientIntensity;
    }

    if (moonLightRef.current) {
      moonLightRef.current.color.setHex(newEnv.directionalColor);
      moonLightRef.current.intensity = newEnv.directionalIntensity;
      moonLightRef.current.position.set(
        newEnv.directionalPos[0],
        newEnv.directionalPos[1],
        newEnv.directionalPos[2]
      );
    }

    // Set map-specific zombie spawn locations and narrow side paths
    if (zombieManagerRef.current) {
      zombieManagerRef.current.setSpawnPoints(newEnv.spawnPoints);
      zombieManagerRef.current.setNarrowPathSpawns(newEnv.narrowPathSpawns);
    }

    // Set player spawn coordinates for this map
    if (playerRef.current) {
      playerRef.current.reset([newEnv.playerSpawn.x, newEnv.playerSpawn.y, newEnv.playerSpawn.z]);
    }

    // Synchronize helicopter cutscene insertion point
    if (cutsceneRef.current) {
      cutsceneRef.current.setDropPoint(newEnv.playerSpawn);
    }

    // Configure atmospheric dynamic weather for this sector
    WeatherSystem.setMissionWeather(missionId);
    WeatherSystem.setBaseFogColor(newEnv.fogColor);
  };

  // Deployment: Start Mission
  const startMission = (missionId: number) => {
    soundFx.userInteracted();
    const currentSave = SaveManager.get();

    // Dynamically load the unique map, obstacles, spawns, and atmosphere
    loadMissionEnvironment(missionId);

    if (playerRef.current && missionManagerRef.current && zombieManagerRef.current) {
      // Clean up previous enemies, particles, and weather transients
      zombieManagerRef.current.clearAll();
      ParticleSystem.clearAll();
      WeatherSystem.clearAll();

      // Clean tactical deployables & spawn recruited squad ally
      GrenadeManager.clearAll();
      TurretManager.clearAll();
      if (currentSave.hasAllyRecruit && currentSave.isAllyDeployed !== false && sceneRef.current) {
        AllySoldier.init(sceneRef.current, playerRef.current.position, currentSave.allyCount || 1);
      } else {
        AllySoldier.clear();
      }

      setIsFlashlightOn(playerRef.current.isFlashlightOn);
      playerRef.current.setWeapon(currentSave.equippedWeapon, currentSave.upgrades[currentSave.equippedWeapon]);
      if (playerRef.current.weaponContainer) {
        playerRef.current.weaponContainer.visible = false;
      }
      missionManagerRef.current.startMission(missionId);
    }

    screenRef.current = 'CUTSCENE';
    setScreen('CUTSCENE');

    cutsceneRef.current?.startCutscene(() => {
      screenRef.current = 'PLAYING';
      setScreen('PLAYING');
      if (playerRef.current?.weaponContainer) {
        playerRef.current.weaponContainer.visible = true;
      }
    });
  };

  // Return cleanly to main menu
  const returnToMenu = () => {
    safeExitPointerLock();
    DroneManager.recall();
    setIsDroneActive(false);
    if (cutsceneRef.current) {
      cutsceneRef.current.dispose();
    }
    if (mission10CutsceneRef.current) {
      mission10CutsceneRef.current.dispose();
    }
    if (zombieManagerRef.current) {
      zombieManagerRef.current.clearAll();
    }
    ParticleSystem.clearAll();
    GrenadeManager.clearAll();
    TurretManager.clearAll();
    AllySoldier.clear();

    if (playerRef.current?.weaponContainer) {
      playerRef.current.weaponContainer.visible = false;
    }
    screenRef.current = 'MENU';
    setScreen('MENU');
  };

  // Throw Tactical Frag Grenade
  const handleThrowGrenade = () => {
    if (screenRef.current !== 'PLAYING' || !playerRef.current) return;
    if (SaveManager.useGrenade()) {
      const player = playerRef.current;
      const origin = player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const forward = new THREE.Vector3();
      player.camera.getWorldDirection(forward);
      GrenadeManager.throwGrenade(origin, forward);
      soundFx.playRadioTransmission();
      setSaveData({ ...SaveManager.get() });
    }
  };

  // Deploy Autonomous Sentry Defense Turret
  const handleDeployTurret = () => {
    if (screenRef.current !== 'PLAYING' || !playerRef.current) return;
    if (SaveManager.useTurret()) {
      const player = playerRef.current;
      const forward = new THREE.Vector3();
      player.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const pos = player.position.clone().add(forward.clone().multiplyScalar(1.8));
      pos.y = player.position.y;
      TurretManager.deployTurret(pos, forward);
      soundFx.playCashEarned();
      setSaveData({ ...SaveManager.get() });
    }
  };

  // Deploy or Recall Combat Recon Drone
  const handleDeployDrone = () => {
    if (screenRef.current !== 'PLAYING' || !playerRef.current) return;
    const save = SaveManager.get();
    if (!save.hasDrone) return;

    if (DroneManager.isDeployed) {
      DroneManager.recall();
      setIsDroneActive(false);
      if (playerRef.current.weaponContainer) {
        playerRef.current.weaponContainer.visible = true;
      }
      return;
    }

    if (DroneManager.cooldownTimer > 0) return;

    const playerForward = new THREE.Vector3();
    playerRef.current.camera.getWorldDirection(playerForward);
    const playerYaw = Math.atan2(playerForward.x, playerForward.z);
    const success = DroneManager.deploy(playerRef.current.position, playerYaw);
    if (success) {
      setIsDroneActive(true);
      if (playerRef.current.weaponContainer) {
        playerRef.current.weaponContainer.visible = false;
      }
    }
  };

  // Toggle Ally Squad Combat Orders
  const handleToggleAllyOrder = () => {
    if (screenRef.current !== 'PLAYING') return;
    const next = AllySoldier.toggleOrder();
    setAllyOrder(next);
  };

  // Switch to next available weapon (cycling smoothly through ALL weapons)
  const handleSwitchWeapon = () => {
    soundFx.playClick();
    const allWeapons: WeaponTypeKey[] = ['pistol', 'shotgun', 'rifle', 'smg', 'heavy', 'sniper'];
    const curIdx = allWeapons.indexOf(saveData.equippedWeapon);
    const nextIdx = curIdx >= 0 ? (curIdx + 1) % allWeapons.length : 0;
    const nextWeapon = allWeapons[nextIdx];

    SaveManager.equipWeapon(nextWeapon);
    if (playerRef.current) {
      playerRef.current.setWeapon(nextWeapon, saveData.upgrades[nextWeapon]);
    }
    setSaveData({ ...SaveManager.get() });
  };

  // Direct select weapon (by key or slot number)
  const handleSelectWeapon = (weaponKey: WeaponTypeKey) => {
    if (saveData.unlockedWeapons.includes(weaponKey)) {
      SaveManager.equipWeapon(weaponKey);
      if (playerRef.current) {
        playerRef.current.setWeapon(weaponKey, saveData.upgrades[weaponKey]);
      }
      setSaveData({ ...SaveManager.get() });
      soundFx.playClick();
    }
  };

  // Toggle tactical weapon-mounted flashlight
  const handleToggleFlashlight = () => {
    if (playerRef.current) {
      const state = playerRef.current.toggleFlashlight();
      setIsFlashlightOn(state);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-black select-none touch-manipulation">
      {/* Three.js 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-crosshair overflow-hidden touch-none" />

      {/* Mobile Landscape Orientation Warning (Non-blocking for menus; dismissable) */}
      <OrientationWarning currentScreen={screen} />

      {/* HELICOPTER CUTSCENE OVERLAY */}
      {screen === 'CUTSCENE' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between">
          {/* Top Cinematic Bar */}
          <div className="w-full h-16 md:h-20 bg-black flex items-center justify-between px-6 pointer-events-auto border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-teko text-lg md:text-xl tracking-widest text-zinc-200">
                OPERATION NIGHTFALL // AIRBORNE INSERTION
              </span>
            </div>
            <button
              onClick={() => cutsceneRef.current?.skip()}
              className="px-4 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded font-teko text-lg tracking-wider transition-colors pointer-events-auto cursor-pointer"
            >
              SKIP [SPACE] ⏭️
            </button>
          </div>

          {/* Radio Subtitle Box */}
          <div className="w-full pb-8 md:pb-12 px-4 flex justify-center">
            {cutsceneSubtitle && (
              <div className="bg-black/90 backdrop-blur-md border border-zinc-700/80 px-6 py-3 rounded-lg max-w-2xl text-center shadow-2xl">
                <div className="font-teko text-xs md:text-sm tracking-widest text-emerald-400 mb-0.5">
                  COMM-LINK ACTIVE // BLACK HAWK PILOT
                </div>
                <div className="font-teko text-xl md:text-2xl tracking-wide text-amber-200 font-semibold">
                  "{cutsceneSubtitle}"
                </div>
              </div>
            )}
          </div>

          {/* Bottom Cinematic Bar */}
          <div className="w-full h-16 md:h-20 bg-black flex items-center justify-center px-6 border-t border-zinc-900">
            <span className="font-military text-xs text-zinc-500 tracking-wider">
              SECTOR 9 QUARANTINE GROUND ZERO // DROP ZONE: LOWER COMMERCIAL DISTRICT
            </span>
          </div>
        </div>
      )}

      {/* MISSION 10 CLIMAX EXTRACTION CUTSCENE */}
      {screen === 'MISSION10_ENDING' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between select-none">
          {/* White Nuclear Blast Screen Flash */}
          <div
            className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-75"
            style={{ opacity: mission10FlashAlpha }}
          />

          {/* Top Cinematic Bar */}
          <div className="w-full h-16 md:h-20 bg-black flex items-center justify-between px-6 border-b border-zinc-900 pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <span className="font-teko text-lg md:text-xl text-red-500 tracking-wider font-bold">
                OPERATION OMEGA // THERMOBARIC BLAST DETONATION
              </span>
            </div>
            <button
              onClick={() => mission10CutsceneRef.current?.skip()}
              className="px-4 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded font-teko text-lg tracking-wider transition-colors pointer-events-auto cursor-pointer"
            >
              SKIP EXTRACTION [SPACE] ⏭️
            </button>
          </div>

          {/* Subtitles Container */}
          <div className="w-full pb-8 md:pb-12 px-4 flex justify-center">
            {cutsceneSubtitle && (
              <div className="bg-black/90 backdrop-blur-md border border-amber-500/80 px-6 py-3 rounded-lg max-w-2xl text-center shadow-2xl animate-fade-in">
                <div className="font-teko text-xs md:text-sm tracking-widest text-amber-400 mb-0.5 font-bold">
                  COMM-LINK ACTIVE // RESCUE PILOT & SQUAD ALLIES
                </div>
                <div className="font-teko text-xl md:text-2xl tracking-wide text-amber-200 font-semibold">
                  "{cutsceneSubtitle}"
                </div>
              </div>
            )}
          </div>

          {/* Bottom Cinematic Bar */}
          <div className="w-full h-16 md:h-20 bg-black flex items-center justify-center px-6 border-t border-zinc-900">
            <span className="font-military text-xs text-zinc-500 tracking-wider">
              GROUND ZERO RUNWAY // EVAC COMPLETED // DETONATION PROTOCOL CONSUMING ZONE
            </span>
          </div>
        </div>
      )}

      {/* IN-GAME HUD (Rendered when PLAYING) */}
      {screen === 'PLAYING' && playerRef.current && missionManagerRef.current && zombieManagerRef.current && (
        <HUD
          player={playerRef.current}
          missionManager={missionManagerRef.current}
          zombieManager={zombieManagerRef.current}
          isMobile={isMobile}
          isPointerLocked={isPointerLocked}
          isFlashlightOn={isFlashlightOn}
          onToggleFlashlight={handleToggleFlashlight}
          onPause={() => {
            safeExitPointerLock();
            screenRef.current = 'PAUSED';
            setScreen('PAUSED');
          }}
          onSwitchWeapon={handleSwitchWeapon}
          onSelectWeapon={handleSelectWeapon}
          unlockedWeapons={saveData.unlockedWeapons}
          onReload={() => {
            inputRef.current.reload = true;
          }}
          onJump={() => {
            inputRef.current.jump = true;
            setTimeout(() => {
              inputRef.current.jump = false;
            }, 120);
          }}
          onInteract={() => {
            if (playerRef.current && missionManagerRef.current) {
              missionManagerRef.current.tryInteractObjective(playerRef.current.position);
            }
          }}
          onSprintToggle={() => setIsSprinting((prev) => !prev)}
          isSprinting={isSprinting}
          hitFeedback={hitFeedback}
          grenadesCount={saveData.grenades || 0}
          turretsCount={saveData.turrets || 0}
          onThrowGrenade={handleThrowGrenade}
          onDeployTurret={handleDeployTurret}
          hasAllyRecruit={saveData.hasAllyRecruit}
          allyStatus={{
            isAlive: AllySoldier.isAlive,
            hp: AllySoldier.hp,
            maxHp: AllySoldier.maxHp,
            kills: AllySoldier.kills,
            radioMessage: AllySoldier.radioMessage,
            squadCount: AllySoldier.squad.length,
            aliveCount: AllySoldier.squad.filter((s) => s.isAlive).length,
            members: AllySoldier.squad.map((s) => ({
              id: s.profile.id,
              name: s.profile.name,
              role: s.profile.role,
              hp: s.hp,
              maxHp: s.maxHp,
              isAlive: s.isAlive,
              kills: s.kills,
            })),
          }}
          hasDrone={saveData.hasDrone}
          droneStatus={{
            isDeployed: DroneManager.isDeployed,
            batteryRemaining: DroneManager.batteryTimer,
            maxBattery: DroneManager.BASE_DURATION + (saveData.droneUpgrades?.durationLevel || 0) * 3.0,
            cooldownRemaining: DroneManager.cooldownTimer,
            maxCooldown: Math.max(35.0, DroneManager.BASE_COOLDOWN - (saveData.droneUpgrades?.cooldownLevel || 0) * 5.0),
            isReady: !DroneManager.isDeployed && DroneManager.cooldownTimer <= 0,
            altitude: DroneManager.position.y,
            targetAltitude: (DroneManager as any).targetAltitude ?? DroneManager.position.y,
          }}
          onDeployDrone={handleDeployDrone}
          onDroneAscend={() => {
            DroneManager.shiftAltitude(3.0);
          }}
          onDroneDescend={() => {
            DroneManager.shiftAltitude(-3.0);
          }}
          allyOrder={allyOrder}
          onToggleAllyOrder={handleToggleAllyOrder}
          killFeed={killFeed}
        />
      )}

      {/* Mobile Touch Joystick & Drag Handler */}
      {screen === 'PLAYING' && isMobile && (
        <MobileControls inputRef={inputRef} touchSensitivity={saveData.settings.touchSensitivity} />
      )}

      {/* Desktop Aim Re-engagement Overlay */}
      {screen === 'PLAYING' && !isMobile && !isPointerLocked && (
        <div
          className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer pointer-events-auto select-none"
          onClick={() => {
            soundFx.userInteracted();
            safeRequestPointerLock();
          }}
        >
          <div className="bg-black/90 border border-red-500/70 p-6 rounded-lg shadow-2xl text-center space-y-2.5 max-w-sm transition-transform hover:scale-105 active:scale-95">
            <div className="text-red-500 font-teko text-2xl font-bold tracking-wider animate-pulse">
              CLICK SCREEN TO ENGAGE AIM
            </div>
            <p className="font-military text-xs text-zinc-300">
              [WASD] Move &bull; [Left Click Hold] Fire &bull; [Right Click] ADS &bull; [Space] Jump &bull; [R] Reload &bull; [F] Light &bull; [E] Interact
            </p>
            <div className="text-[11px] text-amber-400 font-bold uppercase tracking-wider bg-amber-500/15 py-1.5 px-3 rounded border border-amber-500/40">
              Click anywhere to lock cursor
            </div>
          </div>
        </div>
      )}

      {/* COMPANY INTRO SPLASH */}
      {screen === 'COMPANY_INTRO' && (
        <CompanyIntro
          onComplete={() => {
            soundFx.userInteracted();
            screenRef.current = 'MENU';
            setScreen('MENU');
          }}
        />
      )}

      {/* MAIN MENU */}
      {screen === 'MENU' && (
        <MainMenu
          saveData={saveData}
          onPlay={() => startMission(saveData.highestMissionUnlocked)}
          onOpenArsenal={() => setScreen('ARSENAL')}
          onOpenMissions={() => setScreen('MISSIONS')}
          onOpenSettings={() => setScreen('SETTINGS')}
          onOpenSpecimen={() => setScreen('SPECIMEN')}
          onOpenBuyCoins={() => setShowBuyCoinsModal(true)}
        />
      )}

      {/* BIO-SPECIMEN ANALYSIS MODAL (MELTY ZOMBIE 3D VIEWER) */}
      {screen === 'SPECIMEN' && (
        <SpecimenViewerModal
          onClose={() => setScreen('MENU')}
          onDeployCombat={() => startMission(saveData.highestMissionUnlocked)}
        />
      )}

      {/* ARSENAL MODAL */}
      {screen === 'ARSENAL' && (
        <ArsenalModal
          saveData={saveData}
          onClose={() => setScreen('MENU')}
          onEquip={(weaponKey) => {
            if (playerRef.current) {
              playerRef.current.setWeapon(weaponKey, saveData.upgrades[weaponKey]);
            }
            setSaveData({ ...SaveManager.get() });
          }}
          onDataChanged={() => {
            const fresh = SaveManager.get();
            setSaveData({ ...fresh });
            if (playerRef.current) {
              playerRef.current.setWeapon(fresh.equippedWeapon, fresh.upgrades[fresh.equippedWeapon]);
              playerRef.current.setPowerfulFlashlight(Boolean(fresh.hasPowerfulFlashlight));
            }
            if (!fresh.hasAllyRecruit || fresh.isAllyDeployed === false) {
              AllySoldier.clear();
            }
          }}
          onOpenBuyCoins={() => setShowBuyCoinsModal(true)}
        />
      )}

      {/* MISSIONS MODAL */}
      {screen === 'MISSIONS' && (
        <MissionsModal
          saveData={saveData}
          onSelectMission={(id) => startMission(id)}
          onClose={() => setScreen('MENU')}
        />
      )}

      {/* SETTINGS MODAL */}
      {screen === 'SETTINGS' && (
        <SettingsModal
          settings={saveData.settings}
          onClose={() => setScreen('MENU')}
          onSettingsChanged={() => setSaveData({ ...SaveManager.get() })}
        />
      )}

      {/* PAUSE MENU MODAL */}
      {screen === 'PAUSED' && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 overflow-y-auto select-none touch-manipulation">
          <div className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl max-w-sm sm:max-w-md w-full text-center space-y-4 shadow-2xl my-auto">
            <div>
              <div className="font-mono text-[10px] text-red-500 uppercase tracking-widest font-bold mb-1">
                COMBAT TACTICAL PAUSE
              </div>
              <h3 className="font-teko text-4xl sm:text-5xl font-bold text-white tracking-wider leading-none">
                GAME PAUSED
              </h3>
              <p className="font-military text-xs text-zinc-400 mt-1">
                {missionManagerRef.current?.currentMission.title.toUpperCase() || 'OPERATION SUSPENDED'}
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  screenRef.current = 'PLAYING';
                  setScreen('PLAYING');
                  safeRequestPointerLock();
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-teko text-2xl font-bold rounded-lg shadow-lg active:scale-95 transition-all min-h-[50px] touch-manipulation cursor-pointer border border-red-400"
              >
                RESUME COMBAT
              </button>

              <button
                onClick={() => {
                  if (missionManagerRef.current) {
                    startMission(missionManagerRef.current.currentMission.id);
                  }
                }}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 font-teko text-xl font-bold rounded-lg border border-zinc-700 active:scale-95 transition-all min-h-[46px] touch-manipulation cursor-pointer"
              >
                RESTART MISSION
              </button>

              <button
                onClick={() => setScreen('ARSENAL')}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-amber-300 font-teko text-xl font-bold rounded-lg border border-amber-500/50 active:scale-95 transition-all min-h-[46px] touch-manipulation cursor-pointer"
              >
                ARSENAL & UPGRADES
              </button>

              {saveData.hasAllyRecruit && (
                <button
                  onClick={() => {
                    const nextState = SaveManager.toggleAllyDeployment();
                    if (!nextState) {
                      AllySoldier.clear();
                    } else if (playerRef.current && sceneRef.current) {
                      AllySoldier.init(sceneRef.current, playerRef.current.position, saveData.allyCount || 1);
                    }
                    setSaveData({ ...SaveManager.get() });
                  }}
                  className={`w-full py-2.5 px-3 rounded-lg border font-teko text-lg font-bold flex items-center justify-between transition-all cursor-pointer min-h-[44px] ${
                    saveData.isAllyDeployed !== false
                      ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 hover:bg-emerald-900'
                      : 'bg-zinc-900/90 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <span>SQUAD ALLIES ({saveData.allyCount || 1}/5)</span>
                  <span className="text-xs font-mono uppercase">
                    {saveData.isAllyDeployed !== false ? 'DEPLOYED [ACTIVE]' : 'STANDBY [SOLO]'}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowBuyCoinsModal(true)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-950/90 to-zinc-900 hover:from-emerald-900 active:from-emerald-950 text-emerald-300 font-teko text-xl font-bold rounded-lg border border-emerald-500/60 active:scale-95 transition-all min-h-[46px] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
              >
                <Coins className="w-4 h-4 text-emerald-400" />
                BUY COINS / REQUISITION (FREE)
              </button>

              <button
                onClick={() => setScreen('MISSIONS')}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-blue-300 font-teko text-xl font-bold rounded-lg border border-blue-500/50 active:scale-95 transition-all min-h-[46px] touch-manipulation cursor-pointer"
              >
                CAMPAIGN MISSIONS
              </button>

              <button
                onClick={() => setScreen('SETTINGS')}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 font-teko text-xl font-bold rounded-lg border border-zinc-700 active:scale-95 transition-all min-h-[46px] touch-manipulation cursor-pointer"
              >
                SETTINGS & CONTROLS
              </button>

              <button
                onClick={returnToMenu}
                className="w-full py-2 text-zinc-400 hover:text-red-400 font-teko text-lg font-bold transition-colors min-h-[40px] touch-manipulation cursor-pointer"
              >
                QUIT TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUY COINS (FREE TESTING) STORE MODAL */}
      {showBuyCoinsModal && (
        <BuyCoinsModal
          saveData={saveData}
          onClose={() => setShowBuyCoinsModal(false)}
          onDataChanged={() => {
            const fresh = SaveManager.get();
            setSaveData({ ...fresh });
            if (playerRef.current) {
              playerRef.current.setWeapon(fresh.equippedWeapon, fresh.upgrades[fresh.equippedWeapon]);
            }
          }}
        />
      )}

      {/* MISSION END MODAL (VICTORY / DEFEAT) */}
      {(screen === 'VICTORY' || screen === 'DEFEAT') && endMissionStats && missionManagerRef.current && (
        <MissionEndModal
          isVictory={endMissionStats.isVictory}
          mission={missionManagerRef.current.currentMission}
          stats={endMissionStats.stats}
          isMobile={isMobile}
          onNextMission={
            endMissionStats.isVictory && missionManagerRef.current.currentMission.id < 10
              ? () => startMission(missionManagerRef.current!.currentMission.id + 1)
              : undefined
          }
          onRetry={() => startMission(missionManagerRef.current!.currentMission.id)}
          onOpenArsenal={() => setScreen('ARSENAL')}
          onMainMenu={returnToMenu}
        />
      )}

      {/* F3 TACTICAL DEBUG OVERLAY */}
      {showDebug && playerRef.current && zombieManagerRef.current && missionManagerRef.current && (
        <DebugOverlay
          fps={fps}
          player={playerRef.current}
          zombieManager={zombieManagerRef.current}
          missionManager={missionManagerRef.current}
          onRefreshData={() => setSaveData({ ...SaveManager.get() })}
        />
      )}
    </div>
  );
}
