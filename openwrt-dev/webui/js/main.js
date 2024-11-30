// Main HeaterMeter JavaScript
const mapJson = [8,7,6,5];  // translates json temps array index to graphData index
let lastPlot;
let lastOverviewPlot;
let lastGraphHover = 0;
let lastLidOpen = -1;
let lastPeaks;
let lastUpdateUtc = 0;
let graphLoadedUtc = 0;

// Graph configuration
let graphData = [
    { label: "Output", color: "rgba(147, 197, 253, 0.8)", lines: { show: true, lineWidth: 1, fill: 0.1 }, shadowSize: 0, yaxis: 2, data: [] },
    { label: "Fan", color: "rgba(147, 197, 253, 0.8)", lines: { show: false, lineWidth: 1, fill: 0.1 }, shadowSize: 0, yaxis: 2, data: [] },
    { label: "Servo", color: "rgba(147, 197, 253, 0.8)", lines: { show: false, lineWidth: 1, fill: 0.1 }, shadowSize: 0, yaxis: 2, data: [] },
    { label: "", color: "rgba(253, 224, 71, 0.3)", lines: { show: true, lineWidth: 0, fill: 0.2 }, shadowSize: 0, yaxis: 2, data: [] },
    { label: "Set", color: "rgba(239, 68, 68, 0.6)", lines: { show: true, lineWidth: 1, dash: [4, 4] }, shadowSize: 0, data: [] },
    { label: "Food3", color: "#f90", lines: { show: true }, data: [] },
    { label: "Food2", color: "#6c0", lines: { show: true }, data: [] },
    { label: "Food1", color: "#69f", lines: { show: true }, data: [] },
    { label: "Pit", color: "#e73", lines: { show: true, lineWidth: 2 }, data: [] }
];

let graphOpts = {
    legend: { show: false },
    canvas: true,
    series: {
        lines: { 
            show: true,
            lineWidth: 2,
            fill: 0.1
        },
        points: { show: false },
        shadowSize: 0
    },
    xaxis: { 
        show: true,
        mode: "time",
        timezone: "browser",
        font: { 
            size: 11,
            family: "ui-sans-serif, system-ui, -apple-system, sans-serif",
            color: "rgba(255, 255, 255, 0.6)"
        },
        tickLength: 0,
        min: Date.now() - (60 * 60 * 1000),
        max: Date.now(),
        gridLines: false,
        tickColor: "rgba(255, 255, 255, 0.1)"
    },
    yaxis: {
        show: true,
        ticks: 5,
        tickDecimals: 0,
        font: { 
            size: 11,
            family: "ui-sans-serif, system-ui, -apple-system, sans-serif",
            color: "rgba(255, 255, 255, 0.6)"
        },
        tickLength: 0,
        min: 0,
        max: null,
        tickColor: "rgba(255, 255, 255, 0.1)"
    },
    yaxes: [
        { position: "right" },
        { min: 0, max: 100, position: "right" }
    ],
    grid: {
        show: true,
        hoverable: true,
        clickable: true,
        color: "rgba(255, 255, 255, 0.1)",
        borderWidth: 0,
        backgroundColor: { colors: ["rgba(0,0,0,0.4)", "rgba(0,0,0,0.4)"] },
        margin: { top: 20, right: 40, bottom: 20, left: 20 }
    }
};

// Update plot size on window resize
$(window).resize(function() {
    if (lastPlot) {
        lastPlot.resize();
        lastPlot.setupGrid();
        lastPlot.draw();
    }
});

// Function to add a new point to the graph
function addGraphPoint(data) {
    const time = data.time * 1000;  // Convert to milliseconds

    // Add fan data
    graphData[0].data.push([time, data.fan.c]);  // Output
    graphData[1].data.push([time, data.fan.f]);  // Fan Speed
    graphData[2].data.push([time, data.fan.s]);  // Servo

    // Add lid status
    graphData[3].data.push([time, data.lid ? 100 : 0]);

    // Add setpoint
    graphData[4].data.push([time, data.set]);

    // Add probe temperatures
    data.temps.forEach((temp, i) => {
        if (temp.c !== null) {
            graphData[mapJson[i]].data.push([time, temp.c]);
        }
    });

    // Keep only last 24 hours of data
    const cutoff = time - (24 * 60 * 60 * 1000);
    graphData.forEach(series => {
        series.data = series.data.filter(point => point[0] > cutoff);
    });
}

