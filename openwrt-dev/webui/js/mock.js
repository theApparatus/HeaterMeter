// Mock data for development
const mockData = {
    set: 250,  // temperature setpoint
    time: Date.now() / 1000,
    lid: 0,    // lid status
    temps: [
        { c: 250, n: 'Pit', dph: 1.5, a: { h: 300, l: 200, r: null } },
        { c: 165, n: 'Food', dph: 0.8, a: { h: 180, l: 140, r: null } },
        { c: 145, n: 'Ambient', dph: 0.7, a: { h: 180, l: 140, r: null } }
    ],
    fan: {
        c: 45,  // current
        f: 45,  // full
        s: 45,  // servo
        a: 45   // average
    },
    ramp: null
};

// Replace the real EventSource with our mock version
class MockEventSource {
    constructor(url) {
        this.listeners = {};
        
        // Simulate events every 2 seconds
        setInterval(() => {
            if (this.listeners['hmstatus']) {
                // Update time
                mockData.time = Date.now() / 1000;
                
                // Update temperatures and calculate degrees per hour
                mockData.temps.forEach(temp => {
                    temp.c += (Math.random() * 2 - 1);
                    temp.dph = Math.abs(0.5 + Math.random());
                    
                    // Simulate alarms
                    if (temp.c > temp.a.h) temp.a.r = 'H';
                    else if (temp.c < temp.a.l) temp.a.r = 'L';
                    else temp.a.r = null;
                });
                
                // Update fan values with more realistic behavior
                // Current output (c) changes based on PID control
                mockData.fan.c = Math.max(0, Math.min(100, mockData.fan.c + (Math.random() * 10 - 5)));
                
                // Fan speed (f) lags behind current output and has some variation
                const targetSpeed = mockData.fan.c;
                const currentSpeed = mockData.fan.f || 0;
                const speedDiff = targetSpeed - currentSpeed;
                mockData.fan.f = Math.max(0, Math.min(100, currentSpeed + (speedDiff * 0.3) + (Math.random() * 4 - 2)));
                
                // Servo position (s) moves more slowly and deliberately
                const targetServo = mockData.fan.c;
                const currentServo = mockData.fan.s || 0;
                const servoDiff = targetServo - currentServo;
                mockData.fan.s = Math.max(0, Math.min(100, currentServo + (servoDiff * 0.1) + (Math.random() * 2 - 1)));
                
                // Average (a) is a smoothed version of current output
                mockData.fan.a = mockData.fan.a * 0.7 + mockData.fan.c * 0.3;
                
                // Update UI
                this.updateUI();
                
                this.listeners['hmstatus'].forEach(callback => {
                    callback({
                        data: JSON.stringify(mockData)
                    });
                });
            }
        }, 2000);
    }
    
    updateUI() {
        // Update main temperature display
        $('#main-temp').text(mockData.temps[0].c.toFixed(1) + '°');
        $('#target-temp').text(mockData.set);
        $('#temp-rate').text(mockData.temps[0].dph.toFixed(1));
        
        // Update food and ambient temperatures
        $('#food-temp').text(mockData.temps[1].c.toFixed(1));
        $('#food-target').text(mockData.temps[1].a.h);
        $('#ambient-temp').text(mockData.temps[2].c.toFixed(1));
        
        // Update fan displays
        $('#fan-output-display').text(mockData.fan.c.toFixed(0));
        $('#fan-speed-display').text(mockData.fan.f.toFixed(0));
        $('#fan-servo-display').text(mockData.fan.s.toFixed(0));
        
        // Update progress bars with smooth transition
        $('#fan-progress').css('width', mockData.fan.f + '%');
        $('#servo-progress').css('width', mockData.fan.s + '%');
        
        // Update fan rotation speed based on percentage
        const fanSpeed = Math.max(0.1, 2 - (mockData.fan.f / 50)); // Speed ranges from 2s (0%) to 0.1s (100%)
        $('#fan-speed-icon').css('--speed', fanSpeed + 's');
        
        // Update servo position and pulse intensity
        const servoRotation = mockData.fan.s * 3.6;
        const servoScale = 1 + (mockData.fan.s / 400); // Scale ranges from 1 to 1.25
        $('#fan-servo-icon').css({
            '--rotation': `${servoRotation}deg`,
            '--scale': servoScale
        });
    }
    
