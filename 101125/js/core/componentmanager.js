/**
 * ComponentManager.js - Master orchestrator for all component managers
 * 
 * Coordinates: ValveManager, PumpManager, TankManager, PipeManager, PressureManager
 */

class ComponentManager {
  constructor(config) {
    this.config = config;
    this.flowNetwork = new FlowNetwork();
    
    // Component managers (initialized later)
    this.valveManager = null;
    this.pumpManager = null;
    this.tankManager = null;
    this.pipeManager = null;
    this.pressureManager = null;
    
    // Simulation state
    this.running = false;
    this.paused = false;
    this.lastTime = performance.now();
    
    console.log('ComponentManager initialized');
  }

  /**
   * Initialize all component managers
   */
  async initialize() {
    console.log('Initializing component managers...');
    
    try {
      // Initialize managers in order
      await this._initializeTanks();
      await this._initializePumps();
      await this._initializeValves();
      await this._initializePipes();
      await this._initializePressureSensors();
      
      // Build flow network
      this.flowNetwork.buildFromConfig(this.config);
      
      console.log('All component managers initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize component managers:', error);
      return false;
    }
  }

  /**
   * Initialize tank manager
   */
  async _initializeTanks() {
    if (!this.config.tanks || !window.TankManager) return;
    
    this.tankManager = new TankManager(this.config.tanks, this.flowNetwork);
    console.log('✓ TankManager ready');
  }

  /**
   * Initialize pump manager
   */
  async _initializePumps() {
    if (!this.config.pumps || !window.PumpManager) return;
    
    this.pumpManager = new PumpManager(this.config.pumps, this.flowNetwork);
    console.log('✓ PumpManager ready');
  }

  /**
   * Initialize valve manager
   */
  async _initializeValves() {
    if (!this.config.valves || !window.ValveManager) return;
    
    this.valveManager = new ValveManager(this.config.valves, this.flowNetwork);
    console.log('✓ ValveManager ready');
  }

  /**
   * Initialize pipe manager
   */
  async _initializePipes() {
    if (!this.config.pipes || !window.PipeManager) return;
    
    this.pipeManager = new PipeManager(this.config.pipes, this.flowNetwork);
    console.log('✓ PipeManager ready');
  }

  /**
   * Initialize pressure sensor manager
   */
  async _initializePressureSensors() {
    if (!this.config.pressureSensors || !window.PressureManager) return;
    
    this.pressureManager = new PressureManager(this.config.pressureSensors, this.flowNetwork);
    console.log('✓ PressureManager ready');
  }

  /**
   * Start simulation
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    
    this._simulationLoop();
    console.log('Simulation started');
  }

  /**
   * Pause simulation
   */
  pause() {
    this.paused = true;
    console.log('Simulation paused');
  }

  /**
   * Resume simulation
   */
  resume() {
    if (!this.running) {
      this.start();
      return;
    }
    
    this.paused = false;
    this.lastTime = performance.now();
    console.log('Simulation resumed');
  }

  /**
   * Stop simulation
   */
  stop() {
    this.running = false;
    this.paused = false;
    console.log('Simulation stopped');
  }

  /**
   * Main simulation loop
   */
  _simulationLoop() {
    if (!this.running) return;
    
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000); // Cap at 100ms
    this.lastTime = now;
    
    if (!this.paused) {
      // Calculate flows in the network
      this.flowNetwork.calculateFlows(dt);
      
      // Update all components
      this.flowNetwork.updateComponents(dt);
      
      // Render all components
      this.flowNetwork.renderComponents();
    }
    
    // Continue loop
    requestAnimationFrame(() => this._simulationLoop());
  }

  /**
   * Reset all components
   */
  reset() {
    this.flowNetwork.reset();
    
    if (this.tankManager) this.tankManager.reset();
    if (this.pumpManager) this.pumpManager.reset();
    if (this.valveManager) this.valveManager.reset();
    if (this.pipeManager) this.pipeManager.reset();
    if (this.pressureManager) this.pressureManager.reset();
    
    console.log('All components reset');
  }

  /**
   * Get component by ID (searches all managers)
   */
  getComponent(id) {
    return this.flowNetwork.getComponent(id);
  }

  /**
   * Get all components of a type
   */
  getComponentsByType(type) {
    return this.flowNetwork.getComponentsByType(type);
  }

  /**
   * Get manager by type
   */
  getManager(type) {
    const managers = {
      tank: this.tankManager,
      pump: this.pumpManager,
      valve: this.valveManager,
      pipe: this.pipeManager,
      pressure: this.pressureManager
    };
    
    return managers[type] || null;
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo() {
    return {
      running: this.running,
      paused: this.paused,
      network: this.flowNetwork.getNetworkInfo(),
      managers: {
        tanks: this.tankManager ? Object.keys(this.tankManager.tanks || {}).length : 0,
        pumps: this.pumpManager ? Object.keys(this.pumpManager.pumps || {}).length : 0,
        valves: this.valveManager ? Object.keys(this.valveManager.valves || {}).length : 0,
        pipes: this.pipeManager ? Object.keys(this.pipeManager.pipes || {}).length : 0,
        pressureSensors: this.pressureManager ? Object.keys(this.pressureManager.sensors || {}).length : 0
      }
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stop();
    
    if (this.tankManager) this.tankManager.destroy();
    if (this.pumpManager) this.pumpManager.destroy();
    if (this.valveManager) this.valveManager.destroy();
    if (this.pipeManager) this.pipeManager.destroy();
    if (this.pressureManager) this.pressureManager.destroy();
    
    this.flowNetwork.clear();
    
    console.log('ComponentManager destroyed');
  }
}

// Export
window.ComponentManager = ComponentManager;
