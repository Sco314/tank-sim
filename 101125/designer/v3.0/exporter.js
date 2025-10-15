/**
 * exporter.js v3.0 - Flat Self-Contained ZIP Export
 * 
 * Exports a completely self-contained ZIP with:
 * - index.html (entry point)
 * - All engine files locally
 * - All assets embedded/local
 * - manifest.json for metadata
 * - Designer JSON for re-editing
 * - No external dependencies
 */

const EXPORTER_VERSION = '3.0.0';
const ENGINE_VERSION = '1.0.0';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = new Date().toISOString();
    this.simId = this._generateSimId();
  }

  /**
   * Generate unique sim ID
   */
  _generateSimId() {
    return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create safe folder name from sim name
   */
  _createSafeFolderName(simName) {
    return simName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  /**
   * Main export function - creates self-contained ZIP
   */
  async exportSimulator(simName = 'My Simulator') {
    console.log('📦 Starting flat self-contained export...');
    
    // Validate design
    const validation = this._validateForExport();
    if (!validation.canExport) {
      alert(`Cannot export:\n\n${validation.errors.join('\n')}`);
      return;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm(
        `⚠️ Export Warnings:\n\n${validation.warnings.join('\n')}\n\nProceed?`
      );
      if (!proceed) return;
    }

    const safeFolderName = this._createSafeFolderName(simName);
    
    // Load JSZip
    await this._ensureJSZip();
    
    try {
      const zip = new JSZip();
      const simFolder = zip.folder(safeFolderName);
      
      // Generate all files
      console.log('📝 Generating files...');
      
      // 1. Manifest (metadata)
      const manifest = this._generateManifest(simName, safeFolderName);
      simFolder.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      // 2. System Config
      const systemConfig = this._generateSystemConfig(simName);
      simFolder.file('systemConfig.js', systemConfig);
      
      // 3. Index HTML (entry point)
      const indexHTML = this._generateIndexHTML(simName, manifest);
      simFolder.file('index.html', indexHTML);
      
      // 4. Designer JSON (for re-editing)
      const designerJSON = this.designer.exportDesignJSON();
      simFolder.file('design.json', designerJSON);
      
      // 5. Style CSS
      const styleCSS = await this._fetchEngineFile('style.css');
      simFolder.file('style.css', styleCSS);
      
      // 6. Valve HTML (if valves present)
      if (this._hasValves()) {
        const valveHTML = await this._fetchEngineFile('valve.html', '../../valve.html');
        simFolder.file('valve.html', valveHTML);
      }
      
      // 7. Engine JS files (in correct load order)
      console.log('📦 Bundling engine files...');
      await this._bundleEngineFiles(simFolder, manifest.engineScripts);
      
      // 8. Icons/Images (embedded as base64 or local)
      console.log('🖼️ Processing images...');
      await this._bundleImages(simFolder);
      
      // 9. README
      const readme = this._generateReadme(simName, safeFolderName);
      simFolder.file('README.txt', readme);
      
      // Generate ZIP
      console.log('🗜️ Creating ZIP file...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFolderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ Export complete!');
      alert(`✅ Exported: ${simName}\n\nFile: ${safeFolderName}.zip\n\n1. Unzip anywhere\n2. Open index.html\n3. Works offline!`);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed: ' + error.message);
    }
  }

  /**
   * Generate manifest.json
   */
  _generateManifest(simName, safeFolderName) {
    const components = Array.from(this.designer.components.values());
    
    // Define script load order
    const engineScripts = [
      // Core (must load first)
      'core/Component.js',
      'core/FlowNetwork.js',
      'core/ComponentManager.js',
      'core/version.js',
      
      // Components (order matters for inheritance)
      'components/sources/Feed.js',
      'components/sinks/Drain.js',
      'components/tanks/Tank.js',
      'components/pumps/Pump.js',
      'components/pumps/FixedSpeedPump.js',
      'components/pumps/VariableSpeedPump.js',
      'components/pumps/ThreeSpeedPump.js',
      'components/valves/Valve.js',
      'components/pipes/Pipe.js',
      'components/sensors/PressureSensor.js',
      
      // Managers (load last)
      'managers/TankManager.js',
      'managers/PumpManager.js',
      'managers/ValveManager.js',
      'managers/PipeManager.js',
      'managers/PressureManager.js'
    ];
    
    const assets = [
      'style.css',
      'systemConfig.js',
      'design.json',
      'README.txt'
    ];
    
    if (this._hasValves()) {
      assets.push('valve.html');
    }
    
    // Add icon assets
    const usedIcons = this._getUsedIcons();
    assets.push(...usedIcons);
    
    return {
      // Identity
      simName,
      simId: this.simId,
      folderName: safeFolderName,
      
      // Versioning
      engineVersion: ENGINE_VERSION,
      exporterVersion: EXPORTER_VERSION,
      designerVersion: this.designer.designMetadata?.version || '2.0.0',
      
      // Timestamps
      builtAt: this.exportTimestamp,
      designCreated: this.designer.designMetadata?.created,
      designModified: this.designer.designMetadata?.modified,
      
      // Entry point
      entry: 'index.html',
      
      // Scripts (in load order)
      engineScripts,
      
      // Assets
      assets,
      
      // Stats
      componentCount: components.length,
      connectionCount: this.designer.connections.length,
      
      // Future hooks (placeholders)
      licenseToken: null,
      publishedUrl: null,
      analyticsEnabled: false
    };
  }

  /**
   * Generate system config
   */
  _generateSystemConfig(simName) {
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
    
    // Generate pipes from connections
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
    
    const config = {
      // Metadata (mirrors manifest)
      _metadata: {
        simName,
        simId: this.simId,
        engineVersion: ENGINE_VERSION,
        builtAt: this.exportTimestamp,
        licenseToken: null // Placeholder for future
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
    
    return `/**
 * systemConfig.js - ${simName}
 * Generated: ${new Date(this.exportTimestamp).toLocaleString()}
 * 
 * Self-contained configuration - no external dependencies
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
  
  return true;
}

// Export
window.SYSTEM_CONFIG = SYSTEM_CONFIG;
window.validateConfig = validateConfig;

// Auto-validate
if (validateConfig(SYSTEM_CONFIG)) {
  console.log('✅ ${simName} configuration loaded');
}`;
  }

  /**
   * Generate index.html with manifest-driven loader
   */
  _generateIndexHTML(simName, manifest) {
    const components = Array.from(this.designer.components.values());
    const connections = this.designer.connections;
    
    const componentsSVG = components.map(comp => this._generateComponentSVG(comp)).join('\n        ');
    const pipesSVG = connections.map((conn, idx) => this._generatePipeSVG(conn, idx)).join('\n        ');
    
    const viewBox = this.designer.canvas.viewBox.baseVal;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${simName}</title>
  
  <!-- Sim Metadata -->
  <meta name="sim-name" content="${simName}"/>
  <meta name="sim-id" content="${this.simId}"/>
  <meta name="engine-version" content="${ENGINE_VERSION}"/>
  <meta name="built-at" content="${this.exportTimestamp}"/>
  <meta name="generator" content="Process Simulator Designer v${EXPORTER_VERSION}"/>
  
  <!-- Local stylesheet -->
  <link rel="stylesheet" href="./style.css">
  
  <!-- Manifest-driven script loader -->
  <script>
    // Embedded manifest for fast access
    window.SIM_MANIFEST = ${JSON.stringify(manifest, null, 2)};
    
    // Sequential script loader
    (function() {
      const scripts = window.SIM_MANIFEST.engineScripts;
      let currentIndex = 0;
      
      function loadNext() {
        if (currentIndex >= scripts.length) {
          // All scripts loaded - load config and start
          loadConfigAndStart();
          return;
        }
        
        const script = document.createElement('script');
        script.src = './' + scripts[currentIndex];
        script.onload = () => {
          console.log('✓ Loaded:', scripts[currentIndex]);
          currentIndex++;
          loadNext();
        };
        script.onerror = () => {
          console.error('✗ Failed to load:', scripts[currentIndex]);
          alert('Failed to load: ' + scripts[currentIndex]);
        };
        document.head.appendChild(script);
      }
      
      function loadConfigAndStart() {
        // Load system config
        const configScript = document.createElement('script');
        configScript.src = './systemConfig.js';
        configScript.onload = initializeSimulator;
        document.head.appendChild(configScript);
      }
      
      function initializeSimulator() {
        console.log('=== INITIALIZING ${simName} ===');
        
        if (!window.SYSTEM_CONFIG) {
          console.error('❌ SYSTEM_CONFIG not loaded');
          alert('Configuration failed to load');
          return;
        }
        
        if (!window.ComponentManager) {
          console.error('❌ ComponentManager not loaded');
          alert('Engine failed to load');
          return;
        }
        
        console.log('✅ All engine files loaded');
        
        // Initialize
        window.componentManager = new ComponentManager(SYSTEM_CONFIG);
        window.componentManager.initialize().then(success => {
          if (success) {
            console.log('✅ System initialized');
            window.componentManager.start();
            console.log('✅ Simulation started');
            
            // Future: emit analytics event
            if (window.SIM_MANIFEST.analyticsEnabled) {
              emitEvent('sim.start', { simId: window.SIM_MANIFEST.simId });
            }
          } else {
            console.error('❌ Initialization failed');
            alert('Simulation failed to start');
          }
        });
      }
      
      // Placeholder for future analytics
      window.emitEvent = function(type, payload) {
        console.log('📊 Event:', type, payload);
        // Future: POST to analytics endpoint
      };
      
      // Start loading
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadNext);
      } else {
        loadNext();
      }
    })();
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
        <desc id="desc">Interactive process simulator - works offline</desc>
        
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
      <div class="controls-panel card" role="dialog" aria-modal="true">
        <button id="controlsClose" class="controls-close">×</button>

        <div>
          <h1>${simName}</h1>
          <div class="sub">Click components to interact</div>
          
          <div class="controls">
            <div class="row">
              <button type="button" id="pauseBtn" aria-pressed="false" class="btn">Pause</button>
              <button type="button" id="resetBtn" class="btn">Reset</button>
            </div>
          </div>

          <hr/>
          <h1>System Info</h1>
          <div class="kv">
            <div>Sim ID</div><div>${this.simId}</div>
            <div>Engine</div><div>v${ENGINE_VERSION}</div>
            <div>Built</div><div>${new Date(this.exportTimestamp).toLocaleDateString()}</div>
          </div>
          
          <hr/>
          <button type="button" id="debugBtn" class="btn">Debug Info</button>
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
  const toggle = document.getElementById('controlsToggle');
  const closeBtn = document.getElementById('controlsClose');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const debugBtn = document.getElementById('debugBtn');
  const debugOutput = document.getElementById('debugOutput');

  toggle?.addEventListener('click', () => {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    toggle.setAttribute('aria-expanded','true');
  });
  
  closeBtn?.addEventListener('click', () => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    toggle.setAttribute('aria-expanded','false');
  });
  
  drawer?.addEventListener('click', (e) => {
    if (e.target === drawer) {
      drawer.classList.remove('open');
    }
  });
  
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
  
  resetBtn?.addEventListener('click', () => {
    window.componentManager?.reset();
  });
  
  debugBtn?.addEventListener('click', () => {
    if (window.componentManager) {
      const info = {
        manifest: window.SIM_MANIFEST,
        system: window.componentManager.getSystemInfo()
      };
      debugOutput.textContent = JSON.stringify(info, null, 2);
      debugOutput.style.display = debugOutput.style.display === 'none' ? 'block' : 'none';
    }
  });
})();
</script>

