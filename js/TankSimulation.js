/**
 * TankSimulation.js - Refactored tank simulator with valve popup integration
 * 
 * Now with live valve updates and proper valve icon button behavior
 */

// ============================================================================
// MODEL CLASSES (Pure Physics, No Graphics)
// ============================================================================

class Tank {
  constructor(area = 1.2, maxHeight = 1.0) {
    this.area = area;
    this.maxHeight = maxHeight;
    this.volume = 0;
  }

  step(dt, Qin, Qout) {
    const dV = (Qin - Math.min(Qout, this.volume > 0 ? Infinity : 0)) * dt;
    this.volume += dV;
    this.volume = Math.max(0, Math.min(this.volume, this.getMaxVolume()));
  }

  getMaxVolume() {
    return this.area * this.maxHeight;
  }

  getLevel() {
    return Math.min(1, Math.max(0, this.volume / this.getMaxVolume()));
  }

  isOverflow() {
    return this.volume >= this.getMaxVolume() - 1e-6;
  }

  reset() {
    this.volume = 0;
  }
}

class Valve {
  constructor(flowRate = 0.8) {
    this.flowRate = flowRate;
    this.isOpen = false;
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  getFlowRate() {
    return this.isOpen ? this.flowRate : 0;
  }

  setFlowRate(rate) {
    this.flowRate = rate;
  }
}

// ============================================================================
// VIEW CLASSES (Pure Graphics, No Physics)
// ============================================================================

class TankView {
  constructor(tank, levelRect, statusText, levelText) {
    this.tank = tank;
    this.levelRect = levelRect;
    this.statusText = statusText; // May be null
    this.levelText = levelText;   // May be null
  }

  render() {
    const level = this.tank.getLevel();
    const hPx = 360 * level;
    const yPx = 360 - hPx;
    
    this.levelRect.setAttribute('y', yPx);
    this.levelRect.setAttribute('height', hPx);
    
    // Only update if element exists
    if (this.levelText) {
      this.levelText.textContent = `Level: ${(level * 100).toFixed(1)} %`;
    }
  }
}

class ValveView {
  constructor(valve, valveElement, handle, inletFlow, statusText, toggleButton) {
    this.valve = valve;
    this.valveElement = valveElement;
    this.handle = handle;
    this.inletFlow = inletFlow;
    this.statusText = statusText; // May be null
    this.toggleButton = toggleButton;
  }

  render(flowRate) {
    // Update valve visual state
    this.valveElement.setAttribute('aria-pressed', this.valve.isOpen);
    this.toggleButton.setAttribute('aria-pressed', this.valve.isOpen);
    this.toggleButton.textContent = this.valve.isOpen ? 'Close Inlet Valve' : 'Open Inlet Valve';
    
    // Update flow animation
    if (flowRate > 0) {
      const speed = Math.max(0.2, 1.2 - flowRate);
      this.inletFlow.classList.add('on');
      this.inletFlow.style.setProperty('--duration', `${speed * 600}ms`);
    } else {
      this.inletFlow.classList.remove('on');
    }
  }
}

class OutletView {
  constructor(outletFlow) {
    this.outletFlow = outletFlow;
  }

  render(flowRate, tankLevel) {
    if (flowRate > 0 && tankLevel > 0) {
      const speed = Math.max(0.2, 1.4 - flowRate);
      this.outletFlow.classList.add('on');
      this.outletFlow.style.setProperty('--duration', `${speed * 700}ms`);
    } else {
      this.outletFlow.classList.remove('on');
    }
  }
}

// ============================================================================
// SIMULATION CONTROLLER
// ============================================================================

class TankSimulation {
  constructor() {
    // Get DOM elements
    this.dom = this._getDOMElements();
    
    // Create models
    this.tank = new Tank(1.2, 1.0);
    this.inletValve = new Valve(0.8);
    
    // Create views
    this.tankView = new TankView(
      this.tank,
      this.dom.levelRect,
      this.dom.statusText,
      this.dom.levelText
    );
    
    this.valveView = new ValveView(
      this.inletValve,
      this.dom.valve,
      this.dom.handle,
      this.dom.inletFlow,
      this.dom.statusText,
      this.dom.toggleValve
    );
    
    this.outletView = new OutletView(this.dom.outletFlow);
    
    // Simulation state
    this.paused = false;
    this.gravityMode = false;
    this.outletFlowRate = 0.35;
    this.kCoeff = 0.6;
    this.valveOpenFraction = 0; // 0 to 1, controlled by popup valve

    
  this.pumpOn = true;              // Pump starts ON
  this.outletValvePos = 1.0;       // Outlet valve starts 100% open
  this.pumpCapacity = 1.2;         // Max pump flow rate (match your needs)
      
    // Setup event listeners
    this._setupEventListeners();
    
    // Start simulation
    this.lastTime = performance.now();
    this._run();
    
    console.log('Tank Simulation Started - Valve popup integrated');
  }

