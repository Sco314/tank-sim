/**
 * PressureManager.js - Manages all pressure sensors
 * 
 * Creates, updates, and displays pressure readings
 */

class PressureManager {
  constructor(config, flowNetwork) {
    this.config = config;
    this.flowNetwork = flowNetwork;
    this.sensors = {};
    
    this._initializeSensors();
    this._setupStatusDisplay();
    
    console.log(`PressureManager initialized with ${Object.keys(this.sensors).length} sensors`);
  }

  /**
   * Initialize all sensors from config
   */
  _initializeSensors() {
    for (const [key, cfg] of Object.entries(this.config)) {
      const sensor = new PressureSensor({
        ...cfg,
        flowNetwork: this.flowNetwork
      });
      
      this.sensors[key] = sensor;
      this.flowNetwork.addComponent(sensor);
      
      // Setup change callback
      sensor.onChange = (s) => this._onSensorChange(key, s);
    }
  }

  /**
   * Setup status display updates
   */
  _setupStatusDisplay() {
    // Update sensor displays every 100ms (10Hz)
    this.statusInterval = setInterval(() => {
      this._updateStatusDisplays();
    }, 100);
  }

  /**
   * Update all status displays
   */
  _updateStatusDisplays() {
    for (const [key, sensor] of Object.entries(this.sensors)) {
      // Update any status elements that exist
      const pressureEl = document.getElementById(`${sensor.id}Pressure`);
      const statusEl = document.getElementById(`${sensor.id}Status`);
      const trendEl = document.getElementById(`${sensor.id}Trend`);
      
      if (pressureEl) {
        pressureEl.textContent = sensor.getPressureString();
      }
      
      if (statusEl) {
        const status = sensor.getStatus();
        statusEl.textContent = status === 'NORMAL' ? '✅ OK' : 
                               status === 'LOW' ? '⚠️ LOW' : 
                               '⚠️ HIGH';
        
        // Color coding
        if (status === 'NORMAL') {
          statusEl.style.color = '#3ddc97';
        } else {
          statusEl.style.color = '#ff6b6b';
        }
      }
      
      if (trendEl) {
        const trend = sensor.trend;
        const arrow = trend > 0.01 ? '↑' : trend < -0.01 ? '↓' : '→';
        trendEl.textContent = arrow;
        trendEl.style.color = trend > 0 ? '#3ddc97' : trend < 0 ? '#ff6b6b' : '#9bb0ff';
      }
    }
  }

  /**
   * Called when sensor reading changes
   */
  _onSensorChange(key, sensor) {
    // Optional: log significant changes
    if (Math.abs(sensor.trend) > 0.1) {
      console.log(`Pressure ${key}: ${sensor.getPressureString()} (${sensor.trend > 0 ? '↑' : '↓'})`);
    }
  }

  /**
   * Get sensor by key
   */
  getSensor(key) {
    return this.sensors[key];
  }

  /**
   * Get all sensors
   */
  getAllSensors() {
    return this.sensors;
  }

  /**
   * Get all pressure readings
   */
  getAllReadings() {
    const readings = {};
    for (const [key, sensor] of Object.entries(this.sensors)) {
      readings[key] = {
        pressure: sensor.pressure,
        units: sensor.units,
        status: sensor.getStatus(),
        alarm: sensor.alarmActive
      };
    }
    return readings;
  }

  /**
   * Check if any sensor has active alarm
   */
  hasActiveAlarms() {
    for (const sensor of Object.values(this.sensors)) {
      if (sensor.alarmActive) return true;
    }
    return false;
  }

  /**
   * Get list of active alarms
   */
  getActiveAlarms() {
    const alarms = [];
    for (const [key, sensor] of Object.entries(this.sensors)) {
      if (sensor.alarmActive) {
        alarms.push({
          sensor: key,
          name: sensor.name,
          pressure: sensor.getPressureString(),
          status: sensor.getStatus()
        });
      }
    }
    return alarms;
  }

  /**
   * Get highest pressure reading
   */
  getMaxPressure() {
    let max = 0;
    for (const sensor of Object.values(this.sensors)) {
      if (sensor.pressure > max) max = sensor.pressure;
    }
    return max;
  }

  /**
   * Get lowest pressure reading
   */
  getMinPressure() {
    let min = Infinity;
    for (const sensor of Object.values(this.sensors)) {
      if (sensor.pressure < min) min = sensor.pressure;
    }
    return min === Infinity ? 0 : min;
  }

  /**
   * Reset all sensors
   */
  reset() {
    for (const sensor of Object.values(this.sensors)) {
      sensor.reset();
    }
    console.log('All pressure sensors reset');
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Clear status interval
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    for (const sensor of Object.values(this.sensors)) {
      sensor.destroy();
    }
    
    this.sensors = {};
  }
}

// Export
window.PressureManager = PressureManager;
