import { randomRange, randomInt } from '../utils/helpers.js';

class Particle {
  constructor(x, y, color, type = 'juice') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type; // 'juice', 'seed', 'smoke', 'fire', 'spark'

    // Configure properties based on particle type
    switch (type) {
      case 'juice':
        this.size = randomRange(3, 8);
        this.vx = randomRange(-4, 4);
        this.vy = randomRange(-6, 2);
        this.gravity = 0.28;
        this.decay = randomRange(0.015, 0.03);
        break;
      case 'seed':
        this.size = randomRange(1.5, 3.5);
        this.vx = randomRange(-3, 3);
        this.vy = randomRange(-5, 0);
        this.gravity = 0.3;
        this.decay = randomRange(0.01, 0.02);
        break;
      case 'smoke':
        this.size = randomRange(15, 35);
        this.vx = randomRange(-2, 2);
        this.vy = randomRange(-3, -1);
        this.gravity = -0.02; // rises slightly
        this.decay = randomRange(0.01, 0.02);
        break;
      case 'fire':
        this.size = randomRange(5, 12);
        this.vx = randomRange(-6, 6);
        this.vy = randomRange(-8, 4);
        this.gravity = 0.15;
        this.decay = randomRange(0.02, 0.04);
        break;
      case 'spark':
        this.size = randomRange(1, 3);
        this.vx = randomRange(-8, 8);
        this.vy = randomRange(-8, 8);
        this.gravity = 0.05;
        this.decay = randomRange(0.03, 0.06);
        break;
    }

    this.life = 1.0;
    this.angle = randomRange(0, Math.PI * 2);
    this.spin = randomRange(-0.1, 0.1);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.angle += this.spin;

    // Apply air resistance to smoke/fire
    if (this.type === 'smoke' || this.type === 'fire') {
      this.vx *= 0.98;
      this.vy *= 0.98;
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.life;

    if (this.type === 'juice') {
      // Juice drops
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'seed') {
      // Seed shape (little brown/black ellipses)
      ctx.fillStyle = '#3e2723'; // dark brown seed color
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.size * 1.5, this.size * 0.7, this.angle, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'smoke') {
      // Smoke puff
      ctx.fillStyle = 'rgba(100, 100, 110, 0.4)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(50, 50, 50, 0.2)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'fire') {
      // Fire particle
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
      grad.addColorStop(0, '#ffffff'); // center white
      grad.addColorStop(0.3, '#ffcc00'); // yellow
      grad.addColorStop(0.7, '#ff3700'); // orange
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff3700';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spark') {
      // Glowing line sparks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.size;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ffea00';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 1.5, this.y - this.vy * 1.5);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class TextPopup {
  constructor(x, y, text, color, isCombo = false) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.isCombo = isCombo;

    this.vy = isCombo ? -2.5 : -1.8;
    this.life = 1.0;
    this.decay = isCombo ? 0.015 : 0.025;
    this.scale = isCombo ? 1.3 : 1.0;
  }

  update() {
    this.y += this.vy;
    this.vy *= 0.96; // slow down vertical rise
    this.life -= this.decay;
  }

  draw(ctx) {
    if (this.life <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.shadowBlur = this.isCombo ? 12 : 5;
    ctx.shadowColor = this.color;

    ctx.font = this.isCombo ? '900 24px "Orbitron"' : 'bold 20px "Outfit"';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Scale-in effect on creation
    const currentScale = this.isCombo 
      ? this.scale * (1 + (1 - this.life) * 0.2)
      : this.scale;

    ctx.translate(this.x, this.y);
    ctx.scale(currentScale, currentScale);

    // Draw dark outline for contrast
    ctx.strokeStyle = '#070913';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, 0, 0);
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.popups = [];
  }

  update() {
    this.particles.forEach(p => p.update());
    this.popups.forEach(p => p.update());

    // Filter dead elements
    this.particles = this.particles.filter(p => p.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
    this.popups.forEach(p => p.draw(ctx));
  }

  clear() {
    this.particles = [];
    this.popups = [];
  }

  spawnJuiceSplash(x, y, color) {
    // Normal splash juice drops
    const count = randomInt(18, 28);
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, 'juice'));
    }
  }

  spawnSeeds(x, y, count = 6) {
    // Spawn flyout seed particles
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, null, 'seed'));
    }
  }

  spawnBombExplosion(x, y) {
    // Spawn fireballs
    const fireCount = randomInt(35, 45);
    for (let i = 0; i < fireCount; i++) {
      this.particles.push(new Particle(x, y, null, 'fire'));
    }

    // Spawn sparks
    const sparkCount = randomInt(20, 30);
    for (let i = 0; i < sparkCount; i++) {
      this.particles.push(new Particle(x, y, null, 'spark'));
    }

    // Spawn smoke clouds
    const smokeCount = randomInt(8, 12);
    for (let i = 0; i < smokeCount; i++) {
      const sx = x + randomRange(-30, 30);
      const sy = y + randomRange(-30, 30);
      this.particles.push(new Particle(sx, sy, null, 'smoke'));
    }
  }

  spawnText(x, y, text, color = '#ffffff', isCombo = false) {
    this.popups.push(new TextPopup(x, y, text, color, isCombo));
  }
}

const particleSystem = new ParticleSystem();
export default particleSystem;
