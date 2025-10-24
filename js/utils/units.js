/**
 * units.js - Unit conversion utilities for process variables
 *
 * Supports conversion between SI and US customary units for:
 * - Temperature (°C ↔ °F)
 * - Pressure (bar ↔ psi)
 * - Flow (m³/s ↔ gpm)
 * - Level (fraction ↔ %)
 * - Length (m ↔ ft)
 * - Volume (m³ ↔ gal)
 */

class UnitConverter {
  constructor() {
    // Conversion constants
    this.CONSTANTS = {
      // Pressure
      BAR_TO_PSI: 14.5038,
      PSI_TO_BAR: 0.0689476,
      BAR_TO_PA: 100000,
      PA_TO_BAR: 0.00001,

      // Flow
      M3S_TO_GPM: 15850.3,
      GPM_TO_M3S: 0.0000631,
      M3S_TO_LPS: 1000,
      LPS_TO_M3S: 0.001,

      // Volume
      M3_TO_GAL: 264.172,
      GAL_TO_M3: 0.00378541,
      M3_TO_L: 1000,
      L_TO_M3: 0.001,

      // Length
      M_TO_FT: 3.28084,
      FT_TO_M: 0.3048,

      // Temperature (handled by functions due to offset)

      // Thermodynamic
      WATER_DENSITY: 1000, // kg/m³ at 20°C
      WATER_SPECIFIC_HEAT: 4186, // J/(kg·K) at 20°C
      GRAVITY: 9.81 // m/s²
    };
  }

  // ========== Temperature ==========

  /**
   * Convert Celsius to Fahrenheit
   */
  celsiusToFahrenheit(celsius) {
    return celsius * 9/5 + 32;
  }

  /**
   * Convert Fahrenheit to Celsius
   */
  fahrenheitToCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5/9;
  }

  /**
   * Convert Celsius to Kelvin
   */
  celsiusToKelvin(celsius) {
    return celsius + 273.15;
  }

  /**
   * Convert Kelvin to Celsius
   */
  kelvinToCelsius(kelvin) {
    return kelvin - 273.15;
  }

  // ========== Pressure ==========

  /**
   * Convert bar to psi
   */
  barToPsi(bar) {
    return bar * this.CONSTANTS.BAR_TO_PSI;
  }

  /**
   * Convert psi to bar
   */
  psiToBar(psi) {
    return psi * this.CONSTANTS.PSI_TO_BAR;
  }

  /**
   * Convert bar to Pascals
   */
  barToPa(bar) {
    return bar * this.CONSTANTS.BAR_TO_PA;
  }

  /**
   * Convert Pascals to bar
   */
  paToBar(pa) {
    return pa * this.CONSTANTS.PA_TO_BAR;
  }

  // ========== Flow ==========

  /**
   * Convert m³/s to gallons per minute
   */
  m3sToGpm(m3s) {
    return m3s * this.CONSTANTS.M3S_TO_GPM;
  }

  /**
   * Convert gallons per minute to m³/s
   */
  gpmToM3s(gpm) {
    return gpm * this.CONSTANTS.GPM_TO_M3S;
  }

  /**
   * Convert m³/s to liters per second
   */
  m3sToLps(m3s) {
    return m3s * this.CONSTANTS.M3S_TO_LPS;
  }

  /**
   * Convert liters per second to m³/s
   */
  lpsToM3s(lps) {
    return lps * this.CONSTANTS.LPS_TO_M3S;
  }

  // ========== Volume ==========

  /**
   * Convert m³ to gallons
   */
  m3ToGal(m3) {
    return m3 * this.CONSTANTS.M3_TO_GAL;
  }

  /**
   * Convert gallons to m³
   */
  galToM3(gal) {
    return gal * this.CONSTANTS.GAL_TO_M3;
  }

  /**
   * Convert m³ to liters
   */
  m3ToL(m3) {
    return m3 * this.CONSTANTS.M3_TO_L;
  }

  /**
   * Convert liters to m³
   */
  lToM3(l) {
    return l * this.CONSTANTS.L_TO_M3;
  }

  // ========== Length ==========

  /**
   * Convert meters to feet
   */
  mToFt(m) {
    return m * this.CONSTANTS.M_TO_FT;
  }

  /**
   * Convert feet to meters
   */
  ftToM(ft) {
    return ft * this.CONSTANTS.FT_TO_M;
  }

  // ========== Level ==========

  /**
   * Convert fraction (0-1) to percent (0-100)
   */
  fractionToPercent(fraction) {
    return fraction * 100;
  }

  /**
   * Convert percent (0-100) to fraction (0-1)
   */
  percentToFraction(percent) {
    return percent / 100;
  }

  // ========== Thermodynamic Calculations ==========

  /**
   * Calculate enthalpy of water (J/kg)
   * Simplified: H = Cp * T (reference at 0°C)
   */
  waterEnthalpy(tempCelsius) {
    return this.CONSTANTS.WATER_SPECIFIC_HEAT * tempCelsius;
  }

  /**
   * Calculate temperature from enthalpy (°C)
   */
  temperatureFromEnthalpy(enthalpy) {
    return enthalpy / this.CONSTANTS.WATER_SPECIFIC_HEAT;
  }

  /**
   * Calculate mass from volume (kg)
   * For water at standard conditions
   */
  volumeToMass(volume_m3, density = null) {
    const rho = density || this.CONSTANTS.WATER_DENSITY;
    return volume_m3 * rho;
  }

  /**
   * Calculate hydrostatic pressure from height (bar)
   * P = ρgh
   */
  heightToPressure(height_m, density = null) {
    const rho = density || this.CONSTANTS.WATER_DENSITY;
    const pressure_pa = rho * this.CONSTANTS.GRAVITY * height_m;
    return this.paToBar(pressure_pa);
  }

  // ========== Formatting ==========

  /**
   * Format value with units
   */
  format(value, unit, precision = 2) {
    return `${value.toFixed(precision)} ${unit}`;
  }

  /**
   * Format temperature with preferred units
   */
  formatTemperature(celsius, useFahrenheit = false, precision = 1) {
    if (useFahrenheit) {
      const fahrenheit = this.celsiusToFahrenheit(celsius);
      return this.format(fahrenheit, '°F', precision);
    } else {
      return this.format(celsius, '°C', precision);
    }
  }

  /**
   * Format pressure with preferred units
   */
  formatPressure(bar, usePsi = false, precision = 2) {
    if (usePsi) {
      const psi = this.barToPsi(bar);
      return this.format(psi, 'psi', precision);
    } else {
      return this.format(bar, 'bar', precision);
    }
  }

  /**
   * Format flow with preferred units
   */
  formatFlow(m3s, useGpm = false, precision = 2) {
    if (useGpm) {
      const gpm = this.m3sToGpm(m3s);
      return this.format(gpm, 'gpm', precision);
    } else {
      return this.format(m3s, 'm³/s', precision);
    }
  }

  /**
   * Format level as percentage
   */
  formatLevel(fraction, precision = 1) {
    const percent = this.fractionToPercent(fraction);
    return this.format(percent, '%', precision);
  }

  /**
   * Format volume with preferred units
   */
  formatVolume(m3, useGallons = false, precision = 2) {
    if (useGallons) {
      const gal = this.m3ToGal(m3);
      return this.format(gal, 'gal', precision);
    } else {
      return this.format(m3, 'm³', precision);
    }
  }
}

// Create singleton instance
const Units = new UnitConverter();

// Export
window.Units = Units;
window.UnitConverter = UnitConverter;
