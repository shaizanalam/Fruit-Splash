import { randomRange, randomInt } from '../utils/helpers.js';

// Configuration details for each fruit type
export const FRUIT_TYPES = {
  WATERMELON: { name: 'Watermelon', radius: 46, juiceColor: '#ff0044', outerColor: '#1d5a16' },
  APPLE: { name: 'Apple', radius: 34, juiceColor: '#ff2200', outerColor: '#ff1133' },
  ORANGE: { name: 'Orange', radius: 34, juiceColor: '#ffaa00', outerColor: '#ffa500' },
  KIWI: { name: 'Kiwi', radius: 28, juiceColor: '#7cfc00', outerColor: '#604020' },
  BANANA: { name: 'Banana', radius: 32, juiceColor: '#ffea00', outerColor: '#ffd700' },
  PINEAPPLE: { name: 'Pineapple', radius: 42, juiceColor: '#ffd700', outerColor: '#cc9900' },
  DRAGON_FRUIT: { name: 'Dragon Fruit', radius: 36, juiceColor: '#ff007f', outerColor: '#ff0055' },
  STRAWBERRY: { name: 'Strawberry', radius: 26, juiceColor: '#ff0033', outerColor: '#d6002a' },
  GRAPES: { name: 'Grapes', radius: 32, juiceColor: '#9932cc', outerColor: '#6f00ff' },
  MANGO: { name: 'Mango', radius: 36, juiceColor: '#ff9900', outerColor: '#ff8800' },
  FREEZE_BANANA: { name: 'Freeze Banana', radius: 32, juiceColor: '#00f0ff', outerColor: '#00f0ff', isPowerUp: true, powerUpType: 'freeze' },
  FRENZY_PINEAPPLE: { name: 'Frenzy Pineapple', radius: 42, juiceColor: '#ffaa00', outerColor: '#ffd700', isPowerUp: true, powerUpType: 'frenzy' }
};

export class Fruit {
  constructor(canvasWidth, canvasHeight, forceType = null) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Pick type
    // Filter out power-up types for standard random spawning
    const keys = Object.keys(FRUIT_TYPES).filter(k => !FRUIT_TYPES[k].isPowerUp);
    this.typeKey = forceType || keys[Math.floor(Math.random() * keys.length)];
    this.config = FRUIT_TYPES[this.typeKey];

    this.radius = this.config.radius;
    this.juiceColor = this.config.juiceColor;
    
    // Spawn at bottom of screen with random horizontal position
    this.x = randomRange(this.radius + 100, canvasWidth - this.radius - 100);
    this.y = canvasHeight + this.radius + 10;

    // Trajectory physics
    // Launch angle upwards towards center
    const targetX = canvasWidth / 2 + randomRange(-150, 150);
    const gravity = 0.11; // match game loop gravity
    
    // We want the fruit to reach its peak near the top-middle (e.g. y = 150..300)
    const peakY = randomRange(140, 300);
    const heightDifference = this.y - peakY;
    
    // Calculate initial vertical velocity needed to reach peakY
    // vf^2 = vi^2 + 2*g*d => vi = sqrt(2 * g * d)
    const launchVy = -Math.sqrt(2 * gravity * heightDifference);
    
    // Calculate time to reach peak
    const timeToPeak = -launchVy / gravity;
    
    // Calculate horizontal velocity to reach targetX at peak time
    const launchVx = (targetX - this.x) / timeToPeak;

    this.vx = launchVx;
    this.vy = launchVy;

    this.angle = randomRange(0, Math.PI * 2);
    this.spin = randomRange(-0.04, 0.04);
    
    this.gravity = gravity;
    this.sliced = false;

