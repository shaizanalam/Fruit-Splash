import { checkLineCircleCollision, interpolateSegmentPoints, distance } from '../utils/helpers.js';

class PhysicsEngine {
  constructor() {
    // Map of fingerId -> array of points [{ x, y, time }]
    this.trails = new Map();
    this.maxTrailAge = 190; // ms
  }

  // Update multi-finger trails
  // Accepts coords: single point { x, y } OR enhanced object with { cutters: [...] }
  updateTrails(coords, width, height) {
    const time = performance.now();

    if (!coords) {
      this.decayAllTrails(time);
      return;
    }

    const activeCutters = coords.cutters && coords.cutters.length > 0 
      ? coords.cutters 
      : [{ id: coords.id || 'primary', x: coords.x, y: coords.y }];

    const activeIds = new Set();

    for (const cutter of activeCutters) {
      const id = cutter.id || 'primary';
      activeIds.add(id);

      let screenX = cutter.x * width;
      let screenY = cutter.y * height;

      let trail = this.trails.get(id);
      if (!trail) {
        trail = [];
        this.trails.set(id, trail);
      }

      // Exponential moving average (EMA) smoothing to eliminate camera jitter
      if (trail.length > 0) {
        const lastPt = trail[trail.length - 1];
        if (time - lastPt.time < 120) {
          const smoothing = 0.45; // responsive low-lag smoothing
          screenX = lastPt.x * smoothing + screenX * (1 - smoothing);
          screenY = lastPt.y * smoothing + screenY * (1 - smoothing);
        }
      }

      trail.push({ x: screenX, y: screenY, time });

      // Decay this specific trail
      this.decayTrail(trail, time);
    }

    // Decay trails for fingers that are no longer extended
    for (const [id, trail] of this.trails.entries()) {
      if (!activeIds.has(id)) {
        this.decayTrail(trail, time);
        if (trail.length === 0) {
          this.trails.delete(id);
        }
      }
    }
  }

  // Backward compatibility alias
  updateTrail(coords, width, height) {
    this.updateTrails(coords, width, height);
  }

  decayTrail(trail, currentTime) {
    let i = 0;
    while (i < trail.length && (currentTime - trail[i].time) >= this.maxTrailAge) {
      i++;
    }
    if (i > 0) {
      trail.splice(0, i);
    }
    // Limit to max 12 points for crisp responsive feel
    if (trail.length > 12) {
      trail.splice(0, trail.length - 12);
    }
  }

  decayAllTrails(currentTime) {
    for (const [id, trail] of this.trails.entries()) {
      this.decayTrail(trail, currentTime);
      if (trail.length === 0) {
        this.trails.delete(id);
      }
    }
  }

  clearTrail() {
    this.trails.clear();
  }

  // Calculate speed of the last slice segment for a specific cutter
  getSliceVelocity(trailId = null) {
    let targetTrail = null;
    if (trailId && this.trails.has(trailId)) {
      targetTrail = this.trails.get(trailId);
    } else {
      // Find the fastest active trail
      for (const trail of this.trails.values()) {
        if (!targetTrail || trail.length > targetTrail.length) {
          targetTrail = trail;
        }
      }
    }

    if (!targetTrail || targetTrail.length < 2) return 0;

    const p1 = targetTrail[targetTrail.length - 2];
    const p2 = targetTrail[targetTrail.length - 1];

    const dist = distance(p1.x, p1.y, p2.x, p2.y);
    const timeDiff = p2.time - p1.time;

    if (timeDiff <= 0) return 0;
    return dist / timeDiff; // px/ms
  }

  // Perform continuous collision check across all active finger/mouse cutter trails
  // Returns array of sliced items with slice metadata: [{ obj, sliceAngle, sliceOffset, cutterId }]
  checkCollisions(objects, width, height) {
    if (this.trails.size === 0) return [];

    const slicedResults = [];
    const alreadySlicedInFrame = new Set();

    for (const [cutterId, trail] of this.trails.entries()) {
      if (trail.length === 0) continue;

      const tip = trail[trail.length - 1];
      let subSegments = [];

      if (trail.length >= 2) {
        const p1 = trail[trail.length - 2];
        subSegments = interpolateSegmentPoints(p1.x, p1.y, tip.x, tip.y, 8);
      }

      for (const obj of objects) {
        if (obj.sliced || obj.exploding || alreadySlicedInFrame.has(obj)) continue;

        let hit = false;
        const isBomb = obj.constructor.name === 'Bomb';
        // Generous, satisfying hitboxes
        const collisionRadius = isBomb 
          ? (obj.radius * 0.8) 
          : (obj.radius * 1.8 + 25);

        // 1. Direct touch check
        const distToCenter = distance(tip.x, tip.y, obj.x, obj.y);
        if (distToCenter <= collisionRadius) {
          hit = true;
        }

        // 2. Continuous line sweep check
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
          alreadySlicedInFrame.add(obj);

          // Calculate precise cut angle and offset
          let sliceAngle = 0;
          let sliceOffset = 0;

          if (trail.length >= 2) {
            const p1 = trail[trail.length - 2];
            const p2 = trail[trail.length - 1];
            sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            const num = (p2.x - p1.x) * (p1.y - obj.y) - (p1.x - obj.x) * (p2.y - p1.y);
            const den = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (den !== 0) {
              sliceOffset = num / den;
              const maxOffset = obj.radius * 0.85;
              sliceOffset = Math.max(-maxOffset, Math.min(maxOffset, sliceOffset));
            }
          }

          slicedResults.push({
            obj,
            cutterId,
            sliceAngle,
            sliceOffset
          });
        }
      }
    }

    return slicedResults;
  }

  // Draw refined katana blade trails for all active cutters
  drawTrail(ctx, comboCount) {
    if (this.trails.size === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Premium arcade palette (blade silver, cyan, gold, ruby)
    let glowColor = '#38bdf8'; // Blade Cyan
    let coreColor = '#ffffff';

    if (comboCount >= 8) {
      glowColor = '#f43f5e'; // Fiery Ruby
    } else if (comboCount >= 5) {
      glowColor = '#fbbf24'; // Radiant Gold
    } else if (comboCount >= 3) {
      glowColor = '#a855f7'; // Royal Purple
    }

    for (const [id, trail] of this.trails.entries()) {
      if (trail.length < 2) continue;

      // Outer blade aura
      ctx.shadowBlur = 12;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;

      for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i - 1];
        const p2 = trail[i];
        const ratio = i / trail.length;
        ctx.lineWidth = 10 * ratio;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Inner razor core
      ctx.shadowBlur = 4;
      ctx.strokeStyle = coreColor;

      for (let i = 1; i < trail.length; i++) {
        const p1 = trail[i - 1];
        const p2 = trail[i];
        const ratio = i / trail.length;
        ctx.lineWidth = 3.5 * ratio;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Blade tip glint
      const tip = trail[trail.length - 1];
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

const physicsEngine = new PhysicsEngine();
export default physicsEngine;
