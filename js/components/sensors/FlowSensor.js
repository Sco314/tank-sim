/**
 * FlowSensor.js - Flow rate sensor component
 *
 * Monitors flow rate at any point in the system
 * Supports both volumetric flow (m³/s, gpm) and mass flow (kg/s)
 */

class FlowSensor extends Component {
  constructor(config) {
    super(config);

    this.type = 'sensor';
    this.sensorType = 'flow';

    // Measurement properties
    this.range = config.range || [0, 10]; // [min, max] in m³/s
    this.units = config.units || 'm³/s'; // 'm³/s', 'gpm', 'lps', 'kg/s'
    this.accuracy = config.accuracy || 0.001; // Reading precision

    // Measurement type
    this.measurementType = config.measurementType || 'volumetric'; // 'volumetric' or 'mass'
    this.fluidDensity = config.fluidDensity || 1000; // kg/m³ (for mass flow)

    // Current reading
    this.flowRate = 0; // Current flow reading (in internal units m³/s or kg/s)
    this.averageFlow = 0; // Time-averaged flow
    this.totalVolume = 0; // Cumulative volume (totalizer)
    this.trend = 0; // Rate of change
    this.previousFlow = 0;

    // Averaging
    this.averagingTime = config.averagingTime || 1.0; // seconds
    this.flowHistory = [];
    this.maxHistoryLength = 100;

    // Alarm thresholds
    this.lowAlarm = config.lowAlarm || null; // Low flow alarm
    this.highAlarm = config.highAlarm || null; // High flow alarm
    this.alarmActive = false;

    // Visual gauge element
    this.gaugeElement = null;

    this._initializeVisuals();

    console.log(`Flow sensor created: ${this.name} (${this.range[0]}-${this.range[1]} ${this.units})`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      this.gaugeElement = element.querySelector('.flow-gauge');
    }
  }

  /**
   * Measure flow at this sensor location
   * Reads from the flow network based on sensor position
   */
  measureFlow() {
    if (!this.flowNetwork) return 0;

    // Get flow passing through this sensor
    // Sensor can measure input flow or output flow depending on configuration
    let flow = 0;

    // Default: measure input flow (flow coming into the sensor)
    flow = this.flowNetwork.getInputFlow(this.id);

    // Convert to mass flow if needed
    if (this.measurementType === 'mass') {
      flow = flow * this.fluidDensity; // kg/s = m³/s × kg/m³
    }

    return flow;
  }

  /**
   * Update sensor reading
   */
  update(dt) {
    // Store previous reading
    this.previousFlow = this.flowRate;

    // Measure new flow
    this.flowRate = this.measureFlow();

    // Apply accuracy (round to sensor precision)
    this.flowRate = Math.round(this.flowRate / this.accuracy) * this.accuracy;

    // Update flow history for averaging
    this.flowHistory.push({ time: performance.now(), flow: this.flowRate });

    // Trim history to max length
    if (this.flowHistory.length > this.maxHistoryLength) {
      this.flowHistory.shift();
    }

    // Calculate time-averaged flow
    this._calculateAverageFlow();

    // Calculate trend (rate of change)
    this.trend = (this.flowRate - this.previousFlow) / dt;

    // Update totalizer
    this.totalVolume += this.flowRate * dt;

    // Check alarms
    this._checkAlarms();
  }

  /**
   * Calculate time-averaged flow
   */
  _calculateAverageFlow() {
    if (this.flowHistory.length === 0) {
      this.averageFlow = 0;
      return;
    }

    const now = performance.now();
    const cutoffTime = now - (this.averagingTime * 1000);

    // Filter to recent readings
    const recentReadings = this.flowHistory.filter(h => h.time >= cutoffTime);

    if (recentReadings.length === 0) {
      this.averageFlow = this.flowRate;
      return;
    }

    // Calculate average
    const sum = recentReadings.reduce((acc, h) => acc + h.flow, 0);
    this.averageFlow = sum / recentReadings.length;
  }

