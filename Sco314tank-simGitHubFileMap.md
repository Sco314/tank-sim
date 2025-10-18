Sco314/tank-sim  [GitHub root https://github.com/Sco314/tank-sim/]
├── designer.html           
├── valve.html              
│
├── css/
│   └── designer-style.css  (referenced in designer.html)
│
├── js/
│   ├── designer.js         
│   ├── exporter.js          
│   ├── componentLibrary.js  
│   │
│   ├── config/
│   │   ├── systemConfig.js
│   │   └── configGenerator.js  [⚠️ Optional not used for now]  
│   │
│   ├── core/
│   │   ├── Component.js
│   │   ├── FlowNetwork.js
│   │   └── ComponentManager.js
│   │
│   ├── components/
│   │   ├── sources/
│   │   │   └── Feed.js
│   │   ├── sinks/
│   │   │   └── Drain.js
│   │   ├── tanks/
│   │   │   └── Tank.js
│   │   ├── pumps/
│   │   │   ├── Pump.js
│   │   │   ├── FixedSpeedPump.js
│   │   │   ├── VariableSpeedPump.js
│   │   │   └── ThreeSpeedPump.js
│   │   ├── valves/
│   │   │   └── Valve.js
│   │   ├── pipes/
│   │   │   └── Pipe.js
│   │   └── sensors/
│   │       └── PressureSensor.js
│   │
│   └── managers/
│       ├── TankManager.js
│       ├── PumpManager.js
│       ├── ValveManager.js
│       ├── PipeManager.js
│       └── PressureManager.js
│
└── 101125/ [legacy and beta files]