/**
 * PumpManager.js - Manages all pumps in the system
 * 
 * Creates, configures, and controls all pump types with modal interfaces
 */

class PumpManager {
  constructor(config, flowNetwork) {
    this.config = config;
    this.flowNetwork = flowNetwork;
    this.pumps = {};
    this.modals = {};
    
    this._initializePumps();
    this._createModals();
    this._setupEventListeners();
    
    console.log(`PumpManager initialized with ${Object.keys(this.pumps).length} pumps`);
  }

  /**
   * Initialize all pumps from config
   */
  _initializePumps() {
    for (const [key, cfg] of Object.entries(this.config)) {
      let pump;
      
      // Create appropriate pump type
      switch (cfg.pumpType) {
        case 'fixed':
          pump = new FixedSpeedPump(cfg);
          break;
        case 'variable':
          pump = new VariableSpeedPump(cfg);
          break;
        case '3-speed':
          pump = new ThreeSpeedPump(cfg);
          break;
        default:
          console.warn(`Unknown pump type: ${cfg.pumpType}, defaulting to fixed`);
          pump = new FixedSpeedPump(cfg);
      }
      
      this.pumps[key] = pump;
      this.flowNetwork.addComponent(pump);
      
      // Setup change callback
      pump.onChange = (p) => this._onPumpChange(key, p);
    }
  }

  /**
   * Create modal for each pump
   */
  _createModals() {
    for (const [key, pump] of Object.entries(this.pumps)) {
      const modal = this._createModalElement(key, pump);
      document.body.appendChild(modal);
      this.modals[key] = modal;
    }
  }

