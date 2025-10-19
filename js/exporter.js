/**
 * exporter.js v3.2 - GitHub Exporter with SVG Symbol Support
 * 
 * NEW: Fetches vectorized SVG component files from GitHub
 * Parses SVGs to extract <symbol> definitions with connection points
 * Generates standalone HTML with embedded symbols using <use> references
 * 
 * Base URL: https://sco314.github.io/tank-sim/
 */

const EXPORTER_VERSION = '3.2.0';
const ENGINE_VERSION = '1.0.0';

// Hardcoded GitHub base URLs
const GITHUB_BASE_URL = 'https://sco314.github.io/tank-sim/101125/';
const GITHUB_SVG_URL = 'https://sco314.github.io/tank-sim/';

// All engine files to fetch
const ENGINE_FILES = [
  // Core
  'js/core/Component.js',
  'js/core/FlowNetwork.js',
  'js/core/ComponentManager.js',
  
  // Boundary components
  'js/components/sources/Feed.js',
  'js/components/sinks/Drain.js',
  
  // Tanks
  'js/components/tanks/Tank.js',
  
  // Pumps
  'js/components/pumps/Pump.js',
  'js/components/pumps/FixedSpeedPump.js',
  'js/components/pumps/VariableSpeedPump.js',
  'js/components/pumps/ThreeSpeedPump.js',
  
  // Valves
  'js/components/valves/Valve.js',
  
  // Pipes
  'js/components/pipes/Pipe.js',
  
  // Sensors
  'js/components/sensors/PressureSensor.js',
  
  // Managers
  'js/managers/TankManager.js',
  'js/managers/PumpManager.js',
  'js/managers/ValveManager.js',
  'js/managers/PipeManager.js',
  'js/managers/PressureManager.js'
];

// Valve HTML file
const VALVE_HTML_FILE = 'valve.html';

