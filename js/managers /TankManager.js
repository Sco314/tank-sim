/**
 * TankManager.js - Manages all tanks in the system
 * 
 * Creates, configures, and updates all tank components
 */

class TankManager {
  constructor(config, flowNetwork) {
    this.config = config;
    this.flowNetwork = flowNetwork;
    this.tanks = {};
    
    this._initializeTanks();
    this._setupStatusDisplay();
    
    console.log(`TankManager initialized with ${Object.keys(this.tanks).length} tanks`);
  }

  /**
   * Initialize all tanks from config
   */
  _initializeTanks() {
    for (const [key, cfg] of Object.entries(this.config)) {
      const tank = new Tank({
        ...cfg,
        flowNetwork: this.flowNetwork
      });
      
      this.tanks[key] = tank;
      this.flowNetwork.addComponent(tank);
      
      // Setup change callback
      tank.onChange = (t) => this._onTankChange(key, t);
      
      // Initial render
      tank.render();
    }
  }

  /**
   * Setup status display updates
   */
  _setupStatusDisplay() {
    // Update tank status displays every 100ms (10Hz)
    this.statusInterval = setInterval(() => {
      this._updateStatusDisplays();
    }, 100);
  }

  /**
   * Update all status displays
   */
  _updateStatusDisplays() {
    for (const [key, tank] of Object.entries(this.tanks)) {
      // Update any status elements that exist
      const statusEl = document.getElementById(`${tank.id}Status`);
      const levelEl = document.getElementById(`${tank.id}Level`);
      const volumeEl = document.getElementById(`${tank.id}Volume`);
      const flowInEl = document.getElementById(`${tank.id}FlowIn`);
      const flowOutEl = document.getElementById(`${tank.id}FlowOut`);
      
      if (statusEl) {
        statusEl.textContent = tank.isEmpty() ? '⚠️ EMPTY' : 
                               tank.isFull() ? '⚠️ FULL' : 
                               tank.isLow() ? '⚠️ LOW' : 
                               tank.isHigh() ? '⚠️ HIGH' : '✅ OK';
        
        // Color coding
        if (tank.isEmpty() || tank.isFull()) {
          statusEl.style.color = '#ff6b6b';
        } else if (tank.isLow() || tank.isHigh()) {
          statusEl.style.color = '#ffc107';
        } else {
          statusEl.style.color = '#3ddc97';
        }
      }
      
      if (levelEl) {
        levelEl.textContent = tank.getLevelPercent() + '%';
      }
      
      if (volumeEl) {
        volumeEl.textContent = tank.volume.toFixed(3) + ' m³';
      }
      
      if (flowInEl) {
        flowInEl.textContent = tank.lastInputFlow.toFixed(2) + ' m³/s';
      }
      
      if (flowOutEl) {
        flowOutEl.textContent = tank.lastOutputFlow.toFixed(2) + ' m³/s';
      }
    }
  }

  /**
   * Called when tank state changes
   */
  _onTankChange(key, tank) {
    console.log(`Tank ${key} changed:`, tank.getInfo());
  }

  /**
   * Get tank by key
   */
  getTank(key) {
    return this.tanks[key];
  }

  /**
   * Get all tanks
   */
  getAllTanks() {
    return this.tanks;
  }

  /**
   * Set tank level by key
   */
  setTankLevel(key, percent) {
    const tank = this.tanks[key];
    if (!tank) {
      console.warn(`Tank ${key} not found`);
      return;
    }
    
    tank.setLevelPercent(percent);
  }

  /**
   * Check if any tank is overflowing
   */
  hasOverflow() {
    for (const tank of Object.values(this.tanks)) {
      if (tank.isFull()) return true;
    }
    return false;
  }

  /**
   * Check if any tank is empty
   */
  hasEmpty() {
    for (const tank of Object.values(this.tanks)) {
      if (tank.isEmpty()) return true;
    }
    return false;
  }

  /**
   * Get total system volume
   */
  getTotalVolume() {
    let total = 0;
    for (const tank of Object.values(this.tanks)) {
      total += tank.volume;
    }
    return total;
  }

  /**
   * Get total system capacity
   */
  getTotalCapacity() {
    let total = 0;
    for (const tank of Object.values(this.tanks)) {
      total += tank.maxVolume;
    }
    return total;
  }

  /**
   * Get system-wide fill percentage
   */
  getSystemFillPercent() {
    const capacity = this.getTotalCapacity();
    if (capacity === 0) return 0;
    return Math.round((this.getTotalVolume() / capacity) * 100);
  }

  /**
   * Reset all tanks
   */
  reset() {
    for (const tank of Object.values(this.tanks)) {
      tank.reset();
      tank.render();
    }
    console.log('All tanks reset');
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Clear status interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    for (const tank of Object.values(this.tanks)) {
      tank.destroy();
    }
    
    this.tanks = {};
  }
}

// Export
window.TankManager = TankManager;
