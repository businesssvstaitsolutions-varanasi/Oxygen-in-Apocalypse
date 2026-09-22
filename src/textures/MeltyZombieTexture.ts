import * as THREE from 'three';

export interface UVRegion {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

export const MELTY_UV = {
  CHEST_RIBS: { uMin: 0.32, vMin: 0.35, uMax: 0.96, vMax: 0.68 },
  BELLY_PUSTULES: { uMin: 0.52, vMin: 0.52, uMax: 0.84, vMax: 0.74 },
  LIMB_ARM: { uMin: 0.26, vMin: 0.62, uMax: 0.50, vMax: 0.98 },
  LIMB_LEG: { uMin: 0.02, vMin: 0.50, uMax: 0.25, vMax: 0.98 },
  NECK_THROAT: { uMin: 0.56, vMin: 0.52, uMax: 0.84, vMax: 0.98 },
  HEAD_FACE: { uMin: 0.22, vMin: 0.28, uMax: 0.42, vMax: 0.49 },
  HAND_CLAW: { uMin: 0.66, vMin: 0.02, uMax: 0.98, vMax: 0.30 },
  FOOT_TOES: { uMin: 0.02, vMin: 0.02, uMax: 0.30, vMax: 0.32 },
  TEETH_ENAMEL: { uMin: 0.76, vMin: 0.66, uMax: 0.98, vMax: 0.98 },
  EYEBALL: { uMin: 0.55, vMin: 0.01, uMax: 0.70, vMax: 0.16 },
};

export class MeltyZombieTexture {
  private static cachedTexture: THREE.CanvasTexture | null = null;
  private static cachedMaterial: THREE.MeshStandardMaterial | null = null;
  private static cachedGoreMaterial: THREE.MeshStandardMaterial | null = null;
  private static cachedEyeMaterial: THREE.MeshStandardMaterial | null = null;

  public static remapGeometryUV(geo: THREE.BufferGeometry, region: UVRegion) {
    const uvAttr = geo.attributes.uv;
    if (!uvAttr) return;

    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      uvAttr.setXY(
        i,
        region.uMin + u * (region.uMax - region.uMin),
        region.vMin + v * (region.vMax - region.vMin)
      );
    }
    uvAttr.needsUpdate = true;
  }

  // Generates the authentic 1024x1024 Melty Zombie diffuse texture pattern matching Material__meltyzombie_diffuse_tga_baseColor.png
  public static getDiffuseTexture(): THREE.CanvasTexture {
    if (this.cachedTexture) return this.cachedTexture;

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // -------------------------------------------------------------
    // 1. BASE ORGANIC FLESH BACKGROUND (Warm cadaverous necrotic flesh)
    // -------------------------------------------------------------
    const baseGrad = ctx.createLinearGradient(0, 0, size, size);
    baseGrad.addColorStop(0, '#e5beaf');
    baseGrad.addColorStop(0.3, '#d8a99a');
    baseGrad.addColorStop(0.6, '#e0b5a6');
    baseGrad.addColorStop(0.85, '#cca091');
    baseGrad.addColorStop(1, '#dfb4a4');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, size, size);

    // Dermal micro-grain & pores
    ctx.fillStyle = 'rgba(120, 50, 45, 0.07)';
    for (let i = 0; i < 35000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = 'rgba(255, 230, 220, 0.08)';
    for (let i = 0; i < 20000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillRect(x, y, 2, 2);
    }

    // Mottled warm orange/salmon undertones
    for (let i = 0; i < 35; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const r = Math.random() * 120 + 40;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, Math.random() > 0.4 ? 'rgba(215, 110, 75, 0.28)' : 'rgba(180, 50, 45, 0.22)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // -------------------------------------------------------------
    // 2. PANEL 1: LEFT VERTICAL LIMB STRIP (X: 0..260, Y: 0..520)
    // Long scratches, veins, and crimson pustule colonies
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(4, 4, 256, 520);
    ctx.clip();

    // Darker flesh backing for panel 1
    ctx.fillStyle = 'rgba(195, 140, 130, 0.35)';
    ctx.fillRect(4, 4, 256, 520);

    // Fine vertical striation scratches
    ctx.strokeStyle = 'rgba(120, 35, 40, 0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 45; i++) {
      const sx = 10 + Math.random() * 240;
      const sy = 10 + Math.random() * 300;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 15, sy + Math.random() * 180 + 40);
      ctx.stroke();
    }

