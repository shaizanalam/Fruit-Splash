import audioManager from '../audio/audioManager.js';
import leaderboard from './leaderboard.js';
import settingsManager from './settings.js';
import handTracker from '../mediaPipe/handTracker.js';

class ScreenManager {
  constructor() {
    this.currentScreen = 'loading-screen';
    this.gameEngine = null;
    this.practiceCanvas = null;
    this.practiceCtx = null;
    this.practiceTrails = new Map();
  }

  init(gameEngine) {
    this.gameEngine = gameEngine;
    
    // Wire all button audio cues
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        audioManager.playHover();
      });
      btn.addEventListener('click', () => {
        audioManager.playClick();
      });
    });

    // Start Game
    document.getElementById('btn-start').addEventListener('click', () => {
      this.gameEngine.startGame();
    });

    // Leaderboard Screen
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
      leaderboard.renderLeaderboard();
      this.showScreen('leaderboard-screen');
    });
    document.getElementById('btn-leaderboard-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // Settings Screen
    document.getElementById('btn-settings').addEventListener('click', () => {
      settingsManager.populateCameras();
      this.showScreen('settings-screen');
    });
    document.getElementById('btn-settings-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // How to Play Screen
    document.getElementById('btn-how-to').addEventListener('click', () => {
      this.showScreen('how-to-play-screen');
      this.initPracticeCanvas();
    });
    document.getElementById('btn-howto-back').addEventListener('click', () => {
      this.stopPracticeCanvas();
      this.showScreen('main-menu');
    });

    // Game Over Buttons
    document.getElementById('btn-gameover-menu').addEventListener('click', () => {
      this.showScreen('main-menu');
    });
    document.getElementById('btn-gameover-restart').addEventListener('click', () => {
      this.gameEngine.startGame();
    });

    // Name Entry Submission
    document.getElementById('btn-submit-score').addEventListener('click', () => {
      this.submitHighScore();
    });
    document.getElementById('player-name-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.submitHighScore();
      }
    });

    // Attract Screen (clicking anywhere exits attract mode)
    document.getElementById('attract-screen').addEventListener('click', () => {
      audioManager.playClick();
      this.gameEngine.exitAttractMode();
    });
  }

  showScreen(screenId) {
    this.currentScreen = screenId;
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen-overlay');
    screens.forEach(s => s.classList.add('hidden'));

    // Show target screen
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.remove('hidden');
    }

    // Toggle HUD display
    const hud = document.getElementById('hud');
    if (screenId === 'game-play') {
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }

    // Handle webcam panel visibility
    const webcam = document.getElementById('webcam-panel');
    if (screenId === 'loading-screen') {
      webcam.style.display = 'none';
    } else {
      webcam.style.display = 'flex';
    }

    // Reset game over input
    if (screenId !== 'game-over-screen') {
      document.getElementById('name-entry-container').classList.remove('active');
      document.getElementById('player-name-input').value = '';
    }
  }

  // --- LEADERBOARD SCORE SUBMISSION ---
  setupNameEntry(score, accuracy) {
    const entryContainer = document.getElementById('name-entry-container');
    
    if (leaderboard.checkHighScore(score) && score > 0) {
      entryContainer.classList.add('active');
      setTimeout(() => {
        document.getElementById('player-name-input').focus();
      }, 500);
    } else {
      entryContainer.classList.remove('active');
    }
  }

  submitHighScore() {
    const input = document.getElementById('player-name-input');
    const name = input.value.trim();
    if (!name) return;

    const finalScore = this.gameEngine.score;
    const finalAccuracy = this.gameEngine.getAccuracy();

    leaderboard.addScore(name, finalScore, finalAccuracy);
    audioManager.playVictory();
    
    document.getElementById('name-entry-container').classList.remove('active');
    leaderboard.renderLeaderboard();
    this.showScreen('leaderboard-screen');
  }

  // --- PRACTICE CANVAS PLAYGROUND ---
  initPracticeCanvas() {
    this.practiceCanvas = document.getElementById('practice-canvas');
    this.practiceCtx = this.practiceCanvas.getContext('2d');
    
    this.practiceCanvas.width = this.practiceCanvas.offsetWidth || 500;
    this.practiceCanvas.height = this.practiceCanvas.offsetHeight || 160;

    this.practiceTrails = new Map();
    this.practiceActive = true;

    // Mouse draw in practice area
    const onMove = (e) => {
      if (!this.practiceActive) return;
      const rect = this.practiceCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      let t = this.practiceTrails.get('mouse');
      if (!t) {
        t = [];
        this.practiceTrails.set('mouse', t);
      }
      t.push({ x, y, time: performance.now() });
    };

    this.practiceCanvas.addEventListener('mousemove', onMove);
    
    // Multi-finger tracking in practice area
    this.handTrackListener = (coords, landmarks, isFist, extendedCutters) => {
      if (!this.practiceActive || !coords) return;
      const time = performance.now();
      const cutters = coords.cutters && coords.cutters.length > 0 
        ? coords.cutters 
        : [{ id: 'primary', x: coords.x, y: coords.y }];

      for (const c of cutters) {
        const px = c.x * this.practiceCanvas.width;
        const py = c.y * this.practiceCanvas.height;
        let t = this.practiceTrails.get(c.id);
        if (!t) {
          t = [];
          this.practiceTrails.set(c.id, t);
        }
        t.push({ x: px, y: py, time });
      }
    };

    handTracker.addListener(this.handTrackListener);
    this.practiceLoop();
  }

  stopPracticeCanvas() {
    this.practiceActive = false;
    if (this.handTrackListener) {
      handTracker.removeListener(this.handTrackListener);
    }
    this.practiceTrails.clear();
  }

  practiceLoop() {
    if (!this.practiceActive) return;

    const ctx = this.practiceCtx;
    const canvas = this.practiceCanvas;
    const time = performance.now();

    ctx.fillStyle = '#0c0f17';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle dark blueprint grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gridSz = 24;
    for (let x = 0; x < canvas.width; x += gridSz) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSz) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render each active cutter trail
    for (const [id, trail] of this.practiceTrails.entries()) {
      // Decay points
      let i = 0;
      while (i < trail.length && (time - trail[i].time) >= 190) {
        i++;
      }
      if (i > 0) trail.splice(0, i);

      if (trail.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Blade aura
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#38bdf8';
        ctx.strokeStyle = '#38bdf8';
        
        for (let j = 1; j < trail.length; j++) {
          const p1 = trail[j - 1];
          const p2 = trail[j];
          const ratio = j / trail.length;
          ctx.lineWidth = 6 * ratio;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        // White core
        ctx.shadowBlur = 3;
        ctx.strokeStyle = '#ffffff';
        for (let j = 1; j < trail.length; j++) {
          const p1 = trail[j - 1];
          const p2 = trail[j];
          const ratio = j / trail.length;
          ctx.lineWidth = 2 * ratio;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    requestAnimationFrame(() => this.practiceLoop());
  }
}

const screenManager = new ScreenManager();
export default screenManager;
