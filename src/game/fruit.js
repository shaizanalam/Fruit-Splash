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
  MANGO: { name: 'Mango', radius: 36, juiceColor: '#ff9900', outerColor: '#ff8800' }
};

export class Fruit {
  constructor(canvasWidth, canvasHeight, forceType = null) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Pick type
    const keys = Object.keys(FRUIT_TYPES);
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
    const gravity = 0.32; // match game loop gravity
    
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

  update() {
    if (!this.sliced) {
      // Normal physics
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.angle += this.spin;
    } else {
      // Update sliced halves separately
      if (this.half1 && this.half2) {
        this.half1.x += this.half1.vx;
        this.half1.y += this.half1.vy;
        this.half1.vy += this.gravity;
        this.half1.angle += this.half1.spin;

        this.half2.x += this.half2.vx;
        this.half2.y += this.half2.vy;
        this.half2.vy += this.gravity;
        this.half2.angle += this.half2.spin;

        // Fade out halves
        this.life -= 0.02;
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

  slice(swordAngle) {
    if (this.sliced) return;

    this.sliced = true;
    // Store slice orientation (normalized)
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
    // Draw clip mask relative to slicing angle
    ctx.beginPath();
    ctx.rect(-this.radius - 20, -this.radius - 20, this.radius * 2 + 40, this.radius + 20);
    ctx.clip();
    this.drawProceduralFruit(ctx, 0, 0, this.radius);
    this.drawGlossHighlight(ctx, 0, 0, this.radius);
    ctx.restore();

    // Draw Half 2
    ctx.save();
    ctx.translate(this.half2.x, this.half2.y);
    ctx.rotate(this.half2.angle);
    // Draw clip mask opposite of slicing angle
    ctx.beginPath();
    ctx.rect(-this.radius - 20, 0, this.radius * 2 + 40, this.radius + 20);
    ctx.clip();
    this.drawProceduralFruit(ctx, 0, 0, this.radius);
    this.drawGlossHighlight(ctx, 0, 0, this.radius);
    ctx.restore();

    ctx.restore();
  }

  // Draw actual vector graphics based on fruit type
  drawProceduralFruit(ctx, cx, cy, r) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.config.juiceColor + '77';

    switch (this.typeKey) {
      case 'WATERMELON':
        // Outer Rind (Dark Green)
        ctx.fillStyle = '#1d5a16';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Rind Stripes (Lighter green)
        ctx.strokeStyle = '#2d8c22';
        ctx.lineWidth = 4;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 0.95, Math.abs(r * i * 0.25), Math.PI/6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Inner flesh (White-Green transition rind)
        ctx.fillStyle = '#ebfed1';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
        ctx.fill();

        // Inner flesh (Red)
        const watermelonGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.8);
        watermelonGrad.addColorStop(0, '#ff1a53');
        watermelonGrad.addColorStop(0.85, '#ff003c');
        watermelonGrad.addColorStop(1, '#ff3b3b');
        ctx.fillStyle = watermelonGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Seeds
        ctx.fillStyle = '#111';
        ctx.shadowBlur = 0;
        const seedAngles = [0, 0.4, 0.9, 1.5, 2.1, 2.7, 3.3, 3.9, 4.5, 5.1, 5.8];
        seedAngles.forEach(a => {
          const sx = cx + Math.cos(a) * (r * 0.5);
          const sy = cy + Math.sin(a) * (r * 0.5);
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3, 1.5, a, 0, Math.PI * 2);
          ctx.fill();
        });
        break;

      case 'APPLE':
        // Apple Body (Red Radial Gradient)
        const appleGrad = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, 5, cx, cy, r);
        appleGrad.addColorStop(0, '#ff4d6d');
        appleGrad.addColorStop(0.65, '#ff0f39');
        appleGrad.addColorStop(1, '#a8001e');
        
        ctx.fillStyle = appleGrad;
        ctx.beginPath();
        // Apple shape indentation at top and bottom
        ctx.moveTo(cx, cy - r * 0.8);
        ctx.bezierCurveTo(cx + r * 0.4, cy - r * 1.1, cx + r * 1.1, cy - r * 0.5, cx + r * 1.0, cy);
        ctx.bezierCurveTo(cx + r * 0.9, cy + r * 0.7, cx + r * 0.4, cy + r * 1.0, cx, cy + r * 0.9);
        ctx.bezierCurveTo(cx - r * 0.4, cy + r * 1.0, cx - r * 0.9, cy + r * 0.7, cx - r * 1.0, cy);
        ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.5, cx - r * 0.4, cy - r * 1.1, cx, cy - r * 0.8);
        ctx.fill();

