/**
 * exporter.js - Simulator Exporter v2.0
 * 
 * ⚙️ CONFIGURATION (IMPORTANT!)
 * ═══════════════════════════════════════════════════════════
 * 
 * SET YOUR ENGINE PATH HERE:
 * 
 * If your engine files are in a folder called 'js/', set to '../../js'
 * If your engine files are in a folder called 'engine/', set to '../../engine'
 * 
 * To configure, add this BEFORE loading exporter.js in your HTML:
 * 
 *   <script>
 *     window.EXPORTER_ENGINE_PATH = '../../js';  // or '../../engine'
 *   </script>
 *   <script src="exporter.js"></script>
 * 
 * Or modify the default below:
 * ═══════════════════════════════════════════════════════════
 * 
 * Features:
 * - Path validation
 * - Property validation
 * - Pre-export validation
 * - Better setup instructions
 * - Export versioning
 * - Disconnected component warnings
 */

const EXPORTER_VERSION = '2.0.0';
const ENGINE_VERSION = '1.0.0'; // Track engine compatibility

// ⚙️ DEFAULT ENGINE PATH - Change this to match YOUR folder structure!
// Common options: '../../js' or '../../engine'
window.EXPORTER_ENGINE_PATH = window.EXPORTER_ENGINE_PATH || '../../js';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = new Date().toISOString();
  }

  /**
   * Export complete simulator with validation
   */
  async exportSimulator(simName = 'my-sim') {
    // Clean sim name
    const cleanName = simName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Validate before export
    const validation = this._validateForExport();
    if (!validation.canExport) {
      console.error('❌ Export blocked:', validation.errors);
      alert(`Cannot export:\n\n${validation.errors.join('\n')}`);
      return;
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      const proceed = confirm(
        `⚠️ Export Warnings:\n\n${validation.warnings.join('\n')}\n\nProceed with export?`
      );
      if (!proceed) return;
    }
    
    console.log('📦 Starting export...');
    
    // Generate files
    const files = {
      'systemConfig.js': this.generateSystemConfig(simName, cleanName),
      'index.html': this.generateIndexHTML(simName, cleanName),
      'README.md': this.generateReadme(simName, cleanName),
      'SETUP.txt': this.generateSetupInstructions(cleanName)
    };
    
    // Download files
    this.downloadFiles(files, cleanName);
    
    console.log(`✅ Exported simulator: ${simName}`);
    
    // Show success message with instructions
    this._showSuccessMessage(simName, cleanName, validation);
  }

  /**
   * Validate design for export (NEW)
   */
  _validateForExport() {
    const errors = [];
    const warnings = [];
    
    // Must have components
    if (this.designer.components.size === 0) {
      errors.push('No components to export');
    }
    
    // Check for disconnected components
    const disconnected = this._findDisconnectedComponents();
    if (disconnected.length > 0) {
      warnings.push(`${disconnected.length} disconnected components will not function: ${disconnected.map(c => c.name).join(', ')}`);
    }
    
    // Check for feed/drain
    const components = Array.from(this.designer.components.values());
    const hasFeed = components.some(c => c.type === 'feed');
    const hasDrain = components.some(c => c.type === 'drain');
    
    if (!hasFeed) {
      warnings.push('No feed (source) - components will have no input');
    }
    if (!hasDrain) {
      warnings.push('No drain (sink) - fluid will have nowhere to go');
    }
    
    // Validate properties
    for (const comp of components) {
      const propErrors = this._validateComponentProperties(comp);
      errors.push(...propErrors);
    }
    
    // Path dependency check
    const pathIssues = this._checkPathDependencies();
    warnings.push(...pathIssues);
    
    return {
      canExport: errors.length === 0,
      errors,
      warnings,
      componentCount: this.designer.components.size,
      connectionCount: this.designer.connections.length
    };
  }

  /**
   * Check path dependencies (NEW)
   */
  _checkPathDependencies() {
    const warnings = [];
    const enginePath = window.EXPORTER_ENGINE_PATH || '../../js';
    const engineFolder = enginePath.split('/').pop();
    
    // Check if valve.html will be accessible
    warnings.push('Ensure valve.html exists at ../../valve.html relative to simulator');
    
    // Check if engine folder will be accessible
    warnings.push(`Ensure ${engineFolder}/ folder exists at ${enginePath} relative to simulator`);
    
    // Check for image dependencies
    const usesImages = Array.from(this.designer.components.values())
      .some(c => ['tank', 'pump', 'valve'].includes(c.type));
    
    if (usesImages) {
      warnings.push('Simulator uses external image URLs - internet connection required for icons');
    }
    
    return warnings;
  }

  /**
   * Find disconnected components
   */
  _findDisconnectedComponents() {
    const disconnected = [];
    
    for (const comp of this.designer.components.values()) {
      const hasInput = comp.config.inputs && comp.config.inputs.length > 0;
      const hasOutput = comp.config.outputs && comp.config.outputs.length > 0;
      
      if (comp.type === 'feed' && !hasOutput) {
        disconnected.push(comp);
      } else if (comp.type === 'drain' && !hasInput) {
        disconnected.push(comp);
      } else if (comp.type !== 'feed' && comp.type !== 'drain' && !hasInput && !hasOutput) {
        disconnected.push(comp);
      }
    }
    
    return disconnected;
  }

  /**
   * Validate component properties
   */
  _validateComponentProperties(comp) {
    const errors = [];
    const config = comp.config;
    
    // Negative checks
    if (config.capacity !== undefined && config.capacity < 0) {
      errors.push(`${comp.name}: capacity cannot be negative`);
    }
    if (config.efficiency !== undefined && (config.efficiency < 0 || config.efficiency > 1)) {
      errors.push(`${comp.name}: efficiency must be 0-1`);
    }
    if (config.volume !== undefined && config.volume <= 0) {
      errors.push(`${comp.name}: volume must be positive`);
    }
    if (config.maxFlow !== undefined && config.maxFlow < 0) {
      errors.push(`${comp.name}: maxFlow cannot be negative`);
    }
    
    return errors;
  }

  /**
   * Generate system config with validation
   */
  generateSystemConfig(simName, cleanName) {
    const components = Array.from(this.designer.components.values());
    const connections = this.designer.connections;
    
    // Group components
    const grouped = {
      feeds: {},
      drains: {},
      tanks: {},
      pumps: {},
      valves: {},
      pipes: {},
      pressureSensors: {}
    };
    
    // Process components
    components.forEach(comp => {
      const cleanId = this._cleanId(comp.id);
      const config = this._buildComponentConfig(comp, cleanId);
      
      const categoryMap = {
        feed: 'feeds',
        drain: 'drains',
        tank: 'tanks',
        pump: 'pumps',
        valve: 'valves',
        sensor: 'pressureSensors'
      };
      
      const category = categoryMap[comp.type];
      if (category) {
        grouped[category][cleanId] = config;
      }
    });
    
    // Generate pipes
    connections.forEach((conn, idx) => {
      const fromComp = this.designer.components.get(conn.from);
      const toComp = this.designer.components.get(conn.to);
      const pipeId = `pipe${idx + 1}`;
      
      grouped.pipes[pipeId] = {
        id: pipeId,
        name: `${fromComp.name} to ${toComp.name}`,
        type: 'pipe',
        diameter: 0.05,
        length: this._calculateDistance(fromComp, toComp),
        svgElement: `#${pipeId}Flow`,
        inputs: [this._cleanId(conn.from)],
        outputs: [this._cleanId(conn.to)]
      };
    });
    
    // Build config with metadata
    const config = {
      // Metadata
      _metadata: {
        name: simName,
        version: ENGINE_VERSION,
        exportVersion: EXPORTER_VERSION,
        designerVersion: this.designer.designMetadata?.version || 'unknown',
        exported: this.exportTimestamp,
        componentCount: components.length,
        connectionCount: connections.length
      },
      
      // Components
      feeds: grouped.feeds,
      drains: grouped.drains,
      tanks: grouped.tanks,
      pumps: grouped.pumps,
      valves: grouped.valves,
      pipes: grouped.pipes,
      pressureSensors: grouped.pressureSensors,
      
      // Settings
      settings: {
        timeStep: 0.016,
        maxTimeStep: 0.1,
        gravity: 9.81,
        fluidDensity: 1000,
        updateInterval: 16,
        debugMode: true,
        logFlows: false
      }
    };
    
    const enginePath = window.EXPORTER_ENGINE_PATH || '../../js';
    const engineFolder = enginePath.split('/').pop();
    
    const configJS = `/**
 * systemConfig.js - ${simName}
 * 
 * Generated by Process Simulator Designer v${EXPORTER_VERSION}
 * Export Date: ${new Date(this.exportTimestamp).toLocaleString()}
 * 
 * ⚙️ ENGINE PATH CONFIGURATION:
 * This config expects engine files at: ${enginePath}
 * If your engine files are in a different location, update EXPORTER_ENGINE_PATH
 * in exporter.js before exporting.
 * 
 * ⚠️ IMPORTANT PATH REQUIREMENTS:
 * This file expects the following structure:
 *   sims/${cleanName}/
 *   ├── index.html
 *   ├── systemConfig.js (this file)
 *   └── README.md
 *   
 *   ${engineFolder}/ (at ${enginePath} from this file)
 *   ├── core/
 *   ├── components/
 *   └── managers/
 *   
 *   valve.html (at ../../valve.html from this file)
 */

const SYSTEM_CONFIG = ${JSON.stringify(config, null, 2)};

// Validation
function validateConfig(config) {
  const errors = [];
  const allIds = new Set();
  
  for (const [category, items] of Object.entries(config)) {
    if (category === 'settings' || category === '_metadata') continue;
    for (const [key, item] of Object.entries(items)) {
      if (allIds.has(item.id)) {
        errors.push(\`Duplicate ID: \${item.id}\`);
      }
      allIds.add(item.id);
    }
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    return false;
  }
  
  console.log('✓ Configuration validated');
  return true;
}

// Version check
function checkEngineVersion() {
  const required = '${ENGINE_VERSION}';
  const current = window.ENGINE_VERSION || 'unknown';
  
  if (current !== required && current !== 'unknown') {
    console.warn(\`⚠️ Engine version mismatch: Config expects \${required}, found \${current}\`);
  }
}

// Export
window.SYSTEM_CONFIG = SYSTEM_CONFIG;
window.validateConfig = validateConfig;

// Auto-validate
if (validateConfig(SYSTEM_CONFIG)) {
  checkEngineVersion();
  console.log('✅ System configuration loaded');
  console.log('📋 Components:', {
    feeds: Object.keys(SYSTEM_CONFIG.feeds).length,
    tanks: Object.keys(SYSTEM_CONFIG.tanks).length,
    pumps: Object.keys(SYSTEM_CONFIG.pumps).length,
    valves: Object.keys(SYSTEM_CONFIG.valves).length,
    drains: Object.keys(SYSTEM_CONFIG.drains).length,
    pipes: Object.keys(SYSTEM_CONFIG.pipes).length,
    sensors: Object.keys(SYSTEM_CONFIG.pressureSensors).length
  });
}`;
    
    return configJS;
  }

  /**
   * Generate index.html with configurable engine path
   */
  generateIndexHTML(simName, cleanName) {
    const components = Array.from(this.designer.components.values());
    const connections = this.designer.connections;
    
    const componentsSVG = components.map(comp => this._generateComponentSVG(comp)).join('\n        ');
    const pipesSVG = connections.map((conn, idx) => this._generatePipeSVG(conn, idx)).join('\n        ');
    
    const viewBox = this.designer.canvas.viewBox.baseVal;
    
    // Engine path - configurable (user can change this)
    const enginePath = window.EXPORTER_ENGINE_PATH || '../../js'; // Default to ../../js for your structure
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>${simName} - Process Simulator</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="generator" content="Process Simulator Designer v${EXPORTER_VERSION}"/>
  <meta name="export-date" content="${this.exportTimestamp}"/>
  <meta name="engine-path" content="${enginePath}"/>
  <link rel="stylesheet" href="${enginePath}/style.css">

  <!-- Core Architecture -->
  <script src="${enginePath}/core/Component.js" defer></script>
  <script src="${enginePath}/core/FlowNetwork.js" defer></script>
  <script src="${enginePath}/core/ComponentManager.js" defer></script>

  <!-- Boundary Components -->
  <script src="${enginePath}/components/sources/Feed.js" defer></script>
  <script src="${enginePath}/components/sinks/Drain.js" defer></script>

  <!-- Tank Components -->
  <script src="${enginePath}/components/tanks/Tank.js" defer></script>

  <!-- Pump Components -->
  <script src="${enginePath}/components/pumps/Pump.js" defer></script>
  <script src="${enginePath}/components/pumps/FixedSpeedPump.js" defer></script>
  <script src="${enginePath}/components/pumps/VariableSpeedPump.js" defer></script>
  <script src="${enginePath}/components/pumps/ThreeSpeedPump.js" defer></script>

  <!-- Valve Components -->
  <script src="${enginePath}/components/valves/Valve.js" defer></script>

  <!-- Pipe Components -->
  <script src="${enginePath}/components/pipes/Pipe.js" defer></script>

  <!-- Sensor Components -->
  <script src="${enginePath}/components/sensors/PressureSensor.js" defer></script>

  <!-- Managers -->
  <script src="${enginePath}/managers/TankManager.js" defer></script>
  <script src="${enginePath}/managers/PumpManager.js" defer></script>
  <script src="${enginePath}/managers/ValveManager.js" defer></script>
  <script src="${enginePath}/managers/PipeManager.js" defer></script>
  <script src="${enginePath}/managers/PressureManager.js" defer></script>

  <!-- Configuration -->
  <script src="./systemConfig.js" defer></script>

  <!-- Initialize -->
  <script defer>
    // Set engine version for compatibility check
    window.ENGINE_VERSION = '${ENGINE_VERSION}';
    
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        console.log('=== INITIALIZING ${simName} ===');
        
        if (!window.SYSTEM_CONFIG) {
          console.error('❌ SYSTEM_CONFIG not loaded');
          alert('❌ Configuration failed to load. Check console for details.');
          return;
        }
        if (!window.ComponentManager) {
          console.error('❌ ComponentManager not loaded');
          const enginePath = document.querySelector('meta[name="engine-path"]')?.content || 'unknown';
          alert(\`❌ Engine files not loaded. Check that your engine folder exists at: \${enginePath}\n\nExpected structure:\n- \${enginePath}/core/\n- \${enginePath}/components/\n- \${enginePath}/managers/\`);
          return;
        }
        
        console.log('✅ All components loaded');
        
        window.componentManager = new ComponentManager(SYSTEM_CONFIG);
        window.componentManager.initialize().then(success => {
          if (success) {
            console.log('✅ System initialized successfully');
            window.componentManager.start();
            console.log('✅ Simulation started');
          } else {
            console.error('❌ System initialization failed');
            alert('❌ Simulation failed to start. Check console for details.');
          }
        });
      }, 500);
    });
  </script>
</head>

<body>

<button id="controlsToggle" class="controls-toggle" aria-controls="controlsDrawer" aria-expanded="false">
  Controls
</button>
  
<div class="app">
  <div class="grid">
    <div class="card stage">
      <svg viewBox="0 0 ${viewBox.width} ${viewBox.height}" aria-labelledby="title desc" role="img">
        <title id="title">${simName}</title>
        <desc id="desc">Interactive process simulator. Click components to control them.</desc>
        
        <defs>
          <pattern id="grid" width="${this.designer.gridSize}" height="${this.designer.gridSize}" patternUnits="userSpaceOnUse">
            <path d="M ${this.designer.gridSize} 0 L 0 0 0 ${this.designer.gridSize}" fill="none" stroke="#22305f" stroke-width="1"></path>
          </pattern>
          <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7cc8ff"></stop>
            <stop offset="100%" stop-color="#2d8bd6"></stop>
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width="${viewBox.width}" height="${viewBox.height}" fill="url(#grid)" opacity="0.4"></rect>
        
        <!-- PIPES -->
        ${pipesSVG}
        
        <!-- COMPONENTS -->
        ${componentsSVG}
      </svg>
    </div>

    <!-- Controls Drawer -->
    <aside id="controlsDrawer" class="controls-drawer" aria-hidden="true">
      <div class="controls-panel card" role="dialog" aria-modal="true" aria-labelledby="controlsTitle">
        <button id="controlsClose" class="controls-close" aria-label="Close controls">×</button>

        <div>
          <h1 id="controlsTitle">System Controls</h1>
          <div class="sub">${simName} - Click components to interact</div>
          
          <div class="controls">
            <div class="row">
              <button type="button" id="pauseBtn" aria-pressed="false" class="btn">Pause</button>
              <button type="button" id="resetBtn" class="btn">Reset</button>
            </div>
          </div>

          <hr/>
          <h1>System Status</h1>
          <div class="kv" id="systemStatus">
            <div>Status</div><div id="simStatus">Running</div>
          </div>
          
          <hr/>
          <h1>Debug</h1>
          <button type="button" id="debugBtn" class="btn">Show Debug Info</button>
          <pre id="debugOutput" style="display:none; font-size:10px; max-height:200px; overflow:auto; background:#0e1734; padding:8px; margin-top:8px;"></pre>
        </div>
      </div>
    </aside>
  </div>
</div>

<!-- Controls Script -->
<script>
(function(){
  const drawer = document.getElementById('controlsDrawer');
  const panel = drawer.querySelector('.controls-panel');
  const toggle = document.getElementById('controlsToggle');
  const closeBtn = document.getElementById('controlsClose');

  function openDrawer(){
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    toggle.setAttribute('aria-expanded','true');
    setTimeout(() => closeBtn.focus(), 0);
  }
  function closeDrawer(){
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    toggle.setAttribute('aria-expanded','false');
    toggle.focus();
  }

  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (e) => {
    if (!panel.contains(e.target)) closeDrawer();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });
  
  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn?.addEventListener('click', () => {
    if (window.componentManager) {
      if (window.componentManager.paused) {
        window.componentManager.resume();
        pauseBtn.textContent = 'Pause';
      } else {
        window.componentManager.pause();
        pauseBtn.textContent = 'Resume';
      }
    }
  });
  
  const resetBtn = document.getElementById('resetBtn');
  resetBtn?.addEventListener('click', () => {
    if (window.componentManager) {
      window.componentManager.reset();
      console.log('System reset');
    }
  });
  
  const debugBtn = document.getElementById('debugBtn');
  const debugOutput = document.getElementById('debugOutput');
  debugBtn?.addEventListener('click', () => {
    if (window.componentManager) {
      const info = window.componentManager.getSystemInfo();
      debugOutput.textContent = JSON.stringify(info, null, 2);
      debugOutput.style.display = debugOutput.style.display === 'none' ? 'block' : 'none';
    }
  });
})();
</script>

</body>
</html>`;
    
    return html;
  }

  /**
   * Generate README
   */
  generateReadme(simName, cleanName) {
    const components = Array.from(this.designer.components.values());
    const validation = this._validateForExport();
    
    return `# ${simName}

Generated by Process Simulator Designer v${EXPORTER_VERSION}  
Export Date: ${new Date(this.exportTimestamp).toLocaleString()}

## Design Summary

- **Components:** ${components.length}
- **Connections:** ${this.designer.connections.length}
- **Status:** ${validation.canExport ? '✅ Valid' : '❌ Has Issues'}

${validation.warnings.length > 0 ? `
### ⚠️ Warnings
${validation.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

## Component List

${this._groupComponentsByType(components).map(group => `
### ${group.type}
${group.items.map(comp => `- **${comp.name}**`).join('\n')}
`).join('\n')}

## Setup Instructions

### Required Folder Structure

\`\`\`
project-root/
├── sims/
│   └── ${cleanName}/
│       ├── index.html          ← Open this file
│       ├── systemConfig.js
│       ├── README.md
│       └── SETUP.txt
├── engine/
│   ├── core/
│   ├── components/
│   ├── managers/
│   └── style.css
└── valve.html
\`\`\`

### Installation Steps

1. **Create folder structure:**
   \`\`\`bash
   mkdir -p sims/${cleanName}
   \`\`\`

2. **Place exported files:**
   - Put all exported files in \`sims/${cleanName}/\`

3. **Verify engine files:**
   - Ensure \`engine/\` folder exists at project root
   - Ensure \`valve.html\` exists at project root

4. **Open simulator:**
   - Open \`sims/${cleanName}/index.html\` in a web browser
   - No server required!

### Troubleshooting

**Problem:** Components don't appear  
**Solution:** Check browser console for errors. Verify all engine files loaded.

**Problem:** Valves don't open  
**Solution:** Ensure \`valve.html\` exists at \`../../valve.html\` relative to index.html

**Problem:** Pumps/valves not clickable  
**Solution:** Clear browser cache and reload

**Problem:** Simulation doesn't start  
**Solution:** Check console for missing dependencies. Verify folder structure.

## Usage

1. **Open Controls:** Click "Controls" button in top-right
2. **Interact:** Click pumps/valves to control them
3. **Monitor:** Watch system status panel
4. **Debug:** Use "Show Debug Info" for troubleshooting

## Technical Details

- **Engine Version:** ${ENGINE_VERSION}
- **Exporter Version:** ${EXPORTER_VERSION}
- **Designer Version:** ${this.designer.designMetadata?.version || 'Unknown'}
- **Grid Size:** ${this.designer.gridSize}px
- **Canvas Size:** ${this.designer.canvas.viewBox.baseVal.width} × ${this.designer.canvas.viewBox.baseVal.height}

## Support

For issues or questions:
1. Check \`SETUP.txt\` for detailed setup instructions
2. Review browser console for error messages
3. Verify folder structure matches requirements above

---

Built with Process Simulator Designer  
https://github.com/yourusername/process-sim-designer
`;
  }

  /**
   * Generate setup instructions (NEW)
   */
  generateSetupInstructions(cleanName) {
    const enginePath = window.EXPORTER_ENGINE_PATH || '../../js';
    const engineFolder = enginePath.split('/').pop(); // Get 'js' or 'engine'
    
    return `╔════════════════════════════════════════════════════════════════╗
║                   SETUP INSTRUCTIONS                           ║
║            Process Simulator - ${cleanName}                      ║
╚════════════════════════════════════════════════════════════════╝

⚠️ CRITICAL: Follow this folder structure EXACTLY

📁 Required Folder Structure:
──────────────────────────────────────────────────────────────────
project-root/
├── sims/
│   └── ${cleanName}/              ← PUT EXPORTED FILES HERE
│       ├── index.html             ← Open this to run simulator
│       ├── systemConfig.js
│       ├── README.md
│       └── SETUP.txt (this file)
│
├── ${engineFolder}/                        ← MUST EXIST (${enginePath})
│   ├── core/
│   │   ├── Component.js
│   │   ├── FlowNetwork.js
│   │   └── ComponentManager.js
│   ├── components/
│   │   ├── pumps/
│   │   ├── valves/
│   │   ├── tanks/
│   │   ├── pipes/
│   │   ├── sources/
│   │   └── sinks/
│   ├── managers/
│   │   ├── PumpManager.js
│   │   ├── ValveManager.js
│   │   ├── TankManager.js
│   │   ├── PipeManager.js
│   │   └── PressureManager.js
│   └── style.css
│
└── valve.html                     ← MUST EXIST (../../valve.html)

──────────────────────────────────────────────────────────────────

🔧 Setup Steps:

1. CREATE FOLDERS
   Open terminal/command prompt in project root:
   
   mkdir -p sims/${cleanName}
   
2. PLACE FILES
   - Move all exported files into sims/${cleanName}/
   
3. VERIFY DEPENDENCIES
   Check that these exist:
   ✓ engine/core/Component.js
   ✓ engine/managers/PumpManager.js
   ✓ valve.html
   
4. OPEN SIMULATOR
   - Double-click: sims/${cleanName}/index.html
   - Or right-click → Open with → [Your Browser]
   
5. CHECK CONSOLE
   Press F12 to open browser console
   Should see: "✅ System initialized successfully"

──────────────────────────────────────────────────────────────────

🚨 Troubleshooting:

❌ "SYSTEM_CONFIG not loaded"
   → Check that systemConfig.js is in the same folder as index.html

❌ "ComponentManager not loaded"  
   → Verify engine/ folder is at ../../engine/ from index.html
   → Check that all engine files exist

❌ "Valve modal is blank"
   → Ensure valve.html is at ../../valve.html from index.html

❌ Components don't appear
   → Open browser console (F12) for error messages
   → Verify image URLs are accessible (requires internet)

❌ Nothing happens when clicking components
   → Clear browser cache
   → Reload page (Ctrl+R or Cmd+R)
   → Check console for JavaScript errors

──────────────────────────────────────────────────────────────────

📝 Quick Test:

1. Open index.html in browser
2. Check console (F12) - should show no errors
3. Click "Controls" button - drawer should open
4. Click a valve - modal should appear with wheel
5. Click a pump - modal should appear with controls

If all 5 work → Setup successful! ✅

──────────────────────────────────────────────────────────────────

💡 Tips:

• Use Chrome, Firefox, or Edge (not IE)
• Enable JavaScript in browser settings
• Don't rename folders or files
• Keep folder structure intact
• No server needed - runs in browser

──────────────────────────────────────────────────────────────────

Generated: ${new Date(this.exportTimestamp).toLocaleString()}
Exporter Version: ${EXPORTER_VERSION}

For detailed info, see README.md
`;
  }

  /**
   * Show success message (NEW)
   */
  _showSuccessMessage(simName, cleanName, validation) {
    const msg = `✅ Export Complete!

Simulator: ${simName}
Files: 4 (index.html, systemConfig.js, README.md, SETUP.txt)

📁 Next Steps:

1. Create folder: sims/${cleanName}/
2. Move all 4 files there
3. Verify engine/ folder exists at ../../engine/
4. Open sims/${cleanName}/index.html

${validation.warnings.length > 0 ? `
⚠️ Warnings:
${validation.warnings.slice(0, 3).join('\n')}
${validation.warnings.length > 3 ? `... and ${validation.warnings.length - 3} more` : ''}

Check SETUP.txt for details.
` : ''}

See SETUP.txt for complete instructions!`;

    alert(msg);
  }

  /**
   * Build component config
   */
  _buildComponentConfig(comp, cleanId) {
    const config = {
      id: cleanId,
      name: comp.name,
      type: comp.type,
      ...comp.config
    };
    
    if (['valve', 'pump', 'tank'].includes(comp.type)) {
      config.svgElement = `#${cleanId}`;
    }
    
    config.position = [Math.round(comp.x), Math.round(comp.y)];
    
    if (config.inputs) {
      config.inputs = config.inputs.map(id => this._cleanId(id));
    }
    if (config.outputs) {
      config.outputs = config.outputs.map(id => this._cleanId(id));
    }
    
    if (comp.type === 'valve') {
      config.iframeUrl = '../../valve.html';
      config.modalTitle = `${comp.name} Control`;
    }
    
    if (comp.type === 'pump') {
      config.modalTitle = `${comp.name} Control`;
    }
    
    return config;
  }

  /**
   * Generate component SVG
   */
  _generateComponentSVG(comp) {
    const cleanId = this._cleanId(comp.id);
    const template = COMPONENT_LIBRARY[comp.key];
    
    if (comp.type === 'tank') {
      return `
        <!-- TANK: ${comp.name} -->
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)" class="levelRect"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="14">${comp.name}</text>
        </g>`;
    } else if (comp.type === 'valve') {
      return `
        <!-- VALVE: ${comp.name} -->
        <g id="${cleanId}" class="valve" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button" aria-pressed="false" aria-label="${comp.name}">
          <image href="https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png" x="-38" y="-38" width="76" height="76" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    } else if (comp.type === 'pump') {
      return `
        <!-- PUMP: ${comp.name} -->
        <g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button" aria-pressed="false" aria-label="${comp.name}">
          <image href="https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png" x="-60" y="-60" width="120" height="120" />
          <text x="0" y="-70" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    } else {
      return `
        <!-- ${comp.type.toUpperCase()}: ${comp.name} -->
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="20" fill="${template.color}20" stroke="${template.color}" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon}</text>
          <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
  }

  /**
   * Generate pipe SVG
   */
  _generatePipeSVG(conn, idx) {
    const fromComp = this.designer.components.get(conn.from);
    const toComp = this.designer.components.get(conn.to);
    
    const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
    
    return `
        <!-- PIPE: ${fromComp.name} to ${toComp.name} -->
        <g id="pipe${idx + 1}" class="pipe">
          <path class="pipe-body" d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20"></path>
          <path id="pipe${idx + 1}Flow" class="pipe-flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8"></path>
        </g>`;
  }

  /**
   * Calculate distance
   */
  _calculateDistance(comp1, comp2) {
    const dx = comp2.x - comp1.x;
    const dy = comp2.y - comp1.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / 100) / 10;
  }

  /**
   * Clean ID
   */
  _cleanId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Group components by type
   */
  _groupComponentsByType(components) {
    const groups = {};
    
    components.forEach(comp => {
      if (!groups[comp.type]) {
        groups[comp.type] = [];
      }
      groups[comp.type].push(comp);
    });
    
    return Object.entries(groups).map(([type, items]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1) + 's',
      items
    }));
  }

  /**
   * Download files
   */
  downloadFiles(files, simName) {
    for (const [filename, content] of Object.entries(files)) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      // Small delay between downloads
      setTimeout(() => {}, 100);
    }
  }
}

// Export
window.SimulatorExporter = SimulatorExporter;
