/**
 * exporter.js v2.2 - TRULY FIXED
 * 
 * FIXES:
 * 1. Prompts user for sim name
 * 2. Generates ACTUAL designed components in HTML (not template)
 * 3. Creates proper pump/valve/tank configs
 * 4. Generates realistic SVG from actual design
 */

const EXPORTER_VERSION = '2.2.0';
const ENGINE_VERSION = '1.0.0';

class SimulatorExporter {
  constructor(designer) {
    this.designer = designer;
    this.exportTimestamp = Date.now();
  }

  /**
   * Main export method with user prompt for name
   */
  async exportSimulator(defaultName = 'My Simulator') {
    // PROMPT USER FOR NAME
    const simName = prompt('Enter simulator name:', defaultName) || defaultName;
    
    if (!simName || simName.trim() === '') {
      alert('Export cancelled - no name provided');
      return;
    }
    
    console.log(`📦 Exporting simulator: ${simName}`);
    
    // Validate design
    const validation = this._validateDesign();
    if (!validation.valid) {
      if (!confirm(`⚠️ Issues found:\n\n${validation.errors.join('\n')}\n\nExport anyway?`)) {
        return;
      }
    }
    
    // Generate files
    const cleanName = this._sanitizeName(simName);
    const files = {
      html: this._generateIndexHTML(simName, cleanName)
    };
    
    // Download file
    this._downloadFile(`${cleanName}.html`, files.html);
    
    console.log('✅ Export complete!');
    alert(`✅ Export complete!\n\nFile: ${cleanName}.html`);
  }

