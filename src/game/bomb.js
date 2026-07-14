import { randomRange } from '../utils/helpers.js';

export class Bomb {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.radius = 36;
    this.x = randomRange(this.radius + 120, canvasWidth - this.radius - 120);
    this.y = canvasHeight + this.radius + 10;

    // Launch trajectory physics
    const targetX = canvasWidth / 2 + randomRange(-100, 100);
    const gravity = 0.32;
    const peakY = randomRange(160, 320);
    const heightDifference = this.y - peakY;

    const launchVy = -Math.sqrt(2 * gravity * heightDifference);
    const timeToPeak = -launchVy / gravity;
    const launchVx = (targetX - this.x) / timeToPeak;

    this.vx = launchVx;
    this.vy = launchVy;
    this.gravity = gravity;

    this.angle = randomRange(0, Math.PI * 2);
    this.spin = randomRange(-0.02, 0.02);

    this.exploding = false;
    this.explosionProgress = 0; // 0 to 1
    this.isBlinking = false;
    this.blinkTimer = 0;
  }

  update() {
    if (!this.exploding) {
      // Normal physics
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.angle += this.spin;

      // Pulse/blink indicator
      this.blinkTimer += 1;
      if (this.blinkTimer % 12 === 0) {
        this.isBlinking = !this.isBlinking;
      }
    } else {
      // Expand explosion shockwave
      this.explosionProgress += 0.04;
    }
  }

  isOutOfBounds() {
    if (!this.exploding) {
      return this.y > this.canvasHeight + this.radius + 20 && this.vy > 0;
    } else {
      return this.explosionProgress >= 1.0;
    }
  }

  triggerExplosion() {
    this.exploding = true;
    this.explosionProgress = 0;
  }

  draw(ctx) {
    if (!this.exploding) {
      this.drawIntact(ctx);
    } else {
      this.drawExplosion(ctx);
    }
  }

  drawShadow(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 16, this.radius * 0.8, this.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.restore();
  }

  drawIntact(ctx) {
    this.drawShadow(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Spikes (Metallic triangles jutting out)
    const spikesCount = 8;
    ctx.fillStyle = '#222633';
    ctx.strokeStyle = '#3a3f55';
    ctx.lineWidth = 2;
    for (let i = 0; i < spikesCount; i++) {
      const a = (i * Math.PI * 2) / spikesCount;
      ctx.save();
      ctx.rotate(a);
      
      ctx.beginPath();
      ctx.moveTo(-6, -this.radius);
      ctx.lineTo(0, -this.radius - 12);
      ctx.lineTo(6, -this.radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    }

    // Main steel ball (Metallic dark grey radial gradient)
    const ballGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, this.radius);
    ballGrad.addColorStop(0, '#535a70');
    ballGrad.addColorStop(0.6, '#1a1c24');
    ballGrad.addColorStop(1, '#0b0c10');

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Steel boundary outline
    ctx.strokeStyle = '#3a3f55';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Blinking center indicator (Neon Red glow)
    if (this.isBlinking) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff003c';
      ctx.fillStyle = '#ff003c';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#660011';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0; // reset

    // Draw fuse wire (starting from top, extending out)
    ctx.restore(); // cancel rotation so fuse stays pointing up

    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Fuse line
    ctx.strokeStyle = '#9d7f60';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.quadraticCurveTo(-15, -this.radius - 20, -8, -this.radius - 35);
    ctx.stroke();

    // Fuse cap (brass base for fuse)
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.rect(-6, -this.radius - 3, 12, 5);
    ctx.fill();

    // Spark particle effect at tip of fuse
    const sx = -8;
    const sy = -this.radius - 35;
    
    // Glowing orange aura
    const sparkGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
    sparkGrad.addColorStop(0, '#ffffff');
    sparkGrad.addColorStop(0.3, '#ffd700');
    sparkGrad.addColorStop(0.7, '#ff4500');
    sparkGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sparkGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Star spikes for the spark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const sparkLines = 4;
    for (let i = 0; i < sparkLines; i++) {
      const sa = (i * Math.PI) / sparkLines + (performance.now() * 0.01);
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(sa) * 10, sy - Math.sin(sa) * 10);
      ctx.lineTo(sx + Math.cos(sa) * 10, sy + Math.sin(sa) * 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawExplosion(ctx) {
    ctx.save();
    
    // Blinding shockwave ring expanding outwards
    const maxShockwaveRadius = 380;
    const curRadius = this.explosionProgress * maxShockwaveRadius;
    const alpha = 1.0 - this.explosionProgress;

    // Glowing explosion ring
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#ff003c';
    
    const grad = ctx.createRadialGradient(this.x, this.y, curRadius * 0.2, this.x, this.y, curRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, '#ffea00'); // yellow
    grad.addColorStop(0.4, '#ff4500'); // orange-red
    grad.addColorStop(0.8, '#ff003c'); // deep pink-red
    grad.addColorStop(1.0, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, curRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
