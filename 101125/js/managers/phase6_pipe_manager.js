/**
 * PipeManager.js - Manages all pipes and flow animations
 * 
 * Controls flow visualization throughout the system
 */

class PipeManager {
  constructor(config, flowNetwork) {
    this.config = config;
    this.flowNetwork = flowNetwork;
    this.pipes = {};
    
    this._initializePipes();
    this._setupFlowMonitoring();
    
    console.log(`PipeManager initialized with ${Object.keys(this.pipes).length} pipes`);
  }

  /**
   * Initialize all pipes from config
   */
  _initializePipes() {
    for (const [key, cfg] of Object.entries(this.config)) {
      const pipe = new Pipe({
        ...cfg,
        flowNetwork: this.flowNetwork
      });
      
      this.pipes[key] = pipe;
      this.flowNetwork.addComponent(pipe);
      
      // Setup change callback
      pipe.onChange = (p) => this._onPipeChange(key, p);
    }
  }

  /**
   * Setup flow monitoring for debug
   */
  _setupFlowMonitoring() {
    // Optional: log significant flow changes
    this.lastLogTime = performance.now();
    this.logInterval = 5000; // Log every 5 seconds
  }

  /**
   * Called when pipe state changes
   */
  _onPipeChange(key, pipe) {
    // Optional: log flow changes
    const now = performance.now();
    if (now - this.lastLogTime > this.logInterval) {
      if (pipe.flowRate > 0.001) {
        console.log(`Pipe ${key}: ${pipe.flowRate.toFixed(2)} m³/s (${pipe.getFlowRegime()})`);
      }
      this.lastLogTime = now;
    }
  }

  /**
   * Get pipe by key
   */
  getPipe(key) {
    return this.pipes[key];
  }

  /**
   * Get all pipes
   */
  getAllPipes() {
    return this.pipes;
  }

  /**
   * Get all active flows (pipes with flow > 0)
   */
  getActiveFlows() {
    const active = [];
    for (const [key, pipe] of Object.entries(this.pipes)) {
      if (pipe.flowRate > 0.001) {
        active.push({
          pipe: key,
          name: pipe.name,
          flowRate: pipe.flowRate,
          velocity: pipe.velocity
        });
      }
    }
    return active;
  }

  /**
   * Get total system flow rate
   */
  getTotalFlow() {
    let total = 0;
    for (const pipe of Object.values(this.pipes)) {
      total += pipe.flowRate;
    }
    return total;
  }

  /**
   * Get highest flow rate
   */
  getMaxFlow() {
    let max = 0;
    for (const pipe of Object.values(this.pipes)) {
      if (pipe.flowRate > max) max = pipe.flowRate;
    }
    return max;
  }

  /**
   * Check if any pipe is flowing
   */
  hasActiveFlow() {
    for (const pipe of Object.values(this.pipes)) {
      if (pipe.flowRate > 0.001) return true;
    }
    return false;
  }

  /**
   * Get flow path from component A to component B
   */
  getFlowPath(fromId, toId) {
    const path = [];
    for (const [key, pipe] of Object.entries(this.pipes)) {
      if (pipe.inputs.includes(fromId) && pipe.outputs.includes(toId)) {
        path.push(key);
      }
    }
    return path;
  }

  /**
   * Enable/disable all flow animations
   */
  setAnimationsEnabled(enabled) {
    for (const pipe of Object.values(this.pipes)) {
      if (enabled) {
        pipe.render();
      } else {
        if (pipe.flowPath) {
          pipe.flowPath.classList.remove('on');
        }
      }
    }
  }

  /**
   * Set global animation speed multiplier
   */
  setGlobalAnimationSpeed(speed) {
    for (const pipe of Object.values(this.pipes)) {
      pipe.animationSpeed = speed;
    }
  }

  /**
   * Reset all pipes
   */
  reset() {
    for (const pipe of Object.values(this.pipes)) {
      pipe.reset();
    }
    console.log('All pipes reset');
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    for (const pipe of Object.values(this.pipes)) {
      pipe.destroy();
    }
    
    this.pipes = {};
  }
}

// Export
window.PipeManager = PipeManager;
