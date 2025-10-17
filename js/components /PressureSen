/**
 * PressureSensor.js - Pressure sensor component
 * 
 * Monitors pressure at any point in the system
 */

class PressureSensor extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'sensor';
    this.sensorType = 'pressure';
    
    // Measurement properties
    this.range = config.range || [0, 10]; // [min, max] in bar
    this.units = config.units || 'bar';
    this.accuracy = config.accuracy || 0.01; // Reading precision
    
    // Location in system
    this.measurementPoint = config.measurementPoint || 'static'; // 'static', 'pump_inlet', 'pump_outlet', 'tank_bottom'
    this.heightOffset = config.heightOffset || 0; // Height above datum (m)
    
    // Current reading
    this.pressure = 0; // Current pressure reading (bar)
    this.trend = 0; // Rate of change (bar/s)
    this.previousPressure = 0;
    
    // Alarm thresholds
    this.lowAlarm = config.lowAlarm || null; // Low pressure alarm (bar)
    this.highAlarm = config.highAlarm || null; // High pressure alarm (bar)
    this.alarmActive = false;
    
    // Physical constants
    this.fluidDensity = config.fluidDensity || 1000; // kg/m³ (water)
    this.gravity = config.gravity || 9.81; // m/s²
    
    // Visual gauge element
    this.gaugeElement = null;
    
    this._initializeVisuals();
    
    console.log(`Pressure sensor created: ${this.name} (${this.range[0]}-${this.range[1]} ${this.units})`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      this.gaugeElement = element.querySelector('.pressure-gauge');
    }
  }

  /**
   * Calculate pressure based on sensor location and system state
   */
  calculatePressure() {
    let pressure = 0; // in Pascals
    
    switch (this.measurementPoint) {
      case 'atmospheric':
        // Atmospheric pressure (1 bar = 100,000 Pa)
        pressure = 101325; // Pa (1 atm)
        break;
        
      case 'tank_bottom':
        // Static pressure from liquid column: P = ρgh
        const tank = this._getTankFromInputs();
        if (tank) {
          const liquidHeight = tank.level * tank.maxHeight; // meters
          pressure = this.fluidDensity * this.gravity * liquidHeight;
          pressure += 101325; // Add atmospheric
        } else {
          pressure = 101325; // Just atmospheric if no tank
        }
        break;
        
      case 'pump_inlet':
        // Suction pressure (may be below atmospheric)
        const sourceTank = this._getTankFromInputs();
        if (sourceTank) {
          const liquidHeight = sourceTank.level * sourceTank.maxHeight;
          // Account for elevation difference
          const elevationDiff = this.heightOffset;
          const netHead = liquidHeight - elevationDiff;
          pressure = this.fluidDensity * this.gravity * netHead;
          pressure += 101325; // Add atmospheric
          
          // Subtract dynamic losses (simplified)
          const flow = this.flowNetwork.getInputFlow(this.id);
          const velocityHead = 0.5 * this.fluidDensity * Math.pow(flow * 4, 2); // Simplified v²
          pressure -= velocityHead * 0.1; // 10% loss factor
        } else {
          pressure = 101325;
        }
        break;
        
      case 'pump_outlet':
        // Discharge pressure (pump adds energy)
        const pump = this._getPumpFromInputs();
        if (pump && pump.running) {
          // Base pressure from inlet
          const inletPressure = this.calculateInletPressure();
          
          // Add pump head (simplified: 10m head per m³/s capacity)
          const pumpHead = pump.capacity * 10; // meters of head
          const pumpPressure = this.fluidDensity * this.gravity * pumpHead;
          
          pressure = inletPressure + pumpPressure;
        } else {
          pressure = this.calculateInletPressure(); // No boost if pump off
        }
        break;
        
      case 'static':
      default:
        // Simple static pressure at height offset
        pressure = 101325 + (this.fluidDensity * this.gravity * this.heightOffset);
        break;
    }
    
    // Convert to bar (1 bar = 100,000 Pa)
    return pressure / 100000;
  }

  /**
   * Helper: Calculate inlet pressure (used by pump_outlet)
   */
  calculateInletPressure() {
    const tank = this._getTankFromInputs();
    if (tank) {
      const liquidHeight = tank.level * tank.maxHeight;
      return 101325 + (this.fluidDensity * this.gravity * liquidHeight);
    }
    return 101325;
  }

  /**
   * Helper: Get tank from input connections
   */
  _getTankFromInputs() {
    if (!this.flowNetwork) return null;
    
    for (const inputId of this.inputs) {
      const component = this.flowNetwork.getComponent(inputId);
      if (component && component.type === 'tank') {
        return component;
      }
    }
    return null;
  }

  /**
   * Helper: Get pump from input connections
   */
  _getPumpFromInputs() {
    if (!this.flowNetwork) return null;
    
    for (const inputId of this.inputs) {
      const component = this.flowNetwork.getComponent(inputId);
      if (component && component.type === 'pump') {
        return component;
      }
    }
    return null;
  }

  /**
   * Update sensor reading
   */
  update(dt) {
    // Store previous reading
    this.previousPressure = this.pressure;
    
    // Calculate new pressure
    this.pressure = this.calculatePressure();
    
    // Apply accuracy (round to sensor precision)
    this.pressure = Math.round(this.pressure / this.accuracy) * this.accuracy;
    
    // Calculate trend (rate of change)
    this.trend = (this.pressure - this.previousPressure) / dt;
    
    // Check alarms
    this._checkAlarms();
  }

  /**
   * Check if pressure is outside alarm limits
   */
  _checkAlarms() {
    const wasActive = this.alarmActive;
    
    if (this.lowAlarm !== null && this.pressure < this.lowAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ Low pressure alarm: ${this.name} (${this.pressure.toFixed(2)} ${this.units})`);
      }
    } else if (this.highAlarm !== null && this.pressure > this.highAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ High pressure alarm: ${this.name} (${this.pressure.toFixed(2)} ${this.units})`);
      }
    } else {
      if (wasActive) {
        console.log(`✅ Pressure normal: ${this.name}`);
      }
      this.alarmActive = false;
    }
  }

  /**
   * Render visual gauge (if element exists)
   */
  render() {
    if (!this.gaugeElement) return;
    
    // Calculate gauge position (0-100%)
    const [min, max] = this.range;
    const percent = Math.max(0, Math.min(100, 
      ((this.pressure - min) / (max - min)) * 100
    ));
    
    // Update gauge needle or bar
    const needle = this.gaugeElement.querySelector('.gauge-needle');
    if (needle) {
      needle.style.transform = `rotate(${percent * 1.8 - 90}deg)`; // -90° to 90°
    }
    
    // Update reading text
    const reading = this.gaugeElement.querySelector('.gauge-reading');
    if (reading) {
      reading.textContent = `${this.pressure.toFixed(2)} ${this.units}`;
    }
    
    // Update alarm indicator
    if (this.alarmActive) {
      this.gaugeElement.classList.add('alarm');
    } else {
      this.gaugeElement.classList.remove('alarm');
    }
  }

  /**
   * Get current pressure
   */
  getPressure() {
    return this.pressure;
  }

  /**
   * Get pressure as string with units
   */
  getPressureString() {
    return `${this.pressure.toFixed(2)} ${this.units}`;
  }

  /**
   * Check if pressure is in normal range
   */
  isNormal() {
    return !this.alarmActive;
  }

  /**
   * Get sensor status
   */
  getStatus() {
    if (this.lowAlarm !== null && this.pressure < this.lowAlarm) {
      return 'LOW';
    }
    if (this.highAlarm !== null && this.pressure > this.highAlarm) {
      return 'HIGH';
    }
    return 'NORMAL';
  }

  /**
   * Reset sensor
   */
  reset() {
    super.reset();
    this.pressure = 0;
    this.previousPressure = 0;
    this.trend = 0;
    this.alarmActive = false;
  }

  /**
   * Get sensor info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      pressure: this.getPressureString(),
      trend: this.trend.toFixed(3) + ' bar/s',
      measurementPoint: this.measurementPoint,
      range: `${this.range[0]}-${this.range[1]} ${this.units}`,
      status: this.getStatus(),
      alarm: this.alarmActive
    };
  }
}

// Export
window.PressureSensor = PressureSensor;
