import audioManager from '../audio/audioManager.js';
import leaderboard from './leaderboard.js';
import settingsManager from './settings.js';
import handTracker from '../mediaPipe/handTracker.js';

class ScreenManager {
  constructor() {
    this.currentScreen = 'loading-screen';
    this.gameEngine = null; // injected later to prevent circular dependencies
    this.practiceCanvas = null;
    this.practiceCtx = null;
    this.practiceTrail = [];
  }

  init(gameEngine) {
    this.gameEngine = gameEngine;
    
    // Wire all button hover/click audio effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        audioManager.playHover();
      });
      btn.addEventListener('click', () => {
        audioManager.playClick();
      });
    });

    // --- BUTTON BINDINGS ---
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

    // Attract Screen (clicking anywhere exits attract mode and goes home)
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

    // Toggle HUD display (only active on play screen / game engine canvas)
    const hud = document.getElementById('hud');
    if (screenId === 'game-play') {
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }

    // Handle webcam panel positioning or visibility
    const webcam = document.getElementById('webcam-panel');
    if (screenId === 'loading-screen') {
      webcam.style.display = 'none';
    } else {
      webcam.style.display = 'flex';
    }

    // Reset game over forms
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
    
    // Hide name container
    document.getElementById('name-entry-container').classList.remove('active');
    
    // Navigate straight to leaderboard to display new placement
    leaderboard.renderLeaderboard();
    this.showScreen('leaderboard-screen');
  }

  // --- PRACTICE CANVAS PLAYGROUND ---
  initPracticeCanvas() {
    this.practiceCanvas = document.getElementById('practice-canvas');
    this.practiceCtx = this.practiceCanvas.getContext('2d');
    
    // Sync canvas resolution
    this.practiceCanvas.width = this.practiceCanvas.offsetWidth;
    this.practiceCanvas.height = this.practiceCanvas.offsetHeight;

    this.practiceTrail = [];
    this.practiceActive = true;

    // Hook mouse backup draw events in practice area
    const onMove = (e) => {
      if (!this.practiceActive) return;
      const rect = this.practiceCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.practiceTrail.push({ x, y, time: performance.now() });
    };

    this.practiceCanvas.addEventListener('mousemove', onMove);
    
    // Register webcam feed updates onto practice canvas as well
    this.handTrackListener = (coords) => {
      if (!this.practiceActive || !coords) return;
      // Coordinates are normalized 0..1, map to practice canvas dimensions
      const px = coords.x * this.practiceCanvas.width;
      const py = coords.y * this.practiceCanvas.height;
      this.practiceTrail.push({ x: px, y: py, time: performance.now() });
    };

    handTracker.addListener(this.handTrackListener);

    // Start practice loop
    this.practiceLoop();
  }

  stopPracticeCanvas() {
    this.practiceActive = false;
    if (this.handTrackListener) {
      handTracker.removeListener(this.handTrackListener);
    }
  }

  practiceLoop() {
    if (!this.practiceActive) return;

    const ctx = this.practiceCtx;
    const canvas = this.practiceCanvas;
    const time = performance.now();

    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines inside practice canvas
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSz = 20;
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

    // Decay trail points older than 180ms
    this.practiceTrail = this.practiceTrail.filter(pt => (time - pt.time) < 180);

    // Draw glowing neon trail on practice area
    if (this.practiceTrail.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Purple glow layer
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#bd00ff';
      ctx.strokeStyle = '#bd00ff';
      
      for (let i = 1; i < this.practiceTrail.length; i++) {
        const p1 = this.practiceTrail[i - 1];
        const p2 = this.practiceTrail[i];
        const ratio = i / this.practiceTrail.length;
        ctx.lineWidth = 8 * ratio;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // White inner core
      ctx.shadowBlur = 2;
      ctx.strokeStyle = '#ffffff';
      for (let i = 1; i < this.practiceTrail.length; i++) {
        const p1 = this.practiceTrail[i - 1];
        const p2 = this.practiceTrail[i];
        const ratio = i / this.practiceTrail.length;
        ctx.lineWidth = 2 * ratio;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Instruction prompt
    ctx.font = '10px "Orbitron"';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText("SWIPE YOUR HAND/MOUSE HERE TO PRACTICE", canvas.width / 2, canvas.height / 2);

    requestAnimationFrame(() => this.practiceLoop());
  }
}

const screenManager = new ScreenManager();
export default screenManager;
