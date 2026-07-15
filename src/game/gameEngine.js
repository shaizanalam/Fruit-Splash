import audioManager from '../audio/audioManager.js';
import handTracker from '../mediaPipe/handTracker.js';
import physicsEngine from './physics.js';
import particleSystem from './particles.js';
import { Fruit } from './fruit.js';
import { Bomb } from './bomb.js';
import screenManager from '../ui/screenManager.js';
import { randomRange, randomInt, easeOutCubic } from '../utils/helpers.js';

class GameEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;

    // Game state
    this.state = 'menu'; // 'menu', 'countdown', 'playing', 'gameover', 'attract'
    this.score = 0;
    this.highScore = 0;
    this.lives = 3;
    
    // Power-up States
    this.freezeTimeRemaining = 0;
    this.frenzyTimeRemaining = 0;
    
    // Stats
    this.slicedCount = 0;
    this.missedCount = 0;
    this.bombsHitCount = 0;
    this.maxComboReached = 0;
    this.accuracy = 100;

    // Combo system
    this.comboList = []; // list of slices in current sweep
    this.comboTimer = 0;
    this.comboDuration = 350; // ms window to group slices into a single combo

    // Entities
    this.entities = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1600; // ms between spawns
    this.lastSpawnTime = 0;

    // Difficulty scaling
    this.difficultyLevel = 1;
    this.difficultyTimer = 0;
    this.difficultyInterval = 20000; // escalate every 20s
    this.baseSpeedFactor = 1.0;
    this.bombProbability = 0.04; // 50% lower frequency (start with 4% bomb chance)

    // Camera Shake
    this.shakeIntensity = 0;
    this.shakeDecay = 0.92;

    // Background floating stars
    this.bgStars = [];
    this.bgCanvas = null;
    this.bgCtx = null;

    // Time tracking for Exhibition Mode
    this.lastInteractionTime = performance.now();
    this.idleTimeout = 30000; // 30s idle goes to attract
    this.gameOverTimeout = 15000; // 15s idle in gameover returns to attract/home

    // Mouse control fallback
    this.mouseCoords = null;
    this.isMouseSlicing = false;
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.bgCanvas = document.getElementById('bg-particles-canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Setup background stars
    this.initBgStars();

    // Hook webcam stream coordinate update
    handTracker.addListener((coords, landmarks, isFist) => {
      this.handleHandTrackingUpdate(coords, landmarks, isFist);
    });

    // Hook mouse backup slicing coordinates
    this.setupMouseFallback();

    // Init UI screen managers
    screenManager.init(this);
    this.highScore = this.getHighScoreValue();

    // Start main game loop
    this.loop();
  }

  resizeCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.bgCanvas.width = this.width;
    this.bgCanvas.height = this.height;
  }

  initBgStars() {
    this.bgStars = [];
    const starCount = 60;
    for (let i = 0; i < starCount; i++) {
      this.bgStars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: randomRange(1, 3.5),
        speed: randomRange(0.1, 0.4),
        glowColor: Math.random() > 0.5 ? 'rgba(0, 240, 255, 0.3)' : 'rgba(189, 0, 255, 0.3)',
        pulseRate: randomRange(0.01, 0.03),
        alpha: randomRange(0.2, 0.8)
      });
    }
  }

  getHighScoreValue() {
    // Get top score from leaderboard storage
    const stored = localStorage.getItem('fruitslash_leaderboard');
    if (stored) {
      try {
        const scores = JSON.parse(stored);
        if (scores.length > 0) return scores[0].score;
      } catch (e) {}
    }
    return 0; // default when empty
  }

  // --- STATE SWITCHES ---
  
  startGame() {
    audioManager.unlock();
    audioManager.stopMusic();
    
    this.state = 'countdown';
    this.score = 0;
    this.timeRemaining = 60;
    this.fistStartTime = null;
    this.freezeTimeRemaining = 0;
    this.frenzyTimeRemaining = 0;
    this.lives = 3;
    
    // Reset overlay vignettes
    const container = document.getElementById('game-container');
    if (container) {
      container.classList.remove('freeze-active');
      container.classList.remove('frenzy-active');
    }
    this.slicedCount = 0;
    this.missedCount = 0;
    this.bombsHitCount = 0;
    this.maxComboReached = 0;
    this.difficultyLevel = 1;
    this.spawnInterval = 1600;
    this.bombProbability = 0.04; // 50% lower frequency on restart
    this.entities = [];
    this.comboList = [];
    
    particleSystem.clear();
    physicsEngine.clearTrail();
    this.updateHUD();

    // Trigger full screen visual transitions
    screenManager.showScreen('game-play');
    this.triggerCountdown();
  }

  triggerCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    const numEl = document.getElementById('countdown-number');
    
    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    let count = 3;
    numEl.textContent = count.toString();
    numEl.classList.remove('pop');
    void numEl.offsetWidth; // reflow to restart animation
    numEl.classList.add('pop');
    audioManager.playCountdown(false);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count.toString();
        numEl.classList.remove('pop');
        void numEl.offsetWidth;
        numEl.classList.add('pop');
        audioManager.playCountdown(false);
      } else if (count === 0) {
        numEl.textContent = "SLASH!";
        numEl.classList.remove('pop');
        void numEl.offsetWidth;
        numEl.classList.add('pop');
        audioManager.playCountdown(true);
      } else {
        clearInterval(interval);
        overlay.classList.remove('active');
        overlay.classList.add('hidden');
        
        // Start actual playing loop
        this.state = 'playing';
        this.lastSpawnTime = performance.now();
        this.difficultyTimer = performance.now();
        audioManager.startMusic();
      }
    }, 1000);
  }

  endGame() {
    this.state = 'gameover';
    audioManager.stopMusic();
    audioManager.playGameOver();

    // Reset overlay vignettes
    const container = document.getElementById('game-container');
    if (container) {
      container.classList.remove('freeze-active');
      container.classList.remove('frenzy-active');
    }

    // Set screen stats
    document.getElementById('go-score').textContent = this.score.toLocaleString();
    document.getElementById('go-accuracy').textContent = `${this.getAccuracy()}%`;
    document.getElementById('go-combo').textContent = `${this.maxComboReached}x`;
    document.getElementById('go-fruits').textContent = this.slicedCount;

    // Check high score entry condition
    screenManager.setupNameEntry(this.score, this.getAccuracy());
    
    screenManager.showScreen('game-over-screen');
    
    this.lastInteractionTime = performance.now(); // reset idle timer
  }

  enterAttractMode() {
    this.state = 'attract';
    audioManager.stopMusic();
    screenManager.showScreen('attract-screen');
    this.entities = [];
    this.lastSpawnTime = performance.now();
  }

  exitAttractMode() {
    this.state = 'menu';
    screenManager.showScreen('main-menu');
    this.lastInteractionTime = performance.now();
  }

  // --- GAMEPLAY TRIGGERS ---

  updateHUD() {
    document.getElementById('hud-score').textContent = this.score.toLocaleString();
    document.getElementById('hud-sliced').textContent = this.slicedCount.toString();
    document.getElementById('hud-accuracy').textContent = `${this.getAccuracy()}%`;
    document.getElementById('hud-highscore').textContent = Math.max(this.highScore, this.score).toLocaleString();
    
    const timerEl = document.getElementById('hud-time');
    if (timerEl) {
      timerEl.textContent = Math.ceil(Math.max(0, this.timeRemaining || 0)).toString();
    }

    // Hearts visual rendering
    const hearts = document.querySelectorAll('.hud-lives .heart');
    hearts.forEach((heart, index) => {
      if (index < this.lives) {
        heart.classList.add('active');
      } else {
        heart.classList.remove('active');
      }
    });
  }

  getAccuracy() {
    const total = this.slicedCount + this.missedCount;
    if (total === 0) return 100;
    return Math.round((this.slicedCount / total) * 100);
  }

  // --- DETECTING HAND UPDATES & INTERACTIONS ---

  handleHandTrackingUpdate(coords, landmarks, isFist) {
    const time = performance.now();
    this.lastInteractionTime = time; // player is present!

    if (isFist && this.state === 'playing') {
      if (!this.fistStartTime) this.fistStartTime = time;
      else if (time - this.fistStartTime > 800) {
        this.fistStartTime = null;
        this.endGame();
      }
    } else {
      this.fistStartTime = null;
    }

    // Clear webcam raise hand prompts
    const prompt = document.getElementById('webcam-prompt');
    const dot = document.querySelector('.tracking-dot');
    
    if (coords) {
      prompt.classList.remove('active');
      dot.classList.add('tracking');
      
      // Update interactive neon trail
      if (this.state === 'playing') {
        physicsEngine.updateTrail(coords, this.width, this.height);
      }
    } else {
      prompt.classList.add('active');
      dot.classList.remove('tracking');
      
      if (this.state === 'playing') {
        physicsEngine.updateTrail(null, this.width, this.height);
      }
    }
  }

  setupMouseFallback() {
    const onMove = (e) => {
      this.lastInteractionTime = performance.now();
      
      // Only use mouse coordinates if webcam has no detected hands
      if (handTracker.handDetected) return;

      const normX = e.clientX / this.width;
      const normY = e.clientY / this.height;
      this.mouseCoords = { x: normX, y: normY };

      if (this.state === 'playing' && this.isMouseSlicing) {
        physicsEngine.updateTrail(this.mouseCoords, this.width, this.height);
      }
    };

    window.addEventListener('mousedown', () => {
      this.isMouseSlicing = true;
      audioManager.unlock(); // unlock audio context on click
    });

    window.addEventListener('mouseup', () => {
      this.isMouseSlicing = false;
      if (!handTracker.handDetected && this.state === 'playing') {
        physicsEngine.updateTrail(null, this.width, this.height);
      }
    });

    window.addEventListener('mousemove', onMove);
  }

  // --- ENTITY SPAWNING (DIFFICULTY INCR) ---

  spawnObjects(time) {
    if (this.frenzyTimeRemaining > 0) {
      // Frenzy Mode: Spawns 2 to 3 fruits rapidly, no bombs
      const fruitCount = randomInt(2, 3);
      for (let i = 0; i < fruitCount; i++) {
        const fruit = new Fruit(this.width, this.height);
        fruit.vx *= this.baseSpeedFactor * 1.1;
        fruit.vy *= this.baseSpeedFactor * 1.1;
        this.entities.push(fruit);
      }
      return;
    }

    // Determine spawn parameters based on difficulty level
    const maxFruits = Math.min(4, Math.floor(1 + this.difficultyLevel * 0.45));
    const fruitCount = randomInt(1, maxFruits);
    
    for (let i = 0; i < fruitCount; i++) {
      // Spawn Bomb vs Fruit
      const isBomb = Math.random() < this.bombProbability;
      if (isBomb) {
        this.entities.push(new Bomb(this.width, this.height));
      } else {
        // 7% chance to spawn a Power-Up fruit
        const spawnPowerUp = Math.random() < 0.07;
        if (spawnPowerUp) {
          const type = Math.random() < 0.5 ? 'FREEZE_BANANA' : 'FRENZY_PINEAPPLE';
          this.entities.push(new Fruit(this.width, this.height, type));
        } else {
          const fruit = new Fruit(this.width, this.height);
          // Add difficulty speed scaling
          fruit.vx *= this.baseSpeedFactor;
          fruit.vy *= this.baseSpeedFactor;
          this.entities.push(fruit);
        }
      }
    }
  }

  spawnAttractDemoObjects() {
    // Spawn demo fruit to slice automatically in attract screen
    const f = new Fruit(this.width, this.height);
    f.vy *= 0.85; // slower float
    this.entities.push(f);
  }

  scaleDifficulty() {
    this.difficultyLevel++;
    this.baseSpeedFactor = 1.0 + (this.difficultyLevel - 1) * 0.02;
    this.spawnInterval = Math.max(750, 1600 - (this.difficultyLevel - 1) * 120);
    // Keep bomb scaling 50% lower to optimize for high exhibition satisfaction
    this.bombProbability = Math.min(0.18, 0.04 + (this.difficultyLevel - 1) * 0.018);

    // Toast level up popup on HUD
    particleSystem.spawnText(
      this.width / 2,
      this.height * 0.4,
      `LEVEL ${this.difficultyLevel} — FASTER FRUITS!`,
      '#ffb800',
      true
    );
    audioManager.playVictory();
  }

  // --- GAME UPDATE & RENDERING PIPELINES ---

  loop() {
    const time = performance.now();
    const dt = this.lastTime ? time - this.lastTime : 16.66;
    this.lastTime = time;

    // 1. Draw floating background stars always
    this.drawBgStars();

    // 2. Main Game state updates
    if (this.state === 'playing') {
      this.updatePlayingState(time, dt);
    } else if (this.state === 'attract') {
      this.updateAttractState(time, dt);
    } else if (this.state === 'countdown') {
      // Just keep rendering any remnants / trails
      this.ctx.clearRect(0, 0, this.width, this.height);
    } else {
      // Menu / Game Over
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.checkExhibitionIdleTimeouts(time);
    }

    requestAnimationFrame(() => this.loop());
  }

  updatePlayingState(time, dt) {
    this.timeRemaining -= dt / 1000;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      return;
    }

    // Update Power-Up timers
    if (this.freezeTimeRemaining > 0) {
      this.freezeTimeRemaining -= dt;
      if (this.freezeTimeRemaining <= 0) {
        document.getElementById('game-container')?.classList.remove('freeze-active');
      }
    }
    if (this.frenzyTimeRemaining > 0) {
      this.frenzyTimeRemaining -= dt;
      if (this.frenzyTimeRemaining <= 0) {
        document.getElementById('game-container')?.classList.remove('frenzy-active');
      }
    }

    // Apply slow motion to physics update if freeze mode is active
    const physicsDt = this.freezeTimeRemaining > 0 ? dt * 0.3 : dt;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Apply Camera Shake offset
    if (this.shakeIntensity > 0.1) {
      this.ctx.save();
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
      this.shakeIntensity *= this.shakeDecay;
    }

    // Difficulty Scaler Check
    if (time - this.difficultyTimer > this.difficultyInterval) {
      this.scaleDifficulty();
      this.difficultyTimer = time;
    }

    // Spawn Object Check
    const currentSpawnInterval = this.frenzyTimeRemaining > 0 ? 400 : this.spawnInterval;
    if (time - this.lastSpawnTime > currentSpawnInterval) {
      this.spawnObjects(time);
      this.lastSpawnTime = time;
    }

    // Update Entities
    this.entities.forEach(obj => obj.update(physicsDt));

    // Check collisions via hand/mouse trail
    const sliced = physicsEngine.checkCollisions(this.entities, this.width, this.height);
    if (sliced.length > 0) {
      this.handleSlices(sliced);
    }

    // Process combo group timings
    this.updateCombos(time);

    // Filter off-screen / expired items
    this.entities.forEach(obj => {
      if (!obj.sliced && obj.isOutOfBounds && obj.isOutOfBounds() && obj instanceof Fruit) {
        // Missing a fruit costs score deduction
        this.missedCount++;
        const prevScore = this.score;
        this.score = Math.max(0, this.score - 50);
        this.updateHUD();

        // Missed text alert
        particleSystem.spawnText(obj.x, this.height - 50, "-50 MISS", "#ff0055");
        
        // Reset combo list
        this.comboList = [];
      }
    });

    this.entities = this.entities.filter(obj => !obj.isOutOfBounds());

    // Draw Entities
    this.entities.forEach(obj => obj.draw(this.ctx));

    // Draw sword neon trail
    const comboDisplayCount = Math.max(0, this.comboList.length);
    physicsEngine.drawTrail(this.ctx, comboDisplayCount);

    // Update & draw Particles
    particleSystem.update();
    particleSystem.draw(this.ctx);

    if (this.shakeIntensity > 0.1) {
      this.ctx.restore();
    }

    this.updateHUD();
    
    // Exhibition idle tracker
    this.checkExhibitionIdleTimeouts(time);
  }

  updateAttractState(time, dt) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Automatically spawn demo fruits
    if (time - this.lastSpawnTime > 2000) {
      this.spawnAttractDemoObjects();
      this.lastSpawnTime = time;
    }

    // Update demo items
    this.entities.forEach(obj => obj.update(dt));

    // Simulated auto-slice pathing to attract audiences!
    // Every now and then, find a floaty fruit and draw a simulated line slicing through it.
    if (this.entities.length > 0 && Math.random() < 0.015) {
      const target = this.entities.find(e => !e.sliced && e.y < this.height * 0.6);
      if (target) {
        // Draw auto slicing sparks and split
        const angle = randomRange(-Math.PI/4, Math.PI/4);
        target.slice(angle);
        
        audioManager.playSlice();
        particleSystem.spawnJuiceSplash(target.x, target.y, target.juiceColor);
        if (target.typeKey === 'WATERMELON' || target.typeKey === 'KIWI') {
          particleSystem.spawnSeeds(target.x, target.y, 6);
        }
        particleSystem.spawnText(target.x, target.y - 20, "COME TRY AI!", "#00f0ff", false);
      }
    }

    // Filter out of bounds demo fruits
    this.entities = this.entities.filter(obj => !obj.isOutOfBounds());

    // Render demo fruits
    this.entities.forEach(obj => obj.draw(this.ctx));

    // Update & draw particles
    particleSystem.update();
    particleSystem.draw(this.ctx);
  }

  // --- HANDLE SLICES & COMBOS ---

  handleSlices(slicedObjects) {
    const time = performance.now();
    this.lastInteractionTime = time;

    slicedObjects.forEach(obj => {
      if (obj instanceof Bomb) {
        // BOOM!
        obj.triggerExplosion();
        this.bombsHitCount++;
        this.lives--;
        this.shakeIntensity = 25; // camera shake

        audioManager.playExplosion();
        particleSystem.spawnBombExplosion(obj.x, obj.y);
        
        // Reset combo
        this.comboList = [];

        this.updateHUD();

        if (this.lives <= 0) {
          this.endGame();
        }
      } else if (obj instanceof Fruit) {
        // Slice fruit
        const speed = physicsEngine.getSliceVelocity();
        // Calculate tangent sword slice angle
        const trail = physicsEngine.trail;
        let sliceAngle = 0;
        let sliceOffset = 0;
        if (trail.length >= 2) {
          const p1 = trail[trail.length - 2];
          const p2 = trail[trail.length - 1];
          sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          
          // Calculate perpendicular distance from fruit center to the cut line
          const num = (p2.x - p1.x) * (p1.y - obj.y) - (p1.x - obj.x) * (p2.y - p1.y);
          const den = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (den !== 0) {
            sliceOffset = num / den;
            // Clamp offset so the fruit always splits into two visible pieces, even on edge grazes
            const maxOffset = obj.radius * 0.9;
            sliceOffset = Math.max(-maxOffset, Math.min(maxOffset, sliceOffset));
          }
        }

        obj.slice(sliceAngle, sliceOffset);
        this.slicedCount++;

        // Handle Power-Up trigger if applicable
        if (obj.config.isPowerUp) {
          if (obj.config.powerUpType === 'freeze') {
            this.freezeTimeRemaining = 5000;
            this.frenzyTimeRemaining = 0;
            document.getElementById('game-container')?.classList.remove('frenzy-active');
            document.getElementById('game-container')?.classList.add('freeze-active');
            audioManager.playVictory();
            particleSystem.spawnText(obj.x, obj.y - 45, "FREEZE TIME!", "#00f0ff", true);
          } else if (obj.config.powerUpType === 'frenzy') {
            this.frenzyTimeRemaining = 5000;
            this.freezeTimeRemaining = 0;
            document.getElementById('game-container')?.classList.remove('freeze-active');
            document.getElementById('game-container')?.classList.add('frenzy-active');
            audioManager.playVictory();
            particleSystem.spawnText(obj.x, obj.y - 45, "FRUIT FRENZY!", "#ffaa00", true);
          }
        }

        // Add to combo window tally
        this.comboList.push({ obj, time });
        this.comboTimer = time; // reset timer

        audioManager.playSlice();
        
        // Particle feedback
        particleSystem.spawnJuiceSplash(obj.x, obj.y, obj.juiceColor);
        if (obj.typeKey === 'WATERMELON' || obj.typeKey === 'KIWI' || obj.typeKey === 'DRAGON_FRUIT') {
          particleSystem.spawnSeeds(obj.x, obj.y, 8);
        }
      }
    });
  }

  updateCombos(time) {
    if (this.comboList.length > 0 && (time - this.comboTimer) > this.comboDuration) {
      const count = this.comboList.length;
      
      if (count >= 2) {
        // Multiplier scaling
        let multiplier = 2;
        let comboText = "DOUBLE SLICE!";
        let comboColor = "#ff007a"; // pink

        if (count >= 10) {
          multiplier = 10;
          comboText = "LEGENDARY SLASH!";
          comboColor = "#00ffff"; // cyan rainbow
        } else if (count >= 8) {
          multiplier = 8;
          comboText = "NINJA COMBO!";
          comboColor = "#ff00ff"; // purple
        } else if (count >= 5) {
          multiplier = 5;
          comboText = "FRUIT MASTER!";
          comboColor = "#ffb800"; // gold
        } else if (count >= 3) {
          multiplier = 3;
          comboText = "TRIPLE COMBO!";
          comboColor = "#bd00ff"; // violet
        }

        const comboPoints = count * 100 * multiplier;
        this.score += comboPoints;

        // Peak combo records
        if (count > this.maxComboReached) {
          this.maxComboReached = count;
        }

        // Trigger visual alerts on HUD
        const comboAlert = document.getElementById('hud-combo-alert');
        const comboCountText = document.getElementById('hud-combo-count');
        const comboTitleText = comboAlert.querySelector('.combo-title');

        comboTitleText.textContent = comboText;
        comboCountText.textContent = `+${comboPoints.toLocaleString()}`;
        comboCountText.style.textShadow = `0 0 10px ${comboColor}`;
        
        comboAlert.classList.add('active');
        audioManager.playCombo(count);

        // Spawn combo text popup right above last sliced position
        const lastSlice = this.comboList[this.comboList.length - 1].obj;
        particleSystem.spawnText(lastSlice.x, lastSlice.y - 30, comboText, comboColor, true);

        // Hide combo HUD after delay
        setTimeout(() => {
          comboAlert.classList.remove('active');
        }, 1200);

      } else {
        // Single slice score
        this.score += 100;
        const lastSlice = this.comboList[0].obj;
        particleSystem.spawnText(lastSlice.x, lastSlice.y - 20, "+100", "#00f0ff");
      }

      // Reset list
      this.comboList = [];
    }
  }

  // --- BACKGROUND PARTICLES RENDERING ---

  drawBgStars() {
    const ctx = this.bgCtx;
    const canvas = this.bgCanvas;

    const isLightMode = document.documentElement.classList.contains('light-mode');

    ctx.fillStyle = isLightMode ? '#f0f2f8' : '#070913';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.bgStars.forEach(star => {
      // Floating motion upwards
      star.y -= star.speed;
      if (star.y < -10) {
        star.y = canvas.height + 10;
        star.x = Math.random() * canvas.width;
      }

      // Glow pulse oscillation
      star.alpha += star.pulseRate;
      if (star.alpha > 0.95 || star.alpha < 0.15) {
        star.pulseRate = -star.pulseRate;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, star.alpha);
      ctx.shadowBlur = isLightMode ? 2 : 8;
      ctx.shadowColor = isLightMode ? 'rgba(0,0,0,0.1)' : star.glowColor;
      ctx.fillStyle = isLightMode ? '#78909c' : '#ffffff';

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  // --- EXHIBITION TIMEOUT MECHANISMS ---

  checkExhibitionIdleTimeouts(time) {
    const idleTime = time - this.lastInteractionTime;

    if (this.state === 'playing') {
      // If playing, we don't force return (user is active)
      return;
    }

    if (this.state === 'gameover') {
      // Auto return to attract screen after 15 seconds of idle in GameOver screen
      if (idleTime > this.gameOverTimeout) {
        this.enterAttractMode();
      }
    } else {
      // If in menus (Main Menu, Settings, Leaderboard, etc.) and idle for 30 seconds
      if (this.state !== 'attract' && idleTime > this.idleTimeout) {
        this.enterAttractMode();
      }
    }
  }
}

const gameEngine = new GameEngine();
export default gameEngine;