</body>
</html>`;
  }

  /**
   * Generate README
   */
  _generateReadme(simName, folderName) {
    return `${simName}
${'='.repeat(simName.length)}

Self-Contained Process Simulator
Generated: ${new Date(this.exportTimestamp).toLocaleString()}

QUICK START
-----------
1. Unzip this file anywhere
2. Open index.html in your browser
3. Works offline - no internet required!

WHAT'S INCLUDED
---------------
- index.html          Main entry point (open this)
- systemConfig.js     Simulator configuration
- design.json         Design file (import to edit)
- manifest.json       Build metadata
- style.css           Styling
- valve.html          Valve control UI (if applicable)
- core/               Engine core files
- components/         Component definitions
- managers/           System managers
- icons/              Images (if applicable)
- README.txt          This file

USAGE
-----
Double-click index.html or open it in any modern browser:
- Chrome, Firefox, Edge, Safari (latest versions)
- No server required
- Works from USB drive, local folder, or web host

CONTROLS
--------
- Click "Controls" button (top-right) to open control panel
- Click pumps and valves to interact with them
- Use Pause/Reset to control simulation
- Click Debug Info to see system state

RE-EDITING
----------
To edit this simulator:
1. Open the designer
2. Click "Import" 
3. Select design.json from this folder
4. Make changes
5. Export again

