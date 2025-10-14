# Quick Reference - Designer v2.0

**Fast lookup for common tasks and shortcuts**

---

## 🎯 Common Workflows

### Create New Design
1. Open `designer/designer.html`
2. Drag components from left panel
3. Click "Connect" tool
4. Click source component, then target
5. Edit properties in right panel
6. Click "Export Sim"

### Save & Reload Design
1. Click "💾 Save Design"
2. Downloads `.json` file
3. Later: Click "📥 Import"
4. Select saved `.json` file
5. Design restored!

### Export Simulator
1. Build your design
2. Click "📤 Export Sim"
3. Review validation report
4. Fix any errors if needed
5. Enter simulator name
6. Click "Export"
7. 4 files download
8. Follow SETUP.txt instructions

---

## 🖱️ Mouse Actions

| Action | What It Does |
|--------|--------------|
| **Drag from library** | Add component to canvas |
| **Click component** | Select and show properties |
| **Drag component** | Move component (when "Select" tool active) |
| **Click connection line** | Delete connection (with confirmation) |
| **Click + Connect tool** | Start/complete connection |
| **Right-click canvas** | *(No special action yet)* |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Click component** | Select component |
| **Delete** | *(Not implemented - use delete button in properties)* |
| **Ctrl+Z** | *(Not implemented yet - planned for future)* |
| **Escape** | Close modal/cancel action |
| **Tab** | Navigate UI elements |
| **Space/Enter** | Activate focused button |

---

## 🔘 Toolbar Buttons

### Tools
- **🖱️ Select** - Click to select, drag to move
- **🔗 Connect** - Click components to connect them

### View Options
- **☑️ Grid** - Show/hide grid
- **☑️ Snap** - Snap components to grid

### Actions
- **👁️ Preview** - See design before export
- **📥 Import** - Load saved design (.json)
- **💾 Save Design** - Save design as .json
- **🗑️ Clear** - Delete all components (confirm first)
- **📤 Export Sim** - Export as working simulator

---

## 📊 Validation Checks

**What gets validated:**

✅ **Component Properties**
- No negative capacities
- Efficiency between 0-1
- Positive volumes
- Valid flow rates

✅ **Network Topology**
- Disconnected components
- Missing feeds/drains
- Circular dependencies

✅ **Export Requirements**
- At least one component
- Property values valid
- Path dependencies noted

---

## 🎨 Component Types

| Type | Icon | Purpose | Can Input | Can Output |
|------|------|---------|-----------|------------|
| **Feed** | 🔵 | Fluid source | ❌ | ✅ |
| **Drain** | ⭕ | Fluid sink | ✅ | ❌ |
| **Tank** | 🏺 | Storage | ✅ | ✅ |
| **Pump** | 🔄 | Move fluid | ✅ | ✅ |
| **Valve** | 🎛️ | Control flow | ✅ | ✅ |
| **Sensor** | 📊 | Measure | ✅ | ✅ |

---

## 🔍 Validation Indicators

| Symbol | Meaning |
|--------|---------|
| **✅** | No issues found |
| **⚠️** | Warning - review recommended |
| **❌** | Error - must fix before export |

**Issue Severity:**
- **Critical (❌)** - Blocks export
- **Warning (⚠️)** - Allows export with confirmation
- **Info (ℹ️)** - Just FYI

---

## 📁 Export Files

Each export creates:

1. **index.html** - Main simulator interface
2. **systemConfig.js** - Configuration + metadata
3. **README.md** - Usage instructions
4. **SETUP.txt** - Detailed setup guide

**Required folder structure:**
```
sims/my-sim/     ← Put exported files here
  ├── index.html
  ├── systemConfig.js
  ├── README.md
  └── SETUP.txt

../../engine/    ← Must exist
../../valve.html ← Must exist
```

---

## 🚨 Common Warnings

### "Disconnected component"
- **Cause:** Component has no connections
- **Fix:** Connect to other components
- **Impact:** Component won't work in sim

### "No feed component"
- **Cause:** Design has no source
- **Fix:** Add a Feed component
- **Impact:** No fluid enters system

### "No drain component"
- **Cause:** Design has no sink
- **Fix:** Add a Drain component
- **Impact:** Fluid has nowhere to go

