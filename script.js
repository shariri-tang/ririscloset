// script.js - CLOTHES ATTACHED, UPRIGHT, AND COVERING THE BODY

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

// -------------------- GLIDE CAROUSEL (OUTFITS) --------------------

const glide = new Glide(".glide", {
  type: "carousel",
  startAt: 0,
  perView: 1
}).mount();

// Preload clothing images in the same order as the slides
const clothingPaths = [
  "./images/Dress1.png",
  "./images/Dress2.png",
  "./images/Dress3.png",
  "./images/Dress4.png",
  "./images/Dress5.png"
];

const clothingImages = clothingPaths.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

// -------------------- MEDIAPIPE POSE SETUP --------------------

let poseLandmarker;
let runningMode = "IMAGE";
let webcamRunning = false;

const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const centerImage = document.getElementById('center-image');
const clickSound = document.getElementById('click-sound');
const popupOverlay = document.getElementById('popup-overlay');
const closePopupButton = document.getElementById('close-popup');
const bouncingImage = document.getElementById('bouncing-image');
const bgMusic = document.getElementById('bg-music');
let hasSeenPopup = false;

async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    },
    runningMode: runningMode,
    numPoses: 1
  });
}

createPoseLandmarker();

// -------------------- BACKGROUND MUSIC (LANDING PAGE ONLY) --------------------

if (bgMusic) {
  bgMusic.volume = 0.3;
}

let musicStarted = false;

function startLandingMusic() {
  if (!musicStarted && !webcamRunning && bgMusic) {
    bgMusic.play().catch(err => console.log('Autoplay blocked:', err));
    musicStarted = true;
  }
}

document.addEventListener('click', startLandingMusic, { once: true });
document.addEventListener('touchstart', startLandingMusic, { once: true });

// -------------------- POPUP CLOSE FUNCTIONALITY --------------------

if (closePopupButton) {
  closePopupButton.addEventListener('click', () => {
    popupOverlay.classList.remove('show');
  });
}

if (popupOverlay) {
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      popupOverlay.classList.remove('show');
    }
  });
}

// -------------------- WEBCAM HANDLING --------------------

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

enableWebcamButton.addEventListener("click", async () => {
  // Play click sound
  if (clickSound) {
    clickSound.currentTime = 0;
    clickSound.play().catch(err => console.log('Audio play failed:', err));
  }

  if (!hasGetUserMedia()) {
    alert("getUserMedia() is not supported by your browser");
    return;
  }

  // Toggle on/off
  if (webcamRunning) {
    webcamRunning = false;
    // Change back to original button image
    enableWebcamButton.style.backgroundImage = "url('./images/button.png')";
    // Move button back to center
    enableWebcamButton.classList.remove('webcam-active');
    // Show center image when stopping webcam
    if (centerImage) {
      centerImage.classList.add('show');
    }
    // Hide bouncing image when stopping webcam
    if (bouncingImage) {
      bouncingImage.classList.remove('show');
    }
    
    // Restart landing page music
    if (bgMusic) {
      bgMusic.currentTime = 0;
      bgMusic.play().catch(err => console.log('Audio play failed:', err));
    }
    
    const stream = videoElement.srcObject;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    videoElement.srcObject = null;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    return;
  }

  if (!poseLandmarker) {
    alert("Pose model still loading – try again in a moment.");
    return;
  }

  const constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;

  videoElement.addEventListener(
    "loadeddata",
    () => {
      webcamRunning = true;
      // Change to the new button image when webcam is running
      enableWebcamButton.style.backgroundImage = "url('./images/button-stop.png')";
      // Move button to top right
      enableWebcamButton.classList.add('webcam-active');
      // Hide center image when webcam starts
      if (centerImage) {
        centerImage.classList.remove('show');
      }
      // Show bouncing image when webcam starts
      if (bouncingImage) {
        bouncingImage.classList.add('show');
      }
      
      // Stop landing page music when entering interactive mode
      if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
      }
      
      // Show popup only on first entry
    // Show popup every time
setTimeout(() => {
  popupOverlay.classList.add('show');
}, 500);
      
      window.requestAnimationFrame(predictWebcam);
    },
    { once: true }
  );
});

