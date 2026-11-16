import { randomRange, randomInt } from '../utils/helpers.js';

// Configuration details for each fruit type
export const FRUIT_TYPES = {
  WATERMELON: { name: 'Watermelon', radius: 48, juiceColor: '#e11d48', outerColor: '#14532d' },
  APPLE: { name: 'Apple', radius: 36, juiceColor: '#ef4444', outerColor: '#b91c1c' },
  ORANGE: { name: 'Orange', radius: 36, juiceColor: '#f97316', outerColor: '#ea580c' },
  KIWI: { name: 'Kiwi', radius: 30, juiceColor: '#84cc16', outerColor: '#78350f' },
  BANANA: { name: 'Banana', radius: 34, juiceColor: '#eab308', outerColor: '#ca8a04' },
  PINEAPPLE: { name: 'Pineapple', radius: 44, juiceColor: '#f59e0b', outerColor: '#d97706' },
  DRAGON_FRUIT: { name: 'Dragon Fruit', radius: 38, juiceColor: '#ec4899', outerColor: '#db2777' },
  STRAWBERRY: { name: 'Strawberry', radius: 28, juiceColor: '#f43f5e', outerColor: '#e11d48' },
  GRAPES: { name: 'Grapes', radius: 34, juiceColor: '#8b5cf6', outerColor: '#6d28d9' },
  MANGO: { name: 'Mango', radius: 38, juiceColor: '#f59e0b', outerColor: '#d97706' },
  FREEZE_BANANA: { name: 'Freeze Banana', radius: 34, juiceColor: '#38bdf8', outerColor: '#0284c7', isPowerUp: true, powerUpType: 'freeze' },
  FRENZY_PINEAPPLE: { name: 'Frenzy Pineapple', radius: 44, juiceColor: '#f97316', outerColor: '#ea580c', isPowerUp: true, powerUpType: 'frenzy' }
};

export class Fruit {
  constructor(canvasWidth, canvasHeight, forceType = null) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    const keys = Object.keys(FRUIT_TYPES).filter(k => !FRUIT_TYPES[k].isPowerUp);
    this.typeKey = forceType || keys[Math.floor(Math.random() * keys.length)];
    this.config = FRUIT_TYPES[this.typeKey];

    this.radius = this.config.radius;
    this.juiceColor = this.config.juiceColor;
    
    // Spawn position
    this.x = randomRange(this.radius + 80, canvasWidth - this.radius - 80);
    this.y = canvasHeight + this.radius + 15;

    // Launch trajectory physics
    const targetX = canvasWidth / 2 + randomRange(-140, 140);
    const gravity = 0.11;
    const peakY = randomRange(140, 300);
    const heightDifference = this.y - peakY;
    
    const launchVy = -Math.sqrt(2 * gravity * heightDifference);
    const timeToPeak = -launchVy / gravity;
    const launchVx = (targetX - this.x) / timeToPeak;

    this.vx = launchVx;
    this.vy = launchVy;
    this.gravity = gravity;

    this.angle = randomRange(0, Math.PI * 2);
    this.spin = randomRange(-0.035, 0.035);
    
