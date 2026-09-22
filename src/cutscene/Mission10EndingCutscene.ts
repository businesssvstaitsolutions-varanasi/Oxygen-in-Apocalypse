import * as THREE from 'three';
import { HelicopterModel, HelicopterInstance } from '../models/HelicopterModel';
import { soundFx } from '../audio/SoundEffects';
import { ParticleSystem } from '../effects/ParticleSystem';

export class Mission10EndingCutscene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private heliInstance: HelicopterInstance | null = null;
  private isRunning: boolean = false;
  private time: number = 0;
  private readonly duration: number = 10.0;
  private onCompleteCallback: (() => void) | null = null;

  // Visual effects for the nuclear blast
  private blastGroup: THREE.Group | null = null;
  private blastLight: THREE.PointLight | null = null;
  private blastFireballs: THREE.Mesh[] = [];
  private shockwaveRing: THREE.Mesh | null = null;
  private rotorTimer: number = 0;
  private explosionTriggered: boolean = false;

  public currentSubtitle: string = '';
  public screenFlashAlpha: number = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  public startCutscene(onComplete: () => void) {
    this.onCompleteCallback = onComplete;
    this.isRunning = true;
    this.time = 0;
    this.rotorTimer = 0;
    this.explosionTriggered = false;
    this.screenFlashAlpha = 0;
    this.currentSubtitle = 'PILOT: "ALLIES IN CABIN! FULL THROTTLE, HOLD ON!"';

    // Create or prepare helicopter
    if (!this.heliInstance) {
      this.heliInstance = HelicopterModel.createHelicopter();
      this.scene.add(this.heliInstance.group);
    }

    this.heliInstance.group.visible = true;
    // Position at the helipad
    this.heliInstance.group.position.set(0, 0.4, 44);
    this.heliInstance.group.rotation.set(0, Math.PI, 0);

    // Prepare blast group in the background (center of city pylon [0, 0, 0])
    if (!this.blastGroup) {
      this.blastGroup = new THREE.Group();
      this.blastGroup.position.set(0, 0, 0);

      // Expanding nuclear blast light
      this.blastLight = new THREE.PointLight(0xff6600, 0, 200, 1.2);
      this.blastLight.position.set(0, 8, 0);
      this.blastGroup.add(this.blastLight);

      // Shockwave ring
      const ringGeo = new THREE.RingGeometry(0.5, 4.0, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
      this.shockwaveRing.position.y = 0.5;
      this.blastGroup.add(this.shockwaveRing);

      // Multiple layered fireball spheres for rising mushroom explosion
      this.blastFireballs = [];
      for (let i = 0; i < 12; i++) {
        const sphereGeo = new THREE.SphereGeometry(2 + Math.random() * 2.5, 12, 10);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xff5500 : 0xffaa00,
          transparent: true,
          opacity: 0,
        });
        const mesh = new THREE.Mesh(sphereGeo, sphereMat);
        mesh.position.set(
          (Math.random() - 0.5) * 6,
          2 + i * 2.0,
          (Math.random() - 0.5) * 6
        );
        this.blastFireballs.push(mesh);
        this.blastGroup.add(mesh);
      }

      this.scene.add(this.blastGroup);
    }

    this.blastGroup.visible = false;
    soundFx.playRadioTransmission();
  }

  public skip() {
    if (!this.isRunning) return;
    this.finish();
  }

  public dispose() {
    this.isRunning = false;
    this.currentSubtitle = '';
    this.screenFlashAlpha = 0;
    if (this.heliInstance) {
      this.heliInstance.group.visible = false;
    }
    if (this.blastGroup) {
      this.blastGroup.visible = false;
    }
  }

  private finish() {
    this.isRunning = false;
    this.currentSubtitle = '';
    this.screenFlashAlpha = 0;
    if (this.heliInstance) {
      this.heliInstance.group.visible = false;
    }
    if (this.blastGroup) {
      this.blastGroup.visible = false;
    }
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  public update(delta: number): { isRunning: boolean; subtitle: string; flashAlpha: number } {
    if (!this.isRunning || !this.heliInstance) {
      return { isRunning: false, subtitle: '', flashAlpha: 0 };
    }

    this.time += delta;
    const t = this.time;

    // Fast rotor spinning
    this.heliInstance.mainRotor.rotation.y += delta * 36;
    this.heliInstance.tailRotor.rotation.x += delta * 45;

    // Audio rotor thrum
    this.rotorTimer -= delta;
    if (this.rotorTimer <= 0) {
      this.rotorTimer = 0.08;
      soundFx.playHelicopterRotor(0.95);
    }

    // Flash decay
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - delta * 1.2);
    }

    const heli = this.heliInstance.group;

    // =========================================================================
    // CINEMATIC TIMELINE (10.0 Seconds)
    // =========================================================================
    if (t < 3.2) {
      // PHASE 1: Lift off from Helipad [0, 0, 44] and climb vertically
      const p = t / 3.2;
      heli.position.set(0, THREE.MathUtils.lerp(0.4, 12, p * p), 44 + p * 6);
      heli.rotation.set(-0.12 * p, Math.PI, 0);

      // Camera views helicopter from dramatic low ground-angle
      this.camera.position.set(10, 2.5 + p * 4, 32);
      this.camera.lookAt(heli.position.x, heli.position.y + 1.2, heli.position.z);

      this.currentSubtitle = 'PILOT: "CABIN SECURED! MAXIMUM CLIMB POWER - GETTING OUT OF THE BLAST CONE!"';
    } else if (t < 6.5) {
      // PHASE 2: High-speed forward climb towards the camera & horizon
      const p = (t - 3.2) / 3.3;
      heli.position.x = THREE.MathUtils.lerp(0, -12, p);
      heli.position.y = THREE.MathUtils.lerp(12, 34, p);
      heli.position.z = THREE.MathUtils.lerp(50, 110, p);
      heli.rotation.set(-0.25, Math.PI + 0.15, -0.1);

      // Cinematic chase camera looking past the helicopter back toward the quarantine city
      this.camera.position.set(
        heli.position.x + 14,
        heli.position.y + 6,
        heli.position.z - 26
      );
      this.camera.lookAt(0, 10, 0); // Camera looks back toward city ground zero!

      this.currentSubtitle = 'COMMAND RADIO: "TIME-BOMB COUNTDOWN ZERO IN 3... 2... 1..."';
    } else if (t < 9.2) {
      // PHASE 3: THE TIME-BOMB DETONATES IN THE BACKGROUND!
      if (!this.explosionTriggered) {
        this.explosionTriggered = true;
        this.screenFlashAlpha = 0.95; // Blinding flash
        soundFx.playExplosion();
        soundFx.playHordeSiren();

        if (this.blastGroup) {
          this.blastGroup.visible = true;
        }
      }

      const pBlast = (t - 6.5) / 2.7;

      // Helicopter continues flying safely forward into the upper sky
      heli.position.x = THREE.MathUtils.lerp(-12, -22, pBlast);
      heli.position.y = THREE.MathUtils.lerp(34, 52, pBlast);
      heli.position.z = THREE.MathUtils.lerp(110, 160, pBlast);

      // Dramatic camera shake and view of the massive nuclear blast behind the flying helicopter!
      const shakeX = (Math.random() - 0.5) * Math.max(0, 1.0 - pBlast) * 1.5;
      const shakeY = (Math.random() - 0.5) * Math.max(0, 1.0 - pBlast) * 1.5;

      this.camera.position.set(
        heli.position.x + 18 + shakeX,
        heli.position.y + 2 + shakeY,
        heli.position.z - 28
      );
      this.camera.lookAt(0, 14, 0); // Focus on the apocalyptic mushroom blast!

      // Animate the rising expanding blast fireball and shockwave
      if (this.blastLight) {
        this.blastLight.intensity = Math.max(0, (1 - pBlast) * 25.0);
        this.blastLight.position.y = 8 + pBlast * 30;
      }

      if (this.shockwaveRing) {
        const ringScale = 1.0 + pBlast * 45;
        this.shockwaveRing.scale.set(ringScale, ringScale, 1.0);
        (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - pBlast) * 0.85);
      }

      this.blastFireballs.forEach((fb, idx) => {
        const scale = (1.0 + pBlast * 6.0) * (1 + (idx % 3) * 0.4);
        fb.scale.set(scale, scale * 1.25, scale);
        fb.position.y += delta * (12 + idx * 2.0);
        fb.rotation.y += delta * 0.5;
        (fb.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - pBlast * 0.85));
      });

      this.currentSubtitle = 'HQ BROADCAST: "CONFIRMED IMPACT! SECTOR BLAST COMPLETE. THE OUTBREAK IS TERMINATED."';
    } else if (t < this.duration) {
      // PHASE 4: Helicopter banks safely into the dawn sky, city in ashes
      this.currentSubtitle = 'MISSION ACCOMPLISHED: OPERATION OMEGA PROTOCOL SUCCESSFUL.';
      if (t >= this.duration - 0.1) {
        this.finish();
      }
    }

    return {
      isRunning: this.isRunning,
      subtitle: this.currentSubtitle,
      flashAlpha: this.screenFlashAlpha,
    };
  }
}
