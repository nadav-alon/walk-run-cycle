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
const MODES_CONFIG = [
  { id: 'RUN', label: 'Running', color: 'var(--run-color)', class: 'mode-run', input: runTimeInput, storageKey: 'stryde_run_time', default: 5 },
  { id: 'WALK', label: 'Walking', color: 'var(--walk-color)', class: 'mode-walk', input: walkTimeInput, storageKey: 'stryde_walk_time', default: 2 },
  { id: 'CYCLE', label: 'Cycling', color: 'var(--cycle-color)', class: 'mode-cycle', input: cycleTimeInput, storageKey: 'stryde_cycle_time', default: 3 }
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

function switchMode() {
  currentModeIndex = (currentModeIndex + 1) % activeModes.length;
  const mode = activeModes[currentModeIndex];
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
      // Refresh active modes based on current inputs (skip 0)
      activeModes = MODES_CONFIG.filter(m => parseInt(m.input.value) > 0);
      
      if (activeModes.length === 0) {
        alert("Please set at least one mode to more than 0 minutes.");
        return;
      }

      currentModeIndex = 0;
      const mode = activeModes[currentModeIndex];
      totalTimeForMode = parseInt(mode.input.value) * 60;
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

// Event Listeners
startBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);
resetBtn.addEventListener('click', resetSession);

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
    const saved = localStorage.getItem(mode.storageKey);
    if (saved !== null) {
      mode.input.value = saved;
    }

    mode.input.addEventListener('change', () => {
      localStorage.setItem(mode.storageKey, mode.input.value);
    });
  });
}

initSettings();
updateUI();
