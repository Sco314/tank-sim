/**
 * ThreeSpeedPump.js - Three-speed pump (Low/Med/High)
 * 
 * Pump with three discrete speed settings
 */

class ThreeSpeedPump extends Pump {
  constructor(config) {
    super({
      ...config,
      pumpType: '3-speed'
    });
    
    // Three discrete speed levels
    this.speeds = config.speeds || [0.3, 0.6, 1.0]; // Low, Med, High
    this.speedNames = ['Low', 'Medium', 'High'];
    this.currentSpeedIndex = 0; // 0 = Low, 1 = Med, 2 = High
    
    // Set initial speed
    if (config.initialSpeed !== undefined) {
      this.setSpeedIndex(config.initialSpeed);
    } else {
      this.speed = 0;
    }
  }

  /**
   * Start pump at current speed setting
   */
  start() {
    // If speed is 0, start at low speed
    if (this.speed === 0) {
      this.setSpeedIndex(0);
    }
    super.start();
  }

  /**
   * Stop pump
   */
  stop() {
    super.stop();
  }

  /**
   * Set speed by index (0, 1, or 2)
   */
  setSpeedIndex(index) {
    index = Math.max(0, Math.min(2, index));
    this.currentSpeedIndex = index;
    this.speed = this.speeds[index];
    
    // Auto-start if not running
    if (!this.running) {
      super.start();
    }
    
    this.notifyChange();
    console.log(`${this.name} set to ${this.speedNames[index]} (${(this.speed * 100).toFixed(0)}%)`);
  }

  /**
   * Set to Low speed
   */
  setLow() {
    this.setSpeedIndex(0);
  }

  /**
   * Set to Medium speed
   */
  setMedium() {
    this.setSpeedIndex(1);
  }

  /**
   * Set to High speed
   */
  setHigh() {
    this.setSpeedIndex(2);
  }

  /**
   * Cycle to next speed
   */
  nextSpeed() {
    this.setSpeedIndex((this.currentSpeedIndex + 1) % 3);
  }

  /**
   * Cycle to previous speed
   */
  previousSpeed() {
    this.setSpeedIndex((this.currentSpeedIndex - 1 + 3) % 3);
  }

  /**
   * Get current speed name
   */
  getSpeedName() {
    return this.speedNames[this.currentSpeedIndex];
  }

  /**
   * Get current speed index (0, 1, or 2)
   */
  getSpeedIndex() {
    return this.currentSpeedIndex;
  }

  /**
   * Override setSpeed to snap to nearest discrete speed
   */
  setSpeed(speed) {
    // Find nearest speed
    let nearestIndex = 0;
    let minDiff = Math.abs(speed - this.speeds[0]);
    
    for (let i = 1; i < this.speeds.length; i++) {
      const diff = Math.abs(speed - this.speeds[i]);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = i;
      }
    }
    
    this.setSpeedIndex(nearestIndex);
  }

  /**
   * Get pump info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      speedSetting: this.getSpeedName(),
      speedIndex: this.currentSpeedIndex
    };
  }
}

// Export
window.ThreeSpeedPump = ThreeSpeedPump;
