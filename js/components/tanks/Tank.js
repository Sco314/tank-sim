class Tank extends Component {
  constructor(config) {
    super(config);
    this.type = 'tank';
    this.area = config.area || 1.0;
    this.maxHeight = config.maxHeight || 1.0;
    this.maxVolume = this.area * this.maxHeight;
    this.volume = config.initialVolume || 0;
    this.level = this.volume / this.maxVolume;
    this.levelRect = null;
    this.levelRectHeight = config.levelRectHeight || 360;
    this.levelRectY = config.levelRectY || 360;
    this.lowThreshold = config.lowThreshold || 0.1;
    this.highThreshold = config.highThreshold || 0.9;
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;

    // Temperature and energy properties
    this.temperature = config.initialTemperature || 20; // °C
    this.fluidDensity = config.fluidDensity || 1000; // kg/m³ (water)
    this.specificHeat = config.specificHeat || 4186; // J/(kg·K) (water)
    this.enthalpy = this._calculateEnthalpy(); // J
    this.ambientTemperature = config.ambientTemperature || 20; // °C
    this.heatTransferCoeff = config.heatTransferCoeff || 0; // W/(m²·K) - 0 = insulated

    this._initializeVisuals();
    console.log('Tank created: ' + this.name);
  }

  _initializeVisuals() {
    const element = this.getElement();
    if (!element) return;
    this.levelRect = element.querySelector('#levelRect') || element.querySelector('.levelRect');
    if (!this.levelRect) {
      console.warn('Level rect not found for tank ' + this.name);
    }
  }

  getOutputFlow() {
    return 0;
  }

  update(dt) {
    const Qin = this.flowNetwork ? this.flowNetwork.getInputFlow(this.id) : 0;
    const Qout = this.flowNetwork ? this.flowNetwork.getOutputFlow(this.id) : 0;
    this.lastInputFlow = Qin;
    this.lastOutputFlow = Qout;

    // Mass balance: dV/dt = Qin - Qout
    const dV = (Qin - Qout) * dt;
    this.volume += dV;
    this.volume = Math.max(0, Math.min(this.maxVolume, this.volume));
    this.level = this.volume / this.maxVolume;

    // Energy balance: dH/dt = Hin - Hout + Qheat
    this._updateEnergyBalance(Qin, Qout, dt);
  }

  render() {
    if (!this.levelRect) return;
    const heightPx = this.levelRectHeight * this.level;
    const yPx = this.levelRectY - heightPx;
    this.levelRect.setAttribute('height', heightPx);
    this.levelRect.setAttribute('y', yPx);
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

  /**
   * Calculate total enthalpy (J) from temperature and mass
   * H = m * Cp * T (reference at 0°C)
   */
  _calculateEnthalpy() {
    const mass = this.volume * this.fluidDensity; // kg
    return mass * this.specificHeat * this.temperature; // J
  }

  /**
   * Calculate temperature from total enthalpy
   * T = H / (m * Cp)
   */
  _calculateTemperatureFromEnthalpy() {
    if (this.volume < 0.001) {
      // Tank is empty - maintain current temperature
      return this.temperature;
    }
    const mass = this.volume * this.fluidDensity; // kg
    return this.enthalpy / (mass * this.specificHeat); // °C
  }

  /**
   * Update energy balance
   * dH/dt = Hin - Hout + Qheat
   */
  _updateEnergyBalance(Qin, Qout, dt) {
    if (this.volume < 0.001) {
      // Tank is empty - no energy balance
      return;
    }

    // Get inlet temperature (from upstream component or feed)
    let Tin = this.temperature; // Default to tank temperature
    if (this.flowNetwork && Qin > 0) {
      Tin = this._getInletTemperature();
    }

    // Mass flow rates (kg/s)
    const mdotin = Qin * this.fluidDensity;
    const mdotout = Qout * this.fluidDensity;

    // Enthalpy flow rates (W = J/s)
    // H_flow = mdot * Cp * T
    const Hin = mdotin * this.specificHeat * Tin;
    const Hout = mdotout * this.specificHeat * this.temperature;

    // Heat transfer with environment (if not insulated)
    // Q = h * A * (Tambient - T)
    let Qheat = 0;
    if (this.heatTransferCoeff > 0) {
      const surfaceArea = this.area + (4 * Math.sqrt(this.area) * this.level * this.maxHeight);
      Qheat = this.heatTransferCoeff * surfaceArea * (this.ambientTemperature - this.temperature);
    }

    // Update total enthalpy
    const dH = (Hin - Hout + Qheat) * dt;
    this.enthalpy += dH;

    // Ensure enthalpy is non-negative (can't go below absolute zero)
    this.enthalpy = Math.max(0, this.enthalpy);

    // Calculate new temperature from enthalpy
    this.temperature = this._calculateTemperatureFromEnthalpy();
  }

  /**
   * Get inlet temperature from upstream components
   */
  _getInletTemperature() {
    if (!this.flowNetwork) return this.temperature;

    // Check all input components for temperature
    for (const inputId of this.inputs) {
      const component = this.flowNetwork.getComponent(inputId);
      if (component && component.temperature !== undefined) {
        return component.temperature;
      }
    }

    // Check feed components
    const feeds = this.flowNetwork.getComponentsByType('feed');
    for (const feed of feeds) {
      if (feed.temperature !== undefined && feed.outputs.includes(this.id)) {
        return feed.temperature;
      }
    }

    return this.temperature; // Default
  }

  /**
   * Set tank temperature (updates enthalpy)
   */
  setTemperature(temp) {
    this.temperature = temp;
    this.enthalpy = this._calculateEnthalpy();
  }

  reset() {
    super.reset();
    this.volume = 0;
    this.level = 0;
    this.lastInputFlow = 0;
    this.lastOutputFlow = 0;
    this.temperature = 20;
    this.enthalpy = 0;
  }

  getInfo() {
    const tempStr = window.Units ?
      window.Units.formatTemperature(this.temperature, false) :
      `${this.temperature.toFixed(1)} °C`;

    return {
      ...super.getInfo(),
      volume: this.volume.toFixed(3) + ' m³',
      level: this.getLevelPercent() + '%',
      maxVolume: this.maxVolume.toFixed(2) + ' m³',
      inputFlow: this.lastInputFlow.toFixed(3) + ' m³/s',
      outputFlow: this.lastOutputFlow.toFixed(3) + ' m³/s',
      temperature: tempStr,
      enthalpy: (this.enthalpy / 1000).toFixed(1) + ' kJ',
      status: this.isEmpty() ? 'EMPTY' : this.isFull() ? 'FULL' : this.isLow() ? 'LOW' : this.isHigh() ? 'HIGH' : 'NORMAL'
    };
  }
}

window.Tank = Tank;
