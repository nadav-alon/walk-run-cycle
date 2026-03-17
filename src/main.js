import './style.css';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const currentModeBadge = document.getElementById('current-mode');
const progressCircle = document.getElementById('progress-circle');
const runTimeInput = document.getElementById('run-time');
const walkTimeInput = document.getElementById('walk-time');
const cycleTimeInput = document.getElementById('cycle-time');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const timerUI = document.getElementById('timer-ui');
const appContainer = document.getElementById('app');

// State Variables
let timerState = 'READY'; // READY, RUNNING, PAUSED
let currentModeIndex = 0;
const MODES = [
  { id: 'RUN', label: 'Running', color: 'var(--run-color)', class: 'mode-run', input: runTimeInput },
  { id: 'WALK', label: 'Walking', color: 'var(--walk-color)', class: 'mode-walk', input: walkTimeInput },
  { id: 'CYCLE', label: 'Cycling', color: 'var(--cycle-color)', class: 'mode-cycle', input: cycleTimeInput }
];

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

  const mode = MODES[currentModeIndex];

  if (timerState === 'READY') {
    currentModeBadge.textContent = 'Ready';
    timerUI.className = 'timer-container';
    appContainer.classList.remove('running');
  } else {
    currentModeBadge.textContent = mode.label;
    timerUI.className = `timer-container ${mode.class}`;
    appContainer.classList.add('running');
  }
}

function triggerAlert() {
  const mode = MODES[currentModeIndex];
  if ("vibrate" in navigator) {
    // 1 pulse for walk, 2 for cycle, 3 for run
    const pulses = currentModeIndex === 1 ? [300] : (currentModeIndex === 2 ? [200, 100, 200] : [200, 100, 200, 100, 200]);
    navigator.vibrate(pulses);
  }
  
  // Play a subtle beep if possible (future enhancement)
  console.log(`Alert: Switched to ${mode.id}`);
}

function switchMode() {
  currentModeIndex = (currentModeIndex + 1) % MODES.length;
  const mode = MODES[currentModeIndex];
  totalTimeForMode = parseInt(mode.input.value) * 60;
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
      currentModeIndex = 0;
      const mode = MODES[currentModeIndex];
      totalTimeForMode = parseInt(mode.input.value) * 60;
      timeLeft = totalTimeForMode;
      triggerAlert();
    }
    
    timerState = 'RUNNING';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    intervalId = setInterval(tick, 1000);
    requestWakeLock();
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

// Event Listeners
startBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);
resetBtn.addEventListener('click', resetSession);

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

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered');
    }).catch(err => {
      console.log('SW registration failed', err);
    });
  });
}

// Initialize UI
updateUI();
