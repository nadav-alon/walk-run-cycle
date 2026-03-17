import './style.css';

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
    gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
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
    timerUI.className = 'timer-container';
    appContainer.classList.remove('running');
  } else {
    const mode = activeModes[currentModeIndex];
    currentModeBadge.textContent = mode.label;
    timerUI.className = `timer-container ${mode.class}`;
    appContainer.classList.add('running');
  }
}

function triggerAlert() {
  const mode = activeModes[currentModeIndex];
  if (!mode) return;

  // Haptic Alert
  if ("vibrate" in navigator) {
    let pulses = [300];
    if (mode.id === 'CYCLE') pulses = [200, 100, 200];
    if (mode.id === 'RUN') pulses = [200, 100, 200, 100, 200];
    navigator.vibrate(pulses);
  }

  // Sound Alert Fallback
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
  
  triggerAlert();
  updateUI();
}

function tick() {
  if (timeLeft > 0) {
    timeLeft--;
    updateUI();
  } else {
    switchMode();
  }
}

function startSession() {
  if (timerState === 'READY' || timerState === 'PAUSED') {
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
      triggerAlert();
    }
    
    timerState = 'RUNNING';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    intervalId = setInterval(tick, 1000);
    requestWakeLock();
    
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
}

function resetSession() {
  timerState = 'READY';
  clearInterval(intervalId);
  timeLeft = 0;
  totalTimeForMode = 0;
  currentModeIndex = 0;
  startBtn.querySelector('span').textContent = 'Start Training';
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  releaseWakeLock();
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

hapticCheckBtn.addEventListener('click', () => {
  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
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