    // Sliced halves variables
    this.sliceAngle = 0;
    this.half1 = null;
    this.half2 = null;
    this.life = 1.0; // opacity of sliced halves decay
  }

  update(dt = 16.66) {
    const timeScale = dt / 16.66;
    if (!this.sliced) {
      // Normal physics
      this.x += this.vx * timeScale;
      this.y += this.vy * timeScale;
      this.vy += this.gravity * timeScale;
      this.angle += this.spin * timeScale;
    } else {
      // Update sliced halves separately
      if (this.half1 && this.half2) {
        this.half1.x += this.half1.vx * timeScale;
        this.half1.y += this.half1.vy * timeScale;
        this.half1.vy += this.gravity * timeScale;
        this.half1.angle += this.half1.spin * timeScale;

        this.half2.x += this.half2.vx * timeScale;
        this.half2.y += this.half2.vy * timeScale;
        this.half2.vy += this.gravity * timeScale;
        this.half2.angle += this.half2.spin * timeScale;

        // Fade out halves
        this.life -= 0.02 * timeScale;
      }
    }
  }

  isOutOfBounds() {
    if (!this.sliced) {
      // Intact fruit falls below screen
      return this.y > this.canvasHeight + this.radius + 20 && this.vy > 0;
    } else {
      // Sliced fruit disappears when faded
      return this.life <= 0;
    }
  }

  slice(swordAngle, sliceOffset = 0) {
    if (this.sliced) return;

    this.sliced = true;
    
    // Store slice geometry for rendering precise cut line
    this.cutAngleLocal = swordAngle - this.angle;
    this.cutOffset = sliceOffset;
    this.sliceAngle = swordAngle;

    const pushForce = 3.5;
    // Direction perpendicular to slice angle
    const dx = Math.cos(swordAngle + Math.PI / 2);
    const dy = Math.sin(swordAngle + Math.PI / 2);

    // Create 2 independent halves flying apart
    this.half1 = {
      x: this.x,
      y: this.y,
      vx: this.vx + dx * pushForce,
      vy: this.vy + dy * pushForce,
      vyGravity: this.gravity,
      angle: this.angle,
      spin: this.spin - 0.05
    };

    this.half2 = {
      x: this.x,
      y: this.y,
      vx: this.vx - dx * pushForce,
      vy: this.vy - dy * pushForce,
      vyGravity: this.gravity,
      angle: this.angle,
      spin: this.spin + 0.05
    };
  }

  draw(ctx) {
    if (!this.sliced) {
      this.drawIntact(ctx);
    } else {
      this.drawHalves(ctx);
    }
  }

  // Draw shadow first for 3D depth
  drawShadow(ctx, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + 15, radius * 0.9, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.restore();
  }

  drawIntact(ctx) {
    this.drawShadow(ctx, this.x, this.y, this.radius);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Apply glowing aura outline for power-up fruits
    if (this.config.isPowerUp) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = this.config.juiceColor;
    }

    this.drawProceduralFruit(ctx, 0, 0, this.radius);
    this.drawGlossHighlight(ctx, 0, 0, this.radius);

    ctx.restore();
  }

  drawHalves(ctx) {
    if (!this.half1 || !this.half2) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);

    // Halves Shadow
    this.drawShadow(ctx, this.half1.x, this.half1.y, this.radius);
    this.drawShadow(ctx, this.half2.x, this.half2.y, this.radius);

    // Draw Half 1
    ctx.save();
    ctx.translate(this.half1.x, this.half1.y);
    ctx.rotate(this.half1.angle);
    
    // Apply glowing outline for power-up halves
    if (this.config.isPowerUp) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.config.juiceColor;
    }
    
    // Apply local cut angle and offset for clip
    ctx.rotate(this.cutAngleLocal || 0);
    ctx.beginPath();
    ctx.rect(-this.radius - 50, -this.radius - 50, this.radius * 2 + 100, this.radius + 50 + (this.cutOffset || 0));
    ctx.clip();
    ctx.rotate(-(this.cutAngleLocal || 0));
    
    this.drawProceduralFruit(ctx, 0, 0, this.radius);
    this.drawGlossHighlight(ctx, 0, 0, this.radius);
    ctx.restore();

    // Draw Half 2
    ctx.save();
    ctx.translate(this.half2.x, this.half2.y);
    ctx.rotate(this.half2.angle);
    
    // Apply glowing outline for power-up halves
    if (this.config.isPowerUp) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.config.juiceColor;
    }
    
    // Apply local cut angle and offset for clip
    ctx.rotate(this.cutAngleLocal || 0);
    ctx.beginPath();
    ctx.rect(-this.radius - 50, (this.cutOffset || 0), this.radius * 2 + 100, this.radius + 50 - (this.cutOffset || 0));
    ctx.clip();
    ctx.rotate(-(this.cutAngleLocal || 0));
    
    this.drawProceduralFruit(ctx, 0, 0, this.radius);
    this.drawGlossHighlight(ctx, 0, 0, this.radius);
    ctx.restore();

    ctx.restore();
  }

  // Draw actual vector graphics based on fruit type
  drawProceduralFruit(ctx, cx, cy, r) {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.config.juiceColor + '77';

    switch (this.typeKey) {
      case 'WATERMELON':
        // Outer Rind (Dark Green)
        ctx.fillStyle = '#113c0f';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Wavy Rind Stripes
        ctx.strokeStyle = '#276922';
        ctx.lineWidth = 4;
        for (let i = -3; i <= 3; i++) {
          if (i === 0) continue;
          ctx.beginPath();
          const yOffset = i * r * 0.25;
          ctx.moveTo(cx - r * 0.9, cy + yOffset);
          ctx.quadraticCurveTo(cx, cy + yOffset + (i > 0 ? 15 : -15), cx + r * 0.9, cy + yOffset);
          ctx.stroke();
        }

        // Inner flesh (White-Green transition rind)
        ctx.fillStyle = '#f2ffe3';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
        ctx.fill();

        // Inner flesh (Red)
        const watermelonGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.82);
        watermelonGrad.addColorStop(0, '#ff1a53');
        watermelonGrad.addColorStop(0.85, '#ff003c');
        watermelonGrad.addColorStop(1, '#e00030');
        ctx.fillStyle = watermelonGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
        ctx.fill();

        // Shiny Seeds (Teardrop shape with highlights)
        const seedAngles = [0.2, 0.7, 1.2, 1.7, 2.2, 2.7, 3.2, 3.7, 4.2, 4.7, 5.2, 5.7];
        seedAngles.forEach(a => {
          const sx = cx + Math.cos(a) * (r * 0.52);
          const sy = cy + Math.sin(a) * (r * 0.52);
          
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(a + Math.PI/2);
          
          // Seed Body (Dark Brown/Black)
          ctx.fillStyle = '#221915';
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.quadraticCurveTo(2.5, 2, 0, 4);
          ctx.quadraticCurveTo(-2.5, 2, 0, -4);
          ctx.fill();
          
          // Seed Highlight (White glare)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-0.8, -1, 0.8, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        });
        break;

      case 'APPLE':
        // Shaded Indentation (Top shadow)
        const appleGrad = ctx.createRadialGradient(cx - r*0.15, cy - r*0.3, 2, cx, cy, r);
        appleGrad.addColorStop(0, '#ffe875'); // yellow center
        appleGrad.addColorStop(0.3, '#ff4d6d'); // pinkish transition
        appleGrad.addColorStop(0.75, '#e60029'); // rich red
        appleGrad.addColorStop(1, '#9b001a'); // dark red rim
        
        ctx.fillStyle = appleGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.8);
        ctx.bezierCurveTo(cx + r * 0.45, cy - r * 1.1, cx + r * 1.1, cy - r * 0.5, cx + r * 1.0, cy);
        ctx.bezierCurveTo(cx + r * 0.9, cy + r * 0.75, cx + r * 0.45, cy + r * 1.05, cx, cy + r * 0.92);
        ctx.bezierCurveTo(cx - r * 0.45, cy + r * 1.05, cx - r * 0.9, cy + r * 0.75, cx - r * 1.0, cy);
        ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.5, cx - r * 0.45, cy - r * 1.1, cx, cy - r * 0.8);
        ctx.fill();

        // Skin Speckles
        ctx.fillStyle = 'rgba(255, 235, 150, 0.4)';
        for (let i = 0; i < 20; i++) {
          const sa = Math.random() * Math.PI * 2;
          const sd = r * (0.3 + Math.random() * 0.6);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(sa) * sd, cy + Math.sin(sa) * sd, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Stem (Brown curved)
        ctx.strokeStyle = '#5a3d28';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.78);
        ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 1.1, cx + r * 0.18, cy - r * 1.3);
        ctx.stroke();

        // Leaf with veins
        ctx.save();
        ctx.translate(cx + r*0.12, cy - r*1.15);
        ctx.rotate(-Math.PI/6);
        
        // Leaf body
        const leafGrad = ctx.createLinearGradient(-10, 0, 15, 0);
        leafGrad.addColorStop(0, '#2e7d32');
        leafGrad.addColorStop(1, '#81c784');
        ctx.fillStyle = leafGrad;
        
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(0, -8, 15, -2);
        ctx.quadraticCurveTo(5, 6, -10, 0);
        ctx.fill();
        
        // Leaf vein
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(0, -1, 15, -2);
        ctx.stroke();
        
        ctx.restore();
        break;

      case 'ORANGE':
        // Rind
        ctx.fillStyle = '#cc5200';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner white skin (Pith)
        ctx.fillStyle = '#fff9ee';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
        ctx.fill();

        // Orange pulp base
        ctx.fillStyle = '#f37a12';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
        ctx.fill();

        // Realistic Wedge Segments
        const orangeWedges = 8;
        ctx.fillStyle = '#ff9900';
        ctx.strokeStyle = '#fff9ee';
        ctx.lineWidth = 2.5;
        
        for (let i = 0; i < orangeWedges; i++) {
          const aStart = (i * Math.PI * 2) / orangeWedges + 0.05;
          const aEnd = ((i + 1) * Math.PI * 2) / orangeWedges - 0.05;
          
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r * 0.84, aStart, aEnd);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Pulp Texture (inside each wedge)
          ctx.fillStyle = '#ffaa33';
          const aMid = (aStart + aEnd) / 2;
          for (let d = 0.3; d < 0.8; d += 0.18) {
            const px = cx + Math.cos(aMid + (Math.random() - 0.5) * 0.1) * r * d;
            const py = cy + Math.sin(aMid + (Math.random() - 0.5) * 0.1) * r * d;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI*2);
            ctx.fill();
          }
        }

        // Orange center core
        ctx.fillStyle = '#fff9ee';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'KIWI':
        // Brown Skin with dash fuzzy texture
        ctx.fillStyle = '#5c4021';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Fuzzy dashes
        ctx.strokeStyle = '#3e2713';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Kiwi outer green ring
        const kiwiGrad = ctx.createRadialGradient(cx, cy, r*0.3, cx, cy, r*0.9);
        kiwiGrad.addColorStop(0, '#c5e1a5');
        kiwiGrad.addColorStop(0.5, '#8bc34a');
        kiwiGrad.addColorStop(1, '#558b2f');
        ctx.fillStyle = kiwiGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.fill();

        // Inner core (soft yellow-green)
        ctx.fillStyle = '#f1f8e9';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
        ctx.fill();

        // Radiating rays
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        const kiwiRays = 18;
        for (let i = 0; i < kiwiRays; i++) {
          const a = (i * Math.PI * 2) / kiwiRays;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (r * 0.34), cy + Math.sin(a) * (r * 0.34));
          // Wavy lines
          ctx.quadraticCurveTo(
            cx + Math.cos(a + 0.1) * (r * 0.55), cy + Math.sin(a + 0.1) * (r * 0.55),
            cx + Math.cos(a) * (r * 0.76), cy + Math.sin(a) * (r * 0.76)
          );
          ctx.stroke();

          // Black seeds clustered around core
          ctx.fillStyle = '#1a1a1a';
          const seedAngle = a + Math.PI / kiwiRays;
          const sx = cx + Math.cos(seedAngle) * (r * 0.44 + Math.random() * r * 0.08);
          const sy = cy + Math.sin(seedAngle) * (r * 0.44 + Math.random() * r * 0.08);
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'BANANA':
      case 'FREEZE_BANANA':
        const isFreeze = this.typeKey === 'FREEZE_BANANA';
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // 3D Faceted banana drawing using paths
        const baseColor = isFreeze ? '#00f0ff' : '#ffe033';
        const shadowColor = isFreeze ? '#008ba3' : '#e6c300';
        const highlightColor = isFreeze ? '#e0ffff' : '#fffa65';

        // 1. Shadow Facet (Bottom layer)
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.arc(-r * 0.2, 0, r, -Math.PI / 2.3, Math.PI / 2.3, false);
        ctx.arc(-r * 0.08, 0, r * 0.94, Math.PI / 2.4, -Math.PI / 2.4, true);
        ctx.fill();

        // 2. Mid Facet (Base layer)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(-r * 0.12, 0, r * 0.96, -Math.PI / 2.35, Math.PI / 2.35, false);
        ctx.arc(r * 0.05, 0, r * 0.88, Math.PI / 2.5, -Math.PI / 2.5, true);
        ctx.fill();

        // 3. Highlight Facet (Top layer)
        ctx.fillStyle = highlightColor;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, -Math.PI / 2.4, Math.PI / 2.4, false);
        ctx.arc(r * 0.15, 0, r * 0.82, Math.PI / 2.6, -Math.PI / 2.6, true);
        ctx.fill();

        // Tips (Brown-green or cyan-white)
        ctx.fillStyle = isFreeze ? '#ffffff' : '#5c4033';
        ctx.beginPath();
        ctx.arc(r * 0.45, -r * 0.8, 4.5, 0, Math.PI * 2);
        ctx.arc(r * 0.45, r * 0.8, 4.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Green stem end
        ctx.fillStyle = isFreeze ? '#00e5ff' : '#9e9d24';
        ctx.beginPath();
        ctx.arc(r * 0.4, -r * 0.83, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;

      case 'PINEAPPLE':
      case 'FRENZY_PINEAPPLE':
        const isFrenzy = this.typeKey === 'FRENZY_PINEAPPLE';
        
        // 1. Draw Leaves first so they sit behind the body
        ctx.save();
        ctx.translate(cx, cy);
        
        const leafColorPrimary = isFrenzy ? '#ff3300' : '#2e7d32';
        const leafColorSecondary = isFrenzy ? '#ffaa00' : '#4caf50';

        // Layered leaves
        ctx.fillStyle = leafColorSecondary;
        // Outer leaf wings
        ctx.beginPath();
        ctx.ellipse(-r*0.3, -r*0.9, r*0.2, r*0.5, -Math.PI/6, 0, Math.PI*2);
        ctx.ellipse(r*0.3, -r*0.9, r*0.2, r*0.5, Math.PI/6, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = leafColorPrimary;
        // Central tall leaf
        ctx.beginPath();
        ctx.ellipse(0, -r*1.1, r*0.18, r*0.6, 0, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();

        // 2. Pineapple Body (Textured scales)
        const bodyGrad = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r);
        bodyGrad.addColorStop(0, isFrenzy ? '#ffe082' : '#ffd54f');
        bodyGrad.addColorStop(0.7, isFrenzy ? '#ff8f00' : '#ffb300');
        bodyGrad.addColorStop(1, isFrenzy ? '#d84315' : '#ff6f00');
        ctx.fillStyle = bodyGrad;
        
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.76, r * 0.96, 0, 0, Math.PI * 2);
        ctx.fill();

        // Drawing overlapping scale texture (3D grid)
        ctx.strokeStyle = isFrenzy ? '#d84315' : '#e65100';
        ctx.lineWidth = 2.5;
        
        // Draw scales manually using loop
        const rows = 6;
        const cols = 5;
        for (let row = 0; row < rows; row++) {
          const y = cy - r * 0.7 + (row / (rows-1)) * r * 1.4;
          const wRow = Math.sqrt(1 - Math.pow((y - cy) / r, 2)) * r * 0.76;
          
          for (let col = 0; col < cols; col++) {
            const x = cx - wRow + (col / (cols-1)) * wRow * 2;
            
            // Draw diamond scale
            ctx.save();
            ctx.translate(x, y);
            
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(8, 0);
            ctx.lineTo(0, 7);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.stroke();
            
            // Shading in scale
            ctx.fillStyle = isFrenzy ? '#ff7043' : '#ffca28';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
          }
        }
        break;

      case 'DRAGON_FRUIT':
        // Pink Skin Base
        const dragonSkinGrad = ctx.createRadialGradient(cx - r*0.1, cy - r*0.1, 5, cx, cy, r);
        dragonSkinGrad.addColorStop(0, '#ff4081');
        dragonSkinGrad.addColorStop(0.7, '#f50057');
        dragonSkinGrad.addColorStop(1, '#c51162');
        ctx.fillStyle = dragonSkinGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Curved Flame-like Scales
        ctx.fillStyle = '#00e676';
        ctx.strokeStyle = '#c51162';
        ctx.lineWidth = 1.5;
        const dragonScales = 12;
        for (let i = 0; i < dragonScales; i++) {
          const a = (i * Math.PI * 2) / dragonScales;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a);
          
          ctx.beginPath();
          ctx.moveTo(r - 5, -8);
          ctx.quadraticCurveTo(r + 14, 0, r - 5, 8);
          ctx.quadraticCurveTo(r + 4, 0, r - 5, -8);
          ctx.fill();
          ctx.stroke();
          
          ctx.restore();
        }

        // White core interior
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
        ctx.fill();

        // Seed pockets (randomized but realistic seed pattern)
        ctx.fillStyle = '#111111';
        for (let i = 0; i < 45; i++) {
          const sa = (i * 2.4);
          const sd = Math.sqrt(Math.random()) * (r * 0.72);
          const sx = cx + Math.cos(sa) * sd;
          const sy = cy + Math.sin(sa) * sd;
          
          ctx.beginPath();
          ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'STRAWBERRY':
        // Red body (rounded heart)
        const strawberryGrad = ctx.createRadialGradient(cx - r*0.1, cy - r*0.1, 2, cx, cy, r);
        strawberryGrad.addColorStop(0, '#ff4d6d');
        strawberryGrad.addColorStop(0.7, '#ff0f39');
        strawberryGrad.addColorStop(1, '#b7001c');
        ctx.fillStyle = strawberryGrad;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.75);
        ctx.bezierCurveTo(cx + r * 0.8, cy - r * 0.95, cx + r * 1.1, cy + r * 0.05, cx + r * 0.5, cy + r * 0.85);
        ctx.bezierCurveTo(cx + r * 0.2, cy + r * 1.05, cx - r * 0.2, cy + r * 1.05, cx - r * 0.5, cy + r * 0.85);
        ctx.bezierCurveTo(cx - r * 1.1, cy + r * 0.05, cx - r * 0.8, cy - r * 0.95, cx, cy - r * 0.75);
        ctx.fill();

        // Layered Crown Leaves
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.7);
        ctx.bezierCurveTo(cx - r * 0.5, cy - r * 0.95, cx - r * 0.3, cy - r * 0.65, cx, cy - r * 0.65);
        ctx.bezierCurveTo(cx + r * 0.3, cy - r * 0.65, cx + r * 0.5, cy - r * 0.95, cx, cy - r * 0.7);
        ctx.fill();
        
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.moveTo(cx - r*0.25, cy - r*0.7);
        ctx.lineTo(cx, cy - r*0.95);
        ctx.lineTo(cx + r*0.25, cy - r*0.7);
        ctx.fill();

        // Tiny yellow seeds with indentation pockets
        const sRows = 5;
        for (let row = 1; row < sRows; row++) {
          const yOffset = -r * 0.5 + (row / sRows) * r * 1.35;
          const wRow = Math.sin((row / sRows) * Math.PI) * r * 0.7;
          const sCount = row + 2;
          
          for (let i = 0; i < sCount; i++) {
            const xOffset = -wRow + (i / (sCount - 1)) * wRow * 2;
            const sx = cx + xOffset;
            const sy = cy + yOffset;
            
            // Seed shadow pocket (makes it look 3D)
            ctx.fillStyle = '#7a0010';
            ctx.beginPath();
            ctx.ellipse(sx + 0.8, sy + 0.8, 1.8, 1.0, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Yellow seed
            ctx.fillStyle = '#ffe082';
            ctx.beginPath();
            ctx.ellipse(sx, sy, 1.5, 0.8, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'GRAPES':
        // Vine leaf at the top
        ctx.save();
        ctx.translate(cx, cy - r * 0.4);
        
        // vine stem
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-8, -12, 5, -22);
        ctx.stroke();
        
        // grape vine leaf
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.quadraticCurveTo(-14, -18, -2, -14);
        ctx.quadraticCurveTo(8, -24, 6, -10);
        ctx.quadraticCurveTo(14, -6, 2, -2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // bunch of overlapping glossy grapes
        const grapePositions = [
          { dx: 0, dy: -r*0.4, sz: 14 },
          { dx: -r*0.34, dy: -r*0.2, sz: 13.5 }, { dx: r*0.34, dy: -r*0.2, sz: 13.5 },
          { dx: -r*0.38, dy: r*0.14, sz: 14 }, { dx: 0, dy: r*0.08, sz: 14.5 }, { dx: r*0.38, dy: r*0.14, sz: 14 },
          { dx: -r*0.2, dy: r*0.44, sz: 13.5 }, { dx: r*0.2, dy: r*0.44, sz: 13.5 },
          { dx: 0, dy: r*0.72, sz: 13 }
        ];

        grapePositions.forEach(({ dx, dy, sz }) => {
          const grapeGrad = ctx.createRadialGradient(cx + dx - 4, cy + dy - 4, 1, cx + dx, cy + dy, sz);
          grapeGrad.addColorStop(0, '#bf55ff');
          grapeGrad.addColorStop(0.7, '#6f00ff');
          grapeGrad.addColorStop(1, '#320075');
          ctx.fillStyle = grapeGrad;

          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, sz, 0, Math.PI * 2);
          ctx.fill();
          
          // Specular highlight gloss overlay
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(cx + dx - sz * 0.35, cy + dy - sz * 0.35, sz * 0.22, 0, Math.PI * 2);
          ctx.fill();
        });
        break;

      case 'MANGO':
        // Kidneyshaped mango using bezier curves
        ctx.save();
        ctx.translate(cx, cy);
        
        const mangoSkinGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, 5, 0, 0, r);
        mangoSkinGrad.addColorStop(0, '#ffeb3b'); // Yellow face
        mangoSkinGrad.addColorStop(0.5, '#ffa726'); // Orange sides
        mangoSkinGrad.addColorStop(0.85, '#f44336'); // Red top
        mangoSkinGrad.addColorStop(1, '#d32f2f'); // Deep red rim
        ctx.fillStyle = mangoSkinGrad;

        ctx.beginPath();
        ctx.moveTo(0, -r * 0.72);
        ctx.bezierCurveTo(r * 0.7, -r * 0.95, r * 1.15, -r * 0.2, r * 0.86, r * 0.45);
        ctx.bezierCurveTo(r * 0.65, r * 0.95, -r * 0.2, r * 0.92, -r * 0.6, r * 0.52);
        ctx.bezierCurveTo(-r * 0.98, r * 0.15, -r * 0.75, -r * 0.4, 0, -r * 0.72);
        ctx.closePath();
        ctx.fill();
        
        // Stem and leaf
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.72);
        ctx.quadraticCurveTo(-r * 0.1, -r * 0.9, -r * 0.08, -r * 1.0);
        ctx.stroke();
        
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.ellipse(-r*0.24, -r*0.82, r*0.25, r*0.1, -Math.PI/6, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
        break;
    }
    ctx.restore();
  }

  // Draw white glossy overlay curve to make it look realistic and premium
  drawGlossHighlight(ctx, cx, cy, r) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    // Arc along top-left curve
    ctx.arc(cx, cy, r * 0.82, -Math.PI * 0.7, -Math.PI * 0.3);
    ctx.stroke();
    
    ctx.restore();
  }
}
