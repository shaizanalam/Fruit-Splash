// Collision & math helpers for Fruit Slash AI

// Distance between two 2D points
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Check if a line segment (x1, y1) -> (x2, y2) intersects a circle centered at (cx, cy) with radius r
// Returns true if there is an intersection
export function checkLineCircleCollision(x1, y1, x2, y2, cx, cy, r) {
  // Vector AB (segment)
  const abX = x2 - x1;
  const abY = y2 - y1;
  
  // Vector AC (from start of segment to circle center)
  const acX = cx - x1;
  const acY = cy - y1;
  
  // Square length of AB
  const ab2 = abX * abX + abY * abY;
  
  // If segment is a single point, just check distance from that point to circle center
  if (ab2 === 0) {
    return distance(x1, y1, cx, cy) <= r;
  }
  
  // Projection factor t, clamped between 0 and 1 (so we stay on the segment)
  let t = (acX * abX + acY * abY) / ab2;
  t = Math.max(0, Math.min(1, t));
  
  // Closest point on the segment to the circle center
  const projX = x1 + t * abX;
  const projY = y1 + t * abY;
  
  // Distance from closest point to circle center
  const dist = distance(projX, projY, cx, cy);
  
  return dist <= r;
}

// Interpolate points between A and B to create a smooth, continuous set of subsegments
// This prevents missing slices when a hand moves fast.
// Returns an array of points: [{x, y}, ...]
export function interpolateSegmentPoints(x1, y1, x2, y2, stepSize = 10) {
  const dist = distance(x1, y1, x2, y2);
  if (dist <= stepSize) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  
  const steps = Math.ceil(dist / stepSize);
  const points = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    });
  }
  
  return points;
}

// Generate random number in range [min, max]
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Generate a random integer in range [min, max]
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Easing function for visual effects: cubic out
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Format a number with leading zeros (e.g. for score display)
export function padNumber(num, size = 6) {
  let s = num.toString();
  while (s.length < size) s = "0" + s;
  return s;
}
