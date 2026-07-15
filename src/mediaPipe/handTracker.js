class HandTracker {
  constructor() {
    this.hands = null;
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    
    this.isTracking = false;
    this.isPlaying = false;
    this.handDetected = false;
    this.lastLandmarks = null;
    this.listeners = [];

    // Configuration
    this.mirror = true;
    this.showDebug = true;
    this.currentDeviceId = '';
  }

  // Set up MediaPipe Hands and verify globals
  async init(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement.getContext('2d');

    return new Promise((resolve, reject) => {
      // Check for MediaPipe CDN scripts
      let retries = 0;
      const checkLibs = setInterval(() => {
        if (window.Hands) {
          clearInterval(checkLibs);
          this.setupMediaPipe();
          resolve();
        } else {
          retries++;
          if (retries > 50) { // 5 seconds timeout
            clearInterval(checkLibs);
            reject(new Error("MediaPipe Hands library failed to load from CDN."));
          }
        }
      }, 100);
    });
  }

  setupMediaPipe() {
    this.hands = new window.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    this.hands.onResults((results) => {
      this.handleResults(results);
    });
  }

  // Register coordinate updates
  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  // Enumerate cameras
  async getCameras() {
    try {
      // Prompt permissions if not already granted so we can get labels
      await navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        s.getTracks().forEach(t => t.stop());
      }).catch(() => {});
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (e) {
      console.warn("Failed to enumerate cameras", e);
      return [];
    }
  }

  // Start webcam feed and frame capture loop
  async startCamera(deviceId = '') {
    this.currentDeviceId = deviceId;
    
    // Stop any existing stream
    this.stopCamera();

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      }
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play();
        this.isPlaying = true;
        this.startCaptureLoop();
      };
    } catch (err) {
      console.error("Error accessing webcam: ", err);
      throw err;
    }
  }

  stopCamera() {
    this.isPlaying = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.handDetected = false;
    this.lastLandmarks = null;
    this.clearCanvas();
  }

  startCaptureLoop() {
    if (!this.isPlaying) return;

    const processFrame = async () => {
      if (!this.isPlaying) return;

      if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA && this.hands) {
        try {
          await this.hands.send({ image: this.videoElement });
        } catch (e) {
          console.warn("MediaPipe processing frame error:", e);
        }
      }

      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  }

  handleResults(results) {
    this.clearCanvas();
    
    // Check if hand is detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.handDetected = true;
      const landmarks = results.multiHandLandmarks[0];
      this.lastLandmarks = landmarks;

      // Extract raw points and translate
      // index finger tip is landmark 8
      const indexTip = landmarks[8];
      const wrist = landmarks[0];
      
      // Interpolate screen coordinate depending on mirroring
      // MediaPipe coordinates: X is 0 (left) to 1 (right), Y is 0 (top) to 1 (bottom)
      // Since video is mirrored by default, if mirror is true, standard webcam is already mirrored,
      // and we want X mapping to canvas. Let's calculate:
      let normX = indexTip.x;
      if (this.mirror) {
        // Since video is scaled mirror, indexTip.x should match screen coordinates.
        // MediaPipe detects on video coordinates. X = 0 is left of video, but since we mirror
        // standard canvas, the screen coordinates should match.
        // If we mirror the video feed with CSS scaleX(-1), the left of the image is shown on the right.
        // So a hand on the left of the screen is on the right of the raw video, i.e., indexTip.x is ~0.9.
        // To slice on canvas (which is not mirrored), we want x coordinates to map 1:1.
        // If hand is on screen-left, we want canvas x close to 0.
        // In mirrored video feed, screen-left = video-right (x ~ 1). So canvas x = 1 - indexTip.x.
        normX = 1 - indexTip.x;
      } else {
        normX = indexTip.x;
      }
      
      const screenCoords = {
        x: normX,
        y: indexTip.y,
        z: indexTip.z,
        rawX: indexTip.x,
        rawY: indexTip.y
      };

      // Fist detection logic
      let isFist = true;
      const fingerTips = [8, 12, 16, 20];
      const fingerMcps = [5, 9, 13, 17];
      
      const getDist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      
      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const mcp = landmarks[fingerMcps[i]];
        // In a fist, fingertips are curled in, so their distance to the wrist is less than or similar to the MCP's distance
        if (getDist(tip, wrist) > getDist(mcp, wrist) * 1.1) {
          isFist = false;
          break;
        }
      }

      // Notify listeners
      for (const listener of this.listeners) {
        listener(screenCoords, landmarks, isFist);
      }

      // Draw debug skeleton if active
      if (this.showDebug) {
        this.drawSkeleton(landmarks);
      }
    } else {
      this.handDetected = false;
      this.lastLandmarks = null;
      for (const listener of this.listeners) {
        listener(null, null, false);
      }
    }
  }

  clearCanvas() {
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  drawSkeleton(landmarks) {
    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    // Define connection pairs
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm width
    ];

    // Setup style
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4;

    // Draw connection lines
    connections.forEach(([i, j]) => {
      const pt1 = landmarks[i];
      const pt2 = landmarks[j];

      // Mirror coordinates if active
      const x1 = (this.mirror ? (1 - pt1.x) : pt1.x) * width;
      const y1 = pt1.y * height;
      const x2 = (this.mirror ? (1 - pt2.x) : pt2.x) * width;
      const y2 = pt2.y * height;

      // Create glowing gradient
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#bd00ff'); // purple
      grad.addColorStop(1, '#00f0ff'); // cyan

      ctx.strokeStyle = grad;
      ctx.shadowColor = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Draw landmark joints
    landmarks.forEach((landmark, index) => {
      const x = (this.mirror ? (1 - landmark.x) : landmark.x) * width;
      const y = landmark.y * height;

      ctx.beginPath();
      ctx.arc(x, y, index === 8 ? 6 : 4, 0, 2 * Math.PI);
      
      if (index === 8) {
        // Glowing Index Tip
        ctx.fillStyle = '#ff007a';
        ctx.shadowColor = '#ff007a';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#bd00ff';
        ctx.shadowBlur = 4;
      }
      
      ctx.fill();
    });

    ctx.shadowBlur = 0; // reset shadow
  }
}

const handTracker = new HandTracker();
export default handTracker;
