/**
 * exporter.js v3.0 - TRUE Single-File Exporter
 * 
 * DUMB FULL EMBEDDING:
 * - Embeds ALL engine code (no dependency analysis)
 * - Embeds valve.html as inline iframe content
 * - Embeds all styles
 * - Creates 100% standalone, working HTML file
 * - One file, works anywhere, no dependencies
 */

const EXPORTER_VERSION = '3.0.0';
const ENGINE_VERSION = '1.0.0';

// Engine file URLs (will be fetched and embedded)
const ENGINE_FILES = [
  // Core (always needed)
  'https://sco314.github.io/tank-sim/101125/js/core/Component.js',
  'https://sco314.github.io/tank-sim/101125/js/core/FlowNetwork.js',
  'https://sco314.github.io/tank-sim/101125/js/core/ComponentManager.js',
  
  // Boundary components
  'https://sco314.github.io/tank-sim/101125/js/components/sources/Feed.js',
  'https://sco314.github.io/tank-sim/101125/js/components/sinks/Drain.js',
  
  // Tanks
  'https://sco314.github.io/tank-sim/101125/js/components/tanks/Tank.js',
  
  // Pumps (all types)
  'https://sco314.github.io/tank-sim/101125/js/components/pumps/Pump.js',
  'https://sco314.github.io/tank-sim/101125/js/components/pumps/FixedSpeedPump.js',
  'https://sco314.github.io/tank-sim/101125/js/components/pumps/VariableSpeedPump.js',
  'https://sco314.github.io/tank-sim/101125/js/components/pumps/ThreeSpeedPump.js',
  
  // Valves
  'https://sco314.github.io/tank-sim/101125/js/components/valves/Valve.js',
  
  // Pipes
  'https://sco314.github.io/tank-sim/101125/js/components/pipes/Pipe.js',
  
  // Sensors
  'https://sco314.github.io/tank-sim/101125/js/components/sensors/PressureSensor.js',
  
  // Managers
  'https://sco314.github.io/tank-sim/101125/js/managers/TankManager.js',
  'https://sco314.github.io/tank-sim/101125/js/managers/PumpManager.js',
  'https://sco314.github.io/tank-sim/101125/js/managers/ValveManager.js',
  'https://sco314.github.io/tank-sim/101125/js/managers/PipeManager.js',
  'https://sco314.github.io/tank-sim/101125/js/managers/PressureManager.js'
];

const VALVE_HTML_URL = 'https://sco314.github.io/tank-sim/101125/valve.html';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = Date.now();
    this.engineCodeCache = null; // Cache fetched code
    this.valveHTMLCache = null;
  }

  /**
   * Main export method - creates TRUE standalone file
   */
  async exportSimulator(defaultName = 'My Simulator') {
    // Step 1: Prompt for name
    const simName = prompt('Enter simulator name:', defaultName) || defaultName;
    
    if (!simName || simName.trim() === '') {
      alert('Export cancelled - no name provided');
      return;
    }
    
    console.log(`📦 Exporting standalone simulator: ${simName}`);
    
    // Step 2: Validate design
    const validation = this._validateDesign();
    if (!validation.valid) {
      if (!confirm(`⚠️ Issues found:\n\n${validation.errors.join('\n')}\n\nExport anyway?`)) {
        return;
      }
    }
    
    // Step 3: Show progress
    const progressMsg = document.createElement('div');
    progressMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#172144;color:#e9f0ff;padding:20px 40px;border-radius:12px;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,0.5);';
    progressMsg.innerHTML = '<div style="font-size:18px;font-weight:600;">⏳ Embedding engine code...</div><div style="font-size:14px;margin-top:8px;color:#9bb0ff;">This may take a few seconds</div>';
    document.body.appendChild(progressMsg);
    
    try {
      // Step 4: Fetch all engine code
      await this._fetchEngineCode();
      
      progressMsg.querySelector('div').textContent = '⏳ Embedding valve controls...';
      
      // Step 5: Fetch valve.html
      await this._fetchValveHTML();
      
      progressMsg.querySelector('div').textContent = '⏳ Generating HTML...';
      
      // Step 6: Generate complete standalone HTML
      const cleanName = this._sanitizeName(simName);
      const html = this._generateStandaloneHTML(simName, cleanName);
      
      progressMsg.querySelector('div').textContent = '⏳ Downloading file...';
      
      // Step 7: Download
      this._downloadFile(`${cleanName}.html`, html);
      
      // Step 8: Success!
      document.body.removeChild(progressMsg);
      
      const fileSize = (html.length / 1024).toFixed(1);
      console.log(`✅ Export complete! File size: ${fileSize} KB`);
      alert(`✅ Export complete!\n\nFile: ${cleanName}.html\nSize: ${fileSize} KB\n\nThis file is 100% standalone and works anywhere!`);
      
    } catch (error) {
      document.body.removeChild(progressMsg);
      console.error('Export failed:', error);
      alert(`❌ Export failed:\n\n${error.message}\n\nCheck console for details.`);
    }
  }

  /**
   * Fetch and cache all engine code
   */
  async _fetchEngineCode() {
    if (this.engineCodeCache) {
      console.log('Using cached engine code');
      return;
    }
    
    console.log(`Fetching ${ENGINE_FILES.length} engine files...`);
    
    const codeBlocks = [];
    
    for (const url of ENGINE_FILES) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        const code = await response.text();
        const filename = url.split('/').pop();
        codeBlocks.push(`\n// ========================================\n// ${filename}\n// ========================================\n${code}`);
        console.log(`✓ Fetched ${filename}`);
      } catch (error) {
        console.error(`✗ Failed to fetch ${url}:`, error);
        throw new Error(`Failed to fetch engine file: ${url}`);
      }
    }
    
    this.engineCodeCache = codeBlocks.join('\n\n');
    console.log(`
