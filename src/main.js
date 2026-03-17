import './style.css';

// DOM Elements
const timerDisplay = document.getElementById('timer');
const currentModeBadge = document.getElementById('current-mode');
const progressBar = document.getElementById('progress');
const runTimeInput = document.getElementById('run-time');
const walkTimeInput = document.getElementById('walk-time');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const appContainer = document.getElementById('app');

// State Variables
let timerState = 'READY'; // READY, RUNNING, PAUSED
let currentMode = 'RUN'; // RUN, WALK
let timeLeft = 0;
let totalTimeForMode = 0;
let intervalId = null;

// Vibration Patterns
const VIBRATE_RUN = [200, 100, 200]; // 2 pulses
const VIBRATE_WALK = [300]; // 1 longer pulse

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateUI() {
  timerDisplay.textContent = formatTime(timeLeft);
  const progressPercent = ((totalTimeForMode - timeLeft) / totalTimeForMode) * 100;
  progressBar.style.width = `${progressPercent}%`;

  // Update Badge and App Classes
  if (timerState === 'READY') {
    currentModeBadge.textContent = 'Ready';
    currentModeBadge.className = 'status-badge';
    progressBar.style.backgroundColor = 'var(--accent-color)';
    appContainer.classList.remove('running');
  } else {
    currentModeBadge.textContent = currentMode === 'RUN' ? 'Running' : 'Walking';
    currentModeBadge.className = `status-badge ${currentMode === 'RUN' ? 'status-run' : 'status-walk'}`;
    progressBar.style.backgroundColor = currentMode === 'RUN' ? 'var(--run-color)' : 'var(--walk-color)';
    appContainer.classList.add('running');
  }
}

function switchMode() {
  currentMode = currentMode === 'RUN' ? 'WALK' : 'RUN';
  totalTimeForMode = (currentMode === 'RUN' ? parseInt(runTimeInput.value) : parseInt(walkTimeInput.value)) * 60;
  timeLeft = totalTimeForMode;
  
  // Vibration Alert
  if ("vibrate" in navigator) {
    navigator.vibrate(currentMode === 'RUN' ? VIBRATE_RUN : VIBRATE_WALK);
  }
  
  console.log(`Switched to ${currentMode}. Pattern: ${currentMode === 'RUN' ? '2 pulses' : '1 pulse'}`);
}

function tick() {
  if (timeLeft > 0) {
    timeLeft--;
  } else {
    switchMode();
  }
  updateUI();
}

function startSession() {
  if (timerState === 'READY') {
    currentMode = 'RUN';
    totalTimeForMode = parseInt(runTimeInput.value) * 60;
    timeLeft = totalTimeForMode;
    // Initial vibration for start
    if ("vibrate" in navigator) navigator.vibrate(VIBRATE_RUN);
  }
  
  timerState = 'RUNNING';
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  
  intervalId = setInterval(tick, 1000);
  updateUI();
}

function stopSession() {
  timerState = 'PAUSED';
  clearInterval(intervalId);
  startBtn.textContent = 'Resume Session';
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
}

function resetSession() {
  timerState = 'READY';
  clearInterval(intervalId);
  timeLeft = 0;
  totalTimeForMode = 0;
  currentMode = 'RUN';
  startBtn.textContent = 'Start Session';
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  updateUI();
}

// Event Listeners
startBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);
resetBtn.addEventListener('click', resetSession);

// Handle Wake Lock (if supported) to prevent screen dimming/sleep
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock acquired');
    }
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
}

startBtn.addEventListener('click', requestWakeLock);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered:', reg);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}

// Initialize
updateUI();
