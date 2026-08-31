import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GesturePage from './pages/GesturePage';
import ChatbotPage from './pages/ChatbotPage';
import PipelineHealthPage from './pages/PipelineHealthPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import NotificationToast, { sendAlertEmail } from './components/NotificationToast';
import {
  getDb,
  ref,
  onValue,
  extractLatest,
  extractHistory,
  parseNumeric,
  getStoredActiveDevice,
  switchActiveDevice,
  clearStoredActiveDevice,
  subscribeUserProfile,
  toggleLight,
  toggleSafeMode
} from './services/firebase';
import { sendTemperatureAlertEmail } from './services/emailService';
import { detectSuddenSpike, compute5mWindowMetrics } from './services/streamAnalytics';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentDevice, setCurrentDevice] = useState(() => getStoredActiveDevice());
  const [isConnected, setIsConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [spikeAlerts, setSpikeAlerts] = useState([]);

  // Live Telemetry State
  const [telemetry, setTelemetry] = useState({
    temperature: null,
    humidity: null,
    battery: null,
    hubTemp: null,
    motion: false,
    light1: false,
    light2: false,
    light3: false,
    safeMode: false,
    schedule: { light_schedule_on: '22:00', light_schedule_off: '06:00' }
  });

  // Historical Telemetry for Charts
  const [history, setHistory] = useState({
    tempHistory: { labels: [], values: [], points: [], allPoints: [] },
    humHistory: { labels: [], values: [], points: [], allPoints: [] },
    btryHistory: { labels: [], values: [], points: [], allPoints: [] },
    pitempHistory: { labels: [], values: [], points: [], allPoints: [] },
    light1History: { labels: [], values: [], points: [], allPoints: [] },
    light2History: { labels: [], values: [], points: [], allPoints: [] },
    light3History: { labels: [], values: [], points: [], allPoints: [] }
  });

  // User Profile & Access Control State (Persisted in Firebase)
  const [userProfile, setUserProfile] = useState({
    userName: 'Nayan Chawhan',
    email: 'nayangc2005@gmail.com',
    phone: '+91 9876543210',
    location: 'ORBIT Smart Home • Living Room Node',
    threshold: 30.0,
    emailAlertsEnabled: true,
    role: 'Owner / Administrator',
    avatar: '👨‍💼'
  });

  // Current Acting Actor (Owner or Guest)
  const [activeActor, setActiveActor] = useState({
    name: 'Nayan Chawhan',
    role: 'Owner',
    type: 'owner'
  });

  // Flink Stream Analytics State
  const [analytics, setAnalytics] = useState({
    avgTemp5m: 28.5,
    minTemp: 26.5,
    maxTemp: 30.2,
    trend: 'stable',
    anomalyDetected: false
  });

  // Email alert & spike throttle flags
  const emailSentRef = useRef({
    temp: false,
    battery: false,
    hubTemp: false,
    motion: false
  });

  const lastSpikeTsRef = useRef({
    temp: 0,
    humidity: 0
  });

  // Autonomous Thermal Actuation Flags (Temp > 35°C => Safe Mode ON, Temp > 30°C => Light 1 ON)
  const autoThermalStateRef = useRef({
    safeModeAutoTriggered: false,
    light1AutoTriggered: false
  });

  const notify = (message, type = 'info') => {
    setNotification({ message, type });
  };

  // Device Login / Switch handler
  const handleLoginSuccess = (device, guestActor = null) => {
    const { device: switched } = switchActiveDevice(device);
    setCurrentDevice(switched);
    setIsConnected(false);
    // Reset states for new device
    setTelemetry({
      temperature: null,
      humidity: null,
      battery: null,
      hubTemp: null,
      motion: false,
      light1: false,
      light2: false,
      light3: false,
      safeMode: false,
      schedule: { light_schedule_on: '22:00', light_schedule_off: '06:00' }
    });
    setHistory({
      tempHistory: { labels: [], values: [], points: [], allPoints: [] },
      humHistory: { labels: [], values: [], points: [], allPoints: [] },
      btryHistory: { labels: [], values: [], points: [], allPoints: [] },
      pitempHistory: { labels: [], values: [], points: [], allPoints: [] },
      light1History: { labels: [], values: [], points: [], allPoints: [] },
      light2History: { labels: [], values: [], points: [], allPoints: [] },
      light3History: { labels: [], values: [], points: [], allPoints: [] }
    });

    if (guestActor) {
      setActiveActor({
        id: guestActor.id,
        name: guestActor.name,
        role: guestActor.role,
        type: guestActor.role === 'Family Member' ? 'family' : 'guest',
        permissions: guestActor.permissions || {},
        allowedDevices: guestActor.allowedDevices || ['light1', 'light2', 'light3'],
        isGuest: true
      });
      notify(`Welcome, ${guestActor.name}! Logged in as ${guestActor.role}.`, 'success');
    } else {
      setActiveActor({
        name: userProfile?.userName || 'Nayan Chawhan',
        role: 'Owner',
        type: 'owner'
      });
      notify(`Connected to device ${switched.name || switched.deviceId}`, 'success');
    }
  };

  const handleSwitchDevice = () => {
    clearStoredActiveDevice();
    setCurrentDevice(null);
    setIsConnected(false);
  };

  // Guard activeTab based on activeActor permissions
  useEffect(() => {
    if (!activeActor || activeActor.type === 'owner' || activeActor.role === 'Owner') return;
    const perms = activeActor.permissions || {};
    if (activeTab === 'analytics' && !perms.canAccessAnalytics) setActiveTab('dashboard');
    if (activeTab === 'health' && !perms.canAccessHealth) setActiveTab('dashboard');
    if (activeTab === 'profile' && !perms.canAccessProfile) setActiveTab('dashboard');
    if (activeTab === 'gesture' && !perms.canAccessGestures) setActiveTab('dashboard');
    if (activeTab === 'chatbot' && !perms.canAccessChatbot) setActiveTab('dashboard');
  }, [activeActor, activeTab]);

  // Subscribe to user profile from Firebase
  useEffect(() => {
    const unsubProfile = subscribeUserProfile((p) => {
      if (p) {
        setUserProfile(p);
        setActiveActor(prev => (prev.type === 'owner' ? { name: p.userName, role: 'Owner', type: 'owner' } : prev));
      }
    });
    return () => unsubProfile();
  }, [currentDevice]);

  useEffect(() => {
    if (!currentDevice) return;

    const activeDb = getDb();

    // 1. Temperature Listener
    const tempRef = ref(activeDb, 'temp/');
    const unsubTemp = onValue(tempRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsConnected(true);
        const data = snapshot.val();
        const latestVal = extractLatest(data);
        const numVal = parseNumeric(latestVal);
        const extracted = extractHistory(data, 30);
        
        setTelemetry(prev => ({ ...prev, temperature: numVal }));
        setHistory(prev => {
          // Sudden Spike Detection for Temperature (>= 2.0°C jump)
          const now = Date.now();
          if (now - lastSpikeTsRef.current.temp > 10000) { // throttle 10s
            const spike = detectSuddenSpike('temperature', numVal, prev.tempHistory.values);
            if (spike) {
              lastSpikeTsRef.current.temp = now;
              setSpikeAlerts(curr => [spike, ...curr.slice(0, 15)]);
              notify(spike.message, 'danger');
              sendAlertEmail(numVal, `⚡ Thermal Spike Alert: ${spike.message}`);
            }
          }
          return { ...prev, tempHistory: extracted };
        });

        // Compute 5m analytics from temperature stream
        const metrics = compute5mWindowMetrics(extracted.points || extracted.values, numVal ?? 28.5);
        setAnalytics(prev => ({
          ...prev,
          avgTemp5m: metrics.avgTemp5m,
          minTemp: metrics.minTemp,
          maxTemp: metrics.maxTemp,
          trend: metrics.trend,
          anomalyDetected: metrics.anomalyDetected
        }));

        // Dynamic Alert Check: Temp > userProfile.threshold (Default 30°C)
        const currentThreshold = userProfile.threshold || 30.0;
        if (numVal !== null && numVal > currentThreshold && !emailSentRef.current.temp) {
          notify(`⚠️ High Sensor Temperature: ${numVal}°C! (Threshold > ${currentThreshold}°C)`, 'danger');
          
          // Send automated email via EmailJS (service_f6r9fah / template_o5h6xwq)
          if (userProfile.emailAlertsEnabled !== false) {
            sendTemperatureAlertEmail({
              userName: userProfile.userName,
              temperature: numVal,
              threshold: currentThreshold,
              location: userProfile.location,
              toEmail: userProfile.email
            });
          }
          emailSentRef.current.temp = true;
        } else if (numVal !== null && numVal <= (currentThreshold - 1.0)) {
          emailSentRef.current.temp = false;
        }

        // =========================================================================
        // AUTONOMOUS THERMAL RULES:
        // Rule 1: Temp > 35°C => Auto Turn ON Safe Mode, <= 35°C => Auto Turn OFF
        // Rule 2: Temp > 30°C => Auto Turn ON Light 1, <= 30°C => Auto Turn OFF
        // =========================================================================
        if (numVal !== null && !isNaN(numVal)) {
          // Rule 1: Safe Mode (Threshold: 35.0°C)
          if (numVal > 35.0) {
            setTelemetry(curr => {
              if (!curr.safeMode && !autoThermalStateRef.current.safeModeAutoTriggered) {
                autoThermalStateRef.current.safeModeAutoTriggered = true;
                toggleSafeMode(true, { name: 'Thermal Safety Engine', role: 'System Automation', type: 'system' })
                  .then(() => {
                    notify(`🔒 Critical Temperature ${numVal}°C > 35°C: Auto-Activated Safe Mode (Master Switch Locked)!`, 'danger');
                  })
                  .catch(err => console.warn('[AutoSafeMode] Error:', err));
              }
              return curr;
            });
          } else if (numVal <= 35.0) {
            setTelemetry(curr => {
              if (curr.safeMode && autoThermalStateRef.current.safeModeAutoTriggered) {
                autoThermalStateRef.current.safeModeAutoTriggered = false;
                toggleSafeMode(false, { name: 'Thermal Safety Engine', role: 'System Automation', type: 'system' })
                  .then(() => {
                    notify(`🔓 Temperature normalized (${numVal}°C <= 35°C): Auto-Disabled Safe Mode (Unlocked).`, 'success');
                  })
                  .catch(err => console.warn('[AutoSafeMode] Error:', err));
              }
              return curr;
            });
          }

          // Rule 2: Light 1 (Threshold: 30.0°C)
          if (numVal > 30.0) {
            setTelemetry(curr => {
              if (!curr.light1 && !autoThermalStateRef.current.light1AutoTriggered) {
                autoThermalStateRef.current.light1AutoTriggered = true;
                toggleLight(1, true, { name: 'Thermal Indicator Engine', role: 'System Automation', type: 'system' })
                  .then(() => {
                    notify(`💡 Temperature ${numVal}°C > 30°C: Auto-Switched ON Light 1!`, 'warning');
                  })
                  .catch(err => console.warn('[AutoLight1] Error:', err));
              }
              return curr;
            });
          } else if (numVal <= 30.0) {
            setTelemetry(curr => {
              if (curr.light1 && autoThermalStateRef.current.light1AutoTriggered) {
                autoThermalStateRef.current.light1AutoTriggered = false;
                toggleLight(1, false, { name: 'Thermal Indicator Engine', role: 'System Automation', type: 'system' })
                  .then(() => {
                    notify(`💡 Temperature normalized (${numVal}°C <= 30°C): Auto-Switched OFF Light 1.`, 'info');
                  })
                  .catch(err => console.warn('[AutoLight1] Error:', err));
              }
              return curr;
            });
          }
        }
      }
    });

    // 2. Humidity Listener
    const humRef = ref(activeDb, 'humidity/');
    const unsubHum = onValue(humRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const latestVal = extractLatest(data);
        const numVal = parseNumeric(latestVal);
        const extracted = extractHistory(data, 30);

        setTelemetry(prev => ({ ...prev, humidity: numVal }));
        setHistory(prev => {
          // Sudden Spike Detection for Humidity (>= 6% jump)
          const now = Date.now();
          if (now - lastSpikeTsRef.current.humidity > 10000) {
            const spike = detectSuddenSpike('humidity', numVal, prev.humHistory.values);
            if (spike) {
              lastSpikeTsRef.current.humidity = now;
              setSpikeAlerts(curr => [spike, ...curr.slice(0, 15)]);
              notify(spike.message, 'warning');
            }
          }
          return { ...prev, humHistory: extracted };
        });
      }
    });

    // 3. Battery Listener (handles both btry/ and distbtry/)
    const handleBatterySnapshot = (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const latestVal = extractLatest(data);
        const numVal = parseNumeric(latestVal);
        if (numVal !== null) {
          const extracted = extractHistory(data, 30);
          setTelemetry(prev => ({ ...prev, battery: numVal }));
          setHistory(prev => ({ ...prev, btryHistory: extracted }));

          // Alert check: Battery < 30%
          if (numVal < 30 && !emailSentRef.current.battery) {
            notify(`⚠️ Low Sensor Battery Level: ${numVal}%!`, 'warning');
            sendAlertEmail(numVal, 'Temperature sensor Battery is low! Current Battery level is');
            emailSentRef.current.battery = true;
          } else if (numVal >= 30) {
            emailSentRef.current.battery = false;
          }
        }
      }
    };

    const btryRef = ref(activeDb, 'btry/');
    const unsubBtry = onValue(btryRef, handleBatterySnapshot);

    const distBtryRef = ref(activeDb, 'distbtry/');
    const unsubDistBtry = onValue(distBtryRef, handleBatterySnapshot);

    // 4. Hub Temperature Listener (pitemp)
    const pitempRef = ref(activeDb, 'pitemp/');
    const unsubPiTemp = onValue(pitempRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const latestVal = extractLatest(data);
        const numVal = parseNumeric(latestVal);
        const extracted = extractHistory(data, 30);
        setTelemetry(prev => ({ ...prev, hubTemp: numVal }));
        setHistory(prev => ({ ...prev, pitempHistory: extracted }));

        // Alert check: Hub temp > 59°C
        if (numVal !== null && numVal > 59 && !emailSentRef.current.hubTemp) {
          notify(`🚨 Hub Temperature Alert: ${numVal}°C!`, 'danger');
          sendAlertEmail(numVal, 'The temperature of Hub exceeded the limit! Current temperature is');
          emailSentRef.current.hubTemp = true;
        } else if (numVal !== null && numVal <= 55) {
          emailSentRef.current.hubTemp = false;
        }
      }
    });

    // 5. Motion Sensor Listener (dist)
    const distRef = ref(activeDb, 'dist/');
    const unsubDist = onValue(distRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const latestVal = extractLatest(data);
        const isMotion = latestVal === true || latestVal === 1 || latestVal === 'true' || latestVal === '1' || (typeof latestVal === 'number' && latestVal > 0);
        setTelemetry(prev => ({ ...prev, motion: isMotion }));

        // Safe mode breach alert
        setTelemetry(curr => {
          if (curr.safeMode && isMotion && !emailSentRef.current.motion) {
            notify(`🚨 Motion Detected while Safe Mode is ACTIVE!`, 'danger');
            sendAlertEmail(isMotion, 'Security Alert: Noticed a movement in Safe Mode');
            emailSentRef.current.motion = true;
          } else if (!isMotion) {
            emailSentRef.current.motion = false;
          }
          return curr;
        });
      }
    });

    // 6. Device State Listeners (light1, light2, light3, masterSwitch)
    const light1Ref = ref(activeDb, 'light1/');
    const unsubL1 = onValue(light1Ref, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const val = extractLatest(data);
        const isLightOn = val === 1 || val === true || val === '1' || val === 'on' || val === 'ON';
        const extracted = extractHistory(data, 100);
        setTelemetry(prev => ({ ...prev, light1: isLightOn }));
        setHistory(prev => ({ ...prev, light1History: extracted }));
      }
    });

    const light2Ref = ref(activeDb, 'light2/');
    const unsubL2 = onValue(light2Ref, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const val = extractLatest(data);
        const isLightOn = val === 1 || val === true || val === '1' || val === 'on' || val === 'ON';
        const extracted = extractHistory(data, 100);
        setTelemetry(prev => ({ ...prev, light2: isLightOn }));
        setHistory(prev => ({ ...prev, light2History: extracted }));
      }
    });

    const light3Ref = ref(activeDb, 'light3/');
    const unsubL3 = onValue(light3Ref, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const val = extractLatest(data);
        const isLightOn = val === 1 || val === true || val === '1' || val === 'on' || val === 'ON';
        const extracted = extractHistory(data, 100);
        setTelemetry(prev => ({ ...prev, light3: isLightOn }));
        setHistory(prev => ({ ...prev, light3History: extracted }));
      }
    });

    const masterRef = ref(activeDb, 'masterSwitch/');
    const unsubMaster = onValue(masterRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = extractLatest(snapshot.val());
        setTelemetry(prev => ({ ...prev, safeMode: val === 1 || val === true || val === '1' || val === 'on' || val === 'ON' }));
      }
    });

    // 7. Schedule Listener
    const scheduleRef = ref(activeDb, 'schedule');
    const unsubSchedule = onValue(scheduleRef, (snapshot) => {
      if (snapshot.exists()) {
        setTelemetry(prev => ({ ...prev, schedule: snapshot.val() }));
      }
    });

    return () => {
      unsubTemp();
      unsubHum();
      unsubBtry();
      unsubDistBtry();
      unsubPiTemp();
      unsubDist();
      unsubL1();
      unsubL2();
      unsubL3();
      unsubMaster();
      unsubSchedule();
    };
  }, [currentDevice]);

  // If not logged in / no active device selected, show Login Page
  if (!currentDevice) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeActor={activeActor}
        onSwitchDevice={handleSwitchDevice}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          activeTab={activeTab}
          isConnected={isConnected}
          currentDevice={currentDevice}
          activeActor={activeActor}
          onSwitchDevice={handleSwitchDevice}
        />

        {activeTab === 'dashboard' && (
          <DashboardPage
            telemetry={telemetry}
            history={history}
            activeActor={activeActor}
            onNotify={notify}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPage
            history={history}
            analytics={analytics}
            spikeAlerts={spikeAlerts}
            telemetry={telemetry}
          />
        )}

        {activeTab === 'gesture' && (
          <GesturePage telemetry={telemetry} onNotify={notify} />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotPage telemetry={telemetry} />
        )}

        {activeTab === 'health' && (
          <PipelineHealthPage />
        )}

        {activeTab === 'profile' && (
          <ProfilePage
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            activeActor={activeActor}
            setActiveActor={setActiveActor}
            telemetry={telemetry}
            onNotify={notify}
          />
        )}
      </main>

      {/* Alert / Notification Popup */}
      <NotificationToast
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}
