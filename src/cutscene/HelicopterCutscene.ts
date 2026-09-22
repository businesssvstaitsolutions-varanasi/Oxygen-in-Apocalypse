import * as THREE from 'three';
import { HelicopterModel, HelicopterInstance } from '../models/HelicopterModel';
import { soundFx } from '../audio/SoundEffects';

export class HelicopterCutscene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private heliInstance: HelicopterInstance | null = null;
  private isRunning: boolean = false;
  private time: number = 0;
  private duration: number = 7.5; // ~7.5 seconds cinematic
  private onCompleteCallback: (() => void) | null = null;

  // Sound pulse throttle
  private rotorTimer: number = 0;
  private radioTriggered: boolean = false;
  private dropTriggered: boolean = false;

  private dropPoint: THREE.Vector3 = new THREE.Vector3(0, 0, -36);
  public currentSubtitle: string = '';

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  public setDropPoint(pos: THREE.Vector3) {
    this.dropPoint.copy(pos);
  }

  public startCutscene(onComplete: () => void) {
    this.onCompleteCallback = onComplete;
    this.isRunning = true;
    this.time = 0;
    this.rotorTimer = 0;
    this.radioTriggered = false;
    this.dropTriggered = false;
    this.currentSubtitle = 'TACTICAL INSERTION: EXTRACTION TEAM REACHING SECTOR PERIMETER...';

    // Create helicopter if not already present
    if (!this.heliInstance) {
      this.heliInstance = HelicopterModel.createHelicopter();
      this.scene.add(this.heliInstance.group);
    }

    this.heliInstance.group.visible = true;
    this.heliInstance.group.position.set(this.dropPoint.x - 25, 24, this.dropPoint.z - 54);
    this.heliInstance.group.rotation.set(0.15, -0.2, 0.1);

    soundFx.playRadioTransmission();
  }

  public skip() {
    if (!this.isRunning) return;
    this.finish();
  }

  public dispose() {
    this.isRunning = false;
    this.currentSubtitle = '';
    this.onCompleteCallback = null;
    if (this.heliInstance) {
      this.heliInstance.group.visible = false;
    }
  }

  private finish() {
    this.isRunning = false;
    this.currentSubtitle = '';
    if (this.heliInstance) {
      this.heliInstance.group.visible = false;
    }
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  public update(delta: number): { isRunning: boolean; subtitle: string } {
    if (!this.isRunning || !this.heliInstance) {
      return { isRunning: false, subtitle: '' };
    }

    this.time += delta;
    const t = this.time;

    // Spin main and tail rotors rapidly
    this.heliInstance.mainRotor.rotation.y += delta * 28;
    this.heliInstance.tailRotor.rotation.x += delta * 35;

    // Helicopter rotor audio thrum
    this.rotorTimer -= delta;
    if (this.rotorTimer <= 0) {
      this.rotorTimer = 0.085;
      const dist = this.camera.position.distanceTo(this.heliInstance.group.position);
      const intensity = Math.max(0.2, Math.min(1.0, 1 - dist / 60));
      soundFx.playHelicopterRotor(intensity);
    }

    // Aim searchlight down at the city street
    this.heliInstance.searchLightTarget.position.set(
      this.heliInstance.group.position.x + Math.sin(t * 1.5) * 4,
      0,
      this.heliInstance.group.position.z + 12 + Math.cos(t * 1.5) * 4
    );

    // ==========================================
    // CINEMATIC STAGES
    // ==========================================
    if (t < 2.8) {
      // PHASE 1: Aerial Ingress swoop over skyscrapers
      const progress = t / 2.8;
      const targetX = this.dropPoint.x;
      const targetZ = this.dropPoint.z;

      this.heliInstance.group.position.x = THREE.MathUtils.lerp(targetX - 22, targetX - 2, progress);
      this.heliInstance.group.position.y = THREE.MathUtils.lerp(22, 9, progress);
      this.heliInstance.group.position.z = THREE.MathUtils.lerp(targetZ - 49, targetZ - 6, progress);
      this.heliInstance.group.rotation.set(0.18, -0.15, 0.08);

      // Camera trailing from side-quarter angle
      this.camera.position.set(
        this.heliInstance.group.position.x - 9,
        this.heliInstance.group.position.y + 3.5,
        this.heliInstance.group.position.z - 14
      );
      this.camera.lookAt(
        this.heliInstance.group.position.x,
        this.heliInstance.group.position.y,
        this.heliInstance.group.position.z + 6
      );

      if (!this.radioTriggered && t > 0.8) {
        this.radioTriggered = true;
        soundFx.playRadioTransmission();
        this.currentSubtitle = 'HQ: "VIPER-1, you are green for combat drop. Eliminate all hostiles."';
      }
    } else if (t < 4.8) {
      // PHASE 2: Flare & Hover over Landing Zone
      const progress = (t - 2.8) / 2.0;
      const targetX = this.dropPoint.x;
      const targetZ = this.dropPoint.z;

      this.heliInstance.group.position.x = THREE.MathUtils.lerp(targetX - 2, targetX, progress);
      this.heliInstance.group.position.y = THREE.MathUtils.lerp(9, 4.5, progress);
      this.heliInstance.group.position.z = THREE.MathUtils.lerp(targetZ - 6, targetZ, progress);

      // Pitch nose up to flare
      this.heliInstance.group.rotation.set(-0.12, 0, Math.sin(t * 4) * 0.04);

      // Camera swoops around to front-cinematic low angle facing the helicopter
      this.camera.position.set(
        targetX + Math.sin(progress * Math.PI) * 4,
        THREE.MathUtils.lerp(4.0, 1.8, progress),
        targetZ + THREE.MathUtils.lerp(-12, 4, progress)
      );
      this.camera.lookAt(targetX, 3.5, targetZ);

      this.currentSubtitle = 'PILOT: "FAST ROPE DEPLOYED! GO GO GO!"';
    } else if (t < 5.8) {
      // PHASE 3: Operator Drops onto Pavement
      if (!this.dropTriggered) {
        this.dropTriggered = true;
        soundFx.playLand();
        this.currentSubtitle = 'BOOTS ON THE GROUND. QUARANTINE PERIMETER INFILTRATED.';
      }

      // Smooth camera transition into player eye level
      const progress = (t - 4.8) / 1.0;
      this.camera.position.set(this.dropPoint.x, THREE.MathUtils.lerp(2.2, 1.7, progress), this.dropPoint.z);
      this.camera.rotation.set(
        THREE.MathUtils.lerp(-0.35, 0, progress),
        THREE.MathUtils.lerp(Math.PI, 0, progress),
        0
      );

      // Helicopter starts climb-out
      this.heliInstance.group.position.y += delta * 6.5;
      this.heliInstance.group.position.z += delta * 12.0;
      this.heliInstance.group.rotation.set(0.25, 0.35, -0.2);
    } else if (t < this.duration) {
      // PHASE 4: Helicopter banks away into the night sky
      this.heliInstance.group.position.x += delta * 14.0;
      this.heliInstance.group.position.y += delta * 12.0;
      this.heliInstance.group.position.z += delta * 24.0;
      this.heliInstance.group.rotation.set(0.3, 0.45, -0.35);

      this.currentSubtitle = 'MISSION: RESTORE POWER GENERATOR & REACH SAFEHOUSE';
    } else {
      this.finish();
    }

    return { isRunning: this.isRunning, subtitle: this.currentSubtitle };
  }
}
