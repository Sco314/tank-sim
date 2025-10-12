/**
 * ValveManager.js - Manages all valves with interactive wheel controls
 * 
 * Creates modals with iframe valve controls for each valve
 */

class ValveManager {
  constructor(config, flowNetwork) {
    this.config = config;
    this.flowNetwork = flowNetwork;
    this.valves = {};
    this.modals = {};
    this.iframes = {};
    
    this._initializeValves();
    this._createModals();
    this._setupEventListeners();
    this._setupPostMessageListener();
    
    console.log(`ValveManager initialized with ${Object.keys(this.valves).length} valves`);
  }

  /**
   * Initialize all valves from config
   */
  _initializeValves() {
    for (const [key, cfg] of Object.entries(this.config)) {
      const valve = new Valve(cfg);
      this.valves[key] = valve;
      this.flowNetwork.addComponent(valve);
      
      // Setup change callback
      valve.onChange = (v) => this._onValveChange(key, v);
    }
  }

  /**
   * Create modal for each valve with iframe
   */
  _createModals() {
    for (const [key, valve] of Object.entries(this.valves)) {
      const modal = this._createModalElement(key, valve);
      document.body.appendChild(modal);
      this.modals[key] = modal;
      this.iframes[key] = modal.querySelector('iframe');
      
      // Setup iframe communication after it loads
      this._setupIframeSync(key, this.iframes[key]);
    }
  }

  /**
   * Create modal HTML with iframe for a valve
   */
  _createModalElement(key, valve) {
    const overlay = document.createElement('div');
    overlay.id = `${valve.id}Modal`;
    overlay.className = 'valve-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    
    const title = valve.config?.modalTitle || `${valve.name} Control`;
    const iframeUrl = valve.config?.iframeUrl || 'valve.html';
    
    overlay.innerHTML = `
      <div class="valve-modal-container">
        <button type="button" aria-label="Close ${title}" class="valve-modal-close valve-close-btn" data-valve="${key}">×</button>
        <div class="valve-modal-title">${title}</div>
        <iframe src="${iframeUrl}" title="${title}" class="valve-iframe"></iframe>
      </div>
    `;
    
    return overlay;
  }

  /**
   * Setup iframe communication for a valve
   */
  _setupIframeSync(key, iframe) {
    if (!iframe) return;
    
    iframe.addEventListener('load', () => {
      console.log(`Valve iframe loaded: ${key}`);
      
      // Wait for ValveTop to initialize
      setTimeout(() => {
        const valve = this.valves[key];
        
        // Set initial position
        this._sendValvePosition(iframe, valve.position);
        
        // Setup onChange callback (direct API - works on web server)
        try {
          if (iframe.contentWindow && iframe.contentWindow.ValveTop) {
            iframe.contentWindow.ValveTop.onChange((pos) => {
              this._onIframePositionChange(key, pos);
            });
            console.log(`✅ Valve ${key} direct onChange callback set`);
          }
        } catch(e) {
          console.warn(`⚠️ Direct callback failed for valve ${key}, using postMessage fallback`);
        }
      }, 150);
    });
  }

  /**
   * Setup global postMessage listener (fallback for file:// protocol)
   */
  _setupPostMessageListener() {
    window.addEventListener('message', (event) => {
      // Check if message is from a valve iframe
      if (event.data && event.data.type === 'valve:changed') {
        // Find which valve sent this message
        for (const [key, iframe] of Object.entries(this.iframes)) {
          if (event.source === iframe.contentWindow) {
            const position = Math.max(0, Math.min(1, parseFloat(event.data.value) || 0));
            this._onIframePositionChange(key, position);
            console.log(`📨 Valve ${key} updated via postMessage: ${(position * 100).toFixed(0)}%`);
            break;
          }
        }
      }
    });
    console.log('✅ PostMessage listener active for valve updates');
  }