  _getDOMElements() {
    return {
      // SVG elements
      inletFlow: document.getElementById('inletFlow'),
      outletFlow: document.getElementById('outletFlow'),
      handle: document.getElementById('handle'),
      valve: document.getElementById('valve'),
      // Removed from SVG - no longer exist
      statusText: null,
      levelText: null,
      flowText: null,
      levelRect: document.getElementById('levelRect'),
      
      // Readout spans
      levelPct: document.getElementById('levelPct'),
      vol: document.getElementById('vol'),
      qinRead: document.getElementById('qinRead'),
      qoutRead: document.getElementById('qoutRead'),
      dtMs: document.getElementById('dtMs'),
      overflowText: document.getElementById('overflowText'),
      
      // Controls
      toggleValve: document.getElementById('toggleValve'),
      resetBtn: document.getElementById('resetBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      qout: document.getElementById('qout'),
      qoutVal: document.getElementById('qoutVal'),
      qin: document.getElementById('qin'),
      qinVal: document.getElementById('qinVal'),
      area: document.getElementById('area'),
      areaVal: document.getElementById('areaVal'),
      gravityModeCheck: document.getElementById('gravityMode'),
      kcoeff: document.getElementById('kcoeff'),
      kVal: document.getElementById('kVal')
    };
  }

_setupEventListeners() {
  // Button toggle for quick control (keep this)
  this.dom.toggleValve.addEventListener('click', () => this._toggleValve());
  
  // Reset button
  this.dom.resetBtn.addEventListener('click', () => this._reset());
  
  // Pause button
  this.dom.pauseBtn.addEventListener('click', () => this._togglePause());
  
  // Sliders
  this._bindSlider(this.dom.qout, this.dom.qoutVal, (val) => {
    this.outletFlowRate = val;
  });
  
  this._bindSlider(this.dom.qin, this.dom.qinVal, (val) => {
    this.inletValve.setFlowRate(val);
  });
  
  this._bindSlider(this.dom.area, this.dom.areaVal, (val) => {
    this.tank.area = val;
  });
  
  this._bindSlider(this.dom.kcoeff, this.dom.kVal, (val) => {
    this.kCoeff = val;
  });
  
  // Gravity mode checkbox
  this.dom.gravityModeCheck.addEventListener('change', (e) => {
    this.gravityMode = e.target.checked;
  });
  
  console.log('All event listeners set up successfully');
}

  _bindSlider(slider, output, onChange) {
    const sync = () => {
      const val = parseFloat(slider.value);
      output.textContent = val.toFixed(2);
      if (onChange) onChange(val);
    };
    slider.addEventListener('input', sync);
    slider.addEventListener('change', sync);
    sync();
  }

  _toggleValve() {
    this.inletValve.toggle();
    // Update valve open fraction to match binary state
    this.valveOpenFraction = this.inletValve.isOpen ? 1 : 0;
    console.log('Quick toggle - valve now:', this.valveOpenFraction);
  }

  _openValvePopup() {
    // Open the popup with current valve position (maintains last position)
    console.log('Opening valve popup with current position:', this.valveOpenFraction);
    
    if (!this.valvePopup) {
      console.error('Valve popup not initialized!');
      return;
    }
    
    if (this.valvePopup.isOpen) {
      console.log('Popup is already open, closing first...');
      this.valvePopup.close();
      setTimeout(() => this.valvePopup.open(this.valveOpenFraction), 400);
    } else {
      this.valvePopup.open(this.valveOpenFraction);
    }
  }

_onValvePopupChange(openFraction) {
    // FIXED: This is called live as the valve wheel is turned
    console.log('Valve changed to:', openFraction);
    
    // Update simulation based on valve position (0 to 1)
    this.valveOpenFraction = openFraction;
    
    // Update binary valve state for compatibility with views
    this.inletValve.isOpen = (openFraction > 0.05);
  }

  // Called from parent HTML when pump is toggled
  setPumpFactor(factor) {
    this.pumpOn = (factor > 0);
    console.log('Pump set to:', this.pumpOn ? 'ON' : 'OFF');
  }

  // Called from parent HTML when outlet valve is adjusted
  setOutletValve(position) {
    this.outletValvePos = Math.max(0, Math.min(1, position));
    console.log('Outlet valve set to:', (this.outletValvePos * 100).toFixed(0) + '%');
  }

  // Optional: for inlet valve (if you want proportional control)
  setInletValve(position) {
    this.valveOpenFraction = Math.max(0, Math.min(1, position));
    this.inletValve.isOpen = (position > 0.05);
    console.log('Inlet valve set to:', (this.valveOpenFraction * 100).toFixed(0) + '%');
  }
  
  _reset() {
    this.tank.reset();
    this.inletValve.isOpen = false;
    this.valveOpenFraction = 0;
    console.log('Simulation reset');
  }

  _togglePause() {
    this.paused = !this.paused;
    this.dom.pauseBtn.setAttribute('aria-pressed', this.paused);
    this.dom.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
  }

  _run() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    
    // Update dt display
    this.dom.dtMs.textContent = (dt * 1000).toFixed(1);
    
    if (!this.paused) {
      // INLET FLOW: proportional to valve opening
      const maxInletFlow = this.inletValve.flowRate;
      const Qin = maxInletFlow * this.valveOpenFraction;
      
      // OUTLET FLOW: depends on pump + outlet valve
      let Qout = 0;
      if (this.gravityMode) {
        // Gravity mode: flow depends on tank level
        Qout = this.kCoeff * this.outletValvePos * Math.sqrt(this.tank.getLevel());
      } else {
        // Normal mode: pump must be ON and valve must be open
        if (this.pumpOn) {
          Qout = this.outletValvePos * this.pumpCapacity;
        }
      }

      // Realistic gate: can't pump from empty tank
      if (this.tank.getLevel() <= 0.01) {
        Qout = 0;
      }
      
      // Update physics
      this.tank.step(dt, Qin, Qout);
      
      // Update all views
      this.tankView.render();
      this.valveView.render(Qin);
      this.outletView.render(Qout, this.tank.getLevel());
      
      // Update readouts
      this._updateReadouts(Qin, Qout);
    }
    
    requestAnimationFrame(() => this._run());
  }