    addEventListener(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        
        // Send initial data immediately
        if (event === 'hmstatus') {
            callback({
                data: JSON.stringify(mockData)
            });
        }
    }
    
    removeEventListener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
}

// Replace the real EventSource with our mock version
window.EventSource = MockEventSource;

// Mock state variables
let mockState = {
    lastFanSpeed: 0,
    forceBoost: false,
    forceLongPwm: false,
    forceMaxPower: false,
    lidOpen: false,
    alarmState: null // 'high', 'low', or null
};

// Update range slider values in UI
function updateSliderValue(id, value, unit = '') {
    $(`#${id}-value`).text(value + unit);
}

// Mock data update function
function updateMockData() {
    const fanOutput = parseInt($('#fan-output').val());
    updateSliderValue('fan-output', fanOutput, '%');
    updateSliderValue('servo-pos', $('#servo-pos').val(), '%');
    updateSliderValue('pit-temp', $('#pit-temp').val(), '°');
    updateSliderValue('food1-temp', $('#food1-temp').val(), '°');
    updateSliderValue('food2-temp', $('#food2-temp').val(), '°');
    
    // Simulate different fan states based on output
    let fanSpeed = fanOutput;
    
    // Apply different fan modes
    if (mockState.forceBoost) {
        fanSpeed = 100; // Boost mode
    } else if (mockState.forceLongPwm) {
        fanSpeed = fanOutput > 0 ? 5 : 0; // Long PWM mode
    } else if (mockState.forceMaxPower) {
        fanSpeed = Math.min(fanOutput, 80); // Limit max speed
    } else if (fanOutput < 10) {
        // Normal Long PWM mode
        fanSpeed = fanOutput > 0 ? 5 : 0;
    } else if (fanOutput === 0) {
        fanSpeed = 0;
    } else if (mockState.lastFanSpeed === 0 && fanOutput > 0) {
        // Auto boost mode when starting from zero
        fanSpeed = 100;
    } else {
        // Normal operation with max speed limit
        const maxSpeed = 80;
        fanSpeed = Math.min(fanOutput, maxSpeed);
    }
    
    // Store last fan speed for boost mode detection
    mockState.lastFanSpeed = fanSpeed;
    
    const mockData = {
        time: Date.now() / 1000,
        set: parseInt($('#pit-temp').val()),
        lid: mockState.lidOpen ? 1 : 0,
        fan: {
            c: fanOutput,    // Raw output
            f: fanSpeed,     // Actual fan speed
            s: parseInt($('#servo-pos').val() || 0)  // Servo position
        },
        temps: [
            { 
                c: parseInt($('#pit-temp').val()),
                n: 'Pit',
                a: { r: mockState.alarmState === 'high' ? 'H' : mockState.alarmState === 'low' ? 'L' : '' }
            },
            { 
                c: parseInt($('#food1-temp').val()),
                n: 'Food 1',
                a: { r: '' }
            },
            { 
                c: parseInt($('#food2-temp').val()),
                n: 'Food 2',
                a: { r: '' }
            }
        ]
    };
    
    // Update display with mock data
    updateDisplay(mockData);
    addGraphPoint(mockData);
    updateGraph();
}

