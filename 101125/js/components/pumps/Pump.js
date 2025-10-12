/**
 * Pump.js - Base pump component
 * 
 * All pump types inherit from this base class.
 */

class Pump extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'pump';
    this.pumpType = config.pumpType || 'fixed'; // 'fixed', 'variable', '3-speed'
    
    // Physical properties
    this.capacity = config.capacity || 1.0; // Max flow rate (m³/s)
    this.efficiency = config.efficiency || 0.95; // 0-1
    this.power = config.power || 0; // kW (optional)
    
    // Operating state
    this.running = false;
    this.speed = config.initialSpeed || 0; // 0-1 or discrete speeds
    this.requiresMinLevel = config.requiresMinLevel || 0; // Won't run if source < this level
    
    // Cavitation feature (background system issue)
    this.cavitation = {
      enabled: config.cavitation?.enabled || false,
      triggerTime: config.cavitation?.triggerTime || 60, // seconds (null = at startup)
      duration: config.cavitation?.duration || 5, // seconds
      flowReduction: config.cavitation?.flowReduction || 0.3, // flow reduced to 30%
      active: false,
      startTime: null,
      elapsedTime: 0
    };
    
    // Tracking
    this.runTime = 0; // Total runtime in seconds
    this.startCount = 0; // Number of times started
  }

  /**
   * Start the pump
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.startCount++;
    
    // Check if cavitation triggers at startup
    if (this.cavitation.enabled && this.cavitation.triggerTime === null) {
      this._startCavitation();
    }
    
    this.notifyChange();
    console.log(`${this.name} started (start count: ${this.startCount})`);
  }

  /**
   * Stop the pump
   */
  stop() {
    if (!this.running) return;
    
    this.running = false;
    this.cavitation.active = false;
    this.cavitation.startTime = null;
    
    this.notifyChange();
    console.log(`${this.name} stopped`);
  }

  /**
   * Set pump speed (0-1 for variable, discrete for 3-speed)
   */
  setSpeed(speed) {
    this.speed = Math.max(0, Math.min(1, speed));
    this.notifyChange();
  }

  /**
   * Check if pump can run (source has enough fluid)
   */
  canRun(sourceLevel) {
    if (sourceLevel === undefined) return true; // No level check
    return sourceLevel >= this.requiresMinLevel;
  }

  /**
   * Start cavitation
   */
  _startCavitation() {
    if (!this.cavitation.enabled) return;
    
    this.cavitation.active = true;
    this.cavitation.startTime = performance.now();
    console.warn(`⚠️ ${this.name} CAVITATION STARTED!`);
  }

  /**
   * Update cavitation state
   */
  _updateCavitation(dt) {
    if (!this.cavitation.enabled || !this.running) return;
    
    this.cavitation.elapsedTime += dt;
    
    // Check if cavitation should start (time-based trigger)
    if (!this.cavitation.active && 
        this.cavitation.triggerTime !== null && 
        this.cavitation.elapsedTime >= this.cavitation.triggerTime) {
      this._startCavitation();
    }
    
    // Check if cavitation should end
    if (this.cavitation.active) {
      const cavitationDuration = (performance.now() - this.cavitation.startTime) / 1000;
      if (cavitationDuration >= this.cavitation.duration) {
        this.cavitation.active = false;
        this.cavitation.startTime = null;
        console.log(`${this.name} cavitation ended`);
      }
    }
  }

  /**
   * Get current output flow rate
   */
  getOutputFlow() {
    if (!this.running) return 0;
    
    // Base flow calculation
    let flow = this.capacity * this.speed * this.efficiency;
    
    // Apply cavitation reduction if active
    if (this.cavitation.active) {
      flow *= this.cavitation.flowReduction;
    }
    
    return flow;
  }

  /**
   * Update pump state
   */
  update(dt) {
    if (!this.running) return;
    
    this.runTime += dt;
    this._updateCavitation(dt);
  }

  /**
   * Reset pump
   */
  reset() {
    super.reset();
    this.running = false;
    this.speed = 0;
    this.runTime = 0;
    this.startCount = 0;
    this.cavitation.active = false;
    this.cavitation.startTime = null;
    this.cavitation.elapsedTime = 0;
  }

  /**
   * Get pump info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      pumpType: this.pumpType,
      running: this.running,
      speed: this.speed,
      capacity: this.capacity,
      outputFlow: this.getOutputFlow(),
      cavitation: this.cavitation.active,
      runTime: this.runTime.toFixed(1),
      startCount: this.startCount
    };
  }
}

// Export
window.Pump = Pump;
