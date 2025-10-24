/**
 * LevelSensor.js - Level sensor component
 *
 * Monitors liquid level in tanks
 * Supports percentage, height, and volume measurements
 */

class LevelSensor extends Component {
  constructor(config) {
    super(config);

    this.type = 'sensor';
    this.sensorType = 'level';

    // Measurement properties
    this.range = config.range || [0, 100]; // [min, max] in % or meters
    this.units = config.units || '%'; // '%', 'm', 'ft', 'm³', 'gal'
    this.accuracy = config.accuracy || 0.1; // Reading precision

    // Measurement type
    this.measurementType = config.measurementType || 'percent'; // 'percent', 'height', 'volume'

    // Current reading
    this.level = 0; // Current level (0-1 fraction, internal)
    this.levelPercent = 0; // Level as percentage
    this.height = 0; // Height in meters
    this.volume = 0; // Volume in m³
    this.trend = 0; // Rate of change
    this.previousLevel = 0;

    // Alarm thresholds (as percentages 0-100)
    this.lowLowAlarm = config.lowLowAlarm || null; // Very low level alarm
    this.lowAlarm = config.lowAlarm || null; // Low level alarm
    this.highAlarm = config.highAlarm || null; // High level alarm
    this.highHighAlarm = config.highHighAlarm || null; // Very high level alarm
    this.alarmActive = false;
    this.alarmType = null; // 'LOW_LOW', 'LOW', 'HIGH', 'HIGH_HIGH'

    // Visual gauge element
    this.gaugeElement = null;

    this._initializeVisuals();

    console.log(`Level sensor created: ${this.name} (${this.range[0]}-${this.range[1]} ${this.units})`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      this.gaugeElement = element.querySelector('.level-gauge');
    }
  }

  /**
   * Measure level from connected tank
   */
  measureLevel() {
    if (!this.flowNetwork) return 0;

    // Find connected tank
    const tank = this._getTankFromInputs();
    if (!tank) return 0;

    // Get level fraction (0-1)
    this.level = tank.getLevel ? tank.getLevel() : tank.level;

    // Calculate derived measurements
    this.levelPercent = this.level * 100;
    this.height = tank.maxHeight ? (this.level * tank.maxHeight) : 0;
    this.volume = tank.volume || 0;

    return this.level;
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
    this.previousLevel = this.level;

    // Measure new level
    this.measureLevel();

    // Apply accuracy to percentage reading
    this.levelPercent = Math.round(this.levelPercent / this.accuracy) * this.accuracy;

    // Calculate trend (rate of change in %/s)
    this.trend = ((this.level - this.previousLevel) * 100) / dt;

    // Check alarms
    this._checkAlarms();
  }

  /**
   * Check if level is outside alarm limits
   */
  _checkAlarms() {
    const wasActive = this.alarmActive;
    const previousAlarmType = this.alarmType;

    this.alarmActive = false;
    this.alarmType = null;

    // Check in order of severity
    if (this.lowLowAlarm !== null && this.levelPercent <= this.lowLowAlarm) {
      this.alarmActive = true;
      this.alarmType = 'LOW_LOW';
    } else if (this.lowAlarm !== null && this.levelPercent <= this.lowAlarm) {
      this.alarmActive = true;
      this.alarmType = 'LOW';
    } else if (this.highHighAlarm !== null && this.levelPercent >= this.highHighAlarm) {
      this.alarmActive = true;
      this.alarmType = 'HIGH_HIGH';
    } else if (this.highAlarm !== null && this.levelPercent >= this.highAlarm) {
      this.alarmActive = true;
      this.alarmType = 'HIGH';
    }

    // Log alarm changes
    if (this.alarmActive && (!wasActive || this.alarmType !== previousAlarmType)) {
      console.warn(`⚠️ Level ${this.alarmType} alarm: ${this.name} (${this.getLevelString()})`);
    } else if (wasActive && !this.alarmActive) {
      console.log(`✅ Level normal: ${this.name}`);
    }
  }

  /**
   * Render visual gauge (if element exists)
   */
  render() {
    if (!this.gaugeElement) return;

    // Calculate gauge position (0-100%)
    const percent = Math.max(0, Math.min(100, this.levelPercent));

    // Update level bar
    const bar = this.gaugeElement.querySelector('.level-bar');
    if (bar) {
      bar.style.height = `${percent}%`;

      // Color coding based on alarms
      if (this.alarmType === 'LOW_LOW' || this.alarmType === 'HIGH_HIGH') {
        bar.style.backgroundColor = '#ff0000'; // Red for critical
      } else if (this.alarmType === 'LOW' || this.alarmType === 'HIGH') {
        bar.style.backgroundColor = '#ffaa00'; // Orange for warning
      } else {
        bar.style.backgroundColor = '#00aa00'; // Green for normal
      }
    }

    // Update reading text
    const reading = this.gaugeElement.querySelector('.gauge-reading');
    if (reading) {
      reading.textContent = this.getLevelString();
    }

    // Update alarm indicator
    if (this.alarmActive) {
      this.gaugeElement.classList.add('alarm');
      this.gaugeElement.setAttribute('data-alarm-type', this.alarmType);
    } else {
      this.gaugeElement.classList.remove('alarm');
      this.gaugeElement.removeAttribute('data-alarm-type');
    }
  }

  /**
   * Get current level (fraction 0-1)
   */
  getLevel() {
    return this.level;
  }

  /**
   * Get level as percentage (0-100)
   */
  getLevelPercent() {
    return this.levelPercent;
  }

  /**
   * Get level as string with units
   */
  getLevelString() {
    if (window.Units) {
      switch (this.units) {
        case '%':
          return window.Units.formatLevel(this.level);
        case 'm':
          return window.Units.format(this.height, 'm', 2);
        case 'ft':
          const heightFt = window.Units.mToFt(this.height);
          return window.Units.format(heightFt, 'ft', 2);
        case 'm³':
          return window.Units.formatVolume(this.volume, false);
        case 'gal':
          return window.Units.formatVolume(this.volume, true);
        default:
          return `${this.levelPercent.toFixed(1)} %`;
      }
    }

    // Fallback without Units
    switch (this.units) {
      case 'm':
        return `${this.height.toFixed(2)} m`;
      case 'ft':
        return `${(this.height * 3.28084).toFixed(2)} ft`;
      case 'm³':
        return `${this.volume.toFixed(2)} m³`;
      case 'gal':
        return `${(this.volume * 264.172).toFixed(1)} gal`;
      case '%':
      default:
        return `${this.levelPercent.toFixed(1)} %`;
    }
  }

  /**
   * Check if level is in normal range
   */
  isNormal() {
    return !this.alarmActive;
  }

  /**
   * Get sensor status
   */
  getStatus() {
    if (this.alarmType) {
      return this.alarmType;
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
    this.level = 0;
    this.levelPercent = 0;
    this.height = 0;
    this.volume = 0;
    this.previousLevel = 0;
    this.trend = 0;
    this.alarmActive = false;
    this.alarmType = null;
  }

  /**
   * Get sensor info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      level: this.getLevelString(),
      trend: this.trend.toFixed(2) + ' %/s',
      measurementType: this.measurementType,
      range: `${this.range[0]}-${this.range[1]} ${this.units}`,
      status: this.getStatus(),
      alarm: this.alarmActive,
      alarmType: this.alarmType
    };
  }
}

// Export
window.LevelSensor = LevelSensor;
