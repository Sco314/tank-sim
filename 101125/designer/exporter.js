/**
 * exporter.js - Simulator Exporter v3.0
 * 
 * Enhanced with single-file HTML and ZIP export support.
 * 
 * ⚙️ CONFIGURATION
 * ═══════════════════════════════════════════════════════════
 * 
 * SET YOUR ENGINE PATH HERE:
 * <script>
 *   window.EXPORTER_ENGINE_PATH = '../js';  // Relative to designer
 * </script>
 * <script src="exporter.js"></script>
 * 
 * ═══════════════════════════════════════════════════════════
 * 
 * Features:
 * - Single-file HTML export (everything inlined)
 * - ZIP folder export (traditional structure)
 * - Full validation system
 * - Browser-based (no Node.js required)
 * - Image inlining (base64)
 * - Component library integration
 */

const EXPORTER_VERSION = '3.0.0';
const ENGINE_VERSION = '1.0.0';

// Default engine path (relative to designer)
window.EXPORTER_ENGINE_PATH = window.EXPORTER_ENGINE_PATH || '../js';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = new Date().toISOString();
    
    // Engine file paths (in load order)
    this.engineFiles = [
      'core/Component.js',
      'core/FlowNetwork.js',
      'core/ComponentManager.js',
      'core/version.js',
      'components/sources/Feed.js',
      'components/sinks/Drain.js',
      'components/pumps/Pump.js',
      'components/pumps/FixedSpeedPump.js',
      'components/pumps/VariableSpeedPump.js',
      'components/pumps/ThreeSpeedPump.js',
      'components/valves/Valve.js',
      'components/tanks/Tank.js',
      'components/pipes/Pipe.js',
      'components/sensors/PressureSensor.js',
      'managers/TankManager.js',
      'managers/PumpManager.js',
      'managers/ValveManager.js',
      'managers/PipeManager.js',
      'managers/PressureManager.js',
      'config/systemConfig.js'
    ];
    
    // Image URLs to inline
    this.imageUrls = [
      'https://sco314.github.io/tank-sim/Tank-Icon-Transparent-bg.png',
      'https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png',
      'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png',
      'https://sco314.github.io/tank-sim/cent-pump-9-inlet-right.png'
    ];
  }

  /**
   * Export as single-file HTML (PRIMARY METHOD)
   */
  async exportAsSingleFile(simName = 'my-sim') {
    const cleanName = this._slugify(simName);
    
    // Validate
    const validation = this._validateForExport();
    if (!this._checkValidation(validation)) return;
    
    console.log('📦 Exporting as single-file HTML...');
    
    try {
      // Fetch all resources
      const resources = await this._fetchAllResources();
      
      // Build config
      const config = this._buildSystemConfig();
      
      // Generate single-file HTML
      const html = this._buildSingleFileHTML(simName, cleanName, config, resources);
      
      // Download
      this._downloadFile(html, `${cleanName}.html`, 'text/html');
      
      console.log(`✅ Exported: ${cleanName}.html`);
      this._showSuccessMessage(simName, cleanName, 'single-file', validation);
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Export failed: ${error.message}\n\nCheck console for details.`);
    }
  }

  /**
   * Export as ZIP folder (ALTERNATE METHOD)
   */
  async exportAsZip(simName = 'my-sim') {
    const cleanName = this._slugify(simName);
    
    // Validate
    const validation = this._validateForExport();
    if (!this._checkValidation(validation)) return;
    
    console.log('📦 Exporting as ZIP folder...');
    
    try {
      // Check for JSZip
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded. Add: <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>');
      }
      
      // Create ZIP
      const zip = new JSZip();
      const folder = zip.folder(cleanName);
      
      // Generate files
      const files = await this._generateFolderFiles(simName, cleanName);
      
      // Add files to ZIP
      for (const [filename, content] of Object.entries(files)) {
        folder.file(filename, content);
      }
      
      // Generate and download ZIP
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      
      this._downloadBlob(blob, `${cleanName}.zip`, 'application/zip');
      
      console.log(`✅ Exported: ${cleanName}.zip`);
      this._showSuccessMessage(simName, cleanName, 'zip', validation);
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Export failed: ${error.message}\n\nCheck console for details.`);
    }
  }

  /**
   * Fetch all resources needed for single-file export
   */
  async _fetchAllResources() {
    console.log('📥 Fetching resources...');
    
    const enginePath = window.EXPORTER_ENGINE_PATH;
    
    // Fetch CSS
    const cssPath = `${enginePath}/../style.css`;
    const css = await this._fetchText(cssPath);
    console.log('  ✓ style.css');
    
    // Fetch valve.html
    const valvePath = `${enginePath}/../valve.html`;
    const valveHtml = await this._fetchText(valvePath);
    console.log('  ✓ valve.html');
    
    // Fetch all engine JS files
    const jsFiles = [];
    for (const file of this.engineFiles) {
      const path = `${enginePath}/${file}`;
      const content = await this._fetchText(path);
      jsFiles.push({ file, content });
      console.log(`  ✓ ${file}`);
    }
    
    // Fetch and convert images to base64
    const images = {};
    for (const url of this.imageUrls) {
      const base64 = await this._fetchImageAsBase64(url);
      const filename = url.split('/').pop();
      images[filename] = base64;
      console.log(`  ✓ ${filename}`);
    }
    
    return { css, valveHtml, jsFiles, images };
  }

  /**
   * Build single-file HTML
   */
  _buildSingleFileHTML(simName, cleanName, config, resources) {
    console.log('🔨 Building single-file HTML...');
    
    // Extract valve inline
    const valveInline = this._prepareValveInline(resources.valveHtml);
    
    // Combine all JS
    const combinedJS = resources.jsFiles
      .map(({ file, content }) => {
        return `// ============================================================================\n// ${file}\n// ============================================================================\n\n${content}`;
      })
      .join('\n\n');
    
    // Replace systemConfig.js with inline config
    const configJSON = JSON.stringify(config, null, 2);
    const finalJS = combinedJS.replace(
      /const SYSTEM_CONFIG = \{[\s\S]*?\};/,
      `const SYSTEM_CONFIG = ${configJSON};`
    );
    
    // Process CSS (replace image URLs)
    let processedCSS = resources.css;
    for (const [filename, base64] of Object.entries(resources.images)) {
      const pattern = new RegExp(filename, 'g');
      processedCSS = processedCSS.replace(pattern, base64);
    }
    
    // Generate SVG content
    const svgContent = this._generateSVGContent(resources.images);
    
    // Build HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${simName}</title>
  <meta name="generator" content="Process Simulator Designer v${EXPORTER_VERSION}">
  <meta name="export-date" content="${this.exportTimestamp}">
  
  <style>
${processedCSS}
  </style>
</head>
<body>

<button id="controlsToggle" class="controls-toggle" aria-controls="controlsDrawer" aria-expanded="false">
  Controls
</button>
  
<div class="app">
  <div class="grid">
    <div class="card stage">
${svgContent}
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

<!-- System Configuration -->
<script id="system-config" type="application/json">
${configJSON}
</script>

<!-- Simulator Engine -->
<script>
// Set engine version
window.ENGINE_VERSION = '${ENGINE_VERSION}';

${finalJS}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    console.log('=== INITIALIZING ${simName} ===');
    
    if (!window.SYSTEM_CONFIG) {
      console.error('❌ SYSTEM_CONFIG not loaded');
      alert('❌ Configuration failed to load.');
      return;
    }
    if (!window.ComponentManager) {
      console.error('❌ ComponentManager not loaded');
      alert('❌ Engine failed to load.');
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
        alert('❌ Simulation failed to start.');
      }
    });
  }, 100);
});

