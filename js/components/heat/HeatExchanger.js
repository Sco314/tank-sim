/**
 * HeatExchanger.js - Heat exchanger component with energy balance
 *
 * Transfers thermal energy between two fluid streams:
 * - Hot side: higher temperature fluid that gives up heat
 * - Cold side: lower temperature fluid that receives heat
 *
 * Physics: Q = UA * LMTD (Log Mean Temperature Difference)
 * Or simplified: Q = effectiveness * Cmin * (Thot,in - Tcold,in)
 */

class HeatExchanger extends Component {
  constructor(config) {
    super(config);

    this.type = 'heat_exchanger';

    // Heat exchanger design parameters
    this.heatTransferCoeff = config.heatTransferCoeff || 500; // U: W/(m²·K)
    this.area = config.area || 1.0; // A: Heat transfer area (m²)
    this.effectiveness = config.effectiveness || 0.7; // ε: Effectiveness (0-1)

    // Flow configuration
    this.flowConfiguration = config.flowConfiguration || 'counterflow'; // 'counterflow', 'parallel', 'crossflow'

    // Hot side (inputs[0], outputs[0])
    this.hotSideInput = config.hotSideInput || null;
    this.hotSideOutput = config.hotSideOutput || null;
    this.hotSideFlowRate = 0; // m³/s
    this.hotSideInletTemp = 20; // °C
    this.hotSideOutletTemp = 20; // °C

    // Cold side (inputs[1], outputs[1])
    this.coldSideInput = config.coldSideInput || null;
    this.coldSideOutput = config.coldSideOutput || null;
    this.coldSideFlowRate = 0; // m³/s
    this.coldSideInletTemp = 20; // °C
    this.coldSideOutletTemp = 20; // °C

    // Fluid properties (assuming water, can be overridden)
    this.hotFluidDensity = config.hotFluidDensity || 1000; // kg/m³
    this.hotFluidSpecificHeat = config.hotFluidSpecificHeat || 4186; // J/(kg·K)
    this.coldFluidDensity = config.coldFluidDensity || 1000; // kg/m³
    this.coldFluidSpecificHeat = config.coldFluidSpecificHeat || 4186; // J/(kg·K)

    // Heat transfer state
    this.heatTransferRate = 0; // W (positive = hot to cold)
    this.enabled = config.enabled !== false;

    // Fouling and efficiency
    this.foulingFactor = config.foulingFactor || 0; // m²·K/W (0 = clean)
    this.thermalEfficiency = 1.0; // Actual vs. ideal performance

    console.log(`Heat exchanger created: ${this.name} (A=${this.area}m², U=${this.heatTransferCoeff}W/m²K, ε=${this.effectiveness})`);
  }

  /**
   * Get output flow (heat exchangers don't affect flow, just temperature)
   */
  getOutputFlow() {
    // Heat exchanger is passive to flow - passes through
    if (!this.flowNetwork) return 0;

    // Hot side flow passes through
    return this.flowNetwork.getInputFlow(this.id);
  }

  /**
   * Update heat exchanger state
   */
  update(dt) {
    if (!this.enabled || !this.flowNetwork) return;

    // Get flow rates
    this.hotSideFlowRate = this._getHotSideFlow();
    this.coldSideFlowRate = this._getColdSideFlow();

    // Get inlet temperatures
    this.hotSideInletTemp = this._getHotSideInletTemp();
    this.coldSideInletTemp = this._getColdSideInletTemp();

    // Calculate heat transfer
    this._calculateHeatTransfer();

    // Calculate outlet temperatures
    this._calculateOutletTemperatures();

    // Update connected components with outlet temperatures
    this._updateDownstreamTemperatures();
  }

  /**
   * Get hot side flow rate
   */
  _getHotSideFlow() {
    if (!this.hotSideInput) return 0;

    // Find flow from hot side input
    return this.flowNetwork.getFlow(this.hotSideInput, this.id) || 0;
  }

  /**
   * Get cold side flow rate
   */
  _getColdSideFlow() {
    if (!this.coldSideInput) return 0;

    // Find flow from cold side input
    return this.flowNetwork.getFlow(this.coldSideInput, this.id) || 0;
  }