  /**
   * Check if flow is outside alarm limits
   */
  _checkAlarms() {
    const wasActive = this.alarmActive;

    if (this.lowAlarm !== null && this.flowRate < this.lowAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ Low flow alarm: ${this.name} (${this.getFlowString()})`);
      }
    } else if (this.highAlarm !== null && this.flowRate > this.highAlarm) {
      this.alarmActive = true;
      if (!wasActive) {
        console.warn(`⚠️ High flow alarm: ${this.name} (${this.getFlowString()})`);
      }
    } else {
      if (wasActive) {
        console.log(`✅ Flow normal: ${this.name}`);
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
      ((this.flowRate - min) / (max - min)) * 100
    ));

    // Update gauge bar
    const bar = this.gaugeElement.querySelector('.gauge-bar');
    if (bar) {
      bar.style.width = `${percent}%`;
    }

    // Update reading text
    const reading = this.gaugeElement.querySelector('.gauge-reading');
    if (reading) {
      reading.textContent = this.getFlowString();
    }

    // Update alarm indicator
    if (this.alarmActive) {
      this.gaugeElement.classList.add('alarm');
    } else {
      this.gaugeElement.classList.remove('alarm');
    }
  }

  /**
   * Get current flow rate
   */
  getFlowRate() {
    return this.flowRate;
  }

  /**
   * Get flow as string with units
   */
  getFlowString() {
    if (window.Units && this.units !== 'm³/s') {
      // Use unit converter for display
      if (this.units === 'gpm') {
        return window.Units.formatFlow(this.flowRate, true);
      } else if (this.units === 'lps') {
        const lps = window.Units.m3sToLps(this.flowRate);
        return window.Units.format(lps, 'L/s');
      } else if (this.units === 'kg/s') {
        return window.Units.format(this.flowRate, 'kg/s');
      }
    }

    return `${this.flowRate.toFixed(3)} ${this.units}`;
  }

  /**
   * Get average flow as string with units
   */
  getAverageFlowString() {
    if (window.Units && this.units !== 'm³/s') {
      if (this.units === 'gpm') {
        return window.Units.formatFlow(this.averageFlow, true);
      } else if (this.units === 'lps') {
        const lps = window.Units.m3sToLps(this.averageFlow);
        return window.Units.format(lps, 'L/s');
      } else if (this.units === 'kg/s') {
        return window.Units.format(this.averageFlow, 'kg/s');
      }
    }

    return `${this.averageFlow.toFixed(3)} ${this.units}`;
  }

  /**
   * Get totalizer reading as string
   */
  getTotalizerString() {
    if (window.Units) {
      if (this.units === 'gpm') {
        return window.Units.formatVolume(this.totalVolume, true);
      } else {
        return window.Units.formatVolume(this.totalVolume, false);
      }
    }

    return `${this.totalVolume.toFixed(2)} m³`;
  }

  /**
   * Reset totalizer
   */
  resetTotalizer() {
    this.totalVolume = 0;
    console.log(`${this.name} totalizer reset`);
  }

  /**
   * Check if flow is in normal range
   */
  isNormal() {
    return !this.alarmActive;
  }

  /**
   * Get sensor status
   */
  getStatus() {
    if (this.lowAlarm !== null && this.flowRate < this.lowAlarm) {
      return 'LOW';
    }
    if (this.highAlarm !== null && this.flowRate > this.highAlarm) {
      return 'HIGH';
    }
    if (Math.abs(this.flowRate) < this.accuracy) {
      return 'NO_FLOW';
    }
    return 'NORMAL';
  }

  /**
   * Get output flow (sensors don't affect flow, just pass through)
   */
  getOutputFlow() {
    // Sensors are passive - they don't affect flow
    // Return what's coming in
    if (!this.flowNetwork) return 0;
    return this.flowNetwork.getInputFlow(this.id);
  }

  /**
   * Reset sensor
   */
  reset() {
    super.reset();
    this.flowRate = 0;
    this.averageFlow = 0;
    this.totalVolume = 0;
    this.previousFlow = 0;
    this.trend = 0;
    this.flowHistory = [];
    this.alarmActive = false;
  }

  /**
   * Get sensor info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      flowRate: this.getFlowString(),
      averageFlow: this.getAverageFlowString(),
      totalVolume: this.getTotalizerString(),
      trend: this.trend.toFixed(4) + ' ' + this.units + '/s',
      measurementType: this.measurementType,
      range: `${this.range[0]}-${this.range[1]} ${this.units}`,
      status: this.getStatus(),
      alarm: this.alarmActive
    };
  }
}

// Export
window.FlowSensor = FlowSensor;
