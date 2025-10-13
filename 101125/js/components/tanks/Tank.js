/**
 * Tank.js - Tank component with mass balance
 * 
 * Tank is PASSIVE - pump creates the tank->pump flow
 */

class Tank extends Component {
  constructor(config) {
    super(config);
    
    this.type = 'tank';
    
    // Physical properties
    this.area = config.area || 1.0;
    this.maxHeight = config.maxHeight || 1.0;
    this.maxVolume = this.area * this.maxHeight;
    
    // Current state
    this.volume = config.initialVolume || 0;
    this.level = this.volume / this.maxVolume;
    
    // Visual properties
    this.levelRect = null;
    this.levelRectHeight = config.levelRectHeight || 360;
    this.levelRectY = config.levelRectY || 360;
    
    // Thresholds
    this.lowThreshold = config.lowThreshold || 0.1;
    this.highThreshold = config.highThreshold || 0.9;
    
    // Flow tracking
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;
    
    this._initializeVisuals();
    
    console.log(`Tank created: ${this.name} (${this.maxVolume.toFixed(2)} m³)`);
  }

  _initializeVisuals() {
    const element = this.getElement();
    if (!element) return;
    
    this.levelRect = element.querySelector('#levelRect') || 
                     element.querySelector('.levelRect');
    
    if (!this.levelRect) {
      console.warn(`Level rect not found for tank ${this.name}`);
    }
  }

  /**
   * Tank is PASSIVE - doesn't create flow
   * Pump will create tank->pump flow when it runs
   */
  getOutputFlow() {
    return 0;
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

  render() {
    if (!this.levelRect) return;
    
    // Calculate pixel height and position
    const heightPx = this.levelRectHeight * this.level;
    const yPx = this.levelRectY - heightPx;
    
    // Update SVG attributes
    this.levelRect.setAttribute('height', heightPx);
    this.levelRect.setAttribute('y', yPx);
    
    // Change opacity based on level
    if (this.level < this.lowThreshold) {
      this.levelRect.setAttribute('opacity', '0.6');
    } else if (this.level > this.highThreshold) {
      this.levelRect.setAttribute('opacity', '1.0');
    } else {
      this.levelRect.setAttribute('opacity', '0.8');
    }
  }

  getLevel() {
    return this.level;
  }

  getLevelPercent() {
    return Math.round(this.level * 100);
  }

  isEmpty() {
    return this.volume < 0.001;
  }

  isFull() {
    return this.volume >= this.maxVolume - 0.001;
  }

  isLow() {
    return this.level < this.lowThreshold;
  }

  isHigh() {
    return this.level > this.highThreshold;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(this.maxVolume, volume));
    this.level = this.volume / this.maxVolume;
    this.notifyChange();
  }

  setLevelPercent(percent) {
    const fraction = Math.max(0, Math.min(100, percent)) / 100;
    this.setVolume(fraction * this.maxVolume);
  }

  reset() {
    super.reset();
    this.volume = 0;
    this.level = 0;
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;
  }

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
