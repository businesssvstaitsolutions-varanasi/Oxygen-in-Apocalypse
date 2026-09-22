import * as THREE from 'three';
import { WeaponConfig, WeaponTypeKey, HitResult, WeaponUpgradeLevel } from '../types';
import { WEAPON_DEFINITIONS, UPGRADE_TIERS } from '../data/weapons';
import { WeaponModelFactory } from '../models/WeaponModels';
import { ParticleSystem } from '../effects/ParticleSystem';
import { soundFx } from '../audio/SoundEffects';

export interface PlayerInput {
  forward: number;
  strafe: number;
  lookDeltaX: number;
  lookDeltaY: number;
  sprint: boolean;
  jump: boolean;
  shoot: boolean;
  reload: boolean;
  interact: boolean;
  aimDownSights: boolean;
  ascend?: boolean;
  descend?: boolean;
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public weaponContainer: THREE.Group;
  public currentWeaponMesh: THREE.Group | null = null;

  public position: THREE.Vector3 = new THREE.Vector3(0, 0, -36); // Feet at Y = 0
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public verticalVelocity: number = 0;
  public isGrounded: boolean = true;
  public pitch: number = 0; // vertical camera rotation
  public yaw: number = 0; // Face down the avenue towards +Z (North)

  // Tactical Flashlight (High-Lumen Weapon-Mounted Tactical Array)
  public flashlight: THREE.SpotLight;
  public flashlightFlood: THREE.SpotLight;
  public flashlightFill: THREE.PointLight;
  public flashlightTarget: THREE.Object3D;
  public isFlashlightOn: boolean = true;
  public hasPowerfulFlashlight: boolean = false;

  public hp: number = 100;
  public maxHp: number = 100;
  public isDead: boolean = false;
  public damageFlashTime: number = 0;
  public lastDamageAngle: number = 0;

  // Stamina & Exhaustion State
  public stamina: number = 100;
  public maxStamina: number = 100;
  public isExhausted: boolean = false;
  public isSprinting: boolean = false;
  public staminaRegenTimer: number = 0;
  private pantingSoundTimer: number = 0;

  // Weapon State
  public equippedWeaponKey: WeaponTypeKey = 'pistol';
  public weaponConfig: WeaponConfig = WEAPON_DEFINITIONS.pistol;
  public currentMag: number = 15;
  public reserveAmmo: number = 120;
  public isReloading: boolean = false;
  public reloadProgress: number = 0;
  public fireCooldown: number = 0;
  public upgrades: WeaponUpgradeLevel = { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 };

  // Recoil & Sway
  private recoilOffset: THREE.Vector3 = new THREE.Vector3();
  private recoilRotation: THREE.Euler = new THREE.Euler();
  private swayOffset: THREE.Vector3 = new THREE.Vector3();
  private bobTime: number = 0;
  private isAiming: boolean = false;