// Function to update the graph
function updateGraph() {
    if (!graphData[0].data.length) return;  // No data to plot

    // Update time axis
    const range = parseInt($('#rangeselect').val()) || 1;
    const now = Date.now();
    graphOpts.xaxis.min = now - (range * 60 * 60 * 1000);
    graphOpts.xaxis.max = now;

    // Create the plot
    lastPlot = $.plot('#graph', graphData, graphOpts);
}

// Function to generate historical data
function generateHistoricalData(hours) {
    // Clear existing data
    graphData.forEach(series => series.data = []);

    const now = Date.now();
    const points = hours * 60;  // One point per minute
    const interval = hours * 60 * 60 * 1000 / points;

    for (let i = points; i >= 0; i--) {
        const time = now - (i * interval);
        const point = {
            time: time / 1000,
            set: 250,
            lid: 0,
            temps: [
                { c: 250 + Math.sin(i/10) * 5, n: 'Pit' },
                { c: 165 + Math.sin(i/15) * 3, n: 'Food1' },
                { c: 145 + Math.sin(i/20) * 2, n: 'Food2' }
            ],
            fan: {
                c: 45 + Math.sin(i/5) * 10,
                f: 45 + Math.sin(i/5) * 10,
                s: 45 + Math.sin(i/5) * 10,
                a: 45 + Math.sin(i/5) * 10
            },
            ramp: null
        };
        addGraphPoint(point);
    }
}

// Update the display with new temperature data
function updateDisplay(data) {
    // Update temperatures and probe names
    data.temps.forEach((probe, i) => {
        if (probe.c !== null) {
            $(`#probe${i} .ptemp`).text(probe.c.toFixed(1) + '°');
            $(`#probe${i} .pname`).text(probe.n);
            
            // Update alarm status
            const tempElem = $(`#probe${i} .ptemp`);
            if (probe.a.r === 'H') {
                tempElem.removeClass("alarmLow").addClass("alarmHigh");
            } else if (probe.a.r === 'L') {
                tempElem.removeClass("alarmHigh").addClass("alarmLow");
            } else {
                tempElem.removeClass("alarmLow alarmHigh");
            }

            // Update degrees per hour if available
            if (probe.dph && probe.dph >= 1.0) {
                $(`#probe${i} .pdph`).html(probe.dph.toFixed(1) + '°/hr').show();
            } else {
                $(`#probe${i} .pdph`).hide();
            }
        } else {
            $(`#probe${i} .ptemp`).text('off');
            $(`#probe${i} .pdph`).hide();
        }
    });
    
    // Update fan displays
    $('#fan-output-display').text(Math.round(data.fan.c));
    $('#fan-speed-display').text(Math.round(data.fan.f));
    $('#fan-servo-display').text(Math.round(data.fan.s));
    
    // Update progress bars
    $('#fan-progress').css('width', data.fan.c + '%');
    $('#servo-progress').css('width', data.fan.s + '%');
    
    // Update status indicators
    const fanSpeed = data.fan.f;
    const output = data.fan.c;
    
    // Check for boost mode (fan speed temporarily at 100%)
    $('#boost-mode').toggleClass('hidden', fanSpeed < 100 || output < 100);
    
    // Check for lid open mode
    $('#lid-open').toggleClass('hidden', !data.lid);
    
    // Check if system is at maximum power
    // This happens when output is high (>95%) but fan speed is limited
    const atMaxPower = output > 95 && fanSpeed < output;
    $('#max-power').toggleClass('hidden', !atMaxPower);
    
    // Check for long PWM mode
    // This happens when fan speed is below minimum speed threshold but output is non-zero
    const inLongPwm = fanSpeed < 10 && output > 0;
    $('#long-pwm').toggleClass('hidden', !inLongPwm);
    
    // Update fan icon animation based on speed
    const fanIcon = $('#fan-speed-icon');
    if (fanSpeed > 0) {
        fanIcon.addClass('fa-spin');
        // Adjust animation speed based on fan speed
        const duration = Math.max(3 - (fanSpeed / 40), 0.5); // Speed up as fan speed increases
        fanIcon.css('animation-duration', duration + 's');
    } else {
        fanIcon.removeClass('fa-spin');
    }
    
    // Update lid status
    $('#lidopen').toggle(data.lid === 1);

    // Update setpoint
    if (data.set === null) {
        $('#setpoint').text('Off');
    } else if (data.set <= 0) {
        $('#setpoint').text((-data.set) + '%');
    } else {
        $('#setpoint').text(data.set + '°');
    }

    // Update ramp status
    if (data.ramp) {
        $('#ramp').html(`Ramping ${data.ramp.s}° to ${data.ramp.ta}°`).show();
        $('#setcontainer').addClass('ramp');
    } else {
        $('#ramp').hide();
        $('#setcontainer').removeClass('ramp');
    }
    
    // Update time
    const date = new Date(data.time * 1000);
    $('#updatedtime').text(date.toLocaleTimeString());
}

