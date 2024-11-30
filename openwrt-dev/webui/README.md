# HeaterMeter Web UI

A modern, responsive web interface for HeaterMeter BBQ controller, built with Tailwind CSS and jQuery.

## Features

### Temperature Display and Controls
- Real-time temperature monitoring for pit and food probes
  - Large, prominent pit temperature display
  - Secondary food probe displays with individual targets
  - Temperature rate of change calculation and display
  - Color-coded temperature indicators
  - Automatic alarm state visualization

### Fan Control System
- Real-time fan output percentage display
  - Gradient progress bar showing current output
  - Numerical display of output percentage
  - Fan speed indicator with RPM calculation
  - Servo position monitoring
  - Visual feedback for fan activity
- Multi-mode operation support:
  - Manual mode
  - PID control mode
  - Recovery mode during lid-open events

#### Understanding Fan Control Values

The fan control system displays three key values that help understand how the temperature control system is operating:

1. **Output (fan.c)** - Raw PID Controller Output
   - Range: 0-100%
   - This is the direct output from the PID controller
   - Represents how much power the system thinks is needed to maintain temperature
   - Used as the base value for calculating actual fan speed
   - Useful for diagnosing control issues (e.g., if system is working at max capacity)

2. **Fan Speed (fan.f)** - Actual Fan Speed
   - Range: 0-100%
   - The real fan speed after applying various adjustments:
     - Fan active floor (minimum threshold before fan starts)
     - Maximum speed limits (different for startup vs normal operation)
     - Long PWM mode for very low speeds
     - Boost mode when starting from zero
   - May differ from Output due to these limitations/adjustments
   - Example: Output=75%, Max Speed=80% → Fan Speed=60% (75% of 80%)

3. **Servo (fan.s)** - Damper Position
   - Range: 0-100%
   - Controls a physical damper for additional airflow control
   - Independent of fan speed
   - Can be used in conjunction with fan for fine-tuned control

#### Common Scenarios

Understanding the relationship between these values helps diagnose system behavior:

1. **System at Maximum Power**
   - Output = 100%
   - Fan Speed = Max Speed Setting (e.g., 80%)
   - Indicates system is working at maximum capacity

2. **Below Fan Floor**
   - Output = 25%
   - Fan Speed = 0%
   - Fan is below active floor threshold

3. **Normal Operation**
   - Output = 50%
   - Fan Speed = 50%
   - System operating in proportional range

4. **Startup Mode**
   - Output = Any value
   - Fan Speed = Startup Max Speed
   - System using higher fan speeds to reach initial temperature

#### UI Implementation

The fan control values are updated in main.js:
```javascript
function updateDisplay(data) {
    // Update fan speed displays
    $('#fanc').css('width', data.fan.c + '%');  // Output
    $('#fanf').css('width', data.fan.f + '%');  // Fan Speed
    $('#fanl').text('Fan ' + Math.round(data.fan.c) + '%');
}
```

These values are also plotted on the graph for historical tracking:
```javascript
function addGraphPoint(data) {
    const time = data.time * 1000;
    graphData[0].data.push([time, data.fan.c]);  // Output
    graphData[1].data.push([time, data.fan.f]);  // Fan Speed
    graphData[2].data.push([time, data.fan.s]);  // Servo
}
```

### Interactive Graph
- Real-time temperature plotting
  - Automatic time axis scrolling
  - Dynamic Y-axis scaling
  - Multiple data series with custom styling
  - Smooth transitions and updates
- Historical data visualization
  - Configurable time range (1-24 hours)
  - Data point interpolation
  - Automatic timezone handling
- Interactive features:
  - Hover tooltips with precise values
  - Time-synchronized data display
  - Automatic viewport management
- Visual indicators:
  - Lid-open events (yellow highlight)
  - Temperature setpoints (dashed line)
  - Fan output overlay (optional)

### Configuration Panel
- Probe Configuration:
  - Custom naming for all probes
  - Individual setpoint controls
  - High/low alarm thresholds
  - Probe type selection
- Display Options:
  - Time range selection
  - Graph overlay toggles
  - Temperature unit selection
  - Display precision control
- System Settings:
  - PID parameters adjustment
  - Fan curve configuration
  - Servo position limits
  - Temperature offset calibration

### Mock Controls (Development)
- Temperature Simulation:
  - Individual probe temperature control
  - Temperature ramping simulation
  - Noise and variation settings
- Fan System Testing:
  - Output percentage override
  - Fan speed simulation
  - Servo position testing
