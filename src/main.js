import './styles/index.css';
import gameEngine from './game/gameEngine.js';
import handTracker from './mediaPipe/handTracker.js';
import settingsManager from './ui/settings.js';
import audioManager from './audio/audioManager.js';

// Setup progress-bar increments
function updateLoadingProgress(percent, statusText) {
  const bar = document.getElementById('loading-progress');
  const txt = document.getElementById('loading-status');
  if (bar) bar.style.width = `${percent}%`;
  if (txt) txt.textContent = statusText;
}

async function bootstrap() {
  try {
    // 1. Initializing UI components
    updateLoadingProgress(20, "Setting up interface panels...");
    
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('webcam-canvas');
    
    // 2. Loading MediaPipe Hands from CDN
    updateLoadingProgress(45, "Loading AI Hand Tracking models...");
    await handTracker.init(video, canvas);
    
    // 3. Requesting Webcam Perms & Startup
    updateLoadingProgress(75, "Connecting to webcam device...");
    try {
      await handTracker.startCamera();
    } catch (cameraErr) {
      console.warn("Camera access denied or failed. Falling back to mouse-slicing controls.", cameraErr);
      // We will show a warning alert, but still let them play with mouse
      updateLoadingProgress(80, "No camera found. Falling back to mouse controls...");
    }

    // 4. Initializing audio nodes & settings sliders
    updateLoadingProgress(90, "Configuring synthesized sound boards...");
    settingsManager.init();

    // 5. Instantiating central game coordinators
    updateLoadingProgress(100, "Ready!");
    
    // Slight delay to let progress bar fill smoothly
    setTimeout(() => {
      gameEngine.init();
      
      // Hook audio manager unlock onto general click events
      document.body.addEventListener('click', () => {
        audioManager.unlock();
      }, { once: true });
      
      // Default startup: enter attract screen to hook passing exhibition crowds!
      gameEngine.enterAttractMode();
    }, 400);

  } catch (err) {
    console.error("Critical bootstrap failure: ", err);
    updateLoadingProgress(100, "Error starting application.");
    
    const statusTxt = document.getElementById('loading-status');
    statusTxt.innerHTML = `
      <span style="color: var(--color-pink); font-weight: bold;">FAILED TO INITIALIZE</span><br>
      <span style="font-size: 11px; margin-top: 5px; display: inline-block;">
        ${err.message || 'Check network / webcam permissions and reload.'}
      </span>
    `;
    
    // Stop spinner
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) spinner.style.animation = 'none';
  }
}

// Start application when page is loaded
window.addEventListener('DOMContentLoaded', bootstrap);
