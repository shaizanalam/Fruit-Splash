import audioManager from '../audio/audioManager.js';
import handTracker from '../mediaPipe/handTracker.js';

class SettingsManager {
  constructor() {
    this.musicSlider = null;
    this.sfxSlider = null;
    this.cameraSelect = null;
    this.mirrorCheck = null;
    this.debugCheck = null;
    this.lightModeCheck = null;
  }

  init() {
    this.musicSlider = document.getElementById('slider-music');
    this.sfxSlider = document.getElementById('slider-sfx');
    this.cameraSelect = document.getElementById('select-camera');
    this.mirrorCheck = document.getElementById('check-mirror');
    this.debugCheck = document.getElementById('check-debug');
    this.lightModeCheck = document.getElementById('check-lightmode');

    // 1. Music Volume Slider
    const musicVal = document.getElementById('music-vol-value');
    this.musicSlider.value = audioManager.musicVolume;
    musicVal.textContent = `${Math.round(audioManager.musicVolume * 100)}%`;

    this.musicSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      audioManager.setMusicVolume(val);
      musicVal.textContent = `${Math.round(val * 100)}%`;
    });

    // 2. SFX Volume Slider
    const sfxVal = document.getElementById('sfx-vol-value');
    this.sfxSlider.value = audioManager.sfxVolume;
    sfxVal.textContent = `${Math.round(audioManager.sfxVolume * 100)}%`;

    this.sfxSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      audioManager.setSfxVolume(val);
      sfxVal.textContent = `${Math.round(val * 100)}%`;
      audioManager.playHover(); // play soft hover click for sound confirmation
    });

    // 3. Mirror toggle
    this.mirrorCheck.checked = handTracker.mirror;
    this.mirrorCheck.addEventListener('change', (e) => {
      const checked = e.target.checked;
      handTracker.mirror = checked;
      const video = document.getElementById('webcam-video');
      if (checked) {
        video.classList.remove('no-mirror');
      } else {
        video.classList.add('no-mirror');
      }
    });

    // 4. Debug skeleton overlay toggle
    this.debugCheck.checked = handTracker.showDebug;
    this.debugCheck.addEventListener('change', (e) => {
      handTracker.showDebug = e.target.checked;
    });

    // 4b. Light Theme Toggle
    const isLightMode = localStorage.getItem('fruitslash_lightmode') === 'true';
    this.lightModeCheck.checked = isLightMode;
    this.lightModeCheck.addEventListener('change', (e) => {
      const checked = e.target.checked;
      if (checked) {
        document.documentElement.classList.add('light-mode');
      } else {
        document.documentElement.classList.remove('light-mode');
      }
      localStorage.setItem('fruitslash_lightmode', checked ? 'true' : 'false');
    });

    // 5. Camera dropdown selection
    this.cameraSelect.addEventListener('change', async (e) => {
      const deviceId = e.target.value;
      try {
        await handTracker.startCamera(deviceId);
      } catch (err) {
        alert("Failed to switch camera. Check permission permissions.");
      }
    });

    // Populate camera list
    this.populateCameras();
  }

  async populateCameras() {
    try {
      const cameras = await handTracker.getCameras();
      
      // Clear select options (keep default/first)
      this.cameraSelect.innerHTML = '';
      
      if (cameras.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Default Camera';
        this.cameraSelect.appendChild(opt);
        return;
      }

      cameras.forEach((camera, index) => {
        const opt = document.createElement('option');
        opt.value = camera.deviceId;
        opt.textContent = camera.label || `Camera ${index + 1}`;
        if (handTracker.currentDeviceId === camera.deviceId) {
          opt.selected = true;
        }
        this.cameraSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn("Could not load camera list into settings selector", e);
    }
  }
}

const settingsManager = new SettingsManager();
export default settingsManager;
