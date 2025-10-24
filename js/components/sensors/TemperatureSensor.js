/**
 * TemperatureSensor.js - Temperature sensor component
 *
 * Monitors temperature at any point in the system
 * Supports both Celsius and Fahrenheit display
 */

class TemperatureSensor extends Component {
  constructor(config) {
    super(config);

    this.type = 'sensor';
    this.sensorType = 'temperature';

    // Measurement properties
    this.range = config.range || [-20, 120]; // [min, max] in °C
    this.units = config.units || '°C'; // '°C' or '°F'
    this.accuracy = config.accuracy || 0.1; // Reading precision (°C)

    // Measurement location
    this.measurementPoint = config.measurementPoint || 'fluid'; // 'fluid', 'tank', 'inlet', 'outlet', 'ambient'

    // Current reading
    this.temperature = 20; // Current temperature (°C, internal)
    this.trend = 0; // Rate of change (°C/s)
    this.previousTemperature = 20;

    // Averaging for stability
    this.averagingTime = config.averagingTime || 1.0; // seconds
    this.tempHistory = [];
    this.maxHistoryLength = 50;

    // Alarm thresholds (in °C)
    this.lowAlarm = config.lowAlarm || null; // Low temperature alarm (°C)
    this.highAlarm = config.highAlarm || null; // High temperature alarm (°C)
    this.alarmActive = false;

    // Visual gauge element
    this.gaugeElement = null;

    this._initializeVisuals();

    console.log(`Temperature sensor created: ${this.name} (${this.range[0]}-${this.range[1]} ${this.units})`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      this.gaugeElement = element.querySelector('.temperature-gauge');
    }
  }

  /**
   * Measure temperature at sensor location
   */
  measureTemperature() {
    if (!this.flowNetwork) return 20; // Default room temperature

    let temperature = 20; // Default

    switch (this.measurementPoint) {
      case 'ambient':
        // Ambient temperature (constant)
        temperature = 20; // °C
        break;

      case 'tank':
        // Temperature of fluid in connected tank
        const tank = this._getTankFromInputs();
        if (tank && tank.temperature !== undefined) {
          temperature = tank.temperature;
        }
        break;

      case 'inlet':
        // Temperature of incoming flow
        const inletTemp = this._getInletTemperature();
        if (inletTemp !== null) {
          temperature = inletTemp;
        }
        break;

      case 'outlet':
        // Temperature of outgoing flow
        const outletTemp = this._getOutletTemperature();
        if (outletTemp !== null) {
          temperature = outletTemp;
        }
        break;

      case 'fluid':
      default:
        // General fluid temperature (from connected component)
        temperature = this._getFluidTemperature();
        break;
    }

    return temperature;
  }

  /**
   * Get fluid temperature from connected component
   */
  _getFluidTemperature() {
    // Check all input components for temperature
    for (const inputId of this.inputs) {
      const component = this.flowNetwork.getComponent(inputId);
      if (component && component.temperature !== undefined) {
        return component.temperature;
      }
    }

    // Check feed components for supply temperature
    const feeds = this.flowNetwork.getComponentsByType('feed');
    for (const feed of feeds) {
      if (feed.temperature !== undefined) {
        return feed.temperature;
      }
    }

    return 20; // Default
  }

  /**
   * Get inlet temperature (temperature of incoming flow)
   */
  _getInletTemperature() {
    // Find upstream component with temperature
    for (const inputId of this.inputs) {
      const component = this.flowNetwork.getComponent(inputId);
      if (component && component.temperature !== undefined) {
        return component.temperature;
      }
    }
    return null;
  }

