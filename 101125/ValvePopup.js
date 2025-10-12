/**
 * ValvePopup.js - Modal popup for interactive valve control (FIXED)
 */

class ValvePopup {
  constructor(onValveChange) {
    this.onValveChange = onValveChange;
    this.isOpen = false;
    this.autoCloseTimer = null;
    this.autoCloseDelay = 7000;
    this.iframeReady = false;
    
    this._createModal();
    this._setupEventListeners();
  }

  _createModal() {
    // Create modal overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'valve-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create modal container
    this.container = document.createElement('div');
    this.container.className = 'valve-modal-container';
    this.container.style.cssText = `
      position: relative;
      width: min(600px, 90vw);
      height: min(600px, 90vh);
      background: #0b1330;
      border-radius: 16px;
      border: 2px solid #1fd4d6;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    `;

    // Create close button
    this.closeBtn = document.createElement('button');
    this.closeBtn.innerHTML = '&times;';
    this.closeBtn.className = 'valve-modal-close';
    this.closeBtn.setAttribute('aria-label', 'Close valve control');
    this.closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      width: 40px;
      height: 40px;
      background: rgba(255, 107, 107, 0.9);
      border: 2px solid #ff8787;
      border-radius: 50%;
      color: white;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;

    // Create title bar
    this.titleBar = document.createElement('div');
    this.titleBar.style.cssText = `
      padding: 16px 24px;
      background: rgba(31, 212, 214, 0.1);
      border-bottom: 1px solid #1fd4d6;
      color: #e9f0ff;
      font-size: 18px;
      font-weight: 600;
    `;
    this.titleBar.textContent = 'Inlet Valve Control';

    // Create iframe for valve
    this.iframe = document.createElement('iframe');
    this.iframe.src = 'valve.html';
    this.iframe.style.cssText = `
      width: 100%;
      height: calc(100% - 60px);
      border: none;
      display: block;
    `;
    this.iframe.setAttribute('title', 'Interactive valve control');

    // Assemble modal
    this.container.appendChild(this.closeBtn);
    this.container.appendChild(this.titleBar);
    this.container.appendChild(this.iframe);
    this.overlay.appendChild(this.container);
    document.body.appendChild(this.overlay);
  }

  _setupEventListeners() {
    // Close button
    this.closeBtn.addEventListener('click', () => this.close());
    this.closeBtn.addEventListener('mouseenter', () => {
      this.closeBtn.style.background = 'rgba(255, 107, 107, 1)';
      this.closeBtn.style.transform = 'scale(1.1)';
    });
    this.closeBtn.addEventListener('mouseleave', () => {
      this.closeBtn.style.background = 'rgba(255, 107, 107, 0.9)';
      this.closeBtn.style.transform = 'scale(1)';
    });

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Reset timer on interactions
    this.container.addEventListener('mouseenter', () => this._resetAutoCloseTimer());
    this.container.addEventListener('mousemove', () => this._resetAutoCloseTimer());
    this.container.addEventListener('touchstart', () => this._resetAutoCloseTimer());
    this.container.addEventListener('click', () => this._resetAutoCloseTimer());

    // Iframe load event
    this.iframe.addEventListener('load', () => {
      console.log('Iframe loaded');
      this._setupIframeConnection();
    });
  }

  _setupIframeConnection() {
    // Poll for ValveTop API to be ready
    const checkReady = () => {
      try {
        if (this.iframe.contentWindow && this.iframe.contentWindow.ValveTop) {
          console.log('ValveTop API found!');
          this.iframeReady = true;
          
          // Set up the callback
          this.iframe.contentWindow.ValveTop.onChange((value) => {
            console.log('Valve changed:', value);
            this._resetAutoCloseTimer();
            if (this.onValveChange) {
              this.onValveChange(value);
            }
          });
          
          return true;
        }
      } catch (e) {
        console.error('Error accessing iframe:', e);
      }
      return false;
    };

    // Try immediately
    if (!checkReady()) {
      // If not ready, poll every 100ms for up to 3 seconds
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkReady() || attempts > 30) {
          clearInterval(interval);
          if (attempts > 30) {
            console.error('Failed to connect to valve iframe');
          }
        }
      }, 100);
    }
  }

  open(currentValue = 0) {
    console.log('Opening valve popup with value:', currentValue);
    
    // Clear any existing timers
    this._clearAutoCloseTimer();
    
    // Mark as open
    this.isOpen = true;
    this.currentValue = currentValue;
    
    // Show overlay
    this.overlay.style.display = 'flex';
    this.overlay.style.pointerEvents = 'auto'; // Ensure it's clickable
    
    // Trigger animations
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });

    // If iframe is already ready, set the value immediately
    if (this.iframeReady) {
      setTimeout(() => this._setValveValue(currentValue), 100);
    } else {
      // Wait for ready and then set value
      let attempts = 0;
      const waitForReady = setInterval(() => {
        attempts++;
        if (this.iframeReady) {
          clearInterval(waitForReady);
          this._setValveValue(currentValue);
        } else if (attempts > 60) { // 3 seconds max
          clearInterval(waitForReady);
          console.error('Iframe failed to load in time');
        }
      }, 50);
    }

    this._resetAutoCloseTimer();
  }

  _setValveValue(value) {
    try {
      if (this.iframe.contentWindow && this.iframe.contentWindow.ValveTop) {
        console.log('Setting valve to:', value);
        this.iframe.contentWindow.ValveTop.set(value);
      }
    } catch (e) {
      console.error('Error setting valve value:', e);
    }
  }

  close() {
    if (!this.isOpen) {
      console.log('Popup already closed');
      return;
    }
    
    console.log('Closing valve popup');
    this.isOpen = false;
    
    // Animate out
    this.overlay.style.opacity = '0';
    this.container.style.transform = 'scale(0.9)';
    
    // Hide after animation completes
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.overlay.style.pointerEvents = 'none';
    }, 300);

    this._clearAutoCloseTimer();
  }

  _resetAutoCloseTimer() {
    this._clearAutoCloseTimer();
    this.autoCloseTimer = setTimeout(() => {
      if (this.isOpen) {
        console.log('Auto-closing valve popup');
        this.close();
      }
    }, this.autoCloseDelay);
  }

  _clearAutoCloseTimer() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
}

// Export for use in other scripts
window.ValvePopup = ValvePopup;