// Initialize when document is ready
$(document).ready(function() {
    // Initialize tooltip div
    $("<div id='graphtt'></div>").appendTo("body");
    
    // Bind hover events for tooltip
    $("#graph").bind("plothover", function (event, pos, item) {
        if (item) {
            const date = new Date(item.datapoint[0]);
            const value = Math.round(item.datapoint[1]);
            const timeStr = date.toLocaleTimeString();
            const label = item.series.label;
            
            // Add degree symbol only for temperature values
            const unit = (label === "Pit" || label === "Food1" || label === "Food2" || label === "Food3" || label === "Set") ? "°" : "%";
            
            const tooltip = $("#graphtt");
            tooltip.html(`
                <div id='graphtt_title'>${timeStr}</div>
                <div id='graphtt_content'>${label}: ${value}${unit}</div>
            `);
            
            // Position tooltip and ensure it stays within viewport
            const x = item.pageX + 10;
            const y = item.pageY + 10;
            const tooltipWidth = tooltip.outerWidth();
            const tooltipHeight = tooltip.outerHeight();
            const windowWidth = $(window).width();
            const windowHeight = $(window).height();
            
            // Adjust position if tooltip would go off screen
            const finalX = Math.min(x + tooltipWidth > windowWidth ? x - tooltipWidth - 20 : x, windowWidth - tooltipWidth);
            const finalY = Math.min(y + tooltipHeight > windowHeight ? y - tooltipHeight - 20 : y, windowHeight - tooltipHeight);
            
            tooltip.css({
                top: finalY + "px",
                left: finalX + "px"
            }).fadeIn(200);
        } else {
            $("#graphtt").hide();
        }
    });

    // Hide tooltip when leaving graph area
    $("#graph").bind("mouseleave", function() {
        $("#graphtt").hide();
    });

    // Set up configuration controls
    $('.editable').each(function() {
        $(this).on('change', function() {
            const newValue = $(this).val();
            const id = $(this).attr('id');
            
            // In real implementation, this would send to the server
            console.log(`Setting ${id} to ${newValue}`);
            
            // Update display if needed
            if (id === 'set') {
                $('#target-temp').text(newValue);
            } else if (id.startsWith('pn')) {
                const probeNum = id.charAt(2);
                if (probeNum === '0') {
                    $('#main-temp').prev().text(newValue);
                } else {
                    $(`#probe${probeNum} .text-gray-400`).text(newValue);
                }
            }
        });
    });

    // Set up output display selector
    $('#outputselect').on('change', function() {
        const value = $(this).val();
        graphData[0].lines.show = value === '1' || value === '4';  // Output
        graphData[1].lines.show = value === '2' || value === '4';  // Fan
        graphData[2].lines.show = value === '3' || value === '4';  // Servo
        updateGraph();
    });

    // Set up time range selector
    $('#rangeselect').on('change', function() {
        const hours = parseInt($(this).val());
        generateHistoricalData(hours);
        updateGraph();
    });

    // Set up alarm clear button
    $('#alarmclear').on('click', function() {
        $('.ptemp').removeClass('alarmHigh alarmLow');
        // In real implementation, this would clear server alarms
    });

    // Set up alarm thresholds
    $('#sp_pit_high, #sp_pit_low').on('change', function() {
        const high = parseInt($('#sp_pit_high').val());
        const low = parseInt($('#sp_pit_low').val());
        // In real implementation, this would send to server
        console.log(`Setting alarms - High: ${high}, Low: ${low}`);
    });

    // Initial graph setup
    generateHistoricalData(1);  // Start with 1 hour of data
    updateGraph();

    // Update graph every 2 seconds
    setInterval(updateGraph, 2000);
});

// Set up mock EventSource for real-time updates
if (window.EventSource) {
    const source = new EventSource('mock');
    source.addEventListener('hmstatus', function(e) {
        const data = JSON.parse(e.data);
        addGraphPoint(data);
        updateDisplay(data);
    });
}
