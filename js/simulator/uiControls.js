// Controls Drawer Logic
(function(){
  const drawer   = document.getElementById('controlsDrawer');
  const panel    = drawer.querySelector('.controls-panel');
  const toggle   = document.getElementById('controlsToggle');
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
})();

// Main Modal Control Script
(() => {
  // Elements - Direct valve/pump element references (no hitboxes)
  const inletValve      = document.getElementById('valve');
  const outletValve     = document.getElementById('outletValve');
  const pumpEl          = document.getElementById('pump');
  const outletFlowPath  = document.getElementById('outletFlow');

  // Modals
  const inletModal      = document.getElementById('inletModal');
  const inletClose      = document.getElementById('inletModalClose');
  const inletIframe     = document.getElementById('inletValveIframe');

  const outletModal     = document.getElementById('outletModal');
  const outletClose     = document.getElementById('outletModalClose');
  const outletIframe    = document.getElementById('outletValveIframe');

  const pumpModal       = document.getElementById('pumpModal');
  const pumpClose       = document.getElementById('pumpModalClose');
  const pumpToggle      = document.getElementById('pumpModalToggle');

  // State
  let pumpOn = true;
  let inletValvePos = 0;
  let outletValvePos = 1;

  // Modal Helpers
  function openModal(el){
    el?.classList.add('open');
    el?.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(el){
    el?.classList.remove('open');
    el?.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  // Helper to send valve position to iframe (direct API call + postMessage fallback)
  function sendValvePosition(iframe, value) {
    if (!iframe || !iframe.contentWindow) return;

    // Try direct API call first (if ValveTop is loaded)
    try {
      if (iframe.contentWindow.ValveTop && typeof iframe.contentWindow.ValveTop.set === 'function') {
        iframe.contentWindow.ValveTop.set(value);
        console.log(`Set valve position ${value} via direct API`);
        return;
      }
    } catch(e) {
      // Cross-origin or not loaded yet, fall through
    }

    // Fallback: try postMessage (requires valve.html to have listener)
    try {
      iframe.contentWindow.postMessage({
        type: 'valve:set',
        value: value
      }, '*');
      console.log(`Sent valve position ${value} via postMessage`);
    } catch(e) {
      console.warn('Failed to send valve position:', e);
    }
  }

  // Listen for iframe load events and send initial position
  function setupIframeSync(iframe, getValue) {
    if (!iframe) return;

    // Wait for iframe to fully load, then set initial value
    iframe.addEventListener('load', () => {
      console.log('Iframe loaded');
      // Wait a bit for ValveTop to initialize
      setTimeout(() => {
        const val = getValue();
        console.log('Setting initial valve position:', val);
        sendValvePosition(iframe, val);
      }, 100);
    });
  }

  // Visual Updates
  function updateOutletVisual(){
    const flowing = pumpOn && outletValvePos > 0;
    if (outletFlowPath){
      const dur = 1200 - Math.round(800 * outletValvePos);
      outletFlowPath.style.setProperty('--duration', dur + 'ms');
      outletFlowPath.style.opacity = flowing ? (0.25 + 0.75 * outletValvePos) : 0.15;
    }
  }

  function updatePumpUI(){
    pumpEl?.setAttribute('aria-pressed', String(pumpOn));
    if (pumpToggle){
      pumpToggle.setAttribute('aria-pressed', String(pumpOn));
      pumpToggle.textContent = pumpOn ? 'Stop Pump' : 'Start Pump';
    }
  }

  // Setters
  function setPump(on){
    pumpOn = !!on;
    window.simulation?.setPumpFactor?.(pumpOn ? 1 : 0);
    updatePumpUI();
    updateOutletVisual();
  }

  function setOutletValve(pos, skipIframeUpdate = false){
    outletValvePos = Math.max(0, Math.min(1, pos));
    outletValve?.setAttribute('aria-pressed', String(outletValvePos > 0));
    window.simulation?.setOutletValve?.(outletValvePos);
    if (!skipIframeUpdate) {
      sendValvePosition(outletIframe, outletValvePos);
    }
    updateOutletVisual();
  }

  function setInletValve(pos, skipIframeUpdate = false){
    inletValvePos = Math.max(0, Math.min(1, pos));
    window.simulation?.setInletValve?.(inletValvePos);
    if (!skipIframeUpdate) {
      sendValvePosition(inletIframe, inletValvePos);
    }
  }

  // Inlet Valve Modal
  function openInlet(){
    openModal(inletModal);
    // Send current position immediately when opening
    sendValvePosition(inletIframe, inletValvePos);
    setTimeout(() => inletClose?.focus(), 0);
  }

  inletValve?.addEventListener('click', openInlet);
  inletValve?.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); openInlet(); }
  });
  inletClose?.addEventListener('click', () => closeModal(inletModal));
  inletModal?.addEventListener('click', (e) => { if (e.target === inletModal) closeModal(inletModal); });

  // Setup iframe sync for inlet
  setupIframeSync(inletIframe, () => inletValvePos);
  setupValveCallback(inletIframe, (pos) => setInletValve(pos, true)); // skip iframe update to avoid loop

  // Outlet Valve Modal
  function openOutlet(){
    openModal(outletModal);
    // Send current position immediately when opening
    console.log('Opening outlet valve, position:', outletValvePos);
    sendValvePosition(outletIframe, outletValvePos);
    setTimeout(() => outletClose?.focus(), 0);
  }

  outletValve?.addEventListener('click', openOutlet);
  outletValve?.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); openOutlet(); }
  });
  outletClose?.addEventListener('click', () => closeModal(outletModal));
  outletModal?.addEventListener('click', (e) => { if (e.target === outletModal) closeModal(outletModal); });

  // Setup iframe sync for outlet
  setupIframeSync(outletIframe, () => outletValvePos);
  setupValveCallback(outletIframe, (pos) => setOutletValve(pos, true)); // skip iframe update to avoid loop

  // Listen for valve changes from iframes via ValveTop.onChange callback
  function setupValveCallback(iframe, onChangeFn) {
    if (!iframe) return;

    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          if (iframe.contentWindow.ValveTop && typeof iframe.contentWindow.ValveTop.onChange === 'function') {
            iframe.contentWindow.ValveTop.onChange(onChangeFn);
            console.log('Set up valve onChange callback');
          }
        } catch(e) {
          console.warn('Could not set valve onChange callback:', e);
        }
      }, 150);
    });
  }

  // Also listen for postMessage (fallback if valve.html adds message listener later)
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'valve:changed') return;
    const pos = Math.max(0, Math.min(1, +d.value || 0));

    if (e.source === outletIframe?.contentWindow) {
      setOutletValve(pos, true); // skip iframe update to avoid loop
    } else if (e.source === inletIframe?.contentWindow) {
      setInletValve(pos, true); // skip iframe update to avoid loop
    }
  });

  // Pump Modal
  function openPump(){
    openModal(pumpModal);
    setTimeout(() => pumpClose?.focus(), 0);
  }

  pumpEl?.addEventListener('click', openPump);
  pumpEl?.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); setPump(!pumpOn); }
  });
  pumpClose?.addEventListener('click', () => closeModal(pumpModal));
  pumpModal?.addEventListener('click', (e) => { if (e.target === pumpModal) closeModal(pumpModal); });
  pumpToggle?.addEventListener('click', () => setPump(!pumpOn));

  // Escape key closes any open modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (inletModal?.classList.contains('open')) closeModal(inletModal);
      if (outletModal?.classList.contains('open')) closeModal(outletModal);
      if (pumpModal?.classList.contains('open')) closeModal(pumpModal);
    }
  });

  // Initialize
  setPump(true);
  setOutletValve(1);
  setInletValve(0);
})();
