import './style.css';

interface SessionStatus {
  isActive: boolean;
  endTime?: number;
  mode?: 'allow' | 'block';
  domains?: string[];
}

let sessionStatus: SessionStatus | null = null;
let timerInterval: number | null = null;
let syncInterval: number | null = null;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const blockedUrl = urlParams.get('url');
const domain = urlParams.get('domain');

// Display blocked domain
const domainEl = document.getElementById('blocked-domain');
if (domainEl && domain) {
  domainEl.textContent = domain;
}

// Fetches status from background and updates UI
async function syncSessionStatus() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_SESSION_STATUS' });
    
    // If the session is no longer active in the background
    if (!response || !response.isActive) {
      sessionStatus = { isActive: false };
      updateDisplay();
      return;
    }

    // If this is the first load or if the session data has changed
    if (!sessionStatus || sessionStatus.endTime !== response.endTime) {
      sessionStatus = response;
      updateDisplay();
    }
  } catch (error) {
    console.error('Error syncing session status:', error);
    sessionStatus = { isActive: false };
    updateDisplay();
  }
}

// Updates the display based on the current sessionStatus
function updateDisplay() {
  const timeRemainingEl = document.getElementById('time-remaining');
  const messageEl = document.querySelector('.message');
  const controlsEl = document.querySelector('.controls');
  const domainEl = document.getElementById('blocked-domain');
  const headingEl = document.getElementById('main-heading');
  const addDomainSectionEl = document.querySelector('.add-domain-section');
  const addDomainBtnEl = document.getElementById('add-domain-btn');

  if (!sessionStatus || !sessionStatus.isActive) {
    if (timerInterval) clearInterval(timerInterval);
    if (syncInterval) clearInterval(syncInterval);
    
    if (headingEl) headingEl.textContent = 'Session Complete';
    if (messageEl) messageEl.innerHTML = "You did it! Reflect, rest, or dive in again.";
    if (domainEl) (domainEl as HTMLElement).style.display = 'none';
    if (timeRemainingEl) timeRemainingEl.textContent = '🎉';
    if (controlsEl) (controlsEl as HTMLElement).style.display = 'none';
    if (addDomainSectionEl) (addDomainSectionEl as HTMLElement).style.display = 'none';

    if (blockedUrl && blockedUrl.startsWith('http')) {
      setTimeout(() => {
        window.location.href = blockedUrl;
      }, 3000); // Give user more time to see the completion message
    }
    return;
  }
  
  // Start the countdown timer if it's not already running
  if (!timerInterval) {
    startTimer();
  }
  if (controlsEl) (controlsEl as HTMLElement).style.display = 'flex';
  if (addDomainSectionEl) (addDomainSectionEl as HTMLElement).style.display = 'flex';

  if (addDomainBtnEl) {
    addDomainBtnEl.textContent = sessionStatus.mode === 'allow' ? 'Allow Domain' : 'Block Domain';
  }
}

// The 1-second countdown timer for UI only
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const timeRemainingEl = document.getElementById('time-remaining');

  timerInterval = setInterval(() => {
    if (!sessionStatus || !timeRemainingEl) return;
    const timeRemaining = sessionStatus.endTime - Date.now();

    if (timeRemaining <= 0) {
      timeRemainingEl.textContent = '00:00';
      clearInterval(timerInterval);
      timerInterval = null;
      syncSessionStatus();
    } else {
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      let timeString = '';
      if (hours > 0) {
        timeString = `${hours.toString()}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      timeRemainingEl.textContent = timeString;
    }
  }, 1000);
}

async function adjustSession(minutes: number) {
  try {
    const messageType = minutes > 0 ? 'EXTEND_SESSION' : 'REDUCE_SESSION';
    await browser.runtime.sendMessage({ 
      type: messageType, 
      minutes: Math.abs(minutes) 
    });
    await syncSessionStatus();
  } catch (error) {
    console.error('Error adjusting session:', error);
  }
}

async function addDomain() {
  const inputEl = document.getElementById('add-domain-input') as HTMLInputElement;
  if (!inputEl) return;

  const newDomain = inputEl.value.trim();
  if (newDomain) {
    try {
      await browser.runtime.sendMessage({
        type: 'ADD_DOMAIN',
        domain: newDomain
      });
      
      inputEl.value = '';
      if (addDomainBtnEl) {
        const originalText = addDomainBtnEl.textContent;
        addDomainBtnEl.textContent = 'Added!';
        addDomainBtnEl.style.backgroundColor = '#4caf50'; // Green for success
        setTimeout(() => {
          addDomainBtnEl.textContent = originalText;
          addDomainBtnEl.style.backgroundColor = ''; // Revert style
        }, 1500);
      }
    } catch (error) {
      console.error('Error adding domain:', error);
    }
  }
}

async function endSession() {
  try {
    if (timerInterval) clearInterval(timerInterval);
    if (syncInterval) clearInterval(syncInterval);
    await browser.runtime.sendMessage({ type: 'END_SESSION' });
    await syncSessionStatus();
  } catch (error) {
    console.error('Error ending session:', error);
  }
}

// Setup Event Listeners
document.getElementById('extend-session')?.addEventListener('click', () => adjustSession(15));
document.getElementById('reduce-session')?.addEventListener('click', () => adjustSession(-15));
document.getElementById('end-session')?.addEventListener('click', endSession);
document.getElementById('add-domain-btn')?.addEventListener('click', addDomain);

// Initial load
syncSessionStatus();
syncInterval = window.setInterval(syncSessionStatus, 5000); 