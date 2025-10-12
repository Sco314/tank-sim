/**
 * Tank.js - Tank component with mass balance
 * 
 * Tracks volume, level, and overflow conditions
 */

class Tank extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'tank';
    
    // Physical properties
    this.area = config.area || 1.0; // Cross-sectional area (m²)
    this.maxHeight = config.maxHeight || 1.0; // Maximum height (m)
    this.maxVolume = this.area * this.maxHeight;
    
    // Current state
    this.volume = config.initialVolume || 0; // Current volume (m³)
    this.level = this.volume / this.maxVolume; // 0-1
    
    // Visual properties
    this.levelRect = null; // SVG rect element for liquid level
    this.levelRectHeight = config.levelRectHeight || 360; // Pixels
    this.levelRectY = config.levelRectY || 360; // Base Y position
    
    // Thresholds
    this.lowThreshold = config.lowThreshold || 0.1; // 10%
    this.highThreshold = config.highThreshold || 0.9; // 90%
    
    // Flow tracking
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;
    
    this._initializeVisuals();
    
    console.log(`Tank created: ${this.name} (${this.maxVolume.toFixed(2)} m³)`);
  }

  /**
   * Initialize visual elements
   */
  _initializeVisuals() {
    const element = this.getElement();
    if (!element) return;
    
    // Find the level rectangle (should be inside the tank group)
    this.levelRect = element.querySelector('#levelRect') || 
                     element.querySelector('.levelRect');
    
    if (!this.levelRect) {
      console.warn(`Level rect not found for tank ${this.name}`);
    }
  }

  /**
   * Update tank state (mass balance)
   */
  update(dt) {
    // Get actual flows from network
    const Qin = this.flowNetwork ? this.flowNetwork.getInputFlow(this.id) : 0;
    const Qout = this.flowNetwork ? this.flowNetwork.getOutputFlow(this.id) : 0;
    
    // Track flows for display
    this.lastInputFlow = Qin;
    this.lastOutputFlow = Qout;
    
    // Mass balance: dV/dt = Qin - Qout
    const dV = (Qin - Qout) * dt;
    this.volume += dV;
    
    // Clamp volume to physical limits
    this.volume = Math.max(0, Math.min(this.maxVolume, this.volume));
    
    // Update level
    this.level = this.volume / this.maxVolume;
  }

  /**
   * Render visual representation
   */
  render() {
    if (!this.levelRect) return;
    
    // Calculate pixel height and position
    const heightPx = this.levelRectHeight * this.level;
    const yPx = this.levelRectY - heightPx;
    
    // Update SVG attributes
    this.levelRect.setAttribute('height', heightPx);
    this.levelRect.setAttribute('y', yPx);
    
    // Optional: change color based on level
    if (this.level < this.lowThreshold) {
      this.levelRect.setAttribute('fill', 'url(#liquid)');
      this.levelRect.setAttribute('opacity', '0.6');
    } else if (this.level > this.highThreshold) {
      this.levelRect.setAttribute('fill', 'url(#liquid)');
      this.levelRect.setAttribute('opacity', '1.0');
    } else {
      this.levelRect.setAttribute('fill', 'url(#liquid)');
      this.levelRect.setAttribute('opacity', '0.8');
    }
  }

  /**
   * Get current level (0-1)
   */
  getLevel() {
    return this.level;
  }

  /**
   * Get level percentage (0-100)
   */
  getLevelPercent() {
    return Math.round(this.level * 100);
  }

  /**
   * Check if tank is empty
   */
  isEmpty() {
    return this.volume < 0.001; // Essentially zero
  }

  /**
   * Check if tank is full (overflow condition)
   */
  isFull() {
    return this.volume >= this.maxVolume - 0.001;
  }

  /**
   * Check if level is low
   */
  isLow() {
    return this.level < this.lowThreshold;
  }

  /**
   * Check if level is high
   */
  isHigh() {
    return this.level > this.highThreshold;
  }

  /**
   * FIXED: Get output flow (tank supplies what downstream components demand)
   */
  getOutputFlow() {
    if (!this.flowNetwork) return 0;
    
    // Tank supplies whatever its output components are demanding
    // (pumps have already calculated their output in the flow network processing order)
    let demandedFlow = 0;
    
    for (const outputId of this.outputs) {
      // Check what flow this output component is producing
      // This works because pumps are processed before tanks in calculateFlows()
      demandedFlow += this.flowNetwork.getOutputFlow(outputId);
    }
    
    // Limit by available volume (can't pump from empty tank)
    const availableFlow = this.volume * 10; // Max flow = volume * 10 per second
    
    // Return the lesser of what's demanded vs what's available
    return Math.min(demandedFlow, availableFlow);
  }

  /**
   * Set volume directly (useful for initialization/reset)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(this.maxVolume, volume));
    this.level = this.volume / this.maxVolume;
    this.notifyChange();
  }

  /**
   * Set level as percentage (0-100)
   */
  setLevelPercent(percent) {
    const fraction = Math.max(0, Math.min(100, percent)) / 100;
    this.setVolume(fraction * this.maxVolume);
  }

  /**
   * Reset tank
   */
  reset() {
    super.reset();
    this.volume = 0;
    this.level = 0;
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;
  }

  /**
   * Get tank info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      volume: this.volume.toFixed(3) + ' m³',
      level: this.getLevelPercent() + '%',
      maxVolume: this.maxVolume.toFixed(2) + ' m³',
      inputFlow: this.lastInputFlow.toFixed(3) + ' m³/s',
      outputFlow: this.lastOutputFlow.toFixed(3) + ' m³/s',
      status: this.isEmpty() ? 'EMPTY' : 
              this.isFull() ? 'FULL' : 
              this.isLow() ? 'LOW' : 
              this.isHigh() ? 'HIGH' : 'NORMAL'
    };
  }
}

// Export
window.Tank = Tank;
