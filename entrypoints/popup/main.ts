import './style.css';

interface SessionStatus {
  isActive: boolean;
  startTime?: number;
  endTime?: number;
  mode?: 'allow' | 'block';
  domains?: string[];
}

class ZenTabPopup {
  private sessionStatus: SessionStatus = { isActive: false };
  private timerInterval: number | null = null;

  constructor() {
    this.render();
    this.loadSessionStatus();
    this.setupEventListeners();
  }

  private async loadSessionStatus() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_SESSION_STATUS' });
      if (response && !response.error) {
        this.sessionStatus = response;
        if (this.sessionStatus.isActive) {
          this.startTimer();
        } else {
          if (this.timerInterval) clearInterval(this.timerInterval);
        }
      } else {
        console.error('Error in response:', response?.error);
        this.sessionStatus = { isActive: false };
        this.render();
      }
      this.render();
    } catch (error) {
      console.error('Error loading session status:', error);
      this.sessionStatus = { isActive: false };
      this.render();
    }
  }

  private setupEventListeners() {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      if (target.id === 'start-session') {
        await this.startSession();
      } else if (target.id === 'end-session') {
        if (this.timerInterval) clearInterval(this.timerInterval);
        await this.endSession();
      } else if (target.id === 'extend-session') {
        await this.adjustSession(15);
      } else if (target.id === 'reduce-session') {
        await this.adjustSession(-15);
      }
    });

    document.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.name === 'mode') {
        this.updateModeUI();
      }
    });
  }

  private updateModeUI() {
    const allowModeRadio = document.getElementById('allow-mode') as HTMLInputElement;
    const domainsLabel = document.getElementById('domains-label') as HTMLElement;
    
    if (allowModeRadio && domainsLabel) {
      domainsLabel.textContent = allowModeRadio.checked ? 'Allowed domains:' : 'Blocked domains:';
    }
  }

  private async startSession() {
    const modeRadios = document.querySelectorAll('input[name="mode"]') as NodeListOf<HTMLInputElement>;
    const domainsInput = document.getElementById('domains') as HTMLInputElement;
    const durationInput = document.getElementById('duration') as HTMLInputElement;

    const selectedMode = Array.from(modeRadios).find(radio => radio.checked)?.value as 'allow' | 'block';
    const domainsText = domainsInput.value.trim();
    const duration = parseInt(durationInput.value) || 45;

    if (!selectedMode) {
      this.showError('Please select a mode (Allow or Block)');
      return;
    }

    if (!domainsText) {
      this.showError('Please enter at least one domain');
      return;
    }

    const domains = domainsText.split(',').map(d => d.trim()).filter(d => d.length > 0);

    try {
      await browser.runtime.sendMessage({
        type: 'START_SESSION',
        mode: selectedMode,
        domains,
        duration
      });

      await this.loadSessionStatus();
    } catch (error) {
      console.error('Error starting session:', error);
      this.showError('Failed to start session');
    }
  }

  private async endSession() {
    try {
      if (this.timerInterval) clearInterval(this.timerInterval);
      await browser.runtime.sendMessage({ type: 'END_SESSION' });
      await this.loadSessionStatus();
    } catch (error) {
      console.error('Error ending session:', error);
      this.showError('Failed to end session');
    }
  }

  private async adjustSession(minutes: number) {
    try {
      const messageType = minutes > 0 ? 'EXTEND_SESSION' : 'REDUCE_SESSION';
      await browser.runtime.sendMessage({ 
        type: messageType, 
        minutes: Math.abs(minutes) 
      });
      await this.loadSessionStatus();
    } catch (error) {
      console.error('Error adjusting session:', error);
    }
  }

  private showError(message: string) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 3000);
    }
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = window.setInterval(() => {
      const timeRemainingDiv = document.querySelector('.time-remaining');
      
      if (!timeRemainingDiv || !this.sessionStatus.isActive) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        return;
      }
      
      const timeString = this.formatTimeRemaining();
      timeRemainingDiv.textContent = timeString;

      if (timeString === 'Session Ended') {
        if (this.timerInterval) clearInterval(this.timerInterval);
        // Wait a moment, then refresh the popup's state from the background.
        // This will cause a single, intentional re-render to the 'start session' screen.
        setTimeout(() => this.loadSessionStatus(), 500);
      }
    }, 1000);
  }

  private formatTimeRemaining(): string {
    if (!this.sessionStatus?.endTime) return '';
    
    const remaining = this.sessionStatus.endTime - Date.now();
    if (remaining <= 0) return 'Session Ended';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }

  private render() {
    const app = document.querySelector('#app') as HTMLElement;
    
    if (this.sessionStatus.isActive) {
      app.innerHTML = this.renderActiveSession();
    } else {
      app.innerHTML = this.renderStartSession();
    }

    this.updateModeUI();
  }

  private renderActiveSession(): string {
    const timeRemaining = this.formatTimeRemaining();
    const modeText = this.sessionStatus.mode === 'allow' ? 'Allowing only' : 'Blocking';
    const domains = this.sessionStatus.domains?.join(', ') || '';

    return `
      <div class="session-active">
        <div class="header">
          <div class="icon">🧘</div>
          <h1>Zen Mode</h1>
          <p class="subtitle">You're in Zen Mode. Stay sharp.</p>
        </div>
        
        <div class="session-info">
          <div class="time-remaining">${timeRemaining}</div>
          <div class="mode-info">
            <strong>${modeText}:</strong> ${domains}
          </div>
        </div>

        <div class="controls">
          <button id="extend-session" class="btn btn-secondary">+15 min</button>
          <button id="reduce-session" class="btn btn-secondary">-15 min</button>
          <button id="end-session" class="btn btn-danger">End Session</button>
    </div>
  </div>
`;
  }

  private renderStartSession(): string {
    return `
      <div class="session-start">
        <div class="header">
          <div class="icon">🧘</div>
          <h1>zenTab</h1>
          <p class="subtitle">Stay present. One tab at a time.</p>
        </div>

        <div id="error-message" class="error-message"></div>

        <form class="session-form">
          <p class="form-hint">Choose your focus time and let ZenTab handle the distractions.</p>
          <div class="form-group">
            <label for="duration" class="form-label">Duration (minutes):</label>
            <input 
              type="number" 
              id="duration" 
              class="form-input" 
              value="45" 
              min="1"
              max="480"
            >
          </div>
        
          <div class="form-group">
            <label class="form-label">Mode:</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="mode" value="allow" id="allow-mode" checked>
                <span>Allow only</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="mode" value="block" id="block-mode">
                <span>Block</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="domains" class="form-label" id="domains-label">Allowed domains:</label>
            <input 
              type="text" 
              id="domains" 
              class="form-input" 
              placeholder="github.com, stackoverflow.com"
            >
            <small class="form-hint">Enter domains you want to allow or ban during focus.</small>
          </div>

          <button type="button" id="start-session" class="btn btn-primary">
            Start Focusing
          </button>

          <p class="quote">"The mind is a garden. Block the weeds."</p>
        </form>
      </div>
    `;
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ZenTabPopup();
});
