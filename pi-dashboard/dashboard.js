// Dashboard JavaScript
const NETDATA_HOST = window.location.hostname;
const NETDATA_PORT = '19999';
const UPDATE_INTERVAL = 5000; // 5 seconds

let updateTimer;
let isLoading = false;

// Loading screen management
const loadingSteps = [
    { text: "Connecting to system...", progress: 20 },
    { text: "Loading system metrics...", progress: 40 },
    { text: "Checking network status...", progress: 60 },
    { text: "Initializing services...", progress: 80 },
    { text: "Dashboard ready!", progress: 100 }
];

let currentStep = 0;

function showLoadingStep() {
    if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep];
        document.getElementById('loadingStatus').textContent = step.text;
        document.getElementById('loadingProgressBar').style.width = step.progress + '%';
        currentStep++;
        
        if (currentStep < loadingSteps.length) {
            setTimeout(showLoadingStep, 800);
        } else {
            setTimeout(hideLoadingScreen, 500);
        }
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const dashboard = document.getElementById('dashboard');
    
    loadingScreen.classList.add('hidden');
    dashboard.classList.add('visible');
    
    // Start data loading after loading screen is hidden
    setTimeout(initializeDashboard, 500);
}

// Initialize dashboard
function initializeDashboard() {
    loadInitialData();
    startAutoRefresh();
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format uptime
function formatUptime(seconds) {
    if (!seconds) return '--';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// Update progress bar
function updateProgressBar(elementId, percentage, type = 'normal') {
    const progressBar = document.getElementById(elementId);
    if (!progressBar) return;
    
    progressBar.style.width = percentage + '%';
    
    // Update color based on percentage
    progressBar.className = 'progress-fill';
    if (percentage > 80) {
        progressBar.classList.add('progress-danger');
    } else if (percentage > 60) {
        progressBar.classList.add('progress-warning');
    } else {
        progressBar.classList.add('progress-normal');
    }
}

// Update status indicator
function updateStatusIndicator(elementId, isOnline) {
    const indicator = document.getElementById(elementId);
    if (!indicator) return;
    
    indicator.className = 'status-indicator';
    if (isOnline) {
        indicator.classList.add('status-online');
    } else {
        indicator.classList.add('status-offline');
    }
}

// Fetch data from Netdata API
async function fetchNetdataData(chart, after = -60) {
    try {
        const response = await fetch(`http://${NETDATA_HOST}:${NETDATA_PORT}/api/v1/data?chart=${chart}&after=${after}&format=json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Fetch system info
async function fetchSystemInfo() {
    try {
        const response = await fetch(`http://${NETDATA_HOST}:${NETDATA_PORT}/api/v1/info`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching system info:', error);
        return null;
    }
}

// Load system metrics
async function loadSystemMetrics() {
    try {
        // CPU usage
        const cpuData = await fetchNetdataData('system.cpu');
        if (cpuData && cpuData.data && cpuData.data.length > 0) {
            const latestCpu = cpuData.data[cpuData.data.length - 1];
            const cpuUsage = 100 - (latestCpu[cpuData.labels.indexOf('idle')] || 0);
            
            document.getElementById('cpu-usage').textContent = `${Math.round(cpuUsage)}%`;
            document.getElementById('cpu-percent').textContent = `${Math.round(cpuUsage)}%`;
            updateProgressBar('cpu-progress', cpuUsage);
        }

        // Memory usage
        const memData = await fetchNetdataData('system.ram');
        if (memData && memData.data && memData.data.length > 0) {
            const latestMem = memData.data[memData.data.length - 1];
            const memUsed = latestMem[memData.labels.indexOf('used')] || 0;
            const memFree = latestMem[memData.labels.indexOf('free')] || 0;
            const memTotal = memUsed + memFree;
            const memPercentage = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
            
            document.getElementById('memory-usage').textContent = formatBytes(memUsed * 1024 * 1024);
            document.getElementById('memory-percent').textContent = `${Math.round(memPercentage)}%`;
            updateProgressBar('memory-progress', memPercentage);
        }

        // System info (uptime, temperature, etc.)
        const sysInfo = await fetchSystemInfo();
        if (sysInfo) {
            // Uptime
            if (sysInfo.uptime) {
                document.getElementById('uptime').textContent = formatUptime(sysInfo.uptime);
            }
            
            // Update overall status
            document.getElementById('status-text').textContent = 'System Online';
            updateStatusIndicator('overall-status', true);
        }

        // Temperature (Pi specific)
        const tempData = await fetchNetdataData('sensors.temperature');
        if (tempData && tempData.data && tempData.data.length > 0) {
            const latestTemp = tempData.data[tempData.data.length - 1];
            if (latestTemp && latestTemp.length > 1) {
                const temp = Math.round(latestTemp[1]);
                document.getElementById('temperature').textContent = `${temp}°C`;
            }
        } else {
            document.getElementById('temperature').textContent = '--';
        }

    } catch (error) {
        console.error('Error loading system metrics:', error);
        document.getElementById('status-text').textContent = 'Connection Error';
        updateStatusIndicator('overall-status', false);
    }
}

// Load network status
async function loadNetworkStatus() {
    try {
        // Network interface data
        const netData = await fetchNetdataData('system.net');
        
        // WiFi status (mock for now - you'd need to implement actual detection)
        updateStatusIndicator('wifi-status', true);
        document.getElementById('wifi-speed').textContent = 'Connected - 150 Mbps';
        
        // Verizon USB status
        updateStatusIndicator('verizon-status', true);
        document.getElementById('verizon-speed').textContent = 'Connected - 50 Mbps';
        
        // Speedify status
        updateStatusIndicator('speedify-status', true);
        document.getElementById('speedify-speed').textContent = 'Bonding Active - 200 Mbps';
        
    } catch (error) {
        console.error('Error loading network status:', error);
    }
}

// Load service status
async function loadServiceStatus() {
    // These would need to be implemented via custom API endpoints
    // For now, showing as online
    updateStatusIndicator('hostapd-status', true);
    updateStatusIndicator('dnsmasq-status', true);
    updateStatusIndicator('speedify-service-status', true);
    updateStatusIndicator('netdata-status', true);
}

// Main data loading function
async function loadInitialData() {
    setLoading(true);
    
    try {
        await Promise.all([
            loadSystemMetrics(),
            loadNetworkStatus(),
            loadServiceStatus()
        ]);
        
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading initial data:', error);
    } finally {
        setLoading(false);
    }
}

// Refresh data
async function refreshData() {
    if (isLoading) return;
    
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.classList.add('spinning');
    
    await loadInitialData();
    
    setTimeout(() => {
        refreshBtn.classList.remove('spinning');
    }, 1000);
}

// Set loading state
function setLoading(loading) {
    isLoading = loading;
    const dashboard = document.getElementById('dashboard');
    
    if (loading) {
        dashboard.classList.add('loading');
    } else {
        dashboard.classList.remove('loading');
    }
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-update-time').textContent = timeString;
}

// Start auto refresh
function startAutoRefresh() {
    updateTimer = setInterval(async () => {
        if (!isLoading) {
            await loadInitialData();
        }
    }, UPDATE_INTERVAL);
}

// Stop auto refresh
function stopAutoRefresh() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        refreshData();
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Start loading sequence
    setTimeout(showLoadingStep, 500);
});

// Handle window beforeunload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});