  /**
   * Get hot side inlet temperature
   */
  _getHotSideInletTemp() {
    if (!this.hotSideInput || !this.flowNetwork) return 20;

    const component = this.flowNetwork.getComponent(this.hotSideInput);
    if (component && component.temperature !== undefined) {
      return component.temperature;
    }

    return 20; // Default
  }

  /**
   * Get cold side inlet temperature
   */
  _getColdSideInletTemp() {
    if (!this.coldSideInput || !this.flowNetwork) return 20;

    const component = this.flowNetwork.getComponent(this.coldSideInput);
    if (component && component.temperature !== undefined) {
      return component.temperature;
    }

    return 20; // Default
  }

  /**
   * Calculate heat transfer rate using effectiveness-NTU method
   * Q = ε * Cmin * (Th,in - Tc,in)
   */
  _calculateHeatTransfer() {
    // Check for valid operation
    if (this.hotSideFlowRate < 0.0001 || this.coldSideFlowRate < 0.0001) {
      this.heatTransferRate = 0;
      return;
    }

    if (this.hotSideInletTemp <= this.coldSideInletTemp) {
      // No driving force for heat transfer
      this.heatTransferRate = 0;
      return;
    }

    // Calculate heat capacity rates (W/K)
    const Chot = this.hotSideFlowRate * this.hotFluidDensity * this.hotFluidSpecificHeat;
    const Ccold = this.coldSideFlowRate * this.coldFluidDensity * this.coldFluidSpecificHeat;

    // Minimum and maximum heat capacity rates
    const Cmin = Math.min(Chot, Ccold);
    const Cmax = Math.max(Chot, Ccold);

    // Heat capacity rate ratio
    const Cr = Cmin / Cmax;

    // Calculate effectiveness (if not specified, calculate from NTU)
    let eff = this.effectiveness;

    // Account for fouling (reduces effective U)
    const Ueff = 1 / (1/this.heatTransferCoeff + this.foulingFactor);

    // NTU (Number of Transfer Units)
    const NTU = (Ueff * this.area) / Cmin;

    // Calculate effectiveness based on flow configuration
    if (this.effectiveness === null || this.effectiveness === undefined) {
      switch (this.flowConfiguration) {
        case 'counterflow':
          if (Cr < 0.99) {
            eff = (1 - Math.exp(-NTU * (1 - Cr))) / (1 - Cr * Math.exp(-NTU * (1 - Cr)));
          } else {
            eff = NTU / (1 + NTU);
          }
          break;

        case 'parallel':
          eff = (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);
          break;

        case 'crossflow':
          // Simplified crossflow (both unmixed)
          eff = 1 - Math.exp((1/Cr) * Math.pow(NTU, 0.22) * (Math.exp(-Cr * Math.pow(NTU, 0.78)) - 1));
          break;

        default:
          eff = 0.7; // Default
      }
    }

    this.thermalEfficiency = eff;

    // Maximum possible heat transfer
    const Qmax = Cmin * (this.hotSideInletTemp - this.coldSideInletTemp);

    // Actual heat transfer
    this.heatTransferRate = eff * Qmax;
  }

  /**
   * Calculate outlet temperatures from heat transfer rate
   */
  _calculateOutletTemperatures() {
    if (this.hotSideFlowRate < 0.0001 || this.coldSideFlowRate < 0.0001) {
      // No flow - no temperature change
      this.hotSideOutletTemp = this.hotSideInletTemp;
      this.coldSideOutletTemp = this.coldSideInletTemp;
      return;
    }

    // Calculate heat capacity rates (W/K)
    const Chot = this.hotSideFlowRate * this.hotFluidDensity * this.hotFluidSpecificHeat;
    const Ccold = this.coldSideFlowRate * this.coldFluidDensity * this.coldFluidSpecificHeat;

    // Calculate temperature changes
    // Hot side: Q = Chot * (Th,in - Th,out) → Th,out = Th,in - Q/Chot
    this.hotSideOutletTemp = this.hotSideInletTemp - (this.heatTransferRate / Chot);

    // Cold side: Q = Ccold * (Tc,out - Tc,in) → Tc,out = Tc,in + Q/Ccold
    this.coldSideOutletTemp = this.coldSideInletTemp + (this.heatTransferRate / Ccold);

    // Sanity checks
    this.hotSideOutletTemp = Math.max(this.coldSideInletTemp, this.hotSideOutletTemp);
    this.coldSideOutletTemp = Math.min(this.hotSideInletTemp, this.coldSideOutletTemp);
  }

