/**
 * Valve.js - Valve component with proportional control
 * 
 * Supports 0-100% positioning via interactive wheel control
 */

class Valve extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'valve';
    
    // Physical properties
    this.maxFlow = config.maxFlow || 1.0; // Max flow rate when fully open (m³/s)
    
    // Operating state
    this.position = config.initialPosition || 0; // 0 = closed, 1 = fully open
    
    // Valve characteristics
    this.responseTime = config.responseTime || 0.1; // Time to change position (seconds)
    this.targetPosition = this.position; // Target position for smooth transitions
    
    console.log(`Valve created: ${this.name} (max flow: ${this.maxFlow})`);
  }

  /**
   * Set valve position (0-1)
   */
  setPosition(pos) {
    pos = Math.max(0, Math.min(1, pos));
    this.targetPosition = pos;
    this.notifyChange();
  }

  /**
   * Get current valve position (0-1)
   */
  getPosition() {
    return this.position;
  }

  /**
   * Get position as percentage (0-100)
   */
  getPositionPercent() {
    return Math.round(this.position * 100);
  }

  /**
   * Open valve fully
   */
  open() {
    this.setPosition(1.0);
  }

  /**
   * Close valve fully
   */
  close() {
    this.setPosition(0);
  }

  /**
   * Check if valve is open (>5%)
   */
  isOpen() {
    return this.position > 0.05;
  }

  /**
   * Check if valve is closed (<5%)
   */
  isClosed() {
    return this.position < 0.05;
  }

  /**
   * Check if valve is fully open (>95%)
   */
  isFullyOpen() {
    return this.position > 0.95;
  }

  /**
   * Get current flow rate through valve
   */
  getOutputFlow() {
    // Flow is proportional to valve position
    return this.maxFlow * this.position;
  }

  /**
   * Update valve state (smooth position transitions)
   */
  update(dt) {
    // Smooth transition to target position
    if (Math.abs(this.position - this.targetPosition) > 0.001) {
      const delta = this.targetPosition - this.position;
      const step = (delta / this.responseTime) * dt;
      
      this.position += step;
      this.position = Math.max(0, Math.min(1, this.position));
      
      // Snap to target if very close
      if (Math.abs(this.position - this.targetPosition) < 0.001) {
        this.position = this.targetPosition;
      }
    }
  }

  /**
   * Reset valve
   */
  reset() {
    super.reset();
    this.position = 0;
    this.targetPosition = 0;
  }

  /**
   * Get valve info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      position: this.position,
      positionPercent: this.getPositionPercent() + '%',
      targetPosition: this.targetPosition,
      maxFlow: this.maxFlow,
      currentFlow: this.getOutputFlow().toFixed(3),
      status: this.isClosed() ? 'CLOSED' : this.isFullyOpen() ? 'OPEN' : 'PARTIAL'
    };
  }
}

// Export
window.Valve = Valve;