  /**
   * Send position to iframe valve control
   */
  _sendValvePosition(iframe, position) {
    if (!iframe || !iframe.contentWindow) return;
    
    try {
      // Try direct API call
      if (iframe.contentWindow.ValveTop && 
          typeof iframe.contentWindow.ValveTop.set === 'function') {
        iframe.contentWindow.ValveTop.set(position);
        return;
      }
    } catch(e) {
      // Cross-origin or not loaded yet
    }
    
    // Fallback: postMessage
    try {
      iframe.contentWindow.postMessage({
        type: 'valve:set',
        value: position
      }, '*');
    } catch(e) {
      console.warn('Failed to send valve position:', e);
    }
  }

  /**
   * Called when iframe valve position changes
   */
  _onIframePositionChange(key, position) {
    const valve = this.valves[key];
    if (!valve) return;
    
    valve.setPosition(position);
    console.log(`Valve ${key} set to ${(position * 100).toFixed(0)}%`);
  }

  /**
   * Setup event listeners for all valves
   */
  _setupEventListeners() {
    for (const [key, valve] of Object.entries(this.valves)) {
      const svgElement = document.querySelector(valve.svgElement);
      const modal = this.modals[key];
      
      if (!svgElement) {
        console.warn(`SVG element ${valve.svgElement} not found for valve ${key}`);
        continue;
      }
      
      // Click valve to open modal
      svgElement.addEventListener('click', () => this.openModal(key));
      svgElement.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.openModal(key);
        }
      });
      
      // Close button
      const closeBtn = modal.querySelector('.valve-close-btn');
      closeBtn?.addEventListener('click', () => this.closeModal(key));
      
      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(key);
      });
    }
    
    // Global escape key handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        for (const key of Object.keys(this.modals)) {
          if (this.modals[key].classList.contains('open')) {
            this.closeModal(key);
          }
        }
      }
    });
  }

  /**
   * Open valve modal
   */
  openModal(key) {
    const modal = this.modals[key];
    const valve = this.valves[key];
    
    if (!modal || !valve) return;
    
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Send current position to iframe
    setTimeout(() => {
      this._sendValvePosition(this.iframes[key], valve.position);
    }, 100);
    
    console.log(`Opened ${valve.name} modal at ${valve.getPositionPercent()}%`);
  }

  /**
   * Close valve modal
   */
  closeModal(key) {
    const modal = this.modals[key];
    if (!modal) return;
    
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * Called when valve changes
   * REALISTIC FIELD OPERATION: No visual hints - user must click to check position
   */
  _onValveChange(key, valve) {
    // Update ARIA state for accessibility
    const svgElement = document.querySelector(valve.svgElement);
    if (svgElement) {
      svgElement.setAttribute('aria-pressed', valve.isOpen());
      
      // REMOVED: No opacity changes
      // Valves always look the same regardless of position
      // User must click to check - just like in the field!
    }
    
    console.log(`Valve ${key} changed:`, valve.getInfo());
  }

  /**
   * Get valve by key
   */
  getValve(key) {
    return this.valves[key];
  }

  /**
   * Get all valves
   */
  getAllValves() {
    return this.valves;
  }

  /**
   * Set valve position
   */
  setValvePosition(key, position) {
    const valve = this.valves[key];
    if (!valve) return;
    
    valve.setPosition(position);
    
    // Update iframe if modal is open
    if (this.modals[key]?.classList.contains('open')) {
      this._sendValvePosition(this.iframes[key], position);
    }
  }

  /**
   * Reset all valves
   */
  reset() {
    for (const valve of Object.values(this.valves)) {
      valve.reset();
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    for (const valve of Object.values(this.valves)) {
      valve.destroy();
    }
    
    for (const modal of Object.values(this.modals)) {
      modal.remove();
    }
    
    this.valves = {};
    this.modals = {};
    this.iframes = {};
  }
}

// Export
window.ValveManager = ValveManager;