    // Clusters of dark red necrotic lesions & pustules
    this.drawPustuleCluster(ctx, 60, 120, 40, 22, 5, 12);
    this.drawPustuleCluster(ctx, 160, 140, 45, 24, 6, 13);
    this.drawPustuleCluster(ctx, 90, 320, 50, 30, 5, 14);
    this.drawPustuleCluster(ctx, 180, 390, 45, 25, 6, 12);
    this.drawPustuleCluster(ctx, 80, 460, 40, 18, 5, 11);
    ctx.restore();

    // Panel 1 divider
    ctx.strokeStyle = 'rgba(70, 25, 25, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 256, 520);

    // -------------------------------------------------------------
    // 3. PANEL 2: UPPER ARM/THIGH RECTANGLE (X: 264..512, Y: 4..380)
    // Structured grid-like colony of dark circular sores
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(264, 4, 248, 376);
    ctx.clip();
    ctx.fillStyle = 'rgba(210, 150, 140, 0.3)';
    ctx.fillRect(264, 4, 248, 376);

    // Clustered 30+ dark red pustules in top area
    this.drawPustuleCluster(ctx, 390, 120, 65, 36, 6, 14);
    this.drawPustuleCluster(ctx, 350, 250, 50, 22, 5, 13);
    this.drawPustuleCluster(ctx, 440, 260, 45, 18, 6, 12);
    ctx.restore();
    ctx.strokeStyle = 'rgba(70, 25, 25, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(264, 4, 248, 376);

    // -------------------------------------------------------------
    // 4. TOP-RIGHT TRIANGULAR NECK/THROAT FLAP (X: 570..860, Y: 10..470)
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(715, 12); // Sharp top apex
    ctx.lineTo(870, 360);
    ctx.lineTo(820, 460);
    ctx.lineTo(600, 450);
    ctx.lineTo(570, 350);
    ctx.closePath();
    ctx.fillStyle = 'rgba(215, 160, 150, 0.4)';
    ctx.fill();

    // Longitudinal tracheal cords
    ctx.strokeStyle = 'rgba(145, 35, 40, 0.55)';
    ctx.lineWidth = 2.5;
    for (let c = -4; c <= 4; c++) {
      ctx.beginPath();
      ctx.moveTo(715 + c * 2, 20);
      ctx.quadraticCurveTo(715 + c * 14, 240, 715 + c * 28, 440);
      ctx.stroke();
    }
    // Spots on neck flap base
    this.drawPustuleCluster(ctx, 720, 360, 70, 38, 5, 13);
    ctx.restore();

    // -------------------------------------------------------------
    // 5. TOP-RIGHT DECAYED TOOTH ENAMEL (X: 770..1010, Y: 10..370)
    // Polygonal yellowed tooth bone segments
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(780, 10);
    ctx.lineTo(1010, 10);
    ctx.lineTo(1010, 330);
    ctx.lineTo(880, 365);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#bfa772';
    ctx.fillRect(770, 10, 240, 360);

    // Faceted polygonal teeth chunks
    const toothCenters = [
      [825, 60, 32],
      [905, 50, 34],
      [980, 70, 30],
      [820, 140, 35],
      [895, 155, 36],
      [970, 160, 34],
      [835, 230, 30],
      [920, 240, 35],
      [980, 255, 30],
      [875, 310, 28],
    ];

