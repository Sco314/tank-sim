/**
 * Pump.js - Base pump component with proper flow constraints
 * 
 * Pump reads available supply from tank and constrains by valve position
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
   * SMART OUTPUT: Pump constrains flow based on:
   * 1. Available supply from tank (read from network)
   * 2. Pump capacity
   * 3. Downstream valve position
   */
getOutputFlow() {
  if (!this.running) return 0;
  
  let maxFlow = this.capacity * this.speed * this.efficiency;
  
  if (this.cavitation.active) {
    maxFlow *= this.cavitation.flowReduction;
  }
  
  if (!this.flowNetwork) return maxFlow;
  
  // CONSTRAINT 1: Check tank availability
  let availableFromTank = Infinity;
  let tankComponent = null;
  
  for (const inputId of this.inputs) {
    const tank = this._findUpstreamComponent(inputId, 'tank');
    if (tank) {
      tankComponent = tank;
      // Tank can supply based on current volume (50% per second max)
      availableFromTank = Math.min(availableFromTank, tank.volume * 0.5);
      
      if (tank.level < this.requiresMinLevel) {
        console.warn(`${this.name} stopped - tank level below minimum`);
        return 0;
      }
    }
  }
  
  // CONSTRAINT 2: Check valve
  let valveLimit = Infinity;
  for (const outputId of this.outputs) {
    const valve = this._findDownstreamComponent(outputId, 'valve');
    if (valve) {
      valveLimit = Math.min(valveLimit, valve.maxFlow * valve.position);
    }
  }
  
  // Actual flow = minimum of all constraints
  const actualFlow = Math.min(maxFlow, availableFromTank, valveLimit);
  
  // CRITICAL: Create the tank->pump flow so tank drains correctly
  if (tankComponent && actualFlow > 0) {
    this.flowNetwork.setFlow(tankComponent.id, this.id, actualFlow);
  }
  
  return actualFlow;
}

  /**
   * Helper: Find upstream component by type (looks through pipes)
   */
  _findUpstreamComponent(startId, targetType) {
    if (!this.flowNetwork) return null;
    
    const component = this.flowNetwork.getComponent(startId);
    if (!component) return null;
    
    if (component.type === targetType) return component;
    
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
    
    if (component.type === targetType) return component;
    
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
