"""
Tank & Valve Simulator - Streamlit Version
==========================================
Run with: streamlit run tank_valve_sim.py

Features:
- Interactive tank with level visualization
- Clickable valve (opens modal popup)
- Inlet/outlet flow controls
- Real-time plotting
- Auto-hiding indicators (5s timeout)
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

# Custom CSS for dark theme and modal
st.markdown("""
<style>
    .stApp {
        background-color: #0b1330;
    }
    .main-container {
        background-color: #121a33;
        border-radius: 16px;
        padding: 20px;
        border: 1px solid #1f2a50;
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
if 'tank_volume' not in st.session_state:
    st.session_state.tank_volume = 0.0
    st.session_state.inlet_open = False
    st.session_state.valve_position = 0.0  # 0-1
    st.session_state.show_valve_modal = False
    st.session_state.history = []
    st.session_state.last_update = time.time()
    st.session_state.paused = False
    st.session_state.modal_opened_at = None

# Tank & Valve Classes
class Tank:
    def __init__(self, area=1.2, height=1.0):
        self.A = area  # cross-sectional area
        self.H_max = height  # normalized height
        self.V = 0.0  # volume
    
    def step(self, dt, Q_in, Q_out):
        """Update tank volume based on mass balance"""
        dV = (Q_in - Q_out) * dt
        self.V = np.clip(self.V + dV, 0, self.V_max())
        return self.V
    
    def level(self):
        """Return level as fraction 0-1"""
        return min(1.0, max(0.0, self.V / self.V_max()))
    
    def V_max(self):
        return self.A * self.H_max
    
    def is_overflow(self):
        return self.V >= self.V_max() - 1e-6


class Valve:
    def __init__(self, Cv=0.8):
        self.Cv = Cv  # flow coefficient
        self.position = 0.0  # 0 (closed) to 1 (open)
    
    def flow_rate(self):
        """Return flow rate based on valve position"""
        return self.Cv * self.position


# Initialize tank and valve
if 'tank' not in st.session_state:
    st.session_state.tank = Tank(area=1.2, height=1.0)
if 'valve' not in st.session_state:
    st.session_state.valve = Valve(Cv=0.8)

# Main layout
st.title("🌊 Tank & Valve Simulator")

# Create columns for layout
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Tank Visualization")
    
    # Tank diagram using Plotly
    def create_tank_figure():
        tank = st.session_state.tank
        level_pct = tank.level() * 100
        
        fig = go.Figure()
        
        # Tank outline
        fig.add_shape(
            type="rect",
            x0=0.2, y0=0, x1=0.8, y1=1,
            line=dict(color="#2a3d78", width=4),
            fillcolor="#0e1734"
        )
        
        # Liquid level
        liquid_height = tank.level()
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
        
        # Valve on inlet (clickable area annotation)
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
        if tank.is_overflow():
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
        
        return fig
    
    tank_fig = create_tank_figure()
    st.plotly_chart(tank_fig, use_container_width=True)
    
    # Valve modal button
    if st.button("🔧 Open Valve Control", key="valve_btn"):
        st.session_state.show_valve_modal = True
        st.session_state.modal_opened_at = time.time()

with col2:
    st.subheader("Controls")
    
    # Inlet valve toggle
    inlet_label = "Close Inlet Valve" if st.session_state.inlet_open else "Open Inlet Valve"
    if st.button(inlet_label, key="inlet_toggle"):
        st.session_state.inlet_open = not st.session_state.inlet_open
    
    st.markdown(f"**Inlet Status:** {'🟢 OPEN' if st.session_state.inlet_open else '🔴 CLOSED'}")
    
    st.divider()
    
    # Flow controls
    st.markdown("#### Flow Rates")
    
    inlet_flow = st.slider(
        "Inlet Flow (when open)",
        min_value=0.0,
        max_value=1.5,
        value=0.8,
        step=0.01,
        key="inlet_flow"
    )
    
    outlet_flow = st.slider(
        "Outlet Flow",
        min_value=0.0,
        max_value=1.2,
        value=0.35,
        step=0.01,
        key="outlet_flow"
    )
    
    tank_area = st.slider(
        "Tank Cross-Section Area",
        min_value=0.5,
        max_value=3.0,
        value=1.2,
        step=0.01,
        key="tank_area"
    )
    
    st.session_state.tank.A = tank_area
    
    st.divider()
    
    # Simulation controls
    st.markdown("#### Simulation")
    
    col_a, col_b = st.columns(2)
    with col_a:
        if st.button("▶️ Resume" if st.session_state.paused else "⏸️ Pause"):
            st.session_state.paused = not st.session_state.paused
    
    with col_b:
        if st.button("🔄 Reset"):
            st.session_state.tank.V = 0.0
            st.session_state.inlet_open = False
            st.session_state.history = []
    
    st.divider()
    
    # Readouts
    st.markdown("#### Readouts")
    st.metric("Level", f"{st.session_state.tank.level()*100:.1f}%")
    st.metric("Volume", f"{st.session_state.tank.V:.3f} units³")
    
    Q_in = inlet_flow if st.session_state.inlet_open else 0.0
    Q_out = outlet_flow
    
    st.metric("Q_in", f"{Q_in:.2f} units/s")
    st.metric("Q_out", f"{Q_out:.2f} units/s")

# Valve Modal (popup)
if st.session_state.show_valve_modal:
    # Check 5-second timeout
    if st.session_state.modal_opened_at and (time.time() - st.session_state.modal_opened_at) > 5:
        st.session_state.show_valve_modal = False
        st.rerun()
    
    with st.container():
        st.markdown("---")
        
        modal_col1, modal_col2, modal_col3 = st.columns([1, 2, 1])
        
        with modal_col2:
            st.markdown("### 🔧 Valve Control Panel")
            
            # Close button
            if st.button("❌ Close", key="close_modal"):
                st.session_state.show_valve_modal = False
                st.rerun()
            
            # Valve position control with drag (slider)
            valve_pos = st.slider(
                "Valve Position",
                min_value=0,
                max_value=100,
                value=int(st.session_state.valve_position * 100),
                key="valve_slider"
            )
            st.session_state.valve_position = valve_pos / 100.0
            
            st.progress(valve_pos / 100.0)
            st.markdown(f"**Open: {valve_pos}%**")
            
            # Quick action buttons
            btn_col1, btn_col2 = st.columns(2)
            with btn_col1:
                if st.button("🔓 Fully Open"):
                    st.session_state.valve_position = 1.0
                    st.rerun()
            with btn_col2:
                if st.button("🔒 Fully Close"):
                    st.session_state.valve_position = 0.0
                    st.rerun()
            
            st.info("💡 Modal will auto-close in 5 seconds")
        
        st.markdown("---")

# Real-time plotting
st.subheader("📊 Real-Time Data")

# Simulation update
if not st.session_state.paused:
    current_time = time.time()
    dt = current_time - st.session_state.last_update
    dt = min(dt, 0.1)  # clamp to prevent huge jumps
    
    Q_in = inlet_flow if st.session_state.inlet_open else 0.0
    Q_out = outlet_flow
    
    st.session_state.tank.step(dt, Q_in, Q_out)
    st.session_state.last_update = current_time
    
    # Record history
    st.session_state.history.append({
        'time': datetime.now(),
        'level': st.session_state.tank.level() * 100,
        'Q_in': Q_in,
        'Q_out': Q_out
    })
    
    # Keep last 100 points
    if len(st.session_state.history) > 100:
        st.session_state.history.pop(0)

# Plot history
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

# Auto-refresh for real-time updates
time.sleep(0.05)
st.rerun()
