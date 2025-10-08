/**
 * ValvePopup.js - Modal popup for interactive valve control
 * 
 * Displays valve.html in an iframe and connects it to the simulation
 */

class ValvePopup {
  constructor(onValveChange) {
    this.onValveChange = onValveChange;
    this.isOpen = false;
    this.autoCloseTimer = null;
    this.autoCloseDelay = 7000; // 7 seconds
    
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
    this.closeBtn.onmouseover = () => {
      this.closeBtn.style.background = 'rgba(255, 107, 107, 1)';
      this.closeBtn.style.transform = 'scale(1.1)';
    };
    this.closeBtn.onmouseout = () => {
      this.closeBtn.style.background = 'rgba(255, 107, 107, 0.9)';
      this.closeBtn.style.transform = 'scale(1)';
    };

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

    // Listen for messages from iframe
    window.addEventListener('message', (e) => {
      if (e.data.type === 'valve-change') {
        this._resetAutoCloseTimer();
        if (this.onValveChange) {
          this.onValveChange(e.data.value);
        }
      } else if (e.data.type === 'valve-ready') {
        console.log('Valve iframe ready');
      }
    });

    // Reset timer on any interaction with the modal
    this.container.addEventListener('mouseenter', () => this._resetAutoCloseTimer());
    this.container.addEventListener('mousemove', () => this._resetAutoCloseTimer());
    this.container.addEventListener('touchstart', () => this._resetAutoCloseTimer());
  }

  open(currentValue = 0) {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    
    // Trigger animations
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });

    // Wait for iframe to load, then set initial value
    if (this.iframe.contentWindow) {
      this.iframe.onload = () => {
        this._sendToValve('set-value', currentValue);
        this._setupValveCallback();
      };
      
      // If already loaded, set immediately
      if (this.iframe.contentDocument && this.iframe.contentDocument.readyState === 'complete') {
        this._sendToValve('set-value', currentValue);
        this._setupValveCallback();
      }
    }

    this._resetAutoCloseTimer();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.container.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 300);

    this._clearAutoCloseTimer();
  }

  _setupValveCallback() {
    // Inject code into iframe to send messages back to parent
    const script = this.iframe.contentDocument.createElement('script');
    script.textContent = `
      if (window.ValveTop) {
        window.ValveTop.onChange((value) => {
          window.parent.postMessage({
            type: 'valve-change',
            value: value
          }, '*');
        });
        
        // Notify parent that valve is ready
        window.parent.postMessage({
          type: 'valve-ready'
        }, '*');
      }
    `;
    this.iframe.contentDocument.body.appendChild(script);
  }

  _sendToValve(command, value) {
    if (this.iframe.contentWindow && this.iframe.contentWindow.ValveTop) {
      switch (command) {
        case 'set-value':
          this.iframe.contentWindow.ValveTop.set(value);
          break;
        case 'open':
          this.iframe.contentWindow.ValveTop.open();
          break;
        case 'close':
          this.iframe.contentWindow.ValveTop.close();
          break;
      }
    }
  }

  _resetAutoCloseTimer() {
    this._clearAutoCloseTimer();
    this.autoCloseTimer = setTimeout(() => {
      if (this.isOpen) {
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

  setAutoCloseDelay(ms) {
    this.autoCloseDelay = ms;
  }
}

// Export for use in other scripts
window.ValvePopup = ValvePopup;
