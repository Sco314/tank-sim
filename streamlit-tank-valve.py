"""
Tank & Valve Simulator - Streamlit Version (Fixed for Cloud)
=============================================================
Run with: streamlit run streamlit-tank-valve.py
"""

import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
import time

# Page config
st.set_page_config(
    page_title="Tank & Valve Simulator",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for dark theme
st.markdown("""
<style>
    .stApp {
        background-color: #0b1330;
    }
    h1, h2, h3 {
        color: #e9f0ff;
    }
    .stButton>button {
        background-color: #172144;
        color: #e9f0ff;
        border: 1px solid #28366d;
        border-radius: 12px;
    }
    .stButton>button:hover {
        background-color: #1f2d5a;
        border-color: #3d5278;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'initialized' not in st.session_state:
    st.session_state.tank_volume = 0.0
    st.session_state.inlet_open = False
    st.session_state.valve_position = 0.0
    st.session_state.history = []
    st.session_state.last_update = time.time()
    st.session_state.paused = False
    st.session_state.tank_area = 1.2
    st.session_state.initialized = True

# Tank Class
class Tank:
    def __init__(self, area=1.2, height=1.0):
        self.A = area
        self.H_max = height
    
    def step(self, volume, dt, Q_in, Q_out):
        """Update tank volume based on mass balance"""
        dV = (Q_in - Q_out) * dt
        new_volume = np.clip(volume + dV, 0, self.V_max())
        return new_volume
    
    def level(self, volume):
        """Return level as fraction 0-1"""
        return min(1.0, max(0.0, volume / self.V_max()))
    
    def V_max(self):
        return self.A * self.H_max
    
    def is_overflow(self, volume):
        return volume >= self.V_max() - 1e-6

# Create tank instance
tank = Tank(area=st.session_state.tank_area, height=1.0)

# Main layout
st.title("🌊 Tank & Valve Simulator")

# Simulation update (runs every time page refreshes)
if not st.session_state.paused:
    current_time = time.time()
    dt = min(current_time - st.session_state.last_update, 0.1)
    
    # Get flow rates from session state (will be set by sliders below)
    inlet_flow = st.session_state.get('inlet_flow_value', 0.8)
    outlet_flow = st.session_state.get('outlet_flow_value', 0.35)
    
    Q_in = inlet_flow if st.session_state.inlet_open else 0.0
    Q_out = outlet_flow
    
    # Update tank
    tank.A = st.session_state.tank_area
    st.session_state.tank_volume = tank.step(
        st.session_state.tank_volume, dt, Q_in, Q_out
    )
    st.session_state.last_update = current_time
    
    # Record history (limit to last 100 points)
    st.session_state.history.append({
        'time': datetime.now(),
        'level': tank.level(st.session_state.tank_volume) * 100,
        'Q_in': Q_in,
        'Q_out': Q_out
    })
    
    if len(st.session_state.history) > 100:
        st.session_state.history.pop(0)

# Create columns for layout
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Tank Visualization")
    
    # Tank diagram using Plotly
    level_pct = tank.level(st.session_state.tank_volume) * 100
    
    fig = go.Figure()
    
    # Tank outline
    fig.add_shape(
        type="rect",
        x0=0.2, y0=0, x1=0.8, y1=1,
        line=dict(color="#2a3d78", width=4),
        fillcolor="#0e1734"
    )
    
    # Liquid level
    liquid_height = tank.level(st.session_state.tank_volume)
    if liquid_height > 0:
        fig.add_shape(
            type="rect",
            x0=0.21, y0=0, x1=0.79, y1=liquid_height,
            fillcolor="rgba(124, 200, 255, 0.6)",
            line=dict(width=0)
        )
    
    # Inlet pipe (top)
    fig.add_shape(
        type="rect",
        x0=0.35, y0=0.95, x1=0.45, y1=1.05,
        fillcolor="#9bb0ff",
        line=dict(color="#2a3d78", width=2)
    )
    
    # Valve on inlet
    valve_color = "#3ddc97" if st.session_state.inlet_open else "#ff6b6b"
    fig.add_shape(
        type="circle",
        x0=0.36, y0=0.96, x1=0.44, y1=1.04,
        fillcolor=valve_color,
        line=dict(color="#2a3d78", width=2)
    )
    
    # Outlet pipe (bottom)
    fig.add_shape(
        type="rect",
        x0=0.55, y0=-0.05, x1=0.65, y1=0.05,
        fillcolor="#9bb0ff",
        line=dict(color="#2a3d78", width=2)
    )
    
    # Level percentage text
    fig.add_annotation(
        x=0.5, y=0.5,
        text=f"{level_pct:.1f}%",
        font=dict(size=32, color="#e9f0ff"),
        showarrow=False
    )
    
    # Overflow warning
    if tank.is_overflow(st.session_state.tank_volume):
        fig.add_annotation(
            x=0.5, y=0.95,
            text="⚠️ OVERFLOW",
            font=dict(size=20, color="#ff6b6b"),
            showarrow=False
        )
    
    fig.update_layout(
        width=600,
        height=600,
        showlegend=False,
        xaxis=dict(range=[0, 1], showgrid=False, zeroline=False, visible=False),
        yaxis=dict(range=[-0.1, 1.1], showgrid=False, zeroline=False, visible=False),
        plot_bgcolor="#0b1330",
        paper_bgcolor="#0b1330",
        margin=dict(l=0, r=0, t=0, b=0)
    )
    
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Controls")
    
    # Inlet valve toggle
    inlet_label = "Close Inlet Valve" if st.session_state.inlet_open else "Open Inlet Valve"
    if st.button(inlet_label, key="inlet_toggle"):
        st.session_state.inlet_open = not st.session_state.inlet_open
        st.rerun()
    
    st.markdown(f"**Inlet Status:** {'🟢 OPEN' if st.session_state.inlet_open else '🔴 CLOSED'}")
    
    st.divider()
    
    # Flow controls
    st.markdown("#### Flow Rates")
    
    inlet_flow = st.slider(
        "Inlet Flow (when open)",
        min_value=0.0,
        max_value=1.5,
        value=st.session_state.get('inlet_flow_value', 0.8),
        step=0.01,
        key="inlet_flow"
    )
    st.session_state.inlet_flow_value = inlet_flow
    
    outlet_flow = st.slider(
        "Outlet Flow",
        min_value=0.0,
        max_value=1.2,
        value=st.session_state.get('outlet_flow_value', 0.35),
        step=0.01,
        key="outlet_flow"
    )
    st.session_state.outlet_flow_value = outlet_flow
    
    tank_area = st.slider(
        "Tank Cross-Section Area",
        min_value=0.5,
        max_value=3.0,
        value=st.session_state.tank_area,
        step=0.01,
        key="tank_area_slider"
    )
    st.session_state.tank_area = tank_area
    
    st.divider()
    
    # Simulation controls
    st.markdown("#### Simulation")
    
    col_a, col_b = st.columns(2)
    with col_a:
        pause_label = "▶️ Resume" if st.session_state.paused else "⏸️ Pause"
        if st.button(pause_label):
            st.session_state.paused = not st.session_state.paused
            st.rerun()
    
    with col_b:
        if st.button("🔄 Reset"):
            st.session_state.tank_volume = 0.0
            st.session_state.inlet_open = False
            st.session_state.history = []
            st.rerun()
    
    st.divider()
    
    # Readouts
    st.markdown("#### Readouts")
    st.metric("Level", f"{level_pct:.1f}%")
    st.metric("Volume", f"{st.session_state.tank_volume:.3f} units³")
    
    Q_in = inlet_flow if st.session_state.inlet_open else 0.0
    Q_out = outlet_flow
    
    st.metric("Q_in", f"{Q_in:.2f} units/s")
    st.metric("Q_out", f"{Q_out:.2f} units/s")

# Real-time plotting
st.subheader("📊 Real-Time Data")

if st.session_state.history:
    df = pd.DataFrame(st.session_state.history)
    
    fig_history = go.Figure()
    
    fig_history.add_trace(go.Scatter(
        x=df['time'],
        y=df['level'],
        mode='lines',
        name='Level (%)',
        line=dict(color='#7cc8ff', width=2)
    ))
    
    fig_history.update_layout(
        title="Tank Level Over Time",
        xaxis_title="Time",
        yaxis_title="Level (%)",
        plot_bgcolor="#0e1734",
        paper_bgcolor="#121a33",
        font=dict(color="#e9f0ff"),
        height=300
    )
    
    st.plotly_chart(fig_history, use_container_width=True)

# Auto-refresh for real-time animation
# Only rerun if not paused
if not st.session_state.paused:
    time.sleep(0.05)
    st.rerun()