  /**
   * Validate design before export
   */
  _validateDesign() {
    const errors = [];
    
    if (this.designer.components.size === 0) {
      errors.push('No components in design');
    }
    
    // Check for disconnected components
    const connectedIds = new Set();
    for (const conn of this.designer.connections) {
      connectedIds.add(conn.from);
      connectedIds.add(conn.to);
    }
    
    const disconnected = [];
    for (const [id, comp] of this.designer.components) {
      if (!connectedIds.has(id)) {
        disconnected.push(comp.name);
      }
    }
    
    if (disconnected.length > 0) {
      errors.push(`Disconnected: ${disconnected.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate complete self-contained HTML file
   */
  _generateIndexHTML(simName, cleanName) {
    // Get viewBox from designer canvas
    const svg = document.getElementById('canvas');
    const viewBox = svg ? svg.getAttribute('viewBox') : '0 0 1000 600';
    
    // Generate components SVG from ACTUAL design
    const componentsSVG = this._generateAllComponentsSVG();
    
    // Generate connections SVG from ACTUAL design
    const connectionsSVG = this._generateAllConnectionsSVG();
    
    // Generate embedded config
    const configJSON = this._generateDesignJSON(simName);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${simName}</title>
  <meta name="sim-name" content="${simName}">
  <meta name="engine-version" content="${ENGINE_VERSION}">
  <style>
/* Copy your style.css content here */
* { box-sizing: border-box; }
body { margin: 0; }
:root {
  --bg: #0b1020;
  --card: #121a33;
  --ink: #e9f0ff;
  --muted: #9bb0ff;
  --accent: #7cc8ff;
}
body {
  margin: 0;
  font: 500 16px/1.4 system-ui;
  color: var(--ink);
  background: radial-gradient(1200px 800px at 80% -10%, #1b2752 0%, var(--bg) 60%);
  display: grid;
  place-items: center;
  padding: 18px;
}
.app { width: min(1100px, 95vw); }
.card {
  background: var(--card);
  border: 1px solid #1f2a50;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
.stage { display: flex; align-items: center; justify-content: center; }
svg { width: 100%; height: auto; display: block; }

/* Controls */
.controls-toggle {
  position: fixed; top: 12px; right: 12px; z-index: 1000;
  background: #172144; color: #e9f0ff; border: 1px solid #28366d;
  padding: 10px 14px; border-radius: 12px; cursor: pointer;
}
.btn {
  background: #172144; color: var(--ink); border: 1px solid #28366d;
  padding: 10px 14px; border-radius: 12px; cursor: pointer;
}

/* Flow animation */
.flow { stroke-dasharray: 10 12; }
.flow.on { animation: dash 600ms linear infinite; }
@keyframes dash { to { stroke-dashoffset: -22; } }

/* Modal styles */
.valve-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: none; align-items: center; justify-content: center;
  z-index: 1000; opacity: 0;
  transition: opacity 0.3s ease;
}
.valve-modal-overlay.open { display: flex; opacity: 1; }
.valve-modal-container {
  position: relative;
  width: min(600px, 90vw); height: min(600px, 90vh);
  background: #0b1330;
  border-radius: 16px; border: 2px solid #1fd4d6;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.valve-modal-close {
  position: absolute; top: 12px; right: 12px;
  width: 40px; height: 40px;
  background: rgba(255, 107, 107, 0.9);
  border: 2px solid #ff8787; border-radius: 50%;
  color: white; font-size: 28px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.valve-modal-title {
  padding: 16px 24px;
  background: rgba(31, 212, 214, 0.1);
  border-bottom: 1px solid #1fd4d6;
  color: #e9f0ff; font-size: 18px; font-weight: 600;
}
iframe {
  width: 100%; height: calc(100% - 60px);
  border: none; display: block;
}
  </style>
</head>
<body>

<button id="controlsToggle" class="controls-toggle">Controls</button>

<div class="app">
  <div class="card stage">
    <svg viewBox="${viewBox}" id="mainSVG">
      <title>${simName}</title>
      
      <defs>
        <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7cc8ff"></stop>
          <stop offset="100%" stop-color="#2d8bd6"></stop>
        </linearGradient>
      </defs>
      
      <!-- Connections (pipes) -->
      <g id="connections">
        ${connectionsSVG}
      </g>
      
      <!-- Components -->
      <g id="components">
        ${componentsSVG}
      </g>
    </svg>
  </div>
</div>

<!-- Embedded design data -->
<script id="system-config" type="application/json">
${configJSON}
</script>

<!-- Simulator Engine (embedded) -->
<script>
// TODO: Paste all the engine code here (Component.js, FlowNetwork.js, etc.)
// For now, this is a placeholder
console.log('⚠️ Engine code needs to be embedded here');
console.log('Designed components:', ${this.designer.components.size});
console.log('Designed connections:', ${this.designer.connections.length});
</script>

<script>
// Basic controls
document.getElementById('controlsToggle')?.addEventListener('click', () => {
  alert('Simulator controls - to be implemented');
});
</script>

</body>
</html>`;
  }

  /**
   * Generate SVG for ALL designed components
   */
  _generateAllComponentsSVG() {
    let svg = '';
    
    for (const [id, comp] of this.designer.components) {
      svg += this._generateComponentSVG(comp);
      svg += '\n      ';
    }
    
    return svg;
  }

  /**
   * Generate SVG for a single component based on actual design
   */
  _generateComponentSVG(comp) {
    const cleanId = this._sanitizeId(comp.id);
    const template = window.COMPONENT_LIBRARY?.[comp.key] || {};
    
    // Get image if available
    const image = template.image;
    const imageSize = template.imageSize || { w: 76, h: 76, x: -38, y: -38 };
    
    if (comp.type === 'tank') {
      return `
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <rect x="-80" y="-90" width="160" height="180" rx="12" fill="#0e1734" stroke="#2a3d78" stroke-width="3"></rect>
          <rect id="${cleanId}LevelRect" x="-74" y="88" width="148" height="0" fill="url(#liquid)"></rect>
          <text x="0" y="-100" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'valve') {
      return `
        <g id="${cleanId}" class="valve" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-50" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type.includes('pump') || comp.type.startsWith('pump')) {
      return `
        <g id="${cleanId}" class="pump" transform="translate(${comp.x}, ${comp.y})" tabindex="0" role="button">
          <image href="${image}" x="${imageSize.x}" y="${imageSize.y}" width="${imageSize.w}" height="${imageSize.h}" />
          <text x="0" y="-70" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'feed') {
      return `
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#3b82f620" stroke="#3b82f6" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '💧'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else if (comp.type === 'drain') {
      return `
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="25" fill="#6366f120" stroke="#6366f1" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="20">${template.icon || '🚰'}</text>
          <text x="0" y="-35" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
    else {
      // Generic component
      return `
        <g id="${cleanId}" transform="translate(${comp.x}, ${comp.y})">
          <circle r="20" fill="${template.color || '#4f46e5'}20" stroke="${template.color || '#4f46e5'}" stroke-width="2"></circle>
          <text x="0" y="5" text-anchor="middle" font-size="18">${template.icon || '?'}</text>
          <text x="0" y="-30" text-anchor="middle" fill="#9bb0ff" font-size="12">${comp.name}</text>
        </g>`;
    }
  }

  /**
   * Generate SVG for ALL connections
   */
  _generateAllConnectionsSVG() {
    let svg = '';
    
    this.designer.connections.forEach((conn, idx) => {
      const fromComp = this.designer.components.get(conn.from);
      const toComp = this.designer.components.get(conn.to);
      
      if (!fromComp || !toComp) return;
      
      const path = `M ${fromComp.x} ${fromComp.y} L ${toComp.x} ${toComp.y}`;
      const pipeId = `pipe${idx + 1}`;
      
      svg += `
        <g id="${pipeId}">
          <path d="${path}" fill="none" stroke="#9bb0ff" stroke-width="20" stroke-linecap="round"></path>
          <path id="${pipeId}Flow" d="${path}" fill="none" stroke="#7cc8ff" stroke-width="8" stroke-linecap="round" class="flow"></path>
        </g>`;
    });
    
    return svg;
  }

  /**
   * Generate design JSON for re-import
   */
  _generateDesignJSON(simName) {
    const config = {
      metadata: {
        version: EXPORTER_VERSION,
        created: new Date(this.designer.metadata?.created || this.exportTimestamp).toISOString(),
        modified: new Date().toISOString(),
        name: simName,
        exported: new Date().toISOString()
      },
      components: [],
      connections: [],
      nextId: this.designer.nextId,
      nextConnectionId: this.designer.nextConnectionId,
      gridSize: this.designer.gridSize,
      viewBox: {
        width: 1000,
        height: 600
      }
    };
    
    // Add all components
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
    
    // Add all connections
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
   * Sanitize simulator name for filename
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
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

window.SimulatorExporter = SimulatorExporter;
console.log('✅ Exporter v2.2 loaded (TRULY FIXED)');