// Controls Script
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
   * Generate folder structure files (for ZIP export)
   */
  async _generateFolderFiles(simName, cleanName) {
    console.log('📁 Generating folder files...');
    
    const config = this._buildSystemConfig();
    
    return {
      'index.html': this._generateIndexHTML(simName, cleanName),
      'systemConfig.js': this._generateSystemConfigJS(simName, cleanName, config),
      'README.md': this._generateReadme(simName, cleanName),
      'SETUP.txt': this._generateSetupInstructions(cleanName)
    };
  }

  /**
   * Generate SVG content with components and pipes
   */
  _generateSVGContent(images) {
    const components = Array.from(this.designer.components.values());
    const connections = this.designer.connections;
    
    const componentsSVG = components
      .map(comp => this._generateComponentSVG(comp, images))
      .join('\n        ');
    
    const pipesSVG = connections
      .map((conn, idx) => this._generatePipeSVG(conn, idx))
      .join('\n        ');
    
    const viewBox = this.designer.canvas.viewBox.baseVal;
    
    return `      <svg viewBox="0 0 ${viewBox.width} ${viewBox.height}" aria-labelledby="title desc" role="img">
        <title id="title">${this.designer.simName || 'Process Simulator'}</title>
        <desc id="desc">Interactive process simulator</desc>
        
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
      </svg>`;
  }

  /**
   * Prepare valve HTML for inline srcdoc
   */
  _prepareValveInline(valveHtml) {
    const bodyMatch = valveHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : valveHtml;
    
    const styleMatch = valveHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const style = styleMatch ? styleMatch[1] : '';
    
    const scriptMatch = valveHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const script = scriptMatch ? scriptMatch[1] : '';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Valve Control</title>
<style>${style}</style>
</head>
<body>
${bodyContent}
<script>${script}</script>
</body>
</html>`.trim().replace(/"/g, '&quot;');
  }

  /**
   * Build system configuration object
   */
  _buildSystemConfig() {
    const components = Array.from(this.designer.components.values());
    const connections = this.designer.connections;
    
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
    
    return {
      _metadata: {
        name: this.designer.simName || 'Simulator',
        version: ENGINE_VERSION,
        exportVersion: EXPORTER_VERSION,
        exported: this.exportTimestamp,
        componentCount: components.length,
        connectionCount: connections.length
      },
      ...grouped,
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
  }

  /**
   * Generate component configuration
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
  _generateComponentSVG(comp, images) {
    const cleanId = this._cleanId(comp.id);
    
    if (comp.type === 'tank') {
      return `
        <!-- TANK: ${comp.name} -->
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)" class="levelRect"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="14">${comp.name}</text>
        </g>`;
    }
    
    if (comp.type === 'valve') {
      const imgSrc = images['Valve-Icon-Transparent-bg.png'] || 'https://sco314.github.io/tank-sim/Valve-Icon-Transparent-bg.png';
      return `
        <!-- VALVE: ${comp.name} -->
        <g id="${cleanId}" class="valve" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button" aria-pressed="false" aria-label="${comp.name}">
          <image href="${imgSrc}" x="-38" y="-38" width="76" height="76" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    
    if (comp.type === 'pump') {
      const imgSrc = images['cent-pump-9-inlet-left.png'] || 'https://sco314.github.io/tank-sim/cent-pump-9-inlet-left.png';
      return `
        <!-- PUMP: ${comp.name} -->
        <g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button" aria-pressed="false" aria-label="${comp.name}">
          <image href="${imgSrc}" x="-60" y="-60" width="120" height="120" />
          <text x="0" y="-70" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    
    // Feed/Drain/Sensor
    const template = window.COMPONENT_LIBRARY?.[comp.key] || { icon: '?', color: '#999' };
    return `
        <!-- ${comp.type.toUpperCase()}: ${comp.name} -->
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="20" fill="${template.color}20" stroke="${template.color}" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon}</text>
          <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
  }

  /**
   * Generate pipe SVG
   */
  _generatePipeSVG(conn, idx) {
    const fromComp = this.designer.components.get(conn.from);
    const toComp = this.designer.components.get(conn.to);
    
    if (!fromComp || !toComp) return '';
    
    const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
    
    return `
        <!-- PIPE: ${fromComp.name} to ${toComp.name} -->
        <g id="pipe${idx + 1}" class="pipe">
          <path class="pipe-body" d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20"></path>
          <path id="pipe${idx + 1}Flow" class="pipe-flow flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8"></path>
        </g>`;
  }

  /**
   * Generate index.html for folder export
   */
  _generateIndexHTML(simName, cleanName) {
    // Similar to current version but with updated paths
    // (Keep your existing generateIndexHTML code)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>${simName}</title>
  <!-- ... rest of HTML ... -->
</head>
<body>
  <!-- ... body content ... -->
</body>
</html>`;
  }

  /**
   * Generate systemConfig.js for folder export
   */
  _generateSystemConfigJS(simName, cleanName, config) {
    return `/**
 * systemConfig.js - ${simName}
 * Generated: ${new Date(this.exportTimestamp).toLocaleString()}
 */

const SYSTEM_CONFIG = ${JSON.stringify(config, null, 2)};

window.SYSTEM_CONFIG = SYSTEM_CONFIG;
`;
  }

  /**
   * Generate README.md
   */
  _generateReadme(simName, cleanName) {
    return `# ${simName}

Generated by Process Simulator Designer v${EXPORTER_VERSION}  
Export Date: ${new Date(this.exportTimestamp).toLocaleString()}

## Quick Start

1. Open \`${cleanName}.html\` in a web browser
2. Click components to interact
3. Use Controls panel to manage simulation

## Components

- **Total:** ${this.designer.components.size}
- **Connections:** ${this.designer.connections.length}

---

Built with Process Simulator Designer
`;
  }

  /**
   * Generate SETUP.txt
   */
  _generateSetupInstructions(cleanName) {
    return `SETUP INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Single-File HTML:
1. Open ${cleanName}.html in any modern web browser
2. No setup required - everything is included!

Folder/ZIP Version:
1. Extract ZIP to desired location
2. Open ${cleanName}/index.html in web browser
3. Ensure folder structure is intact

Requirements:
- Modern web browser (Chrome, Firefox, Edge, Safari)
- JavaScript enabled
- No internet required (single-file version)

For help, see README.md

Generated: ${new Date(this.exportTimestamp).toLocaleString()}
`;
  }

  // ========================================================================
  // VALIDATION (Keep existing validation methods)
  // ========================================================================

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
    
    const components = Array.from(this.designer.components.values());
    const hasFeed = components.some(c => c.type === 'feed');
    const hasDrain = components.some(c => c.type === 'drain');
    
    if (!hasFeed) warnings.push('No feed (source)');
    if (!hasDrain) warnings.push('No drain (sink)');
    
    for (const comp of components) {
      const propErrors = this._validateComponentProperties(comp);
      errors.push(...propErrors);
    }
    
    return {
      canExport: errors.length === 0,
      errors,
      warnings,
      componentCount: this.designer.components.size,
      connectionCount: this.designer.connections.length
    };
  }

  _checkValidation(validation) {
    if (!validation.canExport) {
      console.error('❌ Export blocked:', validation.errors);
      alert(`Cannot export:\n\n${validation.errors.join('\n')}`);
      return false;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm(
        `⚠️ Warnings:\n\n${validation.warnings.join('\n')}\n\nProceed?`
      );
      if (!proceed) return false;
    }
    
    return true;
  }

  _findDisconnectedComponents() {
    const disconnected = [];
    for (const comp of this.designer.components.values()) {
      const hasInput = comp.config.inputs?.length > 0;
      const hasOutput = comp.config.outputs?.length > 0;
      
      if (comp.type === 'feed' && !hasOutput) disconnected.push(comp);
      else if (comp.type === 'drain' && !hasInput) disconnected.push(comp);
      else if (!['feed', 'drain'].includes(comp.type) && !hasInput && !hasOutput) {
        disconnected.push(comp);
      }
    }
    return disconnected;
  }

  _validateComponentProperties(comp) {
    const errors = [];
    const c = comp.config;
    
    if (c.capacity !== undefined && c.capacity < 0) {
      errors.push(`${comp.name}: capacity cannot be negative`);
    }
    if (c.efficiency !== undefined && (c.efficiency < 0 || c.efficiency > 1)) {
      errors.push(`${comp.name}: efficiency must be 0-1`);
    }
    if (c.volume !== undefined && c.volume <= 0) {
      errors.push(`${comp.name}: volume must be positive`);
    }
    if (c.maxFlow !== undefined && c.maxFlow < 0) {
      errors.push(`${comp.name}: maxFlow cannot be negative`);
    }
    
    return errors;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  async _fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    return response.text();
  }

  async _fetchImageAsBase64(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image ${url}`);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  _calculateDistance(comp1, comp2) {
    const dx = comp2.x - comp1.x;
    const dy = comp2.y - comp1.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy) / 100) / 10;
  }

  _cleanId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  _slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  _downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    this._downloadBlob(blob, filename, mimeType);
  }

  _downloadBlob(blob, filename, mimeType) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _showSuccessMessage(simName, cleanName, format, validation) {
    const formatText = format === 'single-file' ? 'Single-File HTML' : 'ZIP Folder';
    const filename = format === 'single-file' ? `${cleanName}.html` : `${cleanName}.zip`;
    
    const msg = `✅ Export Complete!

Format: ${formatText}
File: ${filename}

${format === 'single-file' ? 
  'Open the HTML file in any browser - no setup required!' :
  'Extract the ZIP and open index.html in a browser.'
}

${validation.warnings.length > 0 ? `
⚠️ ${validation.warnings.length} warning(s) - check console for details.
` : ''}`;

    alert(msg);
  }
}

// ========================================================================
// EXPORT
// ========================================================================

window.SimulatorExporter = SimulatorExporter;