  /**
   * Create modal HTML for a pump
   */
  _createModalElement(key, pump) {
    const overlay = document.createElement('div');
    overlay.id = `${pump.id}Modal`;
    overlay.className = 'valve-modal-overlay'; // Reuse valve modal styles
    overlay.setAttribute('aria-hidden', 'true');
    
    const title = pump.config?.modalTitle || `${pump.name} Control`;
    
    // Create modal content based on pump type
    let controlsHTML = '';
    
    if (pump.pumpType === 'fixed') {
      controlsHTML = `
        <div class="pump-controls">
          <button type="button" class="btn toggle pump-toggle" data-pump="${key}" aria-pressed="false">
            Start Pump
          </button>
          <div class="pump-status">
            <div class="kv">
              <div>Status</div><div class="pump-status-text">OFF</div>
              <div>Flow Rate</div><div class="pump-flow">0.00 m³/s</div>
              <div>Run Time</div><div class="pump-runtime">0s</div>
            </div>
          </div>
        </div>
      `;
    } else if (pump.pumpType === 'variable') {
      controlsHTML = `
        <div class="pump-controls">
          <div class="row">
            <button type="button" class="btn pump-stop" data-pump="${key}">Stop</button>
            <button type="button" class="btn toggle pump-toggle" data-pump="${key}" aria-pressed="false">
              Start
            </button>
          </div>
          <div class="row" style="margin-top: 16px;">
            <label for="${pump.id}Speed">Speed</label>
            <input type="range" id="${pump.id}Speed" class="grow pump-speed-slider" 
                   data-pump="${key}" min="0" max="100" step="1" value="0"/>
            <output class="pump-speed-output">0%</output>
          </div>
          <div class="pump-status">
            <div class="kv">
              <div>Status</div><div class="pump-status-text">OFF</div>
              <div>Flow Rate</div><div class="pump-flow">0.00 m³/s</div>
              <div>Run Time</div><div class="pump-runtime">0s</div>
            </div>
          </div>
        </div>
      `;
    } else if (pump.pumpType === '3-speed') {
      controlsHTML = `
        <div class="pump-controls">
          <div class="row">
            <button type="button" class="btn pump-stop" data-pump="${key}">Stop</button>
          </div>
          <div class="row" style="margin-top: 12px; gap: 8px;">
            <button type="button" class="btn pump-speed-btn" data-pump="${key}" data-speed="0">Low</button>
            <button type="button" class="btn pump-speed-btn" data-pump="${key}" data-speed="1">Medium</button>
            <button type="button" class="btn pump-speed-btn" data-pump="${key}" data-speed="2">High</button>
          </div>
          <div class="pump-status">
            <div class="kv">
              <div>Status</div><div class="pump-status-text">OFF</div>
              <div>Speed</div><div class="pump-speed-setting">-</div>
              <div>Flow Rate</div><div class="pump-flow">0.00 m³/s</div>
              <div>Run Time</div><div class="pump-runtime">0s</div>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add cavitation warning if enabled
    if (pump.cavitation.enabled) {
      controlsHTML += `
        <div class="pump-cavitation-warning" style="display: none; margin-top: 16px; padding: 12px; background: rgba(255, 107, 107, 0.1); border: 1px solid #ff6b6b; border-radius: 8px; color: #ff6b6b;">
          ⚠️ <strong>CAVITATION DETECTED</strong><br>
          <small>Flow reduced - Check suction conditions</small>
        </div>
      `;
    }
    
    overlay.innerHTML = `
      <div class="valve-modal-container">
        <button type="button" aria-label="Close ${title}" class="valve-modal-close pump-modal-close" data-pump="${key}">×</button>
        <div class="valve-modal-title">${title}</div>
        <div style="padding: 20px;">
          ${controlsHTML}
        </div>
      </div>
    `;
    
    return overlay;
  }

  /**
   * Setup event listeners for all pumps and modals
   */
  _setupEventListeners() {
    for (const [key, pump] of Object.entries(this.pumps)) {
      const svgElement = document.querySelector(pump.svgElement);
      const modal = this.modals[key];
      
      if (!svgElement) {
        console.warn(`SVG element ${pump.svgElement} not found for pump ${key}`);
        continue;
      }
      
      // Click pump to open modal
      svgElement.addEventListener('click', () => this.openModal(key));
      svgElement.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.openModal(key);
        }
      });
      
      // Close button
      const closeBtn = modal.querySelector('.pump-modal-close');
      closeBtn?.addEventListener('click', () => this.closeModal(key));
      
      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(key);
      });
      
      // Setup pump-specific controls
      this._setupPumpControls(key, pump, modal);
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
   * Setup pump-specific controls in modal
   */
  _setupPumpControls(key, pump, modal) {
    if (pump.pumpType === 'fixed') {
      // Fixed speed: toggle button
      const toggle = modal.querySelector('.pump-toggle');
      toggle?.addEventListener('click', () => {
        pump.toggle();
        this._updateModalUI(key);
      });
      
    } else if (pump.pumpType === 'variable') {
      // Variable speed: start, stop, slider
      const startBtn = modal.querySelector('.pump-toggle');
      const stopBtn = modal.querySelector('.pump-stop');
      const slider = modal.querySelector('.pump-speed-slider');
      const output = modal.querySelector('.pump-speed-output');
      
      startBtn?.addEventListener('click', () => {
        pump.start();
        this._updateModalUI(key);
      });
      
      stopBtn?.addEventListener('click', () => {
        pump.stop();
        this._updateModalUI(key);
      });
      
      slider?.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value) / 100;
        pump.setSpeed(speed);
        if (output) output.textContent = e.target.value + '%';
        this._updateModalUI(key);
      });
      
    } else if (pump.pumpType === '3-speed') {
      // 3-speed: stop button + speed buttons
      const stopBtn = modal.querySelector('.pump-stop');
      const speedBtns = modal.querySelectorAll('.pump-speed-btn');
      
      stopBtn?.addEventListener('click', () => {
        pump.stop();
        this._updateModalUI(key);
      });
      
      speedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const speedIndex = parseInt(btn.dataset.speed);
          pump.setSpeedIndex(speedIndex);
          this._updateModalUI(key);
        });
      });
    }
  }

  /**
   * Open pump modal
   */
  openModal(key) {
    const modal = this.modals[key];
    if (!modal) return;
    
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    this._updateModalUI(key);
    
    console.log(`Opened ${this.pumps[key].name} modal`);
  }

  /**
   * Close pump modal
   */
  closeModal(key) {
    const modal = this.modals[key];
    if (!modal) return;
    
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * Update modal UI to reflect pump state
   */
  _updateModalUI(key) {
    const pump = this.pumps[key];
    const modal = this.modals[key];
    if (!modal) return;
    
    // Update status text
    const statusText = modal.querySelector('.pump-status-text');
    if (statusText) {
      statusText.textContent = pump.running ? 'RUNNING' : 'OFF';
      statusText.style.color = pump.running ? '#3ddc97' : '#9bb0ff';
    }
    
    // Update flow rate
    const flowText = modal.querySelector('.pump-flow');
    if (flowText) {
      flowText.textContent = pump.getOutputFlow().toFixed(2) + ' m³/s';
    }
    
    // Update runtime
    const runtimeText = modal.querySelector('.pump-runtime');
    if (runtimeText) {
      runtimeText.textContent = Math.floor(pump.runTime) + 's';
    }
    
    // Update pump-type-specific UI
    if (pump.pumpType === 'fixed') {
      const toggle = modal.querySelector('.pump-toggle');
      if (toggle) {
        toggle.setAttribute('aria-pressed', pump.running);
        toggle.textContent = pump.running ? 'Stop Pump' : 'Start Pump';
      }
      
    } else if (pump.pumpType === 'variable') {
      const slider = modal.querySelector('.pump-speed-slider');
      const output = modal.querySelector('.pump-speed-output');
      if (slider && output) {
        const speedPercent = pump.getSpeedPercent();
        slider.value = speedPercent;
        output.textContent = speedPercent + '%';
      }
      
    } else if (pump.pumpType === '3-speed') {
      const speedSetting = modal.querySelector('.pump-speed-setting');
      if (speedSetting) {
        speedSetting.textContent = pump.running ? pump.getSpeedName() : '-';
      }
      
      // Highlight active speed button
      const speedBtns = modal.querySelectorAll('.pump-speed-btn');
      speedBtns.forEach((btn, index) => {
        if (index === pump.getSpeedIndex() && pump.running) {
          btn.classList.add('toggle');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('toggle');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
    }
    
    // Update cavitation warning
    const cavWarning = modal.querySelector('.pump-cavitation-warning');
    if (cavWarning) {
      cavWarning.style.display = pump.cavitation.active ? 'block' : 'none';
    }
  }

  /**
   * Called when pump changes
   */
  _onPumpChange(key, pump) {
    // Update modal if open
    if (this.modals[key]?.classList.contains('open')) {
      this._updateModalUI(key);
    }
    
    // Update SVG element state
    const svgElement = document.querySelector(pump.svgElement);
    if (svgElement) {
      svgElement.setAttribute('aria-pressed', pump.running);
    }
    
    console.log(`Pump ${key} changed:`, pump.getInfo());
  }

  /**
   * Get pump by key
   */
  getPump(key) {
    return this.pumps[key];
  }

  /**
   * Get all pumps
   */
  getAllPumps() {
    return this.pumps;
  }

  /**
   * Reset all pumps
   */
  reset() {
    for (const pump of Object.values(this.pumps)) {
      pump.reset();
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    for (const pump of Object.values(this.pumps)) {
      pump.destroy();
    }
    
    for (const modal of Object.values(this.modals)) {
      modal.remove();
    }
    
    this.pumps = {};
    this.modals = {};
  }
}

// Export
window.PumpManager = PumpManager;