  // Raycaster
  public raycaster: THREE.Raycaster = new THREE.Raycaster();
  public onGunshot?: (origin: THREE.Vector3, soundRadius: number) => void;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 250);
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // High-powered tactical weapon-mounted flashlight (Primary penetrating spotlight)
    this.flashlight = new THREE.SpotLight(0xfffaed, 14.0, 95, Math.PI / 4.4, 0.35, 1.0);
    this.flashlight.position.set(0.2, -0.15, -0.1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 512;
    this.flashlight.shadow.mapSize.height = 512;
    this.flashlight.shadow.bias = -0.002;

    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -12);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    // Secondary wide-angle peripheral flood beam for doorframes, alleys & close quarters
    this.flashlightFlood = new THREE.SpotLight(0xfff3d6, 5.5, 45, Math.PI / 2.6, 0.85, 1.2);
    this.flashlightFlood.position.set(0.2, -0.15, -0.1);
    this.flashlightFlood.target = this.flashlightTarget;
    this.camera.add(this.flashlightFlood);

    // Ambient forward fill point light to illuminate ground, curbs, and nearby obstacles
    this.flashlightFill = new THREE.PointLight(0xffecd1, 2.5, 14, 1.4);
    this.flashlightFill.position.set(0, -0.1, -1.2);
    this.camera.add(this.flashlightFill);

    this.weaponContainer = new THREE.Group();
    this.camera.add(this.weaponContainer);

    this.setWeapon('pistol', { damageLevel: 0, magLevel: 0, fireRateLevel: 0, reloadLevel: 0 });
  }

  public setPowerfulFlashlight(enabled: boolean) {
    this.hasPowerfulFlashlight = enabled;
    if (enabled) {
      // 3,500-lumen Mil-Spec Heavy Searchlight configuration
      this.flashlight.distance = 180;
      this.flashlight.angle = Math.PI / 3.6;
      this.flashlight.penumbra = 0.45;
      this.flashlight.color.setHex(0xffffff);

      this.flashlightFlood.distance = 80;
      this.flashlightFlood.angle = Math.PI / 2.2;
      this.flashlightFlood.penumbra = 0.9;

      this.flashlightFill.distance = 24;
    } else {
      // Standard issue tactical light
      this.flashlight.distance = 95;
      this.flashlight.angle = Math.PI / 4.4;
      this.flashlight.penumbra = 0.35;
      this.flashlight.color.setHex(0xfffaed);

      this.flashlightFlood.distance = 45;
      this.flashlightFlood.angle = Math.PI / 2.6;
      this.flashlightFlood.penumbra = 0.85;

      this.flashlightFill.distance = 14;
    }

    if (this.isFlashlightOn) {
      this.flashlight.intensity = enabled ? 32.0 : 14.0;
      this.flashlightFlood.intensity = enabled ? 12.0 : 5.5;
      this.flashlightFill.intensity = enabled ? 5.5 : 2.5;
    }
  }

  public toggleFlashlight(): boolean {
    this.isFlashlightOn = !this.isFlashlightOn;
    const isHeavy = this.hasPowerfulFlashlight;
    this.flashlight.intensity = this.isFlashlightOn ? (isHeavy ? 32.0 : 14.0) : 0;
    this.flashlightFlood.intensity = this.isFlashlightOn ? (isHeavy ? 12.0 : 5.5) : 0;
    this.flashlightFill.intensity = this.isFlashlightOn ? (isHeavy ? 5.5 : 2.5) : 0;
    soundFx.playFlashlightClick();
    return this.isFlashlightOn;
  }

  public setWeapon(key: WeaponTypeKey, upgrades: WeaponUpgradeLevel) {
    this.equippedWeaponKey = key;
    this.weaponConfig = WEAPON_DEFINITIONS[key];
    this.upgrades = upgrades;

    // Remove old mesh
    if (this.currentWeaponMesh) {
      this.weaponContainer.remove(this.currentWeaponMesh);
    }

    // Build new mesh
    this.currentWeaponMesh = WeaponModelFactory.createWeaponMesh(key);
    this.weaponContainer.add(this.currentWeaponMesh);

    // Calculate upgraded mag size
    const bonusMag = Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
    this.currentMag = this.weaponConfig.baseMagSize + bonusMag;
    this.reserveAmmo = this.weaponConfig.maxReserveAmmo;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  public update(
    delta: number,
    input: PlayerInput,
    colliders: THREE.Box3[],
    zombieHitboxes: THREE.Object3D[],
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    onHitZombie: (result: HitResult) => void,
    onExplodeBarrel: (barrel: { position: THREE.Vector3 }) => void
  ) {
    if (this.isDead) return;

    if (this.damageFlashTime > 0) {
      this.damageFlashTime -= delta;
    }

    // 1. Look rotation (Euler order YXZ ensures pitch is always local & never inverts regardless of yaw)
    const adsSensitivityMult = input.aimDownSights ? 0.62 : 1.0;
    this.yaw -= input.lookDeltaX * adsSensitivityMult;
    this.pitch = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.44, this.pitch + input.lookDeltaY * adsSensitivityMult));

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // 2. Movement & Stamina Management
    const wantsSprint = input.sprint && input.forward > 0 && !input.aimDownSights;

    if (wantsSprint && !this.isExhausted && this.stamina > 0) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - delta * 24.0);
      this.staminaRegenTimer = 0.8;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.isExhausted = true;
        this.isSprinting = false;
        this.pantingSoundTimer = 0;
        soundFx.playExhausted();
      }
    } else {
      this.isSprinting = false;
      if (this.staminaRegenTimer > 0) {
        this.staminaRegenTimer -= delta;
      } else {
        const isMoving = Math.abs(input.forward) > 0.05 || Math.abs(input.strafe) > 0.05;
        const regenRate = isMoving ? 16.0 : 30.0;
        this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * delta);
        if (this.isExhausted && this.stamina >= 25.0) {
          this.isExhausted = false;
        }
      }
    }

    // Audio cue for heavy panting when exhausted or critically low stamina
    if (this.isExhausted || (this.stamina < 20 && this.velocity.lengthSq() > 0.5)) {
      this.pantingSoundTimer -= delta;
      if (this.pantingSoundTimer <= 0) {
        soundFx.playPanting();
        this.pantingSoundTimer = this.isExhausted ? 1.6 : 2.6;
      }
    }

    const isSprinting = this.isSprinting;
    const speed = isSprinting ? 6.5 : (input.aimDownSights ? 2.4 : 3.8);

    // Move direction relative to yaw
    const forwardVec = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forwardVec, input.forward);
    moveDir.addScaledVector(rightVec, input.strafe);

    if (moveDir.lengthSq() > 0.01) {
      moveDir.normalize();
      this.velocity.lerp(moveDir.multiplyScalar(speed), delta * 16);
      this.bobTime += delta * (isSprinting ? 14 : 9);
    } else {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), delta * 18);
    }

    // Apply movement with collision & auto-step
    const nextPos = this.position.clone().addScaledVector(this.velocity, delta);

    // Calculate ground support height (can stand on vehicles, dumpsters, crates, stairs, and roofs)
    let groundY = 0;
    for (const box of colliders) {
      if (
        nextPos.x > box.min.x - 0.25 &&
        nextPos.x < box.max.x + 0.25 &&
        nextPos.z > box.min.z - 0.25 &&
        nextPos.z < box.max.z + 0.25
      ) {
        // Can land on top if player feet are near or above the surface
        if (box.max.y <= this.position.y + 0.65) {
          if (box.max.y > groundY) {
            groundY = box.max.y;
          }
        }
      }
    }

    // Natural human player collision radius (0.28m - smooth sliding through doorways, pylons, and corners)
    const playerRadius = 0.28;
    const stepHeight = 0.48; // Can easily step over curbs, low debris, pallets
    let allowedX = true;
    let allowedZ = true;

    const bodyBottom = this.position.y + stepHeight;
    const bodyTop = this.position.y + 1.85;

    for (const box of colliders) {
      // Only block horizontal movement if the obstacle is above step height and at body level
      if (bodyBottom >= box.max.y || bodyTop <= box.min.y) continue;

      // 1. Test X axis movement
      // Only evaluate X collision if player's Z span overlaps box's Z span
      const overlapsZ = (this.position.z + playerRadius > box.min.z) && (this.position.z - playerRadius < box.max.z);
      if (overlapsZ) {
        const nextOverlapsX = (nextPos.x + playerRadius > box.min.x) && (nextPos.x - playerRadius < box.max.x);
        if (nextOverlapsX) {
          const boxCenterX = (box.min.x + box.max.x) * 0.5;
          const currDistX = Math.abs(this.position.x - boxCenterX);
          const nextDistX = Math.abs(nextPos.x - boxCenterX);

          // Only block if movement would move deeper into or stay inside the obstacle
          if (nextDistX <= currDistX) {
            allowedX = false;
            this.velocity.x *= 0.15; // Smooth slide friction along wall
          }
        }
      }

      // 2. Test Z axis movement
      // Only evaluate Z collision if player's X span overlaps box's X span
      const overlapsX = (this.position.x + playerRadius > box.min.x) && (this.position.x - playerRadius < box.max.x);
      if (overlapsX) {
        const nextOverlapsZ = (nextPos.z + playerRadius > box.min.z) && (nextPos.z - playerRadius < box.max.z);
        if (nextOverlapsZ) {
          const boxCenterZ = (box.min.z + box.max.z) * 0.5;
          const currDistZ = Math.abs(this.position.z - boxCenterZ);
          const nextDistZ = Math.abs(nextPos.z - boxCenterZ);

          // Only block if movement would move deeper into or stay inside the obstacle
          if (nextDistZ <= currDistZ) {
            allowedZ = false;
            this.velocity.z *= 0.15; // Smooth slide friction along wall
          }
        }
      }
    }

    // Fully accessible perimeter boundaries (expanded across all vast battlegrounds)
    if (allowedX && nextPos.x > -85 && nextPos.x < 85) {
      this.position.x = nextPos.x;
    }
    if (allowedZ && nextPos.z > -115 && nextPos.z < 115) {
      this.position.z = nextPos.z;
    }

    // Proactive Corner & Wall Depenetration Pass:
    // Guarantees player is never stuck or embedded in corners between two perpendicular colliders
    for (const box of colliders) {
      if (bodyBottom >= box.max.y || bodyTop <= box.min.y) continue;

      const closestX = Math.max(box.min.x, Math.min(box.max.x, this.position.x));
      const closestZ = Math.max(box.min.z, Math.min(box.max.z, this.position.z));
      const diffX = this.position.x - closestX;
      const diffZ = this.position.z - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < playerRadius * playerRadius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const pushOut = (playerRadius - dist) + 0.005;
          this.position.x += (diffX / dist) * pushOut;
          this.position.z += (diffZ / dist) * pushOut;
        } else {
          // Inside box center fallback: push along the shortest axis face
          const dMinX = Math.abs(this.position.x - box.min.x);
          const dMaxX = Math.abs(box.max.x - this.position.x);
          const dMinZ = Math.abs(this.position.z - box.min.z);
          const dMaxZ = Math.abs(box.max.z - this.position.z);
          const minVal = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

          if (minVal === dMinX) this.position.x = box.min.x - playerRadius - 0.01;
          else if (minVal === dMaxX) this.position.x = box.max.x + playerRadius + 0.01;
          else if (minVal === dMinZ) this.position.z = box.min.z - playerRadius - 0.01;
          else this.position.z = box.max.z + playerRadius + 0.01;
        }
      }
    }

    // Vertical Physics: Jump & Gravity (with stamina cost)
    if (input.jump && this.isGrounded) {
      if (this.stamina >= 10 && !this.isExhausted) {
        this.stamina = Math.max(0, this.stamina - 12);
        this.staminaRegenTimer = 0.9;
        this.verticalVelocity = 8.5;
        this.isGrounded = false;
        soundFx.playJump();
      } else if (this.stamina >= 4) {
        this.stamina = 0;
        this.isExhausted = true;
        this.staminaRegenTimer = 1.2;
        this.verticalVelocity = 5.2;
        this.isGrounded = false;
        soundFx.playJump();
        soundFx.playExhausted();
      }
    }

    // Gravity & Ground Landing
    if (!this.isGrounded || this.position.y > groundY + 0.02) {
      this.verticalVelocity += -24.0 * delta;
      this.position.y += this.verticalVelocity * delta;

      if (this.position.y <= groundY) {
        if (this.verticalVelocity < -4.0) {
          soundFx.playLand();
        }
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else {
      this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, delta * 18);
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // Head bobbing calculation (only when on ground)
    const bobOffset = this.isGrounded ? Math.sin(this.bobTime) * (isSprinting ? 0.08 : 0.04) : 0;
    this.camera.position.set(this.position.x, this.position.y + 1.7 + bobOffset, this.position.z);

    // 3. Aim Down Sights (ADS)
    this.isAiming = input.aimDownSights;
    const targetFov = this.isAiming ? 50 : 72;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 10);
    this.camera.updateProjectionMatrix();

    // 4. Weapon Sway & Recoil Recovery (gun lags naturally behind camera rotation)
    const targetSwayX = -input.lookDeltaX * 0.35;
    const targetSwayY = -input.lookDeltaY * 0.35;
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, targetSwayX, delta * 8);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, targetSwayY, delta * 8);

    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 9);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, delta * 9);

    if (this.currentWeaponMesh) {
      // Default lower-right or centered ADS
      const defaultX = this.isAiming ? 0 : 0.24;
      const defaultY = this.isAiming ? -0.15 : -0.22;
      const defaultZ = this.isAiming ? -0.36 : -0.45;

      this.currentWeaponMesh.position.set(
        defaultX + this.swayOffset.x + this.recoilOffset.x,
        defaultY + this.swayOffset.y + this.recoilOffset.y,
        defaultZ + this.recoilOffset.z
      );

      this.currentWeaponMesh.rotation.x = this.recoilRotation.x;
      this.currentWeaponMesh.rotation.y = -this.swayOffset.x * 0.5;
    }

    // 5. Weapon Firing & Reloading
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }

    // Reload logic
    if (this.isReloading) {
      const reloadSpeedBonus = this.upgrades.reloadLevel * UPGRADE_TIERS.reloadSpeedBonusPerLevel;
      const effectiveReloadTime = Math.max(0.6, this.weaponConfig.baseReloadTime * (1 - reloadSpeedBonus));
      this.reloadProgress += delta / effectiveReloadTime;

      // Animate weapon dropping down during reload
      if (this.currentWeaponMesh) {
        this.currentWeaponMesh.position.y -= Math.sin(this.reloadProgress * Math.PI) * 0.15;
      }

      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
        const maxMag = this.weaponConfig.baseMagSize + Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
        const needed = maxMag - this.currentMag;
        const taken = Math.min(needed, this.reserveAmmo);
        this.currentMag += taken;
        this.reserveAmmo -= taken;
      }
    } else {
      // Check for reload input
      const maxMag = this.weaponConfig.baseMagSize + Math.round(this.weaponConfig.baseMagSize * (this.upgrades.magLevel * UPGRADE_TIERS.magBonusPerLevel));
      if ((input.reload || this.currentMag === 0 && input.shoot) && this.currentMag < maxMag && this.reserveAmmo > 0) {
        this.isReloading = true;
        this.reloadProgress = 0;
        soundFx.playReloadSequence();
      }
    }

    // Shooting
    if (input.shoot && !this.isReloading && this.fireCooldown <= 0) {
      if (this.currentMag > 0) {
        this.executeFire(zombieHitboxes, explosiveBarrels, onHitZombie, onExplodeBarrel);
      } else {
        soundFx.playDryFire();
        const effectiveRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
        this.fireCooldown = 60 / effectiveRpm;
      }
    }
  }

  private executeFire(
    zombieHitboxes: THREE.Object3D[],
    explosiveBarrels: { mesh: THREE.Mesh; position: THREE.Vector3; hp: number; exploded: boolean }[],
    onHitZombie: (result: HitResult) => void,
    onExplodeBarrel: (barrel: { position: THREE.Vector3 }) => void
  ) {
    this.currentMag -= 1;

    // RPM calculation with upgrades
    const effectiveRpm = this.weaponConfig.fireRateRpm * (1 + this.upgrades.fireRateLevel * UPGRADE_TIERS.fireRateBonusPerLevel);
    this.fireCooldown = 60 / effectiveRpm;

    // Gunshot audio
    switch (this.equippedWeaponKey) {
      case 'shotgun':
        soundFx.playShotgunShot();
        break;
      case 'rifle':
        soundFx.playRifleShot();
        break;
      case 'smg':
        soundFx.playSMGShot();
        break;
      case 'heavy':
        soundFx.playHeavyShot();
        break;
      case 'sniper':
        soundFx.playSniperShot();
        break;
      case 'pistol':
      default:
        soundFx.playPistolShot();
        break;
    }

    // Recoil kick
    const recoilAmount = this.weaponConfig.recoil;
    this.recoilOffset.z += recoilAmount * 0.8;
    this.recoilOffset.y += recoilAmount * 0.2;
    this.recoilRotation.x += recoilAmount * 0.4;
    this.pitch += recoilAmount * 0.08; // Subtle camera rise

    // Acoustic gunshot noise (attracts nearby zombies)
    if (this.onGunshot) {
      const gunshotRadius = this.equippedWeaponKey === 'shotgun' ? 38 : this.equippedWeaponKey === 'pistol' ? 22 : 32;
      this.onGunshot(this.position.clone(), gunshotRadius);
    }

    // Shell casing
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    ParticleSystem.spawnShellCasing(this.camera.position, camRight);

    // Base damage with upgrades
    const damageMultiplier = 1 + this.upgrades.damageLevel * UPGRADE_TIERS.damageMultiplierPerLevel;
    const baseDmg = this.weaponConfig.baseDamage * damageMultiplier;

    // Pellets count (8 for shotgun, 1 for others)
    const pellets = this.weaponConfig.pellets || 1;

    for (let p = 0; p < pellets; p++) {
      // Spread calculation
      const spread = this.isAiming ? this.weaponConfig.spread * 0.5 : this.weaponConfig.spread;
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;

      this.raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), this.camera);

      // Check explosive barrels
      const barrelMeshes = explosiveBarrels.filter((b) => !b.exploded).map((b) => b.mesh);
      const barrelHits = this.raycaster.intersectObjects(barrelMeshes, false);

      if (barrelHits.length > 0 && barrelHits[0].distance < this.weaponConfig.range) {
        const hit = barrelHits[0];
        const barrelObj = explosiveBarrels.find((b) => b.mesh === hit.object);
        if (barrelObj && !barrelObj.exploded) {
          barrelObj.hp -= baseDmg;
          if (barrelObj.hp <= 0) {
            barrelObj.exploded = true;
            barrelObj.mesh.visible = false;
            soundFx.playExplosion();
            ParticleSystem.spawnExplosion(barrelObj.position);
            onExplodeBarrel({ position: barrelObj.position });
          } else {
            ParticleSystem.spawnSparks(hit.point, hit.normal || new THREE.Vector3(0, 1, 0));
          }
        }
        continue;
      }

      // Check zombies
      const zombieHits = this.raycaster.intersectObjects(zombieHitboxes, false);

      if (zombieHits.length > 0 && zombieHits[0].distance < this.weaponConfig.range) {
        const hit = zombieHits[0];
        const hitZone = (hit.object.userData?.hitZone || 'TORSO') as 'HEAD' | 'TORSO' | 'LIMB' | 'WEAKPOINT';
        const zombieId = hit.object.userData?.zombieId;

        let zoneMult = 1.0;
        let isHeadshot = false;

        if (hitZone === 'HEAD') {
          zoneMult = this.weaponConfig.headshotMultiplier;
          isHeadshot = true;
          soundFx.playHeadshotSound();
        } else if (hitZone === 'WEAKPOINT') {
          zoneMult = 3.0; // Boss weak point!
          soundFx.playHeadshotSound();
        } else if (hitZone === 'LIMB') {
          zoneMult = 0.65;
          soundFx.playHitMarker();
        } else {
          soundFx.playHitMarker();
        }

        const totalDamage = Math.round(baseDmg * zoneMult);
        ParticleSystem.spawnBlood(
          hit.point,
          this.raycaster.ray.direction,
          isHeadshot,
          false,
          this.equippedWeaponKey === 'shotgun'
        );

        // Blood/Gore effect of zombie is placed on the ground/floor, NOT on the screen
        const floorPos = hit.point.clone();
        floorPos.y = 0.02;
        ParticleSystem.spawnBloodDecal(floorPos, isHeadshot ? 2.0 : 1.2);

        onHitZombie({
          hit: true,
          zone: hitZone,
          damage: totalDamage,
          isFatal: false, // will be evaluated by ZombieManager
          targetId: zombieId,
          point: [hit.point.x, hit.point.y, hit.point.z],
        });
      } else {
        // Wall spark / dust
        const shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const wallPoint = this.camera.position.clone().addScaledVector(shootDir, Math.min(30, this.weaponConfig.range));
        ParticleSystem.spawnSparks(wallPoint, new THREE.Vector3(0, 1, 0));
      }
    }
  }

  public takeDamage(amount: number, attackerPos: THREE.Vector3) {
    if (this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.stamina = Math.max(0, this.stamina - 15); // Physical shock on stamina
    this.staminaRegenTimer = 1.0;
    this.damageFlashTime = 0.4;
    soundFx.playPlayerHurt();

    // Dynamic blood splatter on player screen / visor
    ParticleSystem.addScreenBlood(Math.min(0.6, amount * 0.02 + 0.18));
    ParticleSystem.spawnBlood(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, 0.5, 0));

    // Calculate angle to attacker for directional HUD damage indicator
    const dx = attackerPos.x - this.position.x;
    const dz = attackerPos.z - this.position.z;
    const angleToAttacker = Math.atan2(dx, dz);
    this.lastDamageAngle = angleToAttacker - this.yaw;

    // Directional damage indicator set for HUD vignette
    let relAngle = this.lastDamageAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    if (this.hp <= 0) {
      this.isDead = true;
      soundFx.playDefeat();
    }
  }

  public heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    soundFx.playPickup();
  }

  public addAmmo(amount: number) {
    this.reserveAmmo = Math.min(this.weaponConfig.maxReserveAmmo * 2, this.reserveAmmo + amount);
    soundFx.playPickup();
  }

  public reset(spawnPos: [number, number, number] = [0, 0, -36]) {
    this.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
    this.camera.position.set(this.position.x, this.position.y + 1.7, this.position.z);
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.pitch = 0;
    this.yaw = Math.PI; // Face forward (+Z) down the urban avenue
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.isExhausted = false;
    this.isSprinting = false;
    this.staminaRegenTimer = 0;
    this.isDead = false;
    this.damageFlashTime = 0;
    this.isReloading = false;
    this.currentMag = this.weaponConfig.baseMagSize;
    this.reserveAmmo = this.weaponConfig.maxReserveAmmo;
    if (this.flashlight) {
      this.flashlight.intensity = this.isFlashlightOn ? 14.0 : 0;
      this.flashlightFlood.intensity = this.isFlashlightOn ? 5.5 : 0;
      this.flashlightFill.intensity = this.isFlashlightOn ? 2.5 : 0;
    }
  }
}