  _updateReadouts(Qin, Qout) {
    const level = this.tank.getLevel();
    const pct = (level * 100).toFixed(1);
    const valvePct = (this.valveOpenFraction * 100).toFixed(0);
    
    // Show valve position as percentage
    const valveStatus = this.valveOpenFraction === 0 ? 'CLOSED' : 
                       this.valveOpenFraction === 1 ? 'OPEN' : 
                       `${valvePct}% OPEN`;
    
    // Update right panel readouts
    this.dom.levelPct.textContent = pct;
    this.dom.vol.textContent = this.tank.volume.toFixed(3);
    this.dom.qinRead.textContent = Qin.toFixed(2);
    this.dom.qoutRead.textContent = Qout.toFixed(2);
    
    // Show pump and outlet valve status in console
    const pumpStatus = this.pumpOn ? 'ON' : 'OFF';
    const outletPct = (this.outletValvePos * 100).toFixed(0);
    
    // Overflow warning
    this.dom.overflowText.classList.toggle('warn', this.tank.isOverflow());
  }
}

// ============================================================================
// INITIALIZE ON PAGE LOAD
// ============================================================================

let simulation;

window.addEventListener('DOMContentLoaded', () => {
  simulation = new TankSimulation();
  console.log('Tank Simulation Started with Live Valve Control');
});

// Expose for debugging
window.simulation = simulation;
