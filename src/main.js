import './style.css';

const APP_VERSION = '1.1.1';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const currentModeBadge = document.getElementById('current-mode');
const progressCircle = document.getElementById('progress-circle');
const runMinInput = document.getElementById('run-min');
const runSecInput = document.getElementById('run-sec');
const walkMinInput = document.getElementById('walk-min');
const walkSecInput = document.getElementById('walk-sec');
const cycleMinInput = document.getElementById('cycle-min');
const cycleSecInput = document.getElementById('cycle-sec');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const timerUI = document.getElementById('timer-ui');
const appContainer = document.getElementById('app');
const hapticStatus = document.getElementById('haptic-status');

// State Variables
const MODES_CONFIG = [
  { id: 'RUN', label: 'Running', class: 'mode-run', minInput: runMinInput, secInput: runSecInput, storageKeyMin: 'stryde_run_min', storageKeySec: 'stryde_run_sec' },
  { id: 'WALK', label: 'Walking', class: 'mode-walk', minInput: walkMinInput, secInput: walkSecInput, storageKeyMin: 'stryde_walk_min', storageKeySec: 'stryde_walk_sec' },
  { id: 'CYCLE', label: 'Cycling', class: 'mode-cycle', minInput: cycleMinInput, secInput: cycleSecInput, storageKeyMin: 'stryde_cycle_min', storageKeySec: 'stryde_cycle_sec' }
];

// Audio Context for beeps
let audioCtx = null;
function playBeep(pulses = 1) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playOne = (time) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, time); // A5 note
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.4);
  };

  const now = audioCtx.currentTime;
  for (let i = 0; i < pulses; i++) {
    playOne(now + (i * 0.3));
  }
}

// State Variables
let timerState = 'READY'; // READY, RUNNING, PAUSED
let currentModeIndex = 0;
let activeModes = [];

let timeLeft = 0;
let totalTimeForMode = 0;
let intervalId = null;
let modeStartTime = null;
let keepAliveOsc = null;

function startKeepAlive() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (keepAliveOsc) return;
  
  const silentGain = audioCtx.createGain();
  // Near-zero gain to keep the audio pipeline truly active on mobile
  silentGain.gain.setValueAtTime(0.001, audioCtx.currentTime); 
  const osc = audioCtx.createOscillator();
  osc.connect(silentGain);
  silentGain.connect(audioCtx.destination);
  osc.start();
  keepAliveOsc = osc;
}

function stopKeepAlive() {
  if (keepAliveOsc) {
    try {
      keepAliveOsc.stop();
    } catch(e) {}
    keepAliveOsc = null;
  }
}

// Circle Circumference (2 * PI * r) where r=45
const CIRCUMFERENCE = 2 * Math.PI * 45;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateUI() {
  timerDisplay.textContent = formatTime(timeLeft);
  
  // Update Circular Progress
  const progressPercent = totalTimeForMode > 0 ? (timeLeft / totalTimeForMode) : 0;
  const offset = CIRCUMFERENCE * (1 - progressPercent);
  progressCircle.style.strokeDashoffset = isNaN(offset) ? 0 : offset;

  if (timerState === 'READY') {
    currentModeBadge.textContent = 'Ready';
    hapticStatus.textContent = `V${APP_VERSION} | Ready`;
    timerUI.className = 'timer-container';
    appContainer.classList.remove('running');
  } else {
    const mode = activeModes[currentModeIndex];
    currentModeBadge.textContent = mode.label;
    hapticStatus.textContent = `V${APP_VERSION} | Training`;
    timerUI.className = `timer-container ${mode.class}`;
    appContainer.classList.add('running');
  }
}

async function triggerAlert() {
  const mode = activeModes[currentModeIndex];
  if (!mode) return;

  const pulses = mode.id === 'RUN' ? [1000, 200, 1000, 200, 1000] : 
                 (mode.id === 'CYCLE' ? [800, 200, 800] : [600]);

  // Haptic Alert (Foreground)
  if ("vibrate" in navigator) {
    navigator.vibrate(pulses);
  }

  // Silent Notification Alert (Target for Locked Screen)
  // This uses 'silent: true' to avoid interrupting music/podcasts
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(`Stryde: ${mode.label}`, {
        body: `Transition to ${mode.label.toLowerCase()}`,
        vibrate: pulses,
        silent: true,
        tag: 'stryde-tick',
        renotify: true
      });
    } catch (e) {
      console.warn("Notification vibration failed", e);
    }
  }

  // Sound Alert
  const beepCount = mode.id === 'RUN' ? 3 : (mode.id === 'CYCLE' ? 2 : 1);
  playBeep(beepCount);
  
  console.log(`Alert: Switched to ${mode.id}`);
}