// Initialize mock controls
$(document).ready(function() {
    // Modal controls
    $('#toggle-mock-controls').click(() => {
        $('#mock-controls-modal').removeClass('hidden');
    });
    
    $('#close-mock-controls').click(() => {
        $('#mock-controls-modal').addClass('hidden');
    });
    
    // Close modal when clicking outside
    $('#mock-controls-modal').click(function(e) {
        if (e.target === this) {
            $(this).addClass('hidden');
        }
    });

    // Draggable functionality
    const modal = document.getElementById('mock-controls-panel');
    const handle = document.getElementById('mock-controls-handle');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    handle.addEventListener('mousedown', dragStart);
    handle.addEventListener('touchstart', dragStart, { passive: true });
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        if (e.type === 'mousedown') {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        } else {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        }

        if (e.target === handle) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            if (e.type === 'mousemove') {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            } else {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, modal);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px) scale(0.8)`;
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    // Update value displays for range inputs
    $('input[type="range"]').on('input', function() {
        const value = $(this).val();
        const unit = $(this).attr('id') === 'fan-output' ? '%' : '°';
        $(`#${$(this).attr('id')}-value`).text(value);
        updateMockData();
    });

    // Special states buttons
    $('#toggle-lid').click(() => {
        mockState.lidOpen = !mockState.lidOpen;
        $(this).toggleClass('bg-yellow-500/40', mockState.lidOpen);
        updateMockData();
    });
    
    $('#toggle-boost').click(() => {
        mockState.forceBoost = !mockState.forceBoost;
        $(this).toggleClass('bg-blue-500/40', mockState.forceBoost);
        mockState.forceLongPwm = false;
        mockState.forceMaxPower = false;
        updateMockData();
    });
    
    $('#toggle-long-pwm').click(() => {
        mockState.forceLongPwm = !mockState.forceLongPwm;
        $(this).toggleClass('bg-purple-500/40', mockState.forceLongPwm);
        mockState.forceBoost = false;
        mockState.forceMaxPower = false;
        updateMockData();
    });
    
    $('#toggle-max-power').click(() => {
        mockState.forceMaxPower = !mockState.forceMaxPower;
        $(this).toggleClass('bg-red-500/40', mockState.forceMaxPower);
        mockState.forceBoost = false;
        mockState.forceLongPwm = false;
        updateMockData();
    });
    
    // Alarm state buttons
    $('#high-alarm').click(() => {
        mockState.alarmState = mockState.alarmState === 'high' ? null : 'high';
        $(this).toggleClass('bg-red-500/40', mockState.alarmState === 'high');
        updateMockData();
    });
    
    $('#low-alarm').click(() => {
        mockState.alarmState = mockState.alarmState === 'low' ? null : 'low';
        $(this).toggleClass('bg-blue-500/40', mockState.alarmState === 'low');
        updateMockData();
    });
    
    // Range input event listeners
    $('#mock-controls-modal input[type="range"]').on('input', updateMockData);
    
    // Start periodic updates
    setInterval(updateMockData, 1000);
    
    // Generate initial historical data
    generateHistoricalData(1);
});

// Mock control panel functionality
$(document).ready(function() {
    // Toggle mock controls visibility
    $('#toggle-mock-controls').on('click', function() {
        const $controls = $('#mock-controls-panel');
        const $button = $(this);
        
        if ($controls.is(':visible')) {
            $controls.hide();
            $button.text('Show Mock Controls');
        } else {
            $controls.show();
            $button.text('Hide Mock Controls');
        }
    });

    // Temperature controls
    $('#pit-temp').on('input', function() {
        mockData.temps[0].c = parseFloat(this.value);
    });

    $('#food1-temp').on('input', function() {
        mockData.temps[1].c = parseFloat(this.value);
    });

    $('#food2-temp').on('input', function() {
        mockData.temps[2].c = parseFloat(this.value);
    });

    // Fan control
    $('#fan-output').on('input', function() {
        const value = parseFloat(this.value);
        mockData.fan.c = value;
        mockData.fan.f = value;
        mockData.fan.s = value;
        mockData.fan.a = value;
    });

    // Lid control
    $('#toggle-lid').on('click', function() {
        mockData.lid = mockData.lid ? 0 : 1;
        $(this).toggleClass('bg-blue-500/50');
    });

    // Ramp control
    $('#toggle-ramp').on('click', function() {
        if (mockData.ramp) {
            mockData.ramp = null;
            $(this).removeClass('bg-purple-500/50');
        } else {
            mockData.ramp = {
                s: mockData.temps[0].c,
                ta: mockData.temps[0].c + 25
            };
            $(this).addClass('bg-purple-500/50');
        }
    });

    // Alarm controls
    $('#high-alarm').on('click', function() {
        mockData.temps.forEach(temp => {
            temp.a.r = 'H';
        });
        $(this).addClass('bg-yellow-500/50');
    });

    $('#low-alarm').on('click', function() {
        mockData.temps.forEach(temp => {
            temp.a.r = 'L';
        });
        $(this).addClass('bg-red-500/50');
    });

    $('#clear-alarm').on('click', function() {
        mockData.temps.forEach(temp => {
            temp.a.r = null;
        });
        $('.bg-yellow-500/50, .bg-red-500/50').removeClass('bg-yellow-500/50 bg-red-500/50');
    });
});