// SVG Component Files with connection points
const SVG_COMPONENTS = {
  'valve': 'Valve-Icon-handle-right-01.svg',
  'valve-left': 'Valve-Icon-handle-left-01.svg',
  'valve-up': 'Valve-Icon-handle-up-01.svg',
  'pumpFixed': 'cent-pump-inlet-left-01.svg',
  'pumpVariable': 'cent-pump-inlet-left-01.svg',
  'pump3Speed': 'cent-pump-inlet-left-01.svg',
  'pump-right': 'cent-pump-inlet-right-01.svg',
  'tank': 'Tankstoragevessel-01.svg'
};

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = Date.now();
  }

  /**
   * Main export method
   */
  async exportSimulator(defaultName = 'My Simulator') {
    // Step 1: Prompt for name
    const simName = prompt('Enter simulator name:', defaultName) || defaultName;
    
    if (!simName || simName.trim() === '') {
      alert('Export cancelled - no name provided');
      return;
    }
    
    console.log(`📦 Exporting simulator: ${simName}`);
    
    // Step 2: Validate design
    const validation = this._validateDesign();
    if (!validation.valid) {
      if (!confirm(`⚠️ Issues found:\n\n${validation.errors.join('\n')}\n\nExport anyway?`)) {
        return;
      }
    }
    
    // Step 3: Show progress UI
    const progressUI = this._createProgressUI();
    
    try {
      // Step 4: Fetch all engine files from GitHub
      progressUI.update('⏳ Fetching engine files from GitHub...', 0);
      const engineCode = await this._fetchAllEngineFiles(progressUI);
      
      // Step 5: Fetch component SVG files (NEW!)
      progressUI.update('⏳ Fetching component SVG files...', 70);
      const svgFiles = await this._fetchComponentSVGs();
      const symbols = this._parseSVGsToSymbols(svgFiles);
      
      // Step 6: Fetch valve.html
      progressUI.update('⏳ Fetching valve control...', 80);
      const valveHTML = await this._fetchValveHTML();
      
      // Step 7: Generate complete standalone HTML with symbols
      progressUI.update('⏳ Generating HTML...', 90);
      const cleanName = this._sanitizeName(simName);
      const html = this._generateStandaloneHTML(simName, cleanName, engineCode, valveHTML, symbols);
      
      // Step 8: Download
      progressUI.update('⏳ Downloading file...', 95);
      this._downloadFile(`${cleanName}.html`, html);
      
      // Step 9: Success!
      progressUI.update('✅ Export complete!', 100);
      setTimeout(() => progressUI.remove(), 2000);
      
      console.log('✅ Export successful!');
      console.log(`📊 Embedded ${Object.keys(symbols).length} SVG symbols`);
      
    } catch (err) {
      progressUI.remove();
      console.error('❌ Export failed:', err);
      alert(`Export failed: ${err.message}`);
    }
  }

  /**
   * Fetch only the SVG files needed for this design
   */
  async _fetchComponentSVGs() {
    // Determine which unique SVG files are needed
    const neededSVGs = new Set();
    
    for (const [id, comp] of this.designer.components) {
      const svgFile = this._getSVGFileForComponent(comp);
      if (svgFile) {
        neededSVGs.add(svgFile);
      }
    }
    
    if (neededSVGs.size === 0) {
      console.log('ℹ️ No SVG components needed (using fallback rendering)');
      return {};
    }
    
    console.log(`📦 Fetching ${neededSVGs.size} SVG file(s):`, Array.from(neededSVGs));
    
    // Fetch all needed SVGs
    const svgPromises = Array.from(neededSVGs).map(async (filename) => {
      const url = `${GITHUB_SVG_URL}${filename}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const svgText = await response.text();
        console.log(`  ✅ ${filename}`);
        return { filename, svgText };
      } catch (err) {
        console.error(`  ❌ ${filename}:`, err.message);
        return { filename, svgText: null };
      }
    });
    
    const results = await Promise.all(svgPromises);
    
    // Build map of filename -> SVG text
    const svgMap = {};
    results.forEach(({ filename, svgText }) => {
      if (svgText) {
        svgMap[filename] = svgText;
      }
    });
    
    return svgMap;
  }

  /**
   * Get SVG filename for a component
   */
  _getSVGFileForComponent(comp) {
    // Check for orientation variants (future enhancement)
    if (comp.type === 'valve' && comp.orientation) {
      const variantKey = `valve-${comp.orientation}`;
      return SVG_COMPONENTS[variantKey] || SVG_COMPONENTS['valve'];
    }
    
    if ((comp.type === 'pumpFixed' || comp.type === 'pumpVariable' || comp.type === 'pump3Speed') && comp.orientation === 'right') {
      return SVG_COMPONENTS['pump-right'];
    }
    
    return SVG_COMPONENTS[comp.type] || null;
  }

  /**
   * Parse SVG files and extract symbol definitions
   */
  _parseSVGsToSymbols(svgMap) {
    const symbols = {};
    
    for (const [filename, svgText] of Object.entries(svgMap)) {
      try {
        // Parse the SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        
        if (!svgElement) {
          console.warn(`⚠️ No SVG element in ${filename}`);
          continue;
        }
        
        // Extract viewBox
        const viewBox = svgElement.getAttribute('viewBox') || '0 0 100 100';
        
        // Get all content
        const content = Array.from(svgElement.children)
          .map(child => child.outerHTML)
          .join('\n        ');
        
        // Create symbol ID from filename
        const symbolId = this._filenameToSymbolId(filename);
        
        symbols[filename] = {
          id: symbolId,
          viewBox: viewBox,
          content: content,
          connectionPoints: this._extractConnectionPoints(svgText)
        };
        
        console.log(`  ✅ Parsed ${filename} -> #${symbolId} (${symbols[filename].connectionPoints.length} connection points)`);
        
      } catch (err) {
        console.error(`❌ Error parsing ${filename}:`, err);
      }
    }
    
    return symbols;
  }

  /**
   * Extract connection point info from SVG
   */
  _extractConnectionPoints(svgText) {
    const points = [];
    const cpRegex = /<circle[^>]*class="cp"[^>]*>/g;
    let match;
    
    while ((match = cpRegex.exec(svgText)) !== null) {
      const circleTag = match[0];
      
      // Extract attributes
      const idMatch = circleTag.match(/id="([^"]+)"/);
      const portMatch = circleTag.match(/data-port="([^"]+)"/);
      const typeMatch = circleTag.match(/data-type="([^"]+)"/);
      const cxMatch = circleTag.match(/cx="([^"]+)"/);
      const cyMatch = circleTag.match(/cy="([^"]+)"/);
      
      if (portMatch && cxMatch && cyMatch) {
        points.push({
          id: idMatch ? idMatch[1] : `cp_${portMatch[1]}`,
          port: portMatch[1],
          type: typeMatch ? typeMatch[1] : 'both',
          cx: parseFloat(cxMatch[1]),
          cy: parseFloat(cyMatch[1])
        });
      }
    }
    
    return points;
  }

  /**
   * Convert filename to symbol ID
   */
  _filenameToSymbolId(filename) {
    // "Valve-Icon-handle-right-01.svg" -> "sym-valve-icon-handle-right"
    return 'sym-' + filename
      .replace(/\.(svg|SVG)$/, '')
      .replace(/-\d+$/, '') // Remove version numbers
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }

  /**
   * Generate <defs> block with all symbol definitions
   */
  _generateSVGDefs(symbols) {
    if (Object.keys(symbols).length === 0) {
      return `    <defs>
      <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7cc8ff"></stop>
        <stop offset="100%" stop-color="#2d8bd6"></stop>
      </linearGradient>
    </defs>`;
    }

    let defs = '    <defs>\n';
    
    // Add standard gradients
    defs += `      <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7cc8ff"></stop>
        <stop offset="100%" stop-color="#2d8bd6"></stop>
      </linearGradient>\n\n`;
    
    // Add each symbol
    for (const [filename, symbolData] of Object.entries(symbols)) {
      defs += `      <!-- ${filename} -->\n`;
      defs += `      <symbol id="${symbolData.id}" viewBox="${symbolData.viewBox}">\n`;
      defs += `        ${symbolData.content}\n`;
      defs += `      </symbol>\n\n`;
    }
    
    defs += '    </defs>';
    
    return defs;
  }

  /**
   * Fetch all engine files from GitHub
   */
  async _fetchAllEngineFiles(progressUI) {
    const total = ENGINE_FILES.length;
    const fetchedFiles = [];
    
    for (let i = 0; i < total; i++) {
      const file = ENGINE_FILES[i];
      const url = `${GITHUB_BASE_URL}${file}`;
      const progress = Math.floor((i / total) * 60); // 0-60%
      
      progressUI.update(`⏳ Fetching ${file}...`, progress);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${file}`);
        }
        const code = await response.text();
        fetchedFiles.push(`/* ===== ${file} ===== */\n${code}`);
      } catch (err) {
        console.error(`❌ Failed to fetch ${file}:`, err);
        throw new Error(`Failed to fetch ${file}: ${err.message}`);
      }
    }
    
    return fetchedFiles.join('\n\n');
  }

  /**
   * Fetch valve.html
   */
  async _fetchValveHTML() {
    const url = `${GITHUB_BASE_URL}${VALVE_HTML_FILE}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (err) {
      console.error(`❌ Failed to fetch valve.html:`, err);
      throw new Error(`Failed to fetch valve control: ${err.message}`);
    }
  }

  /**
   * Create progress UI
   */
  _createProgressUI() {
    const overlay = document.createElement('div');
    overlay.id = 'exportProgress';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 8px;
      min-width: 300px;
      text-align: center;
    `;
    
    const message = document.createElement('div');
    message.id = 'exportMessage';
    message.style.cssText = 'margin-bottom: 15px; font-size: 14px;';
    message.textContent = 'Preparing export...';
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%;
      height: 20px;
      background: #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.id = 'exportProgressFill';
    progressFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #3b82f6, #2563eb);
      transition: width 0.3s ease;
    `;
    
    progressBar.appendChild(progressFill);
    box.appendChild(message);
    box.appendChild(progressBar);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    return {
      update: (msg, percent) => {
        message.textContent = msg;
        progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      },
      remove: () => {
        overlay.remove();
      }
    };
  }

  /**
   * Generate complete standalone HTML
   */
  _generateStandaloneHTML(simName, cleanName, engineCode, valveHTML, symbols = {}) {
    const configJSON = this._generateDesignJSON(simName);
    const componentsSVG = this._generateAllComponentsSVG(symbols);
    const connectionsSVG = this._generateAllConnectionsSVG();
    const defsBlock = this._generateSVGDefs(symbols);
    const valveInline = this._prepareValveInline(valveHTML);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${simName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0f1e;
      color: #e8edf5;
      overflow: hidden;
    }
    #container {
      display: flex;
      height: 100vh;
      width: 100vw;
    }
    #canvas {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0f1e 0%, #1a2332 100%);
    }
    svg {
      max-width: 100%;
      max-height: 100%;
      filter: drop-shadow(0 10px 30px rgba(0,0,0,0.3));
    }
    .flow {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: flowAnimation 3s linear infinite;
    }
    @keyframes flowAnimation {
      to { stroke-dashoffset: 0; }
    }
    .controls-drawer {
      width: 320px;
      background: #0e1734;
      border-left: 1px solid #22305f;
      padding: 20px;
      overflow-y: auto;
    }
    .card {
      background: #0e1734;
      border: 1px solid #22305f;
      border-radius: 8px;
      padding: 16px;
    }
    h1 { 
      font-size: 18px; 
      color: #9bb0ff; 
      margin-bottom: 8px; 
    }
    .sub { 
      font-size: 12px; 
      color: #6b7ba8; 
      margin-bottom: 16px; 
    }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .kv {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      font-size: 13px;
      color: #9bb0ff;
    }
    hr { 
      border: none; 
      border-top: 1px solid #22305f; 
      margin: 14px 0; 
      opacity: 0.5; 
    }
    .valve, .pump {
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .valve:hover, .pump:hover {
      opacity: 0.8;
    }
  </style>
</head>
<body>

<div id="container">
  <div id="canvas">
    <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
${defsBlock}
      
      <!-- Connections -->
      <g id="connections">
${connectionsSVG}
      </g>
      
      <!-- Components -->
      <g id="components">
${componentsSVG}
      </g>
    </svg>
  </div>

  <!-- Controls Drawer -->
  <aside class="controls-drawer">
    <div class="card">
      <h1>${simName}</h1>
      <div class="sub">Interactive Process Simulator</div>
      <div style="margin-top:16px;">
        <button id="pauseBtn" class="btn">Pause</button>
        <button id="resetBtn" class="btn" style="margin-left:8px;">Reset</button>
      </div>
      <hr>
      <h1>System Status</h1>
      <div class="kv" id="systemStatus">
        <div>Components</div><div id="compCount">${this.designer.components.size}</div>
        <div>Connections</div><div id="connCount">${this.designer.connections.length}</div>
      </div>
    </div>
  </aside>
</div>

<!-- Embedded Design Config -->
<script id="system-config" type="application/json">
${configJSON}
</script>

<!-- Embedded Engine Code -->
<script>
/* ============================================================================
   EMBEDDED SIMULATOR ENGINE
   Version: ${ENGINE_VERSION}
   Exporter: ${EXPORTER_VERSION}
   Exported: ${new Date().toISOString()}
   Source: ${GITHUB_BASE_URL}
   Components: ${this.designer.components.size}
   Connections: ${this.designer.connections.length}
   SVG Symbols: ${Object.keys(symbols).length}
   ============================================================================ */

${engineCode}

/* ============================================================================
   ENGINE INITIALIZATION
   ============================================================================ */

// Parse embedded config
const designData = JSON.parse(document.getElementById('system-config').textContent);
console.log('📋 Loaded design:', designData.metadata.name);
console.log('🔧 Components:', designData.components.length);
console.log('🔗 Connections:', designData.connections.length);

// TODO: Initialize simulation engine with designData
// This is where you'll instantiate your ComponentManager, FlowNetwork, etc.

</script>

</body>
</html>`;
  }

  /**
   * Prepare valve.html for inline embedding
   */
  _prepareValveInline(valveHTML) {
    const styleMatch = valveHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch = valveHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    
    const styles = styleMatch ? styleMatch[1] : '';
    const bodyContent = bodyMatch ? bodyMatch[1] : valveHTML;
    
    return `<style>${styles}</style>\n${bodyContent}`;
  }

  /**
   * Validate design
   */
  _validateDesign() {
    const errors = [];
    
    if (this.designer.components.size === 0) {
      errors.push('No components in design');
    }
    
    const connectedIds = new Set();
    for (const conn of this.designer.connections) {
      connectedIds.add(conn.from);
      connectedIds.add(conn.to);
    }
    
    const disconnected = [];
    for (const [id, comp] of this.designer.components) {
      if (!connectedIds.has(id) && this.designer.connections.length > 0) {
        disconnected.push(comp.name);
      }
    }
    
    if (disconnected.length > 0) {
      errors.push(`Disconnected components: ${disconnected.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate all components SVG
   */
  _generateAllComponentsSVG(symbols = {}) {
    let svg = '';
    
    // Build reverse map: symbolId -> filename for quick lookup
    const symbolMap = {};
    for (const [filename, symbolData] of Object.entries(symbols)) {
      symbolMap[symbolData.id] = { filename, ...symbolData };
    }
    
    for (const [id, comp] of this.designer.components) {
      svg += '        ' + this._generateComponentSVG(comp, symbols) + '\n';
    }
    
    return svg;
  }

  /**
   * Generate single component SVG using <use> references
   */
  _generateComponentSVG(comp, symbols = {}) {
    const cleanId = this._sanitizeId(comp.id);
    const svgFile = this._getSVGFileForComponent(comp);
    
    // If we have a symbol for this component, use it
    if (svgFile && symbols[svgFile]) {
      const symbolData = symbols[svgFile];
      const symbolId = symbolData.id;
      
      // Special handling for tanks (need level indicator)
      if (comp.type === 'tank') {
        return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})" data-instance="${comp.id}">
          <use href="#${symbolId}"></use>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
      }
      
      // For valves and pumps, simple symbol reference
      const labelY = comp.type === 'valve' ? -50 : -70;
      return `<g id="${cleanId}" class="${comp.type}" transform="translate(${comp.x}, ${comp.y})" data-instance="${comp.id}" tabindex="0" role="button">
          <use href="#${symbolId}"></use>
          <text x="0" y="${labelY}" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    
    // Fallback: use PNG-based rendering for components without SVGs
    return this._generateComponentSVG_Legacy(comp);
  }

  /**
   * Legacy PNG-based component generation (fallback)
   */
  _generateComponentSVG_Legacy(comp) {
    const cleanId = this._sanitizeId(comp.id);
    const template = window.COMPONENT_LIBRARY?.[comp.key] || {};
    const image = template.image;
    const imageSize = template.imageSize || { w: 76, h: 76, x: -38, y: -38 };
    
    if (comp.type === 'tank') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'valve') {
      return `<g id="${cleanId}" class="valve" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type.includes('pump') || comp.type.includes('Pump')) {
      return `<g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-70" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'feed') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#3b82f620" stroke="#3b82f6" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '💧'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'drain') {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#6366f120" stroke="#6366f1" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '🚰'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else {
      return `<g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="20" fill="${template.color || '#4f46e5'}20" stroke="${template.color || '#4f46e5'}" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="18">${template.icon || '?'}</text>
          <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
  }

  /**
   * Generate all connections SVG
   */
  _generateAllConnectionsSVG() {
    let svg = '';
    
    this.designer.connections.forEach((conn, idx) => {
      const fromComp = this.designer.components.get(conn.from);
      const toComp = this.designer.components.get(conn.to);
      
      if (!fromComp || !toComp) return;
      
      const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
      const pipeId = `pipe${idx + 1}`;
      
      svg += `        <g id="${pipeId}">
          <path d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20" stroke-linecap="round"></path>
          <path id="${pipeId}Flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8" stroke-linecap="round" class="flow"></path>
        </g>\n`;
    });
    
    return svg;
  }

  /**
   * Generate design JSON
   */
  _generateDesignJSON(simName) {
    const config = {
      metadata: {
        version: EXPORTER_VERSION,
        created: new Date(this.designer.metadata?.created || this.exportTimestamp).toISOString(),
        modified: new Date().toISOString(),
        name: simName,
        exported: new Date().toISOString(),
        source: GITHUB_BASE_URL
      },
      components: [],
      connections: [],
      nextId: this.designer.nextId,
      nextConnectionId: this.designer.nextConnectionId,
      gridSize: this.designer.gridSize,
      viewBox: { width: 1000, height: 600 }
    };
    
    for (const [id, comp] of this.designer.components) {
      config.components.push({
        id: comp.id,
        key: comp.key,
        type: comp.type,
        name: comp.name,
        x: comp.x,
        y: comp.y,
        config: comp.config || {}
      });
    }
    
    for (const conn of this.designer.connections) {
      config.connections.push({
        id: conn.id,
        from: conn.from,
        to: conn.to,
        fromPoint: conn.fromPoint || 'outlet',
        toPoint: conn.toPoint || 'inlet'
      });
    }
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * Sanitize name for filename
   */
  _sanitizeName(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Sanitize ID for JavaScript
   */
  _sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Download file
   */
  _downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export
window.SimulatorExporter = SimulatorExporter;
console.log('✅ Exporter v3.2 loaded (SVG Symbol Support)');
console.log('🌐 Engine URL:', GITHUB_BASE_URL);
console.log('🎨 SVG URL:', GITHUB_SVG_URL);
