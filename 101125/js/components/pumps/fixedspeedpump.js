/**
 * FixedSpeedPump.js - Fixed speed pump (ON/OFF only)
 * 
 * Simple pump with just two states: ON or OFF
 */

class FixedSpeedPump extends Pump {
  constructor(config) {
    super({
      ...config,
      pumpType: 'fixed'
    });
    
    // Fixed speed pumps always run at 100% when ON
    this.speed = 1.0;
  }

  /**
   * Start pump (always at full speed)
   */
  start() {
    this.speed = 1.0;
    super.start();
  }

  /**
   * Stop pump
   */
  stop() {
    this.speed = 0;
    super.stop();
  }

  /**
   * Toggle pump ON/OFF
   */
  toggle() {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Fixed speed pumps don't allow speed changes
   */
  setSpeed(speed) {
    console.warn(`${this.name} is a fixed speed pump - speed cannot be adjusted`);
    this.speed = this.running ? 1.0 : 0;
  }
}

// Export
window.FixedSpeedPump = FixedSpeedPump;
