/**
 * VariableSpeedPump.js - Variable speed pump (0-100% control)
 * 
 * Pump with continuous speed control via slider
 */

class VariableSpeedPump extends Pump {
  constructor(config) {
    super({
      ...config,
      pumpType: 'variable'
    });
    
    // Variable speed pumps can run at any speed 0-100%
    this.minSpeed = config.minSpeed || 0.1; // Minimum operating speed (10%)
    this.speed = config.initialSpeed || 0;
  }

  /**
   * Start pump at current speed
   */
  start() {
    // If speed is too low, start at minimum speed
    if (this.speed < this.minSpeed) {
      this.speed = this.minSpeed;
    }
    super.start();
  }

  /**
   * Stop pump (speed goes to 0)
   */
  stop() {
    this.speed = 0;
    super.stop();
  }

  /**
   * Set pump speed (0-1)
   */
  setSpeed(speed) {
    // Clamp speed to valid range
    speed = Math.max(0, Math.min(1, speed));
    
    // If pump is running, enforce minimum speed
    if (this.running && speed > 0 && speed < this.minSpeed) {
      speed = this.minSpeed;
    }
    
    this.speed = speed;
    
    // Auto-start if speed > 0 and pump not running
    if (speed > 0 && !this.running) {
      super.start();
    }
    
    // Auto-stop if speed = 0 and pump running
    if (speed === 0 && this.running) {
      super.stop();
    }
    
    this.notifyChange();
  }

  /**
   * Increase speed by amount
   */
  increaseSpeed(amount = 0.1) {
    this.setSpeed(this.speed + amount);
  }

  /**
   * Decrease speed by amount
   */
  decreaseSpeed(amount = 0.1) {
    this.setSpeed(this.speed - amount);
  }

  /**
   * Get speed percentage (0-100)
   */
  getSpeedPercent() {
    return Math.round(this.speed * 100);
  }
}

// Export
window.VariableSpeedPump = VariableSpeedPump;