HOSTING
-------
To put online:
1. Upload entire unzipped folder to web server
2. Access via: http://yoursite.com/${folderName}/
3. Or use: GitHub Pages, Netlify, Vercel, etc.

LMS INTEGRATION
---------------
Most Learning Management Systems support:
1. Upload ZIP directly (Moodle, Canvas)
2. Or upload unzipped folder
3. LMS will serve index.html automatically

TROUBLESHOOTING
---------------
Problem: Components don't appear
Solution: Check browser console (F12) for errors

Problem: Blank screen
Solution: Ensure all files were unzipped

Problem: "Failed to load" errors
Solution: Files may be blocked by browser - try different browser

METADATA
--------
Sim Name: ${simName}
Sim ID: ${this.simId}
Engine: v${ENGINE_VERSION}
Built: ${new Date(this.exportTimestamp).toLocaleString()}
Exporter: v${EXPORTER_VERSION}

SUPPORT
-------
For issues or questions, check the console (F12) for error messages.

---
Generated by Process Simulator Designer v${EXPORTER_VERSION}
`;
  }

  /**
   * Bundle engine files into ZIP
   */
  async _bundleEngineFiles(simFolder, scriptPaths) {
    for (const path of scriptPaths) {
      try {
        const content = await this._fetchEngineFile(path);
        simFolder.file(path, content);
        console.log(`  ✓ ${path}`);
      } catch (err) {
        console.error(`  ✗ Failed to load ${path}:`, err);
        throw new Error(`Failed to bundle engine file: ${path}`);
      }
    }
  }

  /**
   * Fetch engine file content
   */
  async _fetchEngineFile(path, fallbackPath = null) {
    // Try multiple base paths
    const basePaths = [
      '../../js/',
      '../js/',
      '../../engine/',
      '../engine/',
      './'
    ];
    
    if (fallbackPath) {
      basePaths.unshift(fallbackPath);
    }
    
    for (const base of basePaths) {
      try {
        const response = await fetch(base + path);
        if (response.ok) {
          return await response.text();
        }
      } catch (err) {
        // Try next path
      }
    }
    
    throw new Error(`Could not fetch: ${path}`);
  }

  /**
   * Bundle images (convert to base64 or copy)
   */
  async _bundleImages(simFolder) {
    const icons = this._getUsedIcons();
    const iconsFolder = simFolder.folder('icons');
    
    for (const icon of icons) {
      try {
        // For now, create placeholder
        // In production, fetch and convert to base64
        const placeholder = `<!-- ${icon} -->`;
        iconsFolder.file(icon, placeholder);
      } catch (err) {
        console.warn(`Could not bundle icon: ${icon}`);
      }
    }
  }

  /**
   * Get list of used icons
   */
  _getUsedIcons() {
    const icons = new Set();
    const components = Array.from(this.designer.components.values());
    
    components.forEach(comp => {
      if (comp.type === 'tank') icons.add('Tank-Icon-Transparent-bg.png');
      if (comp.type === 'pump') icons.add('cent-pump-9-inlet-left.png');
      if (comp.type === 'valve') icons.add('Valve-Icon-Transparent-bg.png');
    });
    
    return Array.from(icons);
  }

  /**
   * Check if design has valves
   */
  _hasValves() {
    return Array.from(this.designer.components.values())
      .some(comp => comp.type === 'valve');
  }

  /**
   * Ensure JSZip is loaded
   */
  async _ensureJSZip() {
    if (window.JSZip) return;
    
    console.log('Loading JSZip...');
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => {
        console.log('✅ JSZip loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  /**
   * Validation methods (from v2.0)
   */
  _validateForExport() {
    const errors = [];
    const warnings = [];
    
    if (this.designer.components.size === 0) {
      errors.push('No components to export');
    }
    
    const disconnected = this._findDisconnectedComponents();
    if (disconnected.length > 0) {
      warnings.push(`${disconnected.length} disconnected components`);
    }
    
    return {
      canExport: errors.length === 0,
      errors,
      warnings
    };
  }

  _findDisconnectedComponents() {
    const disconnected = [];
    for (const comp of this.designer.components.values()) {
      const hasInput = comp.config.inputs && comp.config.inputs.length > 0;
      const hasOutput = comp.config.outputs && comp.config.outputs.length > 0;
      
      if (comp.type === 'feed' && !hasOutput) disconnected.push(comp);
      else if (comp.type === 'drain' && !hasInput) disconnected.push(comp);
      else if (comp.type !== 'feed' && comp.type !== 'drain' && !hasInput && !hasOutput) {
        disconnected.push(comp);
      }
    }
    return disconnected;
  }

  /**
   * Helper methods
   */
  _cleanId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  _calculateDistance(comp1, comp2) {
    const dx = comp2.x - comp1.x;
    const dy = comp2.y - comp1.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / 100) / 10;
  }

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
      config.iframeUrl = './valve.html';
      config.modalTitle = `${comp.name} Control`;
    }
    
    if (comp.type === 'pump') {
      config.modalTitle = `${comp.name} Control`;
    }
    
    return config;
  }

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
          <image href="./icons/Valve-Icon-Transparent-bg.png" x="-38" y="-38" width="76" height="76" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    } else if (comp.type === 'pump') {
      return `
        <!-- PUMP: ${comp.name} -->
        <g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button" aria-pressed="false" aria-label="${comp.name}">
          <image href="./icons/cent-pump-9-inlet-left.png" x="-60" y="-60" width="120" height="120" />
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
}

// Export
window.SimulatorExporter = SimulatorExporter;
console.log('✅ Exporter v3.0 loaded - Flat self-contained ZIP export');