    this.sliced = false;
    this.half1 = null;
    this.half2 = null;
    this.life = 1.0;
  }

  update(dt = 16.66) {
    const timeScale = dt / 16.66;
    if (!this.sliced) {
      this.x += this.vx * timeScale;
      this.y += this.vy * timeScale;
      this.vy += this.gravity * timeScale;
      this.angle += this.spin * timeScale;
    } else {
      if (this.half1 && this.half2) {
        this.half1.x += this.half1.vx * timeScale;
        this.half1.y += this.half1.vy * timeScale;
        this.half1.vy += this.gravity * timeScale;
        this.half1.angle += this.half1.spin * timeScale;

        this.half2.x += this.half2.vx * timeScale;
        this.half2.y += this.half2.vy * timeScale;
        this.half2.vy += this.gravity * timeScale;
        this.half2.angle += this.half2.spin * timeScale;

        this.life -= 0.022 * timeScale;
      }
    }
  }

  isOutOfBounds() {
    if (!this.sliced) {
      return this.y > this.canvasHeight + this.radius + 25 && this.vy > 0;
    } else {
      return this.life <= 0;
    }
  }

  slice(swordAngle, sliceOffset = 0) {
    if (this.sliced) return;

    this.sliced = true;
    this.cutAngleLocal = swordAngle - this.angle;
    this.cutOffset = sliceOffset;
    this.sliceAngle = swordAngle;

    const pushForce = 4.2;
    const dx = Math.cos(swordAngle + Math.PI / 2);
    const dy = Math.sin(swordAngle + Math.PI / 2);

    this.half1 = {
      x: this.x,
      y: this.y,
      vx: this.vx + dx * pushForce,
      vy: this.vy + dy * pushForce,
      angle: this.angle,
      spin: this.spin - 0.06
    };

    this.half2 = {
      x: this.x,
      y: this.y,
      vx: this.vx - dx * pushForce,
      vy: this.vy - dy * pushForce,
      angle: this.angle,
      spin: this.spin + 0.06
    };
  }

  draw(ctx) {
    if (!this.sliced) {
      this.drawIntact(ctx);
    } else {
      this.drawHalves(ctx);
    }
  }

  // Draw soft drop shadow for depth
  drawShadow(ctx, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.45, radius * 0.85, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.restore();
  }

  drawIntact(ctx) {
    this.drawShadow(ctx, this.x, this.y, this.radius);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.config.isPowerUp) {
      ctx.shadowBlur = 22;
      ctx.shadowColor = this.config.juiceColor;
    }

    this.drawWholeFruit(ctx, 0, 0, this.radius);
    this.drawSpecularGloss(ctx, 0, 0, this.radius);

    ctx.restore();
  }

  drawHalves(ctx) {
    if (!this.half1 || !this.half2) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);

    this.drawShadow(ctx, this.half1.x, this.half1.y, this.radius);
    this.drawShadow(ctx, this.half2.x, this.half2.y, this.radius);

    const r = this.radius;
    const cutAng = this.cutAngleLocal || 0;
    const offset = this.cutOffset || 0;

    // --- HALF 1 ---
    ctx.save();
    ctx.translate(this.half1.x, this.half1.y);
    ctx.rotate(this.half1.angle);

    if (this.config.isPowerUp) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.config.juiceColor;
    }

    // Clip outer shell along cut line
    ctx.save();
    ctx.rotate(cutAng);
    ctx.beginPath();
    ctx.rect(-r - 60, -r - 60, r * 2 + 120, r + 60 + offset);
    ctx.clip();
    ctx.rotate(-cutAng);
    this.drawWholeFruit(ctx, 0, 0, r);
    ctx.restore();

    // Draw exposed cut face on cut plane
    ctx.save();
    ctx.rotate(cutAng);
    this.drawCutFace(ctx, 0, offset, r, -1);
    ctx.restore();

    ctx.restore();

    // --- HALF 2 ---
    ctx.save();
    ctx.translate(this.half2.x, this.half2.y);
    ctx.rotate(this.half2.angle);

    if (this.config.isPowerUp) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.config.juiceColor;
    }

    // Clip outer shell along cut line
    ctx.save();
    ctx.rotate(cutAng);
    ctx.beginPath();
    ctx.rect(-r - 60, offset, r * 2 + 120, r + 60 - offset);
    ctx.clip();
    ctx.rotate(-cutAng);
    this.drawWholeFruit(ctx, 0, 0, r);
    ctx.restore();

    // Draw exposed cut face on cut plane
    ctx.save();
    ctx.rotate(cutAng);
    this.drawCutFace(ctx, 0, offset, r, 1);
    ctx.restore();

    ctx.restore();

    ctx.restore();
  }

  // ================= WHOLE 3D FRUIT MODELING =================

  drawWholeFruit(ctx, cx, cy, r) {
    ctx.save();

    switch (this.typeKey) {
      case 'WATERMELON':
        this.drawWholeWatermelon(ctx, cx, cy, r);
        break;
      case 'APPLE':
        this.drawWholeApple(ctx, cx, cy, r);
        break;
      case 'ORANGE':
        this.drawWholeOrange(ctx, cx, cy, r);
        break;
      case 'KIWI':
        this.drawWholeKiwi(ctx, cx, cy, r);
        break;
      case 'BANANA':
      case 'FREEZE_BANANA':
        this.drawWholeBanana(ctx, cx, cy, r, this.typeKey === 'FREEZE_BANANA');
        break;
      case 'PINEAPPLE':
      case 'FRENZY_PINEAPPLE':
        this.drawWholePineapple(ctx, cx, cy, r, this.typeKey === 'FRENZY_PINEAPPLE');
        break;
      case 'DRAGON_FRUIT':
        this.drawWholeDragonFruit(ctx, cx, cy, r);
        break;
      case 'STRAWBERRY':
        this.drawWholeStrawberry(ctx, cx, cy, r);
        break;
      case 'GRAPES':
        this.drawWholeGrapes(ctx, cx, cy, r);
        break;
      case 'MANGO':
        this.drawWholeMango(ctx, cx, cy, r);
        break;
    }

    ctx.restore();
  }

  drawWholeWatermelon(ctx, cx, cy, r) {
    // 3D Spherical melon with ambient lighting
    const melonGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    melonGrad.addColorStop(0, '#22c55e');
    melonGrad.addColorStop(0.5, '#16a34a');
    melonGrad.addColorStop(0.85, '#15803d');
    melonGrad.addColorStop(1, '#0f4f26');

    ctx.fillStyle = melonGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Ripe field spot (cream patch on ground side)
    const patchGrad = ctx.createRadialGradient(cx + r * 0.45, cy + r * 0.4, 2, cx + r * 0.45, cy + r * 0.4, r * 0.5);
    patchGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    patchGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.15)');
    patchGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = patchGrad;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.45, cy + r * 0.4, r * 0.4, r * 0.25, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Authentic jagged dark-green stripes
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const stripeAngles = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];
    stripeAngles.forEach(offsetRatio => {
      const xBase = cx + offsetRatio * r * 1.6;
      ctx.beginPath();
      for (let y = cy - r * 1.1; y <= cy + r * 1.1; y += 12) {
        const wave = Math.sin((y - cy) * 0.15) * 8 + Math.cos((y - cy) * 0.08) * 5;
        const xPos = xBase + wave * (1 - Math.abs(offsetRatio) * 0.3);
        if (y === cy - r * 1.1) ctx.moveTo(xPos, y);
        else ctx.lineTo(xPos, y);
      }
      ctx.stroke();
    });
    ctx.restore();

    // Stem pole button
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.95, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.95);
    ctx.quadraticCurveTo(cx + 6, cy - r * 1.1, cx + 10, cy - r * 1.05);
    ctx.stroke();
  }

  drawWholeApple(ctx, cx, cy, r) {
    // Realistic 3D Apple silhouette with top dimple & bottom lobes
    ctx.save();
    const appleGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r * 1.1);
    appleGrad.addColorStop(0, '#fef08a');
    appleGrad.addColorStop(0.2, '#f87171');
    appleGrad.addColorStop(0.65, '#dc2626');
    appleGrad.addColorStop(0.95, '#991b1b');
    appleGrad.addColorStop(1, '#450a0a');

    ctx.fillStyle = appleGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.72);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.05, cx + r * 1.08, cy - r * 0.45, cx + r * 0.95, cy + r * 0.15);
    ctx.bezierCurveTo(cx + r * 0.85, cy + r * 0.85, cx + r * 0.45, cy + r * 1.05, cx, cy + r * 0.92);
    ctx.bezierCurveTo(cx - r * 0.45, cy + r * 1.05, cx - r * 0.85, cy + r * 0.85, cx - r * 0.95, cy + r * 0.15);
    ctx.bezierCurveTo(cx - r * 1.08, cy - r * 0.45, cx - r * 0.5, cy - r * 1.05, cx, cy - r * 0.72);
    ctx.fill();

    // Natural skin lenticel speckles
    ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
    for (let i = 0; i < 28; i++) {
      const sa = (i * 1.7) % (Math.PI * 2);
      const sd = r * (0.25 + ((i * 13) % 65) / 100);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(sa) * sd * 0.85, cy + Math.sin(sa) * sd, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stem dimple shadow
    const dimpleGrad = ctx.createRadialGradient(cx, cy - r * 0.72, 1, cx, cy - r * 0.72, 8);
    dimpleGrad.addColorStop(0, 'rgba(30, 10, 5, 0.8)');
    dimpleGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = dimpleGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.72, 8, 0, Math.PI * 2);
    ctx.fill();

    // Curved wooden stem
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.72);
    ctx.quadraticCurveTo(cx + r * 0.22, cy - r * 1.05, cx + r * 0.18, cy - r * 1.25);
    ctx.stroke();

    // Fresh green leaf
    ctx.save();
    ctx.translate(cx + r * 0.12, cy - r * 1.1);
    ctx.rotate(-Math.PI / 5);
    const leafGrad = ctx.createLinearGradient(-10, 0, 16, 0);
    leafGrad.addColorStop(0, '#15803d');
    leafGrad.addColorStop(1, '#4ade80');
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(0, -9, 16, -2);
    ctx.quadraticCurveTo(6, 7, -10, 0);
    ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(0, -1, 16, -2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawWholeOrange(ctx, cx, cy, r) {
    // 3D textured orange sphere
    const orangeGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    orangeGrad.addColorStop(0, '#fbbf24');
    orangeGrad.addColorStop(0.35, '#f97316');
    orangeGrad.addColorStop(0.8, '#ea580c');
    orangeGrad.addColorStop(1, '#9a3412');

    ctx.fillStyle = orangeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Pebbled zest texture pores
    ctx.fillStyle = 'rgba(154, 52, 18, 0.25)';
    for (let i = 0; i < 45; i++) {
      const sa = (i * 2.39);
      const sd = r * (0.2 + ((i * 17) % 75) / 100);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(sa) * sd, cy + Math.sin(sa) * sd, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Green star stem button (calyx)
    ctx.fillStyle = '#15803d';
    ctx.save();
    ctx.translate(cx, cy - r * 0.88);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const x1 = Math.cos(a) * 4.5;
      const y1 = Math.sin(a) * 4.5;
      const x2 = Math.cos(a + Math.PI / 5) * 2;
      const y2 = Math.sin(a + Math.PI / 5) * 2;
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawWholeKiwi(ctx, cx, cy, r) {
    // Fuzzy brown oval fruit
    const kiwiGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.1);
    kiwiGrad.addColorStop(0, '#a16207');
    kiwiGrad.addColorStop(0.5, '#78350f');
    kiwiGrad.addColorStop(0.9, '#451a03');
    kiwiGrad.addColorStop(1, '#270e02');

    ctx.fillStyle = kiwiGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.9, r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fine fuzzy bristle hairs
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 35; i++) {
      const a = (i * Math.PI * 2) / 35;
      const x1 = cx + Math.cos(a) * (r * 0.88);
      const y1 = cy + Math.sin(a) * (r * 1.03);
      const x2 = cx + Math.cos(a) * (r * 0.94);
      const y2 = cy + Math.sin(a) * (r * 1.09);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Woody stem cap
    ctx.fillStyle = '#1c0a00';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.98, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWholeBanana(ctx, cx, cy, r, isFreeze = false) {
    ctx.save();
    ctx.translate(cx, cy);

    const baseColor = isFreeze ? '#38bdf8' : '#facc15';
    const shadowColor = isFreeze ? '#0284c7' : '#ca8a04';
    const highlightColor = isFreeze ? '#e0f2fe' : '#fef08a';

    // 1. Shadow Facet (Bottom)
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(-r * 0.22, 0, r * 1.05, -Math.PI / 2.3, Math.PI / 2.3, false);
    ctx.arc(-r * 0.08, 0, r * 0.96, Math.PI / 2.4, -Math.PI / 2.4, true);
    ctx.fill();

    // 2. Mid Facet (Center)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(-r * 0.12, 0, r * 0.98, -Math.PI / 2.35, Math.PI / 2.35, false);
    ctx.arc(r * 0.06, 0, r * 0.9, Math.PI / 2.5, -Math.PI / 2.5, true);
    ctx.fill();

    // 3. Highlight Facet (Top)
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, -Math.PI / 2.4, Math.PI / 2.4, false);
    ctx.arc(r * 0.16, 0, r * 0.84, Math.PI / 2.6, -Math.PI / 2.6, true);
    ctx.fill();

    // Stem and blossom tips
    ctx.fillStyle = isFreeze ? '#bae6fd' : '#15803d';
    ctx.beginPath();
    ctx.arc(r * 0.42, -r * 0.85, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isFreeze ? '#0369a1' : '#451a03';
    ctx.beginPath();
    ctx.arc(r * 0.42, r * 0.85, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawWholePineapple(ctx, cx, cy, r, isFrenzy = false) {
    // 1. Spiky crown leaves
    ctx.save();
    ctx.translate(cx, cy);

    const leafPrimary = isFrenzy ? '#ea580c' : '#15803d';
    const leafSecondary = isFrenzy ? '#f59e0b' : '#22c55e';

    ctx.fillStyle = leafSecondary;
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.95, r * 0.18, r * 0.55, -Math.PI / 6, 0, Math.PI * 2);
    ctx.ellipse(r * 0.35, -r * 0.95, r * 0.18, r * 0.55, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = leafPrimary;
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.15, r * 0.18, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Pineapple Body (Textured scales)
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.1, cx, cy, r * 1.1);
    bodyGrad.addColorStop(0, isFrenzy ? '#fde047' : '#fbbf24');
    bodyGrad.addColorStop(0.55, isFrenzy ? '#ea580c' : '#d97706');
    bodyGrad.addColorStop(1, isFrenzy ? '#9a3412' : '#78350f');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.8, r * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Diamond fruitlet scales
    ctx.strokeStyle = isFrenzy ? '#9a3412' : '#92400e';
    ctx.lineWidth = 2.2;

    const rows = 6;
    const cols = 5;
    for (let row = 0; row < rows; row++) {
      const y = cy - r * 0.7 + (row / (rows - 1)) * r * 1.4;
      const wRow = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / (r * 1.0), 2))) * r * 0.8;

      for (let col = 0; col < cols; col++) {
        const x = cx - wRow + (col / (cols - 1)) * wRow * 2;
        ctx.save();
        ctx.translate(x, y);

        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = isFrenzy ? '#f97316' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  drawWholeDragonFruit(ctx, cx, cy, r) {
    // Fuchsia skin base
    const skinGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    skinGrad.addColorStop(0, '#f472b6');
    skinGrad.addColorStop(0.6, '#db2777');
    skinGrad.addColorStop(1, '#831843');

    ctx.fillStyle = skinGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Curving flame scales
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#9d174d';
    ctx.lineWidth = 1.5;

    const scalesCount = 10;
    for (let i = 0; i < scalesCount; i++) {
      const a = (i * Math.PI * 2) / scalesCount;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);

      ctx.beginPath();
      ctx.moveTo(r - 4, -7);
      ctx.quadraticCurveTo(r + 14, 0, r - 4, 7);
      ctx.quadraticCurveTo(r + 4, 0, r - 4, -7);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  drawWholeStrawberry(ctx, cx, cy, r) {
    // 3D Conical ruby berry
    const berryGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r * 1.1);
    berryGrad.addColorStop(0, '#fb7185');
    berryGrad.addColorStop(0.5, '#e11d48');
    berryGrad.addColorStop(0.9, '#9f1239');
    berryGrad.addColorStop(1, '#4c0519');

    ctx.fillStyle = berryGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.bezierCurveTo(cx + r * 0.85, cy - r * 0.95, cx + r * 1.1, cy + r * 0.1, cx + r * 0.5, cy + r * 0.88);
    ctx.bezierCurveTo(cx + r * 0.2, cy + r * 1.05, cx - r * 0.2, cy + r * 1.05, cx - r * 0.5, cy + r * 0.88);
    ctx.bezierCurveTo(cx - r * 1.1, cy + r * 0.1, cx - r * 0.85, cy - r * 0.95, cx, cy - r * 0.75);
    ctx.fill();

    // Recessed yellow seed achenes
    for (let row = 1; row <= 5; row++) {
      const y = cy - r * 0.55 + (row / 5.5) * r * 1.4;
      const w = Math.sin((row / 5.5) * Math.PI) * r * 0.72;
      const count = row + 1;
      for (let i = 0; i < count; i++) {
        const x = cx - w + (i / (count - 1)) * w * 2;
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.ellipse(x + 0.6, y + 0.6, 1.8, 1.0, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(x, y, 1.4, 0.8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Green crown leaves (calyx)
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.lineTo(cx - r * 0.45, cy - r * 1.0);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.7);
    ctx.lineTo(cx, cy - r * 1.05);
    ctx.lineTo(cx + r * 0.2, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.45, cy - r * 1.0);
    ctx.closePath();
    ctx.fill();
  }

  drawWholeGrapes(ctx, cx, cy, r) {
    // Vine stem
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.4);
    ctx.quadraticCurveTo(cx - 8, cy - r * 0.9, cx + 4, cy - r * 1.15);
    ctx.stroke();

    // Grape vine leaf
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.85, r * 0.25, r * 0.12, -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();

    // 3D Spherical grape cluster with individual specular beads
    const grapes = [
      { dx: 0, dy: -r * 0.4, sz: 14 },
      { dx: -r * 0.35, dy: -r * 0.2, sz: 13 }, { dx: r * 0.35, dy: -r * 0.2, sz: 13 },
      { dx: -r * 0.4, dy: r * 0.15, sz: 14 }, { dx: 0, dy: r * 0.1, sz: 15 }, { dx: r * 0.4, dy: r * 0.15, sz: 14 },
      { dx: -r * 0.22, dy: r * 0.45, sz: 13.5 }, { dx: r * 0.22, dy: r * 0.45, sz: 13.5 },
      { dx: 0, dy: r * 0.72, sz: 13 }
    ];

    grapes.forEach(({ dx, dy, sz }) => {
      const gGrad = ctx.createRadialGradient(cx + dx - 3, cy + dy - 3, 1, cx + dx, cy + dy, sz);
      gGrad.addColorStop(0, '#c084fc');
      gGrad.addColorStop(0.5, '#7e22ce');
      gGrad.addColorStop(1, '#3b0764');

      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, sz, 0, Math.PI * 2);
      ctx.fill();

      // Specular pearl
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(cx + dx - sz * 0.32, cy + dy - sz * 0.32, sz * 0.22, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawWholeMango(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);

    // Sinuous kidney-shaped tropical mango
    const mangoGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 4, 0, 0, r * 1.1);
    mangoGrad.addColorStop(0, '#fef08a');
    mangoGrad.addColorStop(0.4, '#fb923c');
    mangoGrad.addColorStop(0.75, '#ef4444');
    mangoGrad.addColorStop(1, '#991b1b');

    ctx.fillStyle = mangoGrad;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.bezierCurveTo(r * 0.72, -r * 0.98, r * 1.15, -r * 0.15, r * 0.85, r * 0.48);
    ctx.bezierCurveTo(r * 0.62, r * 0.98, -r * 0.22, r * 0.94, -r * 0.62, r * 0.52);
    ctx.bezierCurveTo(-r * 0.98, r * 0.12, -r * 0.72, -r * 0.42, 0, -r * 0.75);
    ctx.closePath();
    ctx.fill();

    // Stem and leaf
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.quadraticCurveTo(-r * 0.1, -r * 0.95, -r * 0.08, -r * 1.05);
    ctx.stroke();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.85, r * 0.25, r * 0.1, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ================= EXPOSED CUT FACE (CROSS SECTION) =================

  drawCutFace(ctx, cx, cy, r, sideMultiplier) {
    const halfWidth = r;
    const faceHeight = r * 0.35;

    ctx.save();
    ctx.translate(cx, cy);

    // Cut face ellipse geometry along the cut seam
    ctx.beginPath();
    ctx.ellipse(0, 0, halfWidth, faceHeight, 0, 0, Math.PI * 2);

    switch (this.typeKey) {
      case 'WATERMELON': {
        // 1. Dark rind ring
        ctx.fillStyle = '#14532d';
        ctx.fill();

        // 2. Pale green/white pith
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.92, faceHeight * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ecfccb';
        ctx.fill();

        // 3. Succulent ruby-crimson flesh
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.84, faceHeight * 0.82, 0, 0, Math.PI * 2);
        const fleshGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, halfWidth * 0.84);
        fleshGrad.addColorStop(0, '#f43f5e');
        fleshGrad.addColorStop(0.7, '#e11d48');
        fleshGrad.addColorStop(1, '#be123c');
        ctx.fillStyle = fleshGrad;
        ctx.fill();

        // 4. Black teardrop seeds with specular glint
        const seeds = [-0.65, -0.35, 0, 0.35, 0.65];
        seeds.forEach(pos => {
          const sx = pos * halfWidth * 0.7;
          const sy = (Math.random() - 0.5) * faceHeight * 0.45;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3.2, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx - 0.8, sy - 0.6, 0.7, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'APPLE': {
        // Red peel edge
        ctx.fillStyle = '#b91c1c';
        ctx.fill();

        // Crisp ivory white flesh
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.94, faceHeight * 0.9, 0, 0, Math.PI * 2);
        const appleFlesh = ctx.createRadialGradient(0, 0, 2, 0, 0, halfWidth * 0.9);
        appleFlesh.addColorStop(0, '#fefce8');
        appleFlesh.addColorStop(0.8, '#fef9c3');
        appleFlesh.addColorStop(1, '#fef08a');
        ctx.fillStyle = appleFlesh;
        ctx.fill();

        // Star core capsule and brown seeds
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(-2.5, 0, 2, 1, Math.PI / 4, 0, Math.PI * 2);
        ctx.ellipse(2.5, 0, 2, 1, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'ORANGE': {
        // Orange rind
        ctx.fillStyle = '#ea580c';
        ctx.fill();

        // White pith
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.93, faceHeight * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fffbeb';
        ctx.fill();

        // Citrus pulp base
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.85, faceHeight * 0.82, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.fill();

        // Radiating pulp wedges
        ctx.strokeStyle = '#fffbeb';
        ctx.lineWidth = 1.5;
        const wedges = 8;
        for (let i = 0; i < wedges; i++) {
          const a = (i * Math.PI * 2) / wedges;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * halfWidth * 0.85, Math.sin(a) * faceHeight * 0.82);
          ctx.stroke();
        }

        // Center core
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'KIWI': {
        // Fuzzy brown skin
        ctx.fillStyle = '#78350f';
        ctx.fill();

        // Vibrant emerald green flesh
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.92, faceHeight * 0.9, 0, 0, Math.PI * 2);
        const kiwiFlesh = ctx.createRadialGradient(0, 0, 2, 0, 0, halfWidth * 0.85);
        kiwiFlesh.addColorStop(0, '#bef264');
        kiwiFlesh.addColorStop(0.5, '#84cc16');
        kiwiFlesh.addColorStop(1, '#4d7c0f');
        ctx.fillStyle = kiwiFlesh;
        ctx.fill();

        // Creamy central core
        ctx.fillStyle = '#f7fee7';
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.28, faceHeight * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Radiating rays and tiny black seeds
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.fillStyle = '#020617';
        for (let i = 0; i < 14; i++) {
          const a = (i * Math.PI * 2) / 14;
          const x1 = Math.cos(a) * halfWidth * 0.28;
          const y1 = Math.sin(a) * faceHeight * 0.28;
          const x2 = Math.cos(a) * halfWidth * 0.68;
          const y2 = Math.sin(a) * faceHeight * 0.68;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Seed
          ctx.beginPath();
          ctx.arc(x1 + (x2 - x1) * 0.6, y1 + (y2 - y1) * 0.6, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'BANANA':
      case 'FREEZE_BANANA': {
        const isFreeze = this.typeKey === 'FREEZE_BANANA';
        ctx.fillStyle = isFreeze ? '#0284c7' : '#ca8a04';
        ctx.fill();

        // Creamy banana flesh
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.88, faceHeight * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = isFreeze ? '#e0f2fe' : '#fef9c3';
        ctx.fill();

        // 3-part natural suture star
        ctx.fillStyle = isFreeze ? '#38bdf8' : '#a16207';
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 3, Math.sin(a) * 2, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'PINEAPPLE':
      case 'FRENZY_PINEAPPLE': {
        const isFrenzy = this.typeKey === 'FRENZY_PINEAPPLE';
        ctx.fillStyle = isFrenzy ? '#9a3412' : '#92400e';
        ctx.fill();

        // Golden pineapple rings
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.9, faceHeight * 0.88, 0, 0, Math.PI * 2);
        ctx.fillStyle = isFrenzy ? '#ea580c' : '#fbbf24';
        ctx.fill();

        // Pale core
        ctx.fillStyle = isFrenzy ? '#fde047' : '#fef08a';
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.28, faceHeight * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'DRAGON_FRUIT': {
        // Fuchsia rim
        ctx.fillStyle = '#db2777';
        ctx.fill();

        // Snow-white flesh
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.88, faceHeight * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Tiny black seeds peppered across face
        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < 22; i++) {
          const a = (i * 2.39);
          const d = Math.sqrt((i + 1) / 22);
          const sx = Math.cos(a) * halfWidth * 0.72 * d;
          const sy = Math.sin(a) * faceHeight * 0.68 * d;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'STRAWBERRY': {
        // Ruby outer rim
        ctx.fillStyle = '#e11d48';
        ctx.fill();

        // Pinkish-white feathered interior
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.88, faceHeight * 0.85, 0, 0, Math.PI * 2);
        const strawGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, halfWidth * 0.85);
        strawGrad.addColorStop(0, '#ffe4e6');
        strawGrad.addColorStop(0.6, '#fda4af');
        strawGrad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = strawGrad;
        ctx.fill();
        break;
      }

      case 'MANGO': {
        // Skin rim
        ctx.fillStyle = '#d97706';
        ctx.fill();

        // Saffron golden pulp
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.9, faceHeight * 0.88, 0, 0, Math.PI * 2);
        const mangoFlesh = ctx.createRadialGradient(0, 0, 2, 0, 0, halfWidth * 0.9);
        mangoFlesh.addColorStop(0, '#fef08a');
        mangoFlesh.addColorStop(0.5, '#f59e0b');
        mangoFlesh.addColorStop(1, '#d97706');
        ctx.fillStyle = mangoFlesh;
        ctx.fill();

        // Pale flat seed line
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.35, 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'GRAPES': {
        ctx.fillStyle = '#7e22ce';
        ctx.fill();

        // Translucent gelatinous interior
        ctx.beginPath();
        ctx.ellipse(0, 0, halfWidth * 0.88, faceHeight * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  // Draw crisp specular gloss curve
  drawSpecularGloss(ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.stroke();

    // Specular spot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
