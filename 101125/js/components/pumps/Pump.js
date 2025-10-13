/**
 * Pump.js - Base pump component with proper flow constraints
 * 
 * Pump flow is limited by BOTH upstream (tank) AND downstream (valve)
 */

class Pump extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'pump';
    this.pumpType = config.pumpType || 'fixed';
    
    // Physical properties
    this.capacity = config.capacity || 1.0;
    this.efficiency = config.efficiency || 0.95;
    this.power = config.power || 0;
    
    // Operating state
    this.running = false;
    this.speed = config.initialSpeed || 0;
    this.requiresMinLevel = config.requiresMinLevel || 0;
    
    // Cavitation
    this.cavitation = {
      enabled: config.cavitation?.enabled || false,
      triggerTime: config.cavitation?.triggerTime || 60,
      duration: config.cavitation?.duration || 5,
      flowReduction: config.cavitation?.flowReduction || 0.3,
      active: false,
      startTime: null,
      elapsedTime: 0
    };
    
    // Tracking
    this.runTime = 0;
    this.startCount = 0;
  }

  start() {
    if (this.running) return;
    
    this.running = true;
    this.startCount++;
    
    if (this.cavitation.enabled && this.cavitation.triggerTime === null) {
      this._startCavitation();
    }
    
    this.notifyChange();
    console.log(`${this.name} started (start count: ${this.startCount})`);
  }

  stop() {
    if (!this.running) return;
    
    this.running = false;
    this.cavitation.active = false;
    this.cavitation.startTime = null;
    
    this.notifyChange();
    console.log(`${this.name} stopped`);
  }

  setSpeed(speed) {
    this.speed = Math.max(0, Math.min(1, speed));
    this.notifyChange();
  }

  canRun(sourceLevel) {
    if (sourceLevel === undefined) return true;
    return sourceLevel >= this.requiresMinLevel;
  }

  _startCavitation() {
    if (!this.cavitation.enabled) return;
    
    this.cavitation.active = true;
    this.cavitation.startTime = performance.now();
    console.warn(`⚠️ ${this.name} CAVITATION STARTED!`);
  }

  _updateCavitation(dt) {
    if (!this.cavitation.enabled || !this.running) return;
    
    this.cavitation.elapsedTime += dt;
    
    if (!this.cavitation.active && 
        this.cavitation.triggerTime !== null && 
        this.cavitation.elapsedTime >= this.cavitation.triggerTime) {
      this._startCavitation();
    }
    
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
   * FIXED: Pump output limited by BOTH tank supply AND outlet valve
   * Now looks THROUGH pipes to find actual tanks and valves
   */
  getOutputFlow() {
    if (!this.running) return 0;
    
    // Start with pump's rated capacity
    let maxFlow = this.capacity * this.speed * this.efficiency;
    
    // Apply cavitation if active
    if (this.cavitation.active) {
      maxFlow *= this.cavitation.flowReduction;
    }
    
    if (!this.flowNetwork) return maxFlow;
    
    // CONSTRAINT 1: Check upstream (tank) - can it supply enough?
    let availableFromTank = Infinity;
    
    for (const inputId of this.inputs) {
      // Look through pipes to find the actual tank
      const tank = this._findUpstreamComponent(inputId, 'tank');
      
      if (tank) {
        // Calculate how much tank can supply (based on current volume)
        const tankVolume = tank.volume || 0;
        availableFromTank = Math.min(availableFromTank, tankVolume * 10);
        
        // Check minimum level requirement
        if (tank.level < this.requiresMinLevel) {
          console.warn(`${this.name} stopped - tank level below minimum`);
          return 0;
        }
      }
    }
    
    // CONSTRAINT 2: Check downstream (outlet valve)
    let maxThroughValve = Infinity;
    
    for (const outputId of this.outputs) {
      // Look through pipes to find the actual valve
      const valve = this._findDownstreamComponent(outputId, 'valve');
      
      if (valve) {
        // Valve limits flow based on position
        const valveFlow = valve.maxFlow * valve.position;
        maxThroughValve = Math.min(maxThroughValve, valveFlow);
        
        if (valveFlow < maxFlow) {
          console.log(`${this.name} constrained by ${valve.name}: ${valveFlow.toFixed(3)} m³/s`);
        }
      }
    }
    
    // Pump output = minimum of all constraints
    const actualFlow = Math.min(maxFlow, availableFromTank, maxThroughValve);
    
    return actualFlow;
  }

  /**
   * Helper: Find upstream component by type (looks through pipes)
   */
  _findUpstreamComponent(startId, targetType) {
    if (!this.flowNetwork) return null;
    
    const component = this.flowNetwork.getComponent(startId);
    if (!component) return null;
    
    // Found it!
    if (component.type === targetType) return component;
    
    // If it's a pipe, look further upstream
    if (component.type === 'pipe' && component.inputs && component.inputs.length > 0) {
      for (const inputId of component.inputs) {
        const result = this._findUpstreamComponent(inputId, targetType);
        if (result) return result;
      }
    }
    
    return null;
  }

  /**
   * Helper: Find downstream component by type (looks through pipes)
   */
  _findDownstreamComponent(startId, targetType) {
    if (!this.flowNetwork) return null;
    
    const component = this.flowNetwork.getComponent(startId);
    if (!component) return null;
    
    // Found it!
    if (component.type === targetType) return component;
    
    // If it's a pipe, look further downstream
    if (component.type === 'pipe' && component.outputs && component.outputs.length > 0) {
      for (const outputId of component.outputs) {
        const result = this._findDownstreamComponent(outputId, targetType);
        if (result) return result;
      }
    }
    
    return null;
  }

  update(dt) {
    if (!this.running) return;
    
    this.runTime += dt;
    this._updateCavitation(dt);
  }

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