  /**
   * Update downstream components with outlet temperatures
   */
  _updateDownstreamTemperatures() {
    // Update hot side outlet component
    if (this.hotSideOutput && this.flowNetwork) {
      const hotOutComponent = this.flowNetwork.getComponent(this.hotSideOutput);
      if (hotOutComponent && hotOutComponent.temperature !== undefined) {
        // For tanks, this will be handled by their energy balance
        // For other components, set temperature directly
        if (hotOutComponent.type !== 'tank') {
          hotOutComponent.temperature = this.hotSideOutletTemp;
        }
      }
    }

    // Update cold side outlet component
    if (this.coldSideOutput && this.flowNetwork) {
      const coldOutComponent = this.flowNetwork.getComponent(this.coldSideOutput);
      if (coldOutComponent && coldOutComponent.temperature !== undefined) {
        if (coldOutComponent.type !== 'tank') {
          coldOutComponent.temperature = this.coldSideOutletTemp;
        }
      }
    }
  }

  /**
   * Enable/disable heat exchanger
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.heatTransferRate = 0;
    }
    this.notifyChange();
  }

  /**
   * Get LMTD (Log Mean Temperature Difference) for reference
   */
  getLMTD() {
    if (this.hotSideFlowRate < 0.0001 || this.coldSideFlowRate < 0.0001) {
      return 0;
    }

    const dT1 = this.hotSideInletTemp - this.coldSideOutletTemp;
    const dT2 = this.hotSideOutletTemp - this.coldSideInletTemp;

    if (dT1 <= 0 || dT2 <= 0) return 0;
    if (Math.abs(dT1 - dT2) < 0.01) return dT1;

    return (dT1 - dT2) / Math.log(dT1 / dT2);
  }

  /**
   * Render visual representation
   */
  render() {
    const element = this.getElement();
    if (!element) return;

    // Update visual indicators
    if (this.enabled && this.heatTransferRate > 1000) {
      element.classList.add('active');
    } else {
      element.classList.remove('active');
    }
  }

  /**
   * Reset heat exchanger
   */
  reset() {
    super.reset();
    this.hotSideFlowRate = 0;
    this.coldSideFlowRate = 0;
    this.hotSideInletTemp = 20;
    this.hotSideOutletTemp = 20;
    this.coldSideInletTemp = 20;
    this.coldSideOutletTemp = 20;
    this.heatTransferRate = 0;
  }

  /**
   * Get heat exchanger info
   */
  getInfo() {
    return {
      ...super.getInfo(),
      enabled: this.enabled,
      hotSideFlow: this.hotSideFlowRate.toFixed(4) + ' m³/s',
      coldSideFlow: this.coldSideFlowRate.toFixed(4) + ' m³/s',
      hotInletTemp: this.hotSideInletTemp.toFixed(1) + ' °C',
      hotOutletTemp: this.hotSideOutletTemp.toFixed(1) + ' °C',
      coldInletTemp: this.coldSideInletTemp.toFixed(1) + ' °C',
      coldOutletTemp: this.coldSideOutletTemp.toFixed(1) + ' °C',
      heatTransferRate: (this.heatTransferRate / 1000).toFixed(2) + ' kW',
      effectiveness: (this.thermalEfficiency * 100).toFixed(1) + '%',
      LMTD: this.getLMTD().toFixed(2) + ' °C',
      UA: (this.heatTransferCoeff * this.area).toFixed(1) + ' W/K'
    };
  }
}

// Export
window.HeatExchanger = HeatExchanger;