- Event Simulation:
  - Lid-open event triggering
  - Alarm condition testing
  - Connection loss simulation

## Technical Implementation

### Core Components

#### Temperature Management
```javascript
// Temperature data structure
{
    temps: [pit, food1, food2, food3],
    targets: [pit_target, food1_target, food2_target, food3_target],
    alarms: {
        high: [pit_high, food1_high, food2_high, food3_high],
        low: [pit_low, food1_low, food2_low, food3_low]
    }
}
```

#### Fan Control System
```javascript
// Fan control data structure
{
    fan: {
        c: current_output,    // PID Output (0-100%)
        f: fan_speed,         // Actual Fan Speed (0-100%)
        s: servo_position     // Servo/Damper Position (0-100%)
    }
}
```

#### Graph Implementation
- Data Series Management:
  ```javascript
  graphData = [
    { label: "Output", color: "rgba(147, 197, 253, 0.8)", yaxis: 2 },
    { label: "Fan", color: "rgba(147, 197, 253, 0.8)", yaxis: 2 },
    { label: "Servo", color: "rgba(147, 197, 253, 0.8)", yaxis: 2 },
    { label: "LidOpen", color: "rgba(253, 224, 71, 0.3)", yaxis: 2 },
    { label: "Set", color: "rgba(239, 68, 68, 0.6)" },
    { label: "Food3", color: "#f90" },
    { label: "Food2", color: "#6c0" },
    { label: "Food1", color: "#69f" },
    { label: "Pit", color: "#e73" }
  ]
  ```

### UI Components

#### Status Bar
- Real-time display components:
  - Fan output percentage
  - Current fan speed
  - Servo position
  - Progress bar with gradient
- Update frequency: 1000ms
- Smooth transition animations

#### Temperature Displays
- Main pit display:
  - Large 7xl font size
  - Dynamic color based on alarm state
  - Rate of change indicator
- Food probe displays:
  - 2xl font size
  - Individual target displays
  - Compact layout for multiple probes

#### Configuration Panels
- Organized in collapsible sections
- Real-time validation
- Persistent storage of settings
- Responsive grid layout

### Styling System

#### Color Scheme
```css
/* Primary Colors */
--color-pit: #e73;      /* Pit temperature */
--color-food1: #69f;    /* Food probe 1 */
--color-food2: #6c0;    /* Food probe 2 */
--color-food3: #f90;    /* Food probe 3 */

/* UI Colors */
--color-background: linear-gradient(to bottom right, #020617, #172554);
--color-panel: rgba(0, 0, 0, 0.4);
--color-text: rgba(255, 255, 255, 0.9);
--color-text-secondary: rgba(255, 255, 255, 0.6);
```

#### Layout System
- Responsive breakpoints:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px
- Grid system:
  - 1 column on mobile
  - 2 columns on tablet
  - 3 columns on desktop
- Spacing scale:
  - Base unit: 0.25rem (4px)
  - Common spacings: 0.5rem, 1rem, 1.5rem, 2rem

#### Component Styling
- Cards/Panels:
  - Semi-transparent black background
  - Subtle border radius
  - Consistent padding
- Typography:
  - System font stack
  - Size scale: sm, base, lg, xl, 2xl, 7xl
  - Weight scale: normal, medium, semibold, bold
- Interactive elements:
  - Hover states
  - Focus rings
  - Transition animations

### Development Tools

#### Mock Data Generation
- Temperature simulation:
  ```javascript
  function generateTemp(base, variation) {
      return base + (Math.random() - 0.5) * variation;
  }
  ```
- Fan behavior simulation
- Lid-open event generation
- Network latency simulation

#### Testing Utilities
- Console commands for debugging
- State inspection tools
- Performance monitoring
- Error logging system

### Browser Support
- Modern browsers:
  - Chrome 80+
  - Firefox 75+
  - Safari 13+
  - Edge 80+
- Required features:
  - ES6 support
  - CSS Grid
  - Flexbox
  - CSS Variables
  - RequestAnimationFrame

### Performance Considerations
- Graph optimization:
  - Data point limiting
  - Canvas rendering
  - Throttled updates
- Memory management:
  - Data pruning
  - Event listener cleanup
  - DOM element recycling
- Network efficiency:
  - Data compression
  - Update batching
  - Cache management

### Future Roadmap

#### Short-term Improvements
1. WebSocket Implementation
   - Real-time data streaming
   - Reduced server load
   - Better connection management