        // Stem (Brown)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#6d4c41';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.8);
        ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 1.25, cx + r * 0.2, cy - r * 1.35);
        ctx.stroke();

        // Leaf (Green)
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.ellipse(cx + r*0.25, cy - r*1.2, r*0.3, r*0.12, -Math.PI/6, 0, Math.PI*2);
        ctx.fill();
        break;

      case 'ORANGE':
        // Rind
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner white skin
        ctx.fillStyle = '#fff8ee';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
        ctx.fill();

        // Orange pulp base
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
        ctx.fill();

        // Segments separation
        ctx.strokeStyle = '#fff8ee';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const a = (i * Math.PI * 2) / segments;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
          ctx.stroke();

          // Draw wedge pulps inside each segment
          ctx.fillStyle = '#ffa500';
          const wedgeAngle = a + Math.PI / segments;
          const wx = cx + Math.cos(wedgeAngle) * (r * 0.45);
          const wy = cy + Math.sin(wedgeAngle) * (r * 0.45);
          ctx.beginPath();
          ctx.arc(wx, wy, r * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Orange core center
        ctx.fillStyle = '#fff8ee';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'KIWI':
        // Brown Skin
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Kiwi outer green ring
        ctx.fillStyle = '#a2d149';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Inner core (soft yellow-green)
        ctx.fillStyle = '#e8ffaa';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Radiating rays
        ctx.strokeStyle = '#eefec0';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        const rays = 16;
        for (let i = 0; i < rays; i++) {
          const a = (i * Math.PI * 2) / rays;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (r * 0.35), cy + Math.sin(a) * (r * 0.35));
          ctx.lineTo(cx + Math.cos(a) * (r * 0.8), cy + Math.sin(a) * (r * 0.8));
          ctx.stroke();

          // Black seeds clustered around white core
          ctx.fillStyle = '#111111';
          const seedAngle = a + Math.PI / rays;
          const sx = cx + Math.cos(seedAngle) * (r * 0.42);
          const sy = cy + Math.sin(seedAngle) * (r * 0.42);
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'BANANA':
        // Yellow skin
        ctx.fillStyle = '#ffe033';
        ctx.beginPath();
        // Draw crescent shape
        ctx.arc(cx - r * 0.2, cy, r, -Math.PI / 2.3, Math.PI / 2.3, false);
        ctx.arc(cx - r * 0.05, cy, r * 0.92, Math.PI / 2.5, -Math.PI / 2.5, true);
        ctx.closePath();
        ctx.fill();

        // Tips (Brown)
        ctx.fillStyle = '#5c4033';
        ctx.beginPath();
        // Top tip
        ctx.arc(cx + r * 0.45, cy - r * 0.8, 4, 0, Math.PI * 2);
        // Bottom tip
        ctx.arc(cx + r * 0.45, cy + r * 0.8, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'PINEAPPLE':
        // Yellow base oval
        ctx.fillStyle = '#ffbf00';
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.72, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crosshatch segments (Pineapple grids)
        ctx.strokeStyle = '#e67300';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 0;
        for (let i = -3; i <= 3; i++) {
          // Left-diagonal lines
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.6, cy + i * 20);
          ctx.lineTo(cx + r * 0.6, cy - i * 20 - 40);
          ctx.stroke();

          // Right-diagonal lines
          ctx.beginPath();
          ctx.moveTo(cx + r * 0.6, cy + i * 20);
          ctx.lineTo(cx - r * 0.6, cy - i * 20 - 40);
          ctx.stroke();
        }

        // Draw green spikes on top
        ctx.fillStyle = '#228b22';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.9);
        // Central tall leaf
        ctx.quadraticCurveTo(cx, cy - r * 1.5, cx, cy - r * 1.6);
        ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 1.3, cx + r * 0.2, cy - r * 0.8);
        
        // Left side leaves
        ctx.moveTo(cx - r * 0.1, cy - r * 0.9);
        ctx.quadraticCurveTo(cx - r * 0.45, cy - r * 1.45, cx - r * 0.5, cy - r * 1.55);
        ctx.quadraticCurveTo(cx - r * 0.25, cy - r * 1.15, cx, cy - r * 0.85);

        // Right side leaves
        ctx.moveTo(cx + r * 0.1, cy - r * 0.9);
        ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 1.45, cx + r * 0.5, cy - r * 1.55);
        ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 1.15, cx, cy - r * 0.85);
        ctx.fill();
        break;

      case 'DRAGON_FRUIT':
        // Pink Skin
        ctx.fillStyle = '#ff1493';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Green scales overlapping
        ctx.fillStyle = '#00ff66';
        ctx.shadowBlur = 0;
        const scales = 10;
        for (let i = 0; i < scales; i++) {
          const a = (i * Math.PI * 2) / scales;
          const sx = cx + Math.cos(a) * r;
          const sy = cy + Math.sin(a) * r;
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // White core interior
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
        ctx.fill();

        // Tiny black seeds
        ctx.fillStyle = '#111111';
        for (let i = 0; i < 40; i++) {
          // Distributed randomly inside white circle
          const sa = Math.random() * Math.PI * 2;
          const sd = Math.random() * (r * 0.65);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(sa) * sd, cy + Math.sin(sa) * sd, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'STRAWBERRY':
        // Red body (rounded triangle/heart)
        const strawberryGrad = ctx.createRadialGradient(cx - r*0.1, cy - r*0.1, 2, cx, cy, r);
        strawberryGrad.addColorStop(0, '#ff2e51');
        strawberryGrad.addColorStop(0.8, '#ff052f');
        strawberryGrad.addColorStop(1, '#9b001a');
        ctx.fillStyle = strawberryGrad;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.7);
        ctx.bezierCurveTo(cx + r * 0.75, cy - r * 0.9, cx + r * 1.05, cy, cx + r * 0.5, cy + r * 0.8);
        ctx.bezierCurveTo(cx + r * 0.25, cy + r * 1.0, cx - r * 0.25, cy + r * 1.0, cx - r * 0.5, cy + r * 0.8);
        ctx.bezierCurveTo(cx - r * 1.05, cy, cx - r * 0.75, cy - r * 0.9, cx, cy - r * 0.7);
        ctx.fill();

        // Green leaves crown
        ctx.fillStyle = '#2e8b57';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.65);
        ctx.lineTo(cx - r * 0.45, cy - r * 0.85);
        ctx.lineTo(cx - r * 0.2, cy - r * 0.72);
        ctx.lineTo(cx, cy - r * 0.95);
        ctx.lineTo(cx + r * 0.2, cy - r * 0.72);
        ctx.lineTo(cx + r * 0.45, cy - r * 0.85);
        ctx.closePath();
        ctx.fill();

        // Little yellow seed specks
        ctx.fillStyle = '#ffeb3b';
        for (let i = 0; i < 15; i++) {
          const sa = (i * Math.PI * 2) / 15;
          const sx = cx + Math.cos(sa) * (r * 0.55);
          const sy = cy + Math.sin(sa) * (r * 0.55) + 3;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2, 1, sa, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'GRAPES':
        // Bunch of overlapping grapes
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#5a00a8';
        const grapePositions = [
          { dx: 0, dy: -r*0.4 },
          { dx: -r*0.35, dy: -r*0.2 }, { dx: r*0.35, dy: -r*0.2 },
          { dx: -r*0.4, dy: r*0.15 }, { dx: 0, dy: r*0.1 }, { dx: r*0.4, dy: r*0.15 },
          { dx: -r*0.2, dy: r*0.45 }, { dx: r*0.2, dy: r*0.45 },
          { dx: 0, dy: r*0.75 }
        ];

        // Stem
        ctx.strokeStyle = '#4e3629';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r*0.4);
        ctx.quadraticCurveTo(cx - 5, cy - r*0.8, cx + 5, cy - r*0.95);
        ctx.stroke();

        // Draw grapes
        grapePositions.forEach(({ dx, dy }) => {
          const grapeGrad = ctx.createRadialGradient(cx + dx - 4, cy + dy - 4, 1, cx + dx, cy + dy, 14);
          grapeGrad.addColorStop(0, '#bf55ff');
          grapeGrad.addColorStop(0.7, '#6f00ff');
          grapeGrad.addColorStop(1, '#39008f');
          ctx.fillStyle = grapeGrad;

          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, 13, 0, Math.PI * 2);
          ctx.fill();
        });
        break;

      case 'MANGO':
        // Kidneyshaped mango
        const mangoGrad = ctx.createRadialGradient(cx - r*0.15, cy - r*0.15, 3, cx, cy, r);
        mangoGrad.addColorStop(0, '#ffd800');
        mangoGrad.addColorStop(0.65, '#ff8000');
        mangoGrad.addColorStop(1, '#c0392b');
        ctx.fillStyle = mangoGrad;

        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.72, Math.PI / 7, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
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
