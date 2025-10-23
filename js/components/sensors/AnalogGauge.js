/**
 * AnalogGauge.js - Analog gauge component with dynamic pointer
 *
 * Displays a visual analog gauge with a pointer that rotates based on input value (0-100%)
 * Uses the guageAnalog.svg asset with dynamic rotation applied to the pointer element.
 */

class AnalogGauge extends Component {
  constructor(config) {
    super(config);

    this.type = 'sensor';
    this.sensorType = 'analogGauge';

    // Gauge properties
    this.value = config.value || 0; // Current value (0-100%)
    this.minValue = config.minValue || 0;
    this.maxValue = config.maxValue || 100;
    this.units = config.units || '%';
    this.label = config.label || 'Value';

    // Rotation parameters for the pointer
    // Standard analog gauge: -135° (bottom-left) to +135° (bottom-right) = 270° range
    this.minAngle = config.minAngle || -135; // Starting angle in degrees
    this.maxAngle = config.maxAngle || 135;  // Ending angle in degrees

    // Smoothing/animation
    this.currentAngle = this.minAngle; // Current pointer angle
    this.smoothing = config.smoothing !== false; // Enable smooth transitions
    this.smoothingFactor = config.smoothingFactor || 0.2; // Interpolation speed (0-1)

    // Thresholds for color zones (optional)
    this.yellowThreshold = config.yellowThreshold || 75; // Warning zone starts at 75%
    this.redThreshold = config.redThreshold || 90; // Danger zone starts at 90%

    // Visual elements (will be set when SVG is loaded)
    this.pointerElement = null;
    this.gaugeElement = null;

    // Initialize visuals
    this._initializeVisuals();

    console.log(`Analog gauge created: ${this.name} (${this.minValue}-${this.maxValue} ${this.units})`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (element) {
      // Find the pointer group in the SVG
      this.pointerElement = element.querySelector('#pointer');
      this.gaugeElement = element;

      if (this.pointerElement) {
        // Set transform-origin to the pivot point (400, 400 in the SVG)
        this.pointerElement.style.transformOrigin = '400px 400px';
        this.pointerElement.style.transformBox = 'fill-box';
      } else {
        console.warn(`Analog gauge ${this.name}: pointer element not found in SVG`);
      }
    }
  }

  /**
   * Set the gauge value (0-100 by default, or minValue-maxValue range)
   * @param {number} value - The value to display
   */
  setValue(value) {
    // Clamp value to valid range
    this.value = Math.max(this.minValue, Math.min(this.maxValue, value));

    // Notify system of change
    this.notifyChange();
  }

  /**
   * Get the current gauge value
   * @returns {number} Current value
   */
  getValue() {
    return this.value;
  }

  /**
   * Get normalized value (0-1 range)
   * @returns {number} Normalized value
   */
  getNormalizedValue() {
    return (this.value - this.minValue) / (this.maxValue - this.minValue);
  }

  /**
   * Get percentage value (0-100 range)
   * @returns {number} Percentage value
   */
  getPercentage() {
    return this.getNormalizedValue() * 100;
  }

  /**
   * Calculate target angle based on current value
   * @returns {number} Target angle in degrees
   */
  calculateTargetAngle() {
    const normalized = this.getNormalizedValue();
    const angleRange = this.maxAngle - this.minAngle;
    return this.minAngle + (normalized * angleRange);
  }

  /**
   * Get color zone based on percentage
   * @returns {string} Color zone: 'green', 'yellow', or 'red'
   */
  getColorZone() {
    const percentage = this.getPercentage();

    if (percentage >= this.redThreshold) {
      return 'red';
    } else if (percentage >= this.yellowThreshold) {
      return 'yellow';
    } else {
      return 'green';
    }
  }

  /**
   * Update gauge state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.enabled) return;

    // Calculate target angle
    const targetAngle = this.calculateTargetAngle();

    // Smooth interpolation if enabled
    if (this.smoothing) {
      // Interpolate current angle towards target angle
      const angleDiff = targetAngle - this.currentAngle;
      this.currentAngle += angleDiff * this.smoothingFactor;

      // Snap to target if very close
      if (Math.abs(angleDiff) < 0.1) {
        this.currentAngle = targetAngle;
      }
    } else {
      // Direct update without smoothing
      this.currentAngle = targetAngle;
    }
  }

  /**
   * Render the gauge (rotate pointer to current angle)
   */
  render() {
    if (!this.pointerElement) {
      // Try to initialize visuals if not already done
      this._initializeVisuals();
      if (!this.pointerElement) return;
    }

    // Apply rotation transform to pointer
    this.pointerElement.style.transform = `rotate(${this.currentAngle}deg)`;

    // Optional: Add color coding based on zone
    const zone = this.getColorZone();
    this.pointerElement.setAttribute('data-zone', zone);
  }

  /**
   * Get current status string
   * @returns {string} Status description
   */
  getStatus() {
    const percentage = this.getPercentage();
    const zone = this.getColorZone();

    if (zone === 'red') {
      return 'CRITICAL';
    } else if (zone === 'yellow') {
      return 'WARNING';
    } else {
      return 'NORMAL';
    }
  }

  /**
   * Get gauge info for debugging
   * @returns {object} Gauge information
   */
  getInfo() {
    return {
      ...super.getInfo(),
      value: this.value,
      percentage: this.getPercentage().toFixed(1) + '%',
      angle: this.currentAngle.toFixed(1) + '°',
      status: this.getStatus(),
      zone: this.getColorZone(),
      range: `${this.minValue}-${this.maxValue} ${this.units}`
    };
  }

  /**
   * Reset gauge to initial state
   */
  reset() {
    super.reset();
    this.value = this.minValue;
    this.currentAngle = this.minAngle;
  }

  /**
   * Destroy gauge (cleanup)
   */
  destroy() {
    this.pointerElement = null;
    this.gaugeElement = null;
    super.destroy();
  }
}

// Export
window.AnalogGauge = AnalogGauge;