2. Enhanced Mobile Experience
   - Touch-optimized controls
   - Gesture support
   - Responsive graph interactions

3. Data Analysis Features
   - Temperature trending
   - Cook time estimation
   - Historical data analysis

#### Long-term Goals
1. Advanced Control Features
   - Multi-zone temperature control
   - Recipe management
   - Automated cooking programs

2. Integration Capabilities
   - Cloud backup
   - Mobile app synchronization
   - Smart home integration

3. Community Features
   - Cooking profile sharing
   - Recipe database
   - User forums

## Technical Implementation Details

The fan control system is implemented through several key components:

1. **PID Controller** (grillpid.cpp)
```cpp
void GrillPid::calcPidOutput(void) {
    // PID calculation determines base output (0-100%)
    float error = _setPoint - currentTemp;
    _pidCurrent[PIDP] = Pid[PIDP] * error;
    _pidCurrent[PIDI] += Pid[PIDI] * error;
    _pidCurrent[PIDD] = Pid[PIDD] * (TemperatureAvg - currentTemp);
    _pidOutput = constrain(control, 0, 100);
}
```

2. **Fan Speed Translation** (grillpid.cpp)
```cpp
void GrillPid::commitFanOutput(void) {
    // Convert PID output to actual fan speed
    if (_pidOutput < _fanActiveFloor)
        newFanSpeed = 0;
    else {
        unsigned char range = 100 - _fanActiveFloor;
        unsigned char max = getFanCurrentMaxSpeed();
        newFanSpeed = (_pidOutput - _fanActiveFloor) * max / range;
    }
}
```

3. **Special Modes**
   - **Long PWM Mode**: For very low speeds (<_fanMinSpeed)
     - Uses 10-second PWM cycle
     - Runs fan at minimum speed for proportional time
   - **Boost Mode**: For starting from zero
     - Briefly runs fan at 100% to overcome inertia
   - **Lid-Open Mode**: When lid is detected open
     - Automatically stops fan
     - Resumes previous operation after delay

4. **Key Parameters**
   - `_fanMaxSpeed`: Maximum allowed fan speed (0-100%)
   - `_fanMaxStartupSpeed`: Higher speed limit during startup
   - `_fanMinSpeed`: Threshold for long PWM mode
   - `_fanActiveFloor`: Minimum PID output before fan activates
   - `_pidOutput`: Raw PID controller output (0-100%)
   - `_fanPct`: Actual fan speed after all adjustments

5. **Data Flow**
```
Temperature Reading → PID Calculation → Output Value → Fan Speed Adjustment → PWM Output
                                                   └→ Servo Position    → Servo PWM
```

6. **Safety Features**
   - Fan stops if temperature probe fails
   - Fan stops in OFF mode
   - Fan stops during lid-open condition
   - Maximum speed limits for different modes
   - Feedback voltage monitoring (optional)

7. **UI Considerations**
   - Always show both Output and Fan Speed for transparency
   - Use visual indicators for special modes (boost, lid-open)
   - Graph historical values to show relationships
   - Consider adding tooltips to explain differences
   - Show warning when system is at maximum capacity

This implementation provides a robust and flexible fan control system that can handle various cooking scenarios while maintaining safety and usability.

## Troubleshooting

### Common Issues
1. Graph Display Problems
   - Clear browser cache
   - Check console for errors
   - Verify data structure
   - Confirm proper initialization

2. Temperature Reading Issues
   - Verify probe connections
   - Check alarm settings
   - Confirm proper probe type
   - Validate temperature ranges

3. Fan Control Problems
   - Check fan connections
   - Verify PID settings
   - Confirm output limits
   - Test manual control

### Debug Mode
Enable debug mode in console:
```javascript
localStorage.setItem('DEBUG', 'true');
location.reload();
```

This will:
- Enable verbose logging
- Show additional data points
- Display performance metrics
- Enable test controls

## Contributing

### Development Setup
1. Clone repository
2. Install dependencies
3. Configure local environment
4. Start development server

### Code Style
- Follow existing patterns
- Use meaningful variable names
- Comment complex logic
- Maintain consistent formatting

### Testing
- Add tests for new features
- Verify mobile compatibility
- Check performance impact
- Test error conditions

### Documentation
- Update README for new features
- Document API changes
- Add JSDoc comments
- Include usage examples

## License
This project is part of HeaterMeter and follows its licensing terms.
See LICENSE file for details.