### "Negative capacity"
- **Cause:** Pump capacity < 0
- **Fix:** Set positive value
- **Impact:** Blocks export

### "Circular dependency detected"
- **Cause:** A→B→C→A connection loop
- **Fix:** Review connections
- **Impact:** May cause infinite loops

---

## 🎓 Pro Tips

### Design Tips
1. **Start with feed + drain** - Ensures fluid has path
2. **Connect as you go** - Easier than all at once
3. **Use meaningful names** - "Pump 1" → "Main Feed Pump"
4. **Group related components** - Keeps design organized
5. **Save frequently** - Avoid losing work

### Validation Tips
1. **Run preview first** - Catch issues early
2. **Fix errors before warnings** - Errors block export
3. **Check disconnected warnings** - Usually mistakes
4. **Review circular dependencies** - Can cause problems
5. **Read full validation report** - Don't skip details

### Export Tips
1. **Choose clear names** - "water-treatment" not "sim1"
2. **Read SETUP.txt first** - Has critical info
3. **Verify folder structure** - Must match exactly
4. **Test immediately** - Open index.html to verify
5. **Keep JSON backup** - Save design for later edits

---

## 🔧 Properties Panel

**Common Properties:**

| Property | Description | Typical Range |
|----------|-------------|---------------|
| **Name** | Component label | Text |
| **Capacity** | Max flow rate (m³/s) | 0.1 - 10.0 |
| **Efficiency** | Energy efficiency | 0.0 - 1.0 |
| **Volume** | Tank capacity (m³) | 0.1 - 100.0 |
| **Max Flow** | Valve max flow (m³/s) | 0.1 - 10.0 |
| **Position** | Valve open % | 0 - 100 |

**Connection Lists:**
- **⬇️ Inputs** - Components feeding this one
- **⬆️ Outputs** - Components this feeds

---

## 🎮 Using Exported Simulators

### Opening
1. Navigate to `sims/your-sim/`
2. Double-click `index.html`
3. Or right-click → Open With → Browser

### Controls
1. **Controls Button** (top-right) - Opens panel
2. **Click Components** - Opens control modal
3. **Pumps** - Start/Stop buttons
4. **Valves** - Spin wheel to adjust
5. **Pause/Reset** - Control simulation

### Troubleshooting
- **F12** - Open browser console
- **Check errors** - Red text in console
- **Verify paths** - engine/ and valve.html exist
- **Clear cache** - Ctrl+F5

---

## 📞 Getting Help

**Before asking for help:**

1. ✅ Check console (F12) for errors
2. ✅ Run test script (see Integration Guide)
3. ✅ Verify file structure matches docs
4. ✅ Try clearing browser cache
5. ✅ Check this reference card

**Include in help request:**
- Console error messages
- Browser and version
- Steps to reproduce
- Test script output
- File structure screenshot

---

## 📚 Related Docs

- **INTEGRATION_GUIDE.md** - Complete setup instructions
- **Implementation Summary** - What's new in v2.0
- **README.md** - Project overview
- **SETUP.txt** - In each export, detailed setup

---

## 🎯 Quick Checklist

**Before exporting:**
- [ ] Design has at least one component
- [ ] All components are connected (or intentionally isolated)
- [ ] Properties are valid (no negatives, etc.)
- [ ] Feed and drain present (unless testing)
- [ ] Saved design backup (.json)

**After exporting:**
- [ ] Created folder: `sims/my-sim/`
- [ ] Moved all 4 files there
- [ ] Verified engine/ exists at `../../engine/`
- [ ] Verified valve.html exists at `../../valve.html`
- [ ] Opened index.html - works!

---

## ⚡ Speed Reference

**Fastest way to:**

| Task | Method |
|------|--------|
| Add component | Drag from library |
| Move component | Drag in Select mode |
| Connect | Connect tool → click → click |
| Rename | Select → type in properties |
| Delete connection | Click line → Confirm |
| Delete component | Select → Delete button (properties) |
| Preview | Click 👁️ Preview |
| Save | Click 💾 Save Design |
| Export | Click 📤 Export Sim |

---

**Version:** 2.0.0  
**Last Updated:** October 14, 2025

Keep this handy while designing! 🚀