// -------------------- DRAW CLOTHING ON BODY --------------------
/*
  This version:
  - Keeps the clothing UPRIGHT (no rotation).
  - Anchors at the midpoint of the shoulders.
  - Scales based on shoulder width + torso length.
  - Pushes the dress down so it actually covers the torso.
*/

function drawClothingOnBody(landmarks) {
  if (!landmarks || landmarks.length < 25) return;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

  const w = canvasElement.width;
  const h = canvasElement.height;

  const currentSlide = glide.index % clothingImages.length;
  const clothingImg = clothingImages[currentSlide];
  if (!clothingImg || !clothingImg.complete) return;

  // Shoulder center (where the neckline roughly should start)
  const shoulderCenterX = ((leftShoulder.x + rightShoulder.x) / 2) * w;
  const shoulderCenterY = ((leftShoulder.y + rightShoulder.y) / 2) * h;

  // Hip center (to estimate torso height)
  const hipCenterX = ((leftHip.x + rightHip.x) / 2) * w;
  const hipCenterY = ((leftHip.y + rightHip.y) / 2) * h;

  const shoulderWidth = Math.hypot(
    (rightShoulder.x - leftShoulder.x) * w,
    (rightShoulder.y - leftShoulder.y) * h
  );

  const torsoHeight = Math.hypot(
    hipCenterX - shoulderCenterX,
    hipCenterY - shoulderCenterY
  );

  // ---- TWEAK THESE IF NEEDED ----
  const WIDTH_FACTOR = 3.45;   // wider → increase, narrower → decrease
  const HEIGHT_FACTOR = 2.8;  // longer dress → increase
  const NECK_OFFSET = 0.28;   // move dress up/down relative to shoulders
  // --------------------------------

  const clothingWidth = shoulderWidth * WIDTH_FACTOR;
  const clothingHeight = torsoHeight * HEIGHT_FACTOR;

  // Top-left of the dress image
  const x = shoulderCenterX - clothingWidth / 2;
  const y = shoulderCenterY - clothingHeight * NECK_OFFSET;

  canvasCtx.drawImage(
    clothingImg,
    x,
    y,
    clothingWidth,
    clothingHeight
  );
}

// -------------------- HAND SWIPE TO CHANGE OUTFIT --------------------

let lastRightWristX = null;
let lastSwipeTime = 0;
const SWIPE_THRESHOLD = 0.18; // fraction of screen width
const SWIPE_COOLDOWN = 700; // ms

function handleSwipe(landmarks) {
  const rightWrist = landmarks[16]; // index 16 = right wrist
  if (!rightWrist) return;

  const x = rightWrist.x; // 0..1

  if (lastRightWristX === null) {
    lastRightWristX = x;
    return;
  }

  const dx = x - lastRightWristX;
  const now = Date.now();

  if (now - lastSwipeTime > SWIPE_COOLDOWN) {
    if (dx > SWIPE_THRESHOLD) {
      glide.go(">");
      lastSwipeTime = now;
    } else if (dx < -SWIPE_THRESHOLD) {
      glide.go("<");
      lastSwipeTime = now;
    }
  }

  lastRightWristX = x;
}

// -------------------- MAIN LOOP --------------------

const drawingUtils = new DrawingUtils(canvasCtx);

async function predictWebcam() {
  if (!poseLandmarker || !webcamRunning) return;

  // Ensure running mode is VIDEO when streaming
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await poseLandmarker.setOptions({ runningMode: runningMode });
  }

  const nowMs = performance.now();

  // Match canvas to video dimensions
  const w = videoElement.videoWidth || 1280;
  const h = videoElement.videoHeight || 720;
  if (canvasElement.width !== w || canvasElement.height !== h) {
    canvasElement.width = w;
    canvasElement.height = h;
  }

  poseLandmarker.detectForVideo(videoElement, nowMs, (result) => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (!result || !result.landmarks || result.landmarks.length === 0) {
      return;
    }

    const pose = result.landmarks[0];

    // Draw outfit
    drawClothingOnBody(pose);

    // Optional debug:
    // drawingUtils.drawLandmarks(pose);
    // drawingUtils.drawConnectors(pose, PoseLandmarker.POSE_CONNECTIONS);

    // Swipe detection
    handleSwipe(pose);
  });

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}