  /**
   * Get outlet temperature (temperature of outgoing flow)
   */
  _getOutletTemperature() {
    // Find downstream component with temperature
    for (const outputId of this.outputs) {
      const component = this.flowNetwork.getComponent(outputId);
      if (component && component.temperature !== undefined) {
        return component.temperature;
      }
    }
    return null;
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
   * Update sensor reading
   */
  update(dt) {
    // Store previous reading
    this.previousTemperature = this.temperature;

    // Measure new temperature
    this.temperature = this.measureTemperature();

    // Apply accuracy (round to sensor precision)
    this.temperature = Math.round(this.temperature / this.accuracy) * this.accuracy;

    // Update temperature history for averaging
    this.tempHistory.push({ time: performance.now(), temp: this.temperature });

    // Trim history to max length
    if (this.tempHistory.length > this.maxHistoryLength) {
      this.tempHistory.shift();
    }

    // Calculate trend (rate of change)
    this.trend = (this.temperature - this.previousTemperature) / dt;

    // Check alarms
    this._checkAlarms();
  }

  /**
   * Check if temperature is outside alarm limits
   */
  _checkAlarms() {
    const wasActive = this.alarmActive;

    if (this.lowAlarm !== null && this.temperature < this.lowAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ Low temperature alarm: ${this.name} (${this.getTemperatureString()})`);
      }
    } else if (this.highAlarm !== null && this.temperature > this.highAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ High temperature alarm: ${this.name} (${this.getTemperatureString()})`);
      }
    } else {
      if (wasActive) {
        console.log(`✅ Temperature normal: ${this.name}`);
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
      ((this.temperature - min) / (max - min)) * 100
    ));

    // Update thermometer bar
    const bar = this.gaugeElement.querySelector('.thermometer-bar');
    if (bar) {
      bar.style.height = `${percent}%`;
    }

    // Update reading text
    const reading = this.gaugeElement.querySelector('.gauge-reading');
    if (reading) {
      reading.textContent = this.getTemperatureString();
    }

    // Update alarm indicator
    if (this.alarmActive) {
      this.gaugeElement.classList.add('alarm');
    } else {
      this.gaugeElement.classList.remove('alarm');
    }
  }

  /**
   * Get current temperature (in Celsius)
   */
  getTemperature() {
    return this.temperature;
  }

  /**
   * Get temperature in Fahrenheit
   */
  getTemperatureFahrenheit() {
    if (window.Units) {
      return window.Units.celsiusToFahrenheit(this.temperature);
    }
    return this.temperature * 9/5 + 32;
  }

  /**
   * Get temperature as string with units
   */
  getTemperatureString() {
    if (window.Units) {
      return window.Units.formatTemperature(this.temperature, this.units === '°F');
    }

    if (this.units === '°F') {
      const fahrenheit = this.getTemperatureFahrenheit();
      return `${fahrenheit.toFixed(1)} °F`;
    } else {
      return `${this.temperature.toFixed(1)} °C`;
    }
  }

  /**
   * Check if temperature is in normal range
   */
  isNormal() {
    return !this.alarmActive;
  }

  /**
   * Get sensor status
   */
  getStatus() {
    if (this.lowAlarm !== null && this.temperature < this.lowAlarm) {
      return 'LOW';
    }
    if (this.highAlarm !== null && this.temperature > this.highAlarm) {
      return 'HIGH';
    }
    return 'NORMAL';
  }

  /**
   * Get output flow (sensors don't affect flow, just pass through)
   */
  getOutputFlow() {
    // Sensors are passive - they don't affect flow
    if (!this.flowNetwork) return 0;
    return this.flowNetwork.getInputFlow(this.id);
  }

  /**
   * Reset sensor
   */
  reset() {
    super.reset();
    this.temperature = 20;
    this.previousTemperature = 20;
    this.trend = 0;
    this.tempHistory = [];
    this.alarmActive = false;
  }

  /**
   * Get sensor info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      temperature: this.getTemperatureString(),
      trend: this.trend.toFixed(3) + ' °C/s',
      measurementPoint: this.measurementPoint,
      range: `${this.range[0]}-${this.range[1]} ${this.units}`,
      status: this.getStatus(),
      alarm: this.alarmActive
    };
  }
}

// Export
window.TemperatureSensor = TemperatureSensor;
