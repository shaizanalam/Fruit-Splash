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

    // Active cutters state
    this.activeCutters = [];
  }

  // Set up MediaPipe Hands and verify globals
  async init(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement.getContext('2d');

    return new Promise((resolve, reject) => {
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
      modelComplexity: 1, // Higher accuracy tracking
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    this.hands.onResults((results) => {
      this.handleResults(results);
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  async getCameras() {
    try {
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

  async startCamera(deviceId = '') {
    this.currentDeviceId = deviceId;
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
    this.activeCutters = [];
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

  // Detect which fingers are extended and calculate their cutter positions
  detectFingers(landmarks) {
    const wrist = landmarks[0];
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    const fingersDef = [
      { id: 'thumb', name: 'Thumb', tip: 4, ip: 3, mcp: 2, ref: 17 },
      { id: 'index', name: 'Index', tip: 8, pip: 6, mcp: 5 },
      { id: 'middle', name: 'Middle', tip: 12, pip: 10, mcp: 9 },
      { id: 'ring', name: 'Ring', tip: 16, pip: 14, mcp: 13 },
      { id: 'pinky', name: 'Pinky', tip: 20, pip: 18, mcp: 17 }
    ];

    const extendedCutters = [];

    // Thumb extension check: tip is spread outward from palm and further from pinky MCP
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbMcp = landmarks[2];
    const pinkyMcp = landmarks[17];
    const thumbDistToPinky = dist(thumbTip, pinkyMcp);
    const thumbMcpToPinky = dist(thumbMcp, pinkyMcp);
    const thumbTipToWrist = dist(thumbTip, wrist);
    const thumbIpToWrist = dist(thumbIp, wrist);
    const isThumbExtended = thumbDistToPinky > thumbMcpToPinky * 1.15 && thumbTipToWrist > thumbIpToWrist * 1.05;

    if (isThumbExtended) {
      const normX = this.mirror ? (1 - thumbTip.x) : thumbTip.x;
      extendedCutters.push({
        id: 'thumb',
        name: 'Thumb',
        x: normX,
        y: thumbTip.y,
        z: thumbTip.z,
        rawX: thumbTip.x,
        rawY: thumbTip.y,
        tipIndex: 4
      });
    }

    // Four fingers extension check
    const otherFingers = fingersDef.slice(1);
    for (const f of otherFingers) {
      const tip = landmarks[f.tip];
      const pip = landmarks[f.pip];
      const mcp = landmarks[f.mcp];

      const tipToWrist = dist(tip, wrist);
      const pipToWrist = dist(pip, wrist);
      const tipToMcp = dist(tip, mcp);
      const pipToMcp = dist(pip, mcp);

      // Extended if tip is clearly further from wrist and MCP than the PIP joint
      const isExtended = tipToWrist > pipToWrist * 1.12 && tipToMcp > pipToMcp * 1.1;

      if (isExtended) {
        const normX = this.mirror ? (1 - tip.x) : tip.x;
        extendedCutters.push({
          id: f.id,
          name: f.name,
          x: normX,
          y: tip.y,
          z: tip.z,
          rawX: tip.x,
          rawY: tip.y,
          tipIndex: f.tip
        });
      }
    }

    // Fist check: all 4 fingers curled in
    const isFist = extendedCutters.length === 0;

    return { extendedCutters, isFist };
  }

  handleResults(results) {
    this.clearCanvas();
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.handDetected = true;
      const landmarks = results.multiHandLandmarks[0];
      this.lastLandmarks = landmarks;

      const { extendedCutters, isFist } = this.detectFingers(landmarks);
      this.activeCutters = extendedCutters;

      // Select primary cutter: prefer index if extended, else middle, else first available, or fallback to index tip
      let primary = extendedCutters.find(c => c.id === 'index') ||
                    extendedCutters.find(c => c.id === 'middle') ||
                    extendedCutters[0];

      if (!primary && !isFist) {
        // If hand is flat/moving, fallback to index
        const indexTip = landmarks[8];
        const normX = this.mirror ? (1 - indexTip.x) : indexTip.x;
        primary = {
          id: 'index',
          name: 'Index',
          x: normX,
          y: indexTip.y,
          z: indexTip.z,
          rawX: indexTip.x,
          rawY: indexTip.y,
          tipIndex: 8
        };
      }

      // Backward compatible screenCoords structure with multi-cutter capabilities
      const screenCoords = primary ? {
        x: primary.x,
        y: primary.y,
        z: primary.z,
        rawX: primary.rawX,
        rawY: primary.rawY,
        primary,
        cutters: extendedCutters.length > 0 ? extendedCutters : (primary ? [primary] : [])
      } : null;

      // Notify listeners
      for (const listener of this.listeners) {
        listener(screenCoords, landmarks, isFist, extendedCutters);
      }

      // Draw high-tech minimalist skeleton
      if (this.showDebug) {
        this.drawSkeleton(landmarks, extendedCutters);
      }
    } else {
      this.handDetected = false;
      this.lastLandmarks = null;
      this.activeCutters = [];
      for (const listener of this.listeners) {
        listener(null, null, false, []);
      }
    }
  }

  clearCanvas() {
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  drawSkeleton(landmarks, extendedCutters) {
    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    // Hand bone connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm bridge
    ];

    // High-tech subtle bone styling
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([i, j]) => {
      const pt1 = landmarks[i];
      const pt2 = landmarks[j];

      const x1 = (this.mirror ? (1 - pt1.x) : pt1.x) * width;
      const y1 = pt1.y * height;
      const x2 = (this.mirror ? (1 - pt2.x) : pt2.x) * width;
      const y2 = pt2.y * height;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    const activeTipIndices = new Set(extendedCutters.map(c => c.tipIndex));

    // Draw joints
    landmarks.forEach((landmark, index) => {
      const x = (this.mirror ? (1 - landmark.x) : landmark.x) * width;
      const y = landmark.y * height;
      const isTip = [4, 8, 12, 16, 20].includes(index);
      const isActiveBlade = activeTipIndices.has(index);

      if (isActiveBlade) {
        // Active cutter blade reticle
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#38bdf8';
        ctx.fillStyle = '#ffffff';

        // Outer pulse circle
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Blade flare crosshairs
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();

        ctx.restore();
      } else {
        // Standard joint
        ctx.fillStyle = isTip ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, isTip ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

const handTracker = new HandTracker();
export default handTracker;