const getDuration = (mode) => (parseInt(mode.minInput.value) || 0) * 60 + (parseInt(mode.secInput.value) || 0);

function switchMode() {
  currentModeIndex = (currentModeIndex + 1) % activeModes.length;
  const mode = activeModes[currentModeIndex];
  totalTimeForMode = getDuration(mode);
  timeLeft = totalTimeForMode;
  modeStartTime = Date.now();
  
  triggerAlert();
  updateUI();
}

function tick() {
  if (modeStartTime) {
    const elapsed = Math.floor((Date.now() - modeStartTime) / 1000);
    timeLeft = Math.max(0, totalTimeForMode - elapsed);
    
    if (timeLeft <= 0) {
      switchMode();
    } else {
      updateUI();
    }
  }
}

async function startSession() {
  if (timerState === 'READY' || timerState === 'PAUSED') {
    // Attempt to get notification permission for locked-screen haptics
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (timerState === 'READY') {
      // Refresh active modes based on current inputs (skip 0)
      activeModes = MODES_CONFIG.filter(m => getDuration(m) > 0);
      
      if (activeModes.length === 0) {
        alert("Please set at least one mode to more than 0.");
        return;
      }

      currentModeIndex = 0;
      const mode = activeModes[currentModeIndex];
      totalTimeForMode = getDuration(mode);
      timeLeft = totalTimeForMode;
      modeStartTime = Date.now();
      triggerAlert();
    } else if (timerState === 'PAUSED') {
      // Adjust start time to account for remaining time
      modeStartTime = Date.now() - (totalTimeForMode - timeLeft) * 1000;
    }
    
    timerState = 'RUNNING';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    intervalId = setInterval(tick, 1000);
    requestWakeLock();
    startKeepAlive();
    
    // Resume Audio Context on user gesture
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
  updateUI();
}

function stopSession() {
  timerState = 'PAUSED';
  clearInterval(intervalId);
  startBtn.querySelector('span').textContent = 'Resume Training';
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  releaseWakeLock();
  stopKeepAlive();
}

function resetSession() {
  timerState = 'READY';
  clearInterval(intervalId);
  timeLeft = 0;
  totalTimeForMode = 0;
  currentModeIndex = 0;
  modeStartTime = null;
  startBtn.querySelector('span').textContent = 'Start Training';
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  releaseWakeLock();
  stopKeepAlive();
  updateUI();
}

const hapticCheckBtn = document.getElementById('haptic-check');
const pwaBtn = document.getElementById('pwa-btn');
const pwaModal = document.getElementById('pwa-modal');
const closeModal = document.getElementById('close-modal');

// Event Listeners
startBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);
resetBtn.addEventListener('click', resetSession);

timerUI.addEventListener('click', () => {
  if (timerState === 'RUNNING') {
    switchMode();
  }
});

pwaBtn.addEventListener('click', () => pwaModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => pwaModal.classList.add('hidden'));

hapticCheckBtn.addEventListener('click', async () => {
  if ("vibrate" in navigator) {
    navigator.vibrate([600, 200, 600]);
    console.log("Test vibration triggered");
  } else {
    alert("Vibration API not supported on this device/browser.");
  }
  playBeep(2);
});

// Wake Lock API to keep screen on
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.error(`WakeLock Error: ${err.message}`);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Initialize Settings and UI
function initSettings() {
  MODES_CONFIG.forEach(mode => {
    // Load Mins
    const savedMin = localStorage.getItem(mode.storageKeyMin);
    if (savedMin !== null) mode.minInput.value = savedMin;
    mode.minInput.addEventListener('change', () => localStorage.setItem(mode.storageKeyMin, mode.minInput.value));

    // Load Secs
    const savedSec = localStorage.getItem(mode.storageKeySec);
    if (savedSec !== null) mode.secInput.value = savedSec;
    mode.secInput.addEventListener('change', () => localStorage.setItem(mode.storageKeySec, mode.secInput.value));
  });
}

initSettings();
updateUI();

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Using root-relative path which Vite will resolve correctly based on 'base' config
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered');
    }).catch(err => {
      console.log('SW registration failed', err);
    });
  });
}