    toothCenters.forEach(([tx, ty, tr]) => {
      const grad = ctx.createRadialGradient(tx - 6, ty - 6, 2, tx, ty, tr);
      grad.addColorStop(0, '#f2e4b8'); // Bright enamel
      grad.addColorStop(0.5, '#d6be7f'); // Decayed yellow
      grad.addColorStop(0.85, '#967b45'); // Stained root
      grad.addColorStop(1, '#4e3b1c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const rad = tr * (0.8 + Math.random() * 0.4);
        const px = tx + Math.cos(ang) * rad;
        const py = ty + Math.sin(ang) * rad;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3e2e17';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });
    ctx.restore();

    // -------------------------------------------------------------
    // 6. CENTER & RIGHT: VISCERAL STRIATED THORACIC RIBCAGE & PECTORALS
    // (X: 320..1010, Y: 330..720)
    // The iconic horizontal arched rib muscle fibers in deep crimson
    // -------------------------------------------------------------
    ctx.save();
    const chestPath = new Path2D();
    chestPath.moveTo(330, 360);
    chestPath.lineTo(580, 330);
    chestPath.lineTo(760, 480);
    chestPath.lineTo(1000, 360);
    chestPath.lineTo(1010, 680);
    chestPath.lineTo(780, 740);
    chestPath.lineTo(440, 720);
    chestPath.closePath();
    ctx.clip(chestPath);

    // Deep crimson tissue background for chest
    ctx.fillStyle = 'rgba(165, 35, 45, 0.42)';
    ctx.fill(chestPath);

    // Pectoral & Intercostal Rib Striations (10-12 arched muscle bands)
    for (let r = 0; r < 16; r++) {
      const cy = 350 + r * 22;
      const ribGrad = ctx.createLinearGradient(350, cy, 980, cy);
      ribGrad.addColorStop(0, '#851620');
      ribGrad.addColorStop(0.2, '#b22432');
      ribGrad.addColorStop(0.5, '#6a0e16');
      ribGrad.addColorStop(0.8, '#b22432');
      ribGrad.addColorStop(1, '#851620');

      ctx.strokeStyle = ribGrad;
      ctx.lineWidth = 9.5;
      ctx.lineCap = 'round';

      // Left rib arch
      ctx.beginPath();
      ctx.moveTo(370, cy + 15);
      ctx.quadraticCurveTo(560, cy - 8, 670, cy + 25);
      ctx.stroke();

      // Right rib arch
      ctx.beginPath();
      ctx.moveTo(680, cy + 25);
      ctx.quadraticCurveTo(800, cy - 8, 970, cy + 15);
      ctx.stroke();

      // Bright muscle fiber highlights
      ctx.strokeStyle = 'rgba(235, 100, 110, 0.6)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(380, cy + 12);
      ctx.quadraticCurveTo(560, cy - 10, 665, cy + 22);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(685, cy + 22);
      ctx.quadraticCurveTo(800, cy - 10, 960, cy + 12);
      ctx.stroke();
    }

    // Dense cluster of circular pustules on lower abdomen / belly (X: 620..770, Y: 360..480)
    this.drawPustuleCluster(ctx, 690, 420, 75, 45, 6, 16);
    ctx.restore();

    // -------------------------------------------------------------
    // 7. MID-LEFT OPEN JAW / MOUTH WOUND (X: 230..410, Y: 510..720)
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(320, 620, 85, 95, -0.3, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#42060b';
    ctx.fill();

    // Dark oral cavity hole
    ctx.fillStyle = '#180204';
    ctx.beginPath();
    ctx.ellipse(330, 610, 45, 55, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Clusters of pustules around the mouth flaps
    this.drawPustuleCluster(ctx, 280, 580, 45, 20, 5, 12);
    this.drawPustuleCluster(ctx, 350, 670, 50, 22, 6, 14);
    ctx.restore();

    // -------------------------------------------------------------
    // 8. BOTTOM-RIGHT HANDS & CLAW FINGERS (X: 660..990, Y: 720..990)
    // -------------------------------------------------------------
    ctx.save();
    // Hand 1 (Left hand in texture)
    this.drawClawHand(ctx, 745, 850, 0.95);
    // Hand 2 (Right hand in texture)
    this.drawClawHand(ctx, 910, 860, 1.05);
    ctx.restore();

    // -------------------------------------------------------------
    // 9. BOTTOM-CENTER SICKLY EYEBALL (X: 560..710, Y: 840..1000)
    // -------------------------------------------------------------
    ctx.save();
    const eyeX = 635;
    const eyeY = 920;
    const eyeR = 68;

    // Dark socket rim
    ctx.fillStyle = '#1c0808';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR + 8, 0, Math.PI * 2);
    ctx.fill();

    // Sclera with yellowed jaundice & bloodshot vessels
    const scleraGrad = ctx.createRadialGradient(eyeX, eyeY, 15, eyeX, eyeY, eyeR);
    scleraGrad.addColorStop(0, '#e5d79b');
    scleraGrad.addColorStop(0.65, '#c5a34e');
    scleraGrad.addColorStop(0.85, '#874f26');
    scleraGrad.addColorStop(1, '#44140e');
    ctx.fillStyle = scleraGrad;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Sickly Yellow-Amber Iris
    const irisR = 34;
    const irisGrad = ctx.createRadialGradient(eyeX, eyeY, 4, eyeX, eyeY, irisR);
    irisGrad.addColorStop(0, '#fde68a'); // Bright diseased amber
    irisGrad.addColorStop(0.4, '#eab308');
    irisGrad.addColorStop(0.8, '#a16207');
    irisGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Black Pupil
    ctx.fillStyle = '#050202';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(eyeX - 8, eyeY - 8, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // -------------------------------------------------------------
    // 10. BOTTOM-LEFT BARE ZOMBIE FOOT & HEEL (X: 20..310, Y: 680..990)
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(35, 760);
    ctx.quadraticCurveTo(110, 690, 260, 780);
    ctx.lineTo(290, 890);
    ctx.quadraticCurveTo(200, 980, 50, 970);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 145, 135, 0.45)';
    ctx.fill();

    // Bloodied sole & heel pads with cluster of dark sores
    this.drawPustuleCluster(ctx, 130, 860, 60, 32, 6, 14);
    this.drawPustuleCluster(ctx, 70, 910, 40, 18, 5, 12);
    ctx.restore();

    // Create Three.js canvas texture
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    this.cachedTexture = tex;
    return tex;
  }

  // Draw an organic cluster of dark red circular pustules with distinct cores and pale rims
  private static drawPustuleCluster(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    count: number,
    minSize: number,
    maxSize: number
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const r = minSize + Math.random() * (maxSize - minSize);

      // Outer darkened red halo
      const grad = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);
      grad.addColorStop(0, '#54080e'); // Coagulated dark red center
      grad.addColorStop(0.55, '#8c1622'); // Rich crimson body
      grad.addColorStop(0.85, '#b92837');
      grad.addColorStop(1, 'rgba(150, 35, 45, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner festering core
      ctx.fillStyle = '#380408';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Subtle off-center pus gleam
      if (Math.random() < 0.6) {
        ctx.fillStyle = 'rgba(240, 200, 190, 0.45)';
        ctx.beginPath();
        ctx.arc(px - r * 0.25, py - r * 0.25, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw claw hand representation with finger bones & crimson knuckle spots
  private static drawClawHand(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Palm base
    ctx.fillStyle = 'rgba(210, 150, 140, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 55, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5 Splayed claw fingers
    const fingers = [-35, -18, 0, 18, 35];
    fingers.forEach((fx, idx) => {
      ctx.strokeStyle = '#99222c';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx * 0.8, 10);
      ctx.lineTo(fx * 1.3, -75 - (idx === 2 ? 15 : 0));
      ctx.stroke();

      // Knuckle pustule spots along the finger
      for (let k = 0; k < 3; k++) {
        const ky = -15 - k * 22;
        const kx = fx * (0.8 + (k / 3) * 0.5);
        ctx.fillStyle = '#620b12';
        ctx.beginPath();
        ctx.arc(kx, ky, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark Talon / Claw tip
      ctx.fillStyle = '#22080a';
      ctx.beginPath();
      ctx.arc(fx * 1.3, -75 - (idx === 2 ? 15 : 0), 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  // Shared high-performance PBR Material using the Melty Zombie Diffuse texture
  public static getMaterial(roughness: number = 0.62, metalness: number = 0.05): THREE.MeshStandardMaterial {
    if (this.cachedMaterial) return this.cachedMaterial;

    const tex = this.getDiffuseTexture();
    this.cachedMaterial = new THREE.MeshStandardMaterial({
      map: tex,
      roughness,
      metalness,
      bumpScale: 0.04,
    });

    return this.cachedMaterial;
  }

  // Exposed visceral red flesh & gore material
  public static getGoreMaterial(): THREE.MeshStandardMaterial {
    if (this.cachedGoreMaterial) return this.cachedGoreMaterial;

    this.cachedGoreMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e0f18,
      roughness: 0.2,
      metalness: 0.12,
    });
    return this.cachedGoreMaterial;
  }

  // Sickly diseased amber-yellow glowing eyes
  public static getEyeMaterial(eyeGlowColor?: number): THREE.MeshStandardMaterial {
    const color = eyeGlowColor ?? 0xf59e0b;
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.1,
    });
  }
}
