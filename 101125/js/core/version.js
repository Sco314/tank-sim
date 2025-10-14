/**
 * version.js - Engine Version Declaration and Compatibility Checking
 * 
 * Place this file in: engine/core/version.js
 * Load it FIRST in all simulator HTML files
 */

// Engine version
window.ENGINE_VERSION = '1.0.0';

// Compatibility checking
window.EngineCompat = {
  
  /**
   * Check if config is compatible with current engine
   */
  checkCompatibility(config) {
    if (!config || !config._metadata) {
      console.warn('⚠️ Config missing metadata - compatibility unknown');
      return { compatible: true, warnings: ['Config missing version metadata'] };
    }
    
    const configVersion = config._metadata.version;
    const engineVersion = window.ENGINE_VERSION;
    
    const warnings = [];
    const errors = [];
    
    // Parse versions
    const configParts = configVersion.split('.').map(Number);
    const engineParts = engineVersion.split('.').map(Number);
    
    // Major version must match
    if (configParts[0] !== engineParts[0]) {
      errors.push(`Major version mismatch: Config v${configVersion}, Engine v${engineVersion}`);
      errors.push('This simulator may not work correctly. Update either the config or engine.');
    }
    
    // Minor version mismatch is a warning
    else if (configParts[1] !== engineParts[1]) {
      warnings.push(`Minor version mismatch: Config v${configVersion}, Engine v${engineVersion}`);
      warnings.push('Some features may not work as expected.');
    }
    
    // Patch version difference is OK
    else if (configParts[2] !== engineParts[2]) {
      console.log(`ℹ️ Patch version difference: Config v${configVersion}, Engine v${engineVersion} (OK)`);
    }
    
    return {
      compatible: errors.length === 0,
      warnings,
      errors,
      configVersion,
      engineVersion
    };
  },
  
  /**
   * Display compatibility report
   */
  showCompatibilityReport(result) {
    if (result.errors.length > 0) {
      console.error('❌ COMPATIBILITY ERRORS:');
      result.errors.forEach(err => console.error('  - ' + err));
      
      // Show alert to user
      alert(`❌ Version Incompatibility\n\n${result.errors.join('\n')}\n\nSimulator may not work correctly.`);
    }
    
    if (result.warnings.length > 0) {
      console.warn('⚠️ COMPATIBILITY WARNINGS:');
      result.warnings.forEach(warn => console.warn('  - ' + warn));
    }
    
    if (result.compatible && result.warnings.length === 0) {
      console.log('✅ Version compatibility: OK');
    }
  },
  
  /**
   * Get feature compatibility matrix
   */
  getFeatureSupport() {
    return {
      '1.0.0': {
        pumps: ['fixed', 'variable', '3-speed'],
        valves: ['proportional'],
        tanks: ['basic'],
        pipes: ['basic'],
        sensors: ['pressure'],
        features: ['cavitation', 'modal-controls']
      }
      // Add new versions here as engine evolves
    };
  },
  
  /**
   * Check if specific feature is supported
   */
  supportsFeature(feature) {
    const support = this.getFeatureSupport();
    const version = window.ENGINE_VERSION;
    
    if (!support[version]) {
      console.warn(`No feature data for engine v${version}`);
      return false;
    }
    
    // Check all feature arrays
    for (const [category, items] of Object.entries(support[version])) {
      if (Array.isArray(items) && items.includes(feature)) {
        return true;
      }
    }
    
    return false;
  }
};

// Auto-check on load if config is already present
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (window.SYSTEM_CONFIG) {
        const result = window.EngineCompat.checkCompatibility(window.SYSTEM_CONFIG);
        window.EngineCompat.showCompatibilityReport(result);
      }
    }, 100);
  });
}

console.log(`✅ Engine v${window.ENGINE_VERSION} loaded`);
