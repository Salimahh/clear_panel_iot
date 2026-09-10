// Wait for the HTML to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("System initializing...");

    // Grab Elements
    const themeToggleBtn = document.getElementById('themeToggle');
    const langToggleBtn = document.getElementById('langToggle');
    const mainToggleBtn = document.getElementById('mainToggle');
    const statusCard = document.getElementById('statusCard');
    const networkStatus = document.getElementById('networkStatus');
    const bodyElement = document.body;

    // Digital Twin Elements
    const waterFill = document.getElementById('waterFill');
    const waterLevelPct = document.getElementById('waterLevelPct');
    const batteryStatus = document.getElementById('batteryStatus');
    const alertText = document.getElementById('alertText');

    // State tracking
    let isSystemOn = false;
    let currentLang = 'EN';
    const LOW_WATER_THRESHOLD = 20;

    // ==========================================
    // 1. SUPABASE DATABASE CONFIGURATION
    // ==========================================
    const supabaseUrl = 'https://usnoixtysqghktqrmdaq.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzbm9peHR5c3FnaGt0cXJtZGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjA4NzYsImV4cCI6MjEwMTkzNjg3Nn0.4MCWXqJWCnenRvVme7Fy3IlaJm2SuToRG8i1SqnuGvY';
    
    let supabase = null;
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    }

    async function logCleaningEvent(pumpStatus) {
        if (!supabase) return;
        try {
            const { error } = await supabase
                .from('cleaning_logs')
                .insert([{ trigger_type: 'Manual', status: pumpStatus }]);

            if (error) console.error('Database Error:', error);
            else console.log('Successfully logged to Supabase:', pumpStatus);
        } catch (err) {
            console.error('Database Exception:', err);
        }
    }

    // ==========================================
    // 2. MQTT CLOUD CONNECTION (HIVEMQ SECURE)
    // ==========================================
    if (typeof mqtt !== 'undefined') {
        // HIVEMQ WEBSOCKET CONFIGURATION
        const brokerUrl = 'wss:f8877d3a2d5946f1864f539b404e12c8.s1.eu.hivemq.cloud:8884/mqtt';
        const mqttOptions = {
            clientId: 'solar_dashboard_' + Math.random().toString(16).substring(2, 8),
            username: 'solar_admin',
            password: 'Adm_123_in',
            reconnectPeriod: 1000
        };


        const client = mqtt.connect(brokerUrl, mqttOptions);

        client.on('connect', () => {
            console.log('Connected to HiveMQ Secure Cloud!');
            if (networkStatus) {
                networkStatus.innerText = currentLang === 'EN' ? 'Online (HiveMQ)' : 'Lórí Íńtánẹ́ẹ̀tì (HiveMQ)';
                networkStatus.classList.remove('text-muted', 'text-red');
                networkStatus.classList.add('text-green');
            }

            client.subscribe('solar/pump/status');
            client.subscribe('solar/reservoir/level');
            client.subscribe('solar/battery/voltage'); 
        });

        client.on('message', (topic, message) => {
            const payload = message.toString();
            console.log(`Received from ${topic}: ${payload}`);

            if (topic === 'solar/pump/status') {
                if (payload === 'ON' && !isSystemOn) {
                    isSystemOn = true;
                    if (statusCard) statusCard.classList.add('system-is-on');
                    updateTextUI();
                } else if (payload === 'OFF' && isSystemOn) {
                    isSystemOn = false;
                    if (statusCard) statusCard.classList.remove('system-is-on');
                    updateTextUI();
                }
            } 
            else if (topic === 'solar/reservoir/level') {
                const level = parseInt(payload, 10);
                if (!isNaN(level)) window.setWaterLevel(level);
            }
            else if (topic === 'solar/battery/voltage') {
                // Expecting a payload like "15.6"
                if (batteryStatus) {
                    batteryStatus.innerText = `${payload}V`;
                }
            }
        });

        client.on('error', (err) => {
            console.error('MQTT Connection error: ', err);
            if (networkStatus) {
                networkStatus.innerText = currentLang === 'EN' ? 'Offline' : 'Àìlo Íńtánẹ́ẹ̀tì';
                networkStatus.classList.remove('text-green');
                networkStatus.classList.add('text-red');
            }
        });

        // Attach click listener for Pump Button
        if (mainToggleBtn) {
            mainToggleBtn.addEventListener('click', () => {
                isSystemOn = !isSystemOn;
                
                if (isSystemOn) {
                    if (statusCard) statusCard.classList.add('system-is-on');
                    client.publish('solar/pump/command', 'ON');
                    logCleaningEvent('ON');
                } else {
                    if (statusCard) statusCard.classList.remove('system-is-on');
                    client.publish('solar/pump/command', 'OFF');
                    logCleaningEvent('OFF');
                }
                updateTextUI();
            });
        }

    } else {
        console.error("MQTT library not found!");
    }

    // ==========================================
    // 3. UI & TRANSLATION LOGIC
    // ==========================================
    
    // Global function to update the horizontal progress bar
    window.setWaterLevel = function(percentage) {
        const level = Math.max(0, Math.min(percentage, 100));
        console.log(`Setting water level to: ${level}%`);
        
        if (waterFill && waterLevelPct) {
            waterFill.style.width = `${level}%`; // Changes width for horizontal bar
            waterLevelPct.textContent = `${level}%`;
        }

        if (level <= LOW_WATER_THRESHOLD) {
            if (alertText) {
                alertText.innerText = currentLang === 'EN' ? 'Low Water Level! Refill Needed.' : 'Omi ti Dínkù! Jọ̀wọ́ Ro Omi Kún.';
                alertText.style.color = '#ef4444'; // Red alert
            }
        } else {
            if (alertText) {
                alertText.innerText = currentLang === 'EN' ? 'Sensor: Active' : 'Sẹnsọ: Nṣiṣẹ';
                alertText.style.color = '#888'; // Normal grey
            }
        }
    };

    const translations = {
        'EN': {
            'headerTitle': 'Clear Panel IoT',
            'statusLabel': 'SYSTEM STATUS',
            'statusDry': 'Standby / Dry',
            'statusWet': 'Cleaning Active...',
            'powerOn': 'Start Cleaning',
            'powerOff': 'Stop Pump',
            'scheduleLabel': 'ROUTINE SCHEDULE',
            'wedLabel': 'Wednesdays',
            'sunLabel': 'Sundays',
            'editBtn': 'Edit Schedule',
            'networkLabel': 'NETWORK & TELEMETRY',
            'connLabel': 'Connection',
            'overrideLabel': 'Manual Override',
            'overrideValue': 'Enabled',
            'alertNormal': 'Sensor: Active',
            'alertLow': 'Low Water Level! Refill Needed.'
        },
        'YR': {
            'headerTitle': 'Ẹrọ Ìfọ́ Sola',
            'statusLabel': 'IPÒ ETO',
            'statusDry': 'O Wa Ní Imurasilẹ / O Gbẹ',
            'statusWet': 'O N Fọ lọwọ...',
            'powerOn': 'Bẹrẹ Si Ni Fọ',
            'powerOff': 'Pa Pọmpu',
            'scheduleLabel': 'ETO ÀKÓKÒ',
            'wedLabel': 'Ọjọ́ Ìrú',
            'sunLabel': 'Ọjọ́ Àìkú',
            'editBtn': 'Ṣatunṣe Eto',
            'networkLabel': 'NẸTIWỌỌKI ATI INÁ',
            'connLabel': 'Isopọ',
            'overrideLabel': 'Iṣakoso Ọwọ́',
            'overrideValue': 'O Wa Ní Ṣíṣe',
            'alertNormal': 'Sẹnsọ: Nṣiṣẹ',
            'alertLow': 'Omi ti Dínkù! Jọ̀wọ́ Ro Omi Kún.'
        }
    };

    // Theme Toggle
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = bodyElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                bodyElement.setAttribute('data-theme', 'light');
                themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            } else {
                bodyElement.setAttribute('data-theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        });
    }

    // Language Toggle
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'EN' ? 'YR' : 'EN';
            langToggleBtn.innerText = currentLang;
            updateTextUI();
        });
    }

    function updateTextUI() {
        const setElementText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setElementText('headerTitle', translations[currentLang].headerTitle);
        setElementText('statusLabel', translations[currentLang].statusLabel);
        setElementText('scheduleLabel', translations[currentLang].scheduleLabel);
        setElementText('wedLabel', translations[currentLang].wedLabel);
        setElementText('sunLabel', translations[currentLang].sunLabel);
        setElementText('editBtn', translations[currentLang].editBtn);
        setElementText('networkLabel', translations[currentLang].networkLabel);
        setElementText('connLabel', translations[currentLang].connLabel);
        setElementText('overrideLabel', translations[currentLang].overrideLabel);
        setElementText('overrideValue', translations[currentLang].overrideValue);

        if (isSystemOn) {
            setElementText('statusText', translations[currentLang].statusWet);
            setElementText('powerText', translations[currentLang].powerOff);
        } else {
            setElementText('statusText', translations[currentLang].statusDry);
            setElementText('powerText', translations[currentLang].powerOn);
        }

        // Update alert text based on current water level
        if (alertText) {
            const currentPct = parseInt(waterLevelPct?.textContent || "100", 10);
            if (currentPct <= LOW_WATER_THRESHOLD) {
                alertText.innerText = translations[currentLang].alertLow;
            } else {
                alertText.innerText = translations[currentLang].alertNormal;
            }
        }
    }

    // Initialize UI
    updateTextUI();
});