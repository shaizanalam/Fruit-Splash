import { checkLineCircleCollision, interpolateSegmentPoints, distance } from '../utils/helpers.js';

class PhysicsEngine {
  constructor() {
    this.trail = []; // [{x, y, time}, ...]
    this.maxTrailAge = 180; // ms
    this.minSliceVelocity = 4.0; // minimum pixels per millisecond to register a slice
  }

  // Update trail with new point from tracker
  // coords = {x: 0..1, y: 0..1} mapped to screen px
  updateTrail(coords, width, height) {
    const time = performance.now();
    
    if (!coords) {
      // If hand is lost, let trail decay naturally
      this.decayTrail(time);
      return;
    }

    let screenX = coords.x * width;
    let screenY = coords.y * height;

    // Apply exponential moving average (EMA) smoothing of 0.75 to eliminate camera jitter
    if (this.trail.length > 0) {
      const lastPt = this.trail[this.trail.length - 1];
      // Only smooth if hand has been tracked continuously (within last 150ms)
      if (time - lastPt.time < 150) {
        const smoothing = 0.5; // lowered to reduce input lag
        screenX = lastPt.x * smoothing + screenX * (1 - smoothing);
        screenY = lastPt.y * smoothing + screenY * (1 - smoothing);
      }
    }

    this.trail.push({ x: screenX, y: screenY, time });
    this.decayTrail(time);
  }

  decayTrail(currentTime) {
    // Filter out points older than the time decay
    this.trail = this.trail.filter(pt => (currentTime - pt.time) < this.maxTrailAge);
    // Limit trail points to exactly/at most 10 for quick responsive styling
    if (this.trail.length > 10) {
      this.trail = this.trail.slice(-10);
    }
  }

  clearTrail() {
    this.trail = [];
  }

  // Calculate speed of the last slice segment
  getSliceVelocity() {
    if (this.trail.length < 2) return 0;
    
    const p1 = this.trail[this.trail.length - 2];
    const p2 = this.trail[this.trail.length - 1];
    
    const dist = distance(p1.x, p1.y, p2.x, p2.y);
    const timeDiff = p2.time - p1.time; // ms
    
    if (timeDiff <= 0) return 0;
    return dist / timeDiff; // px/ms
  }

  // Perform continuous collision check against active fruits/bombs
  // Returns array of sliced objects in this frame
  checkCollisions(objects, width, height) {
    if (this.trail.length === 0) return [];

    const tip = this.trail[this.trail.length - 1]; // Current fingertip/mouse tip
    const slicedObjects = [];

    // Interpolate points between last two frames to make sure no gaps
    let subSegments = [];
    if (this.trail.length >= 2) {
      const p1 = this.trail[this.trail.length - 2];
      subSegments = interpolateSegmentPoints(p1.x, p1.y, tip.x, tip.y, 8);
    }

    for (const obj of objects) {
      if (obj.sliced || obj.exploding) continue;

      let hit = false;
      
      // Exhibition settings:
      // - Fruit hitbox: 1.4x radius + 15px auto-hit tolerance for generous slices
      // - Bomb hitbox: 0.8x radius to forgive close shaves and avoid frustration
      const isBomb = obj.constructor.name === 'Bomb';
      const collisionRadius = isBomb 
        ? (obj.radius * 0.8) 
        : (obj.radius * 2.0 + 35);

      // 1. Direct Touch Check: If the finger tip/pointer is directly inside the fruit circle
      const distToCenter = distance(tip.x, tip.y, obj.x, obj.y);
      if (distToCenter <= collisionRadius) {
        hit = true;
      }

      // 2. Line Intersection Check (fallback for rapid hand sweeps)
      if (!hit && subSegments.length >= 2) {
        for (let i = 0; i < subSegments.length - 1; i++) {
          const segStart = subSegments[i];
          const segEnd = subSegments[i + 1];

          if (checkLineCircleCollision(
            segStart.x, segStart.y,
            segEnd.x, segEnd.y,
            obj.x, obj.y,
            collisionRadius
          )) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        slicedObjects.push(obj);
      }
    }

    return slicedObjects;
  }

  // Draw the neon sword trail on canvas
  drawTrail(ctx, comboCount) {
    if (this.trail.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Select neon glow colors based on combo status
    let glowColor = '#00f0ff'; // blue
    let innerColor = '#ffffff';

    if (comboCount >= 8) {
      // Max combo: animated rainbow glow
      const t = performance.now() * 0.005;
      const r = Math.sin(t) * 127 + 128;
      const g = Math.sin(t + 2) * 127 + 128;
      const b = Math.sin(t + 4) * 127 + 128;
      glowColor = `rgb(${r},${g},${b})`;
    } else if (comboCount >= 5) {
      glowColor = '#ffb800'; // gold
    } else if (comboCount >= 3) {
      glowColor = '#bd00ff'; // purple
    } else if (comboCount >= 2) {
      glowColor = '#ff007a'; // pink
    }

    // Draw multi-layered glowing trail
    // Outer glow layer
    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = glowColor;

    // We draw connected lines that taper in thickness
    for (let i = 1; i < this.trail.length; i++) {
      const p1 = this.trail[i - 1];
      const p2 = this.trail[i];
      
      // Calculate width tapering from head (index 8 tip) to tail (start of array)
      const ratio = i / this.trail.length;
      ctx.lineWidth = 14 * ratio; // outer thick width
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Inner bright core layer
    ctx.shadowBlur = 4;
    ctx.strokeStyle = innerColor;

    for (let i = 1; i < this.trail.length; i++) {
      const p1 = this.trail[i - 1];
      const p2 = this.trail[i];
      const ratio = i / this.trail.length;
      ctx.lineWidth = 4 * ratio; // thin sharp inner width

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const physicsEngine = new PhysicsEngine();
export default physicsEngine;
