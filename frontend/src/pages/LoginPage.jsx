import React, { useState, useEffect } from 'react';
import logoImg from '../assets/Untitled-3.jpg';
import {
  Cpu,
  Wifi,
  WifiOff,
  PlusCircle,
  LogIn,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Radio,
  Server,
  Key,
  Users
} from 'lucide-react';
import {
  resolveDatabaseUrl,
  testDeviceConnection,
  getRegisteredDevices,
  addDeviceToRegistry,
  removeDeviceFromRegistry,
  loginWithMemberPasscode
} from '../services/firebase';

export default function LoginPage({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'member' | 'register'
  
  // Login Form State
  const [loginDeviceId, setLoginDeviceId] = useState('d5695');
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [loginPingResult, setLoginPingResult] = useState(null);

  // Member / Guest Login State
  const [memberPasscode, setMemberPasscode] = useState('');
  const [isTestingMember, setIsTestingMember] = useState(false);
  const [memberError, setMemberError] = useState(null);
  const [memberSuccess, setMemberSuccess] = useState(null);
  
  // Register Form State
  const [regDeviceId, setRegDeviceId] = useState('');
  const [regDeviceName, setRegDeviceName] = useState('');
  const [regCustomUrl, setRegCustomUrl] = useState('');
  const [regApiKey, setRegApiKey] = useState('');
  const [isTestingReg, setIsTestingReg] = useState(false);
  const [regPingResult, setRegPingResult] = useState(null);
  const [regError, setRegError] = useState(null);

  // Registered Devices Registry
  const [savedDevices, setSavedDevices] = useState([]);

  useEffect(() => {
    loadSavedDevices();
    // Test initial connection for default device
    handleTestPing('d5695', setLoginPingResult, setIsTestingLogin);
  }, []);

  const loadSavedDevices = () => {
    const list = getRegisteredDevices();
    setSavedDevices(list);
  };

  const handleTestPing = async (idOrUrl, setResult, setLoading) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await testDeviceConnection(idOrUrl);
      setResult(res);
    } catch (err) {
      setResult({ online: false, error: err.message, latency: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (deviceId = 'd5695') => {
    const target = savedDevices.find(d => d.deviceId === deviceId) || {
      deviceId,
      name: deviceId === 'd5695' ? 'Primary Hub (d5695)' : `Device ${deviceId}`,
      databaseURL: resolveDatabaseUrl(deviceId)
    };
    onLoginSuccess(target);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanId = loginDeviceId.trim();
    if (!cleanId) return;

    setIsTestingLogin(true);
    const ping = await testDeviceConnection(cleanId);
    setLoginPingResult(ping);
    setIsTestingLogin(false);

    // Proceed to login
    const target = savedDevices.find(d => d.deviceId === cleanId) || {
      deviceId: cleanId,
      name: `Device ${cleanId}`,
      databaseURL: resolveDatabaseUrl(cleanId)
    };
    onLoginSuccess(target);
  };

  const handleMemberLoginSubmit = async (e) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSuccess(null);
    const cleanKey = memberPasscode.trim();
    if (!cleanKey) {
      setMemberError('Please enter your unique Member Passcode / ID.');
      return;
    }

    setIsTestingMember(true);
    const res = await loginWithMemberPasscode(cleanKey);
    setIsTestingMember(false);

    if (res.success) {
      setMemberSuccess(`Authenticated! Welcome ${res.guest.name} (${res.guest.role})`);
      setTimeout(() => {
        onLoginSuccess(res.device, res.guest);
      }, 400);
    } else {
      setMemberError(res.error || 'Invalid passcode.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError(null);
    const cleanId = regDeviceId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) {
      setRegError('Please provide a valid Device ID');
      return;
    }

    const name = regDeviceName.trim() || `Node ${cleanId}`;
    const customUrl = regCustomUrl.trim() ? resolveDatabaseUrl(regCustomUrl.trim()) : resolveDatabaseUrl(cleanId);

    setIsTestingReg(true);
    const ping = await testDeviceConnection(customUrl);
    setRegPingResult(ping);
    setIsTestingReg(false);

    const newDevice = {
      deviceId: cleanId,
      name,
      databaseURL: customUrl,
      apiKey: regApiKey.trim() || undefined,
      registeredAt: new Date().toISOString()
    };

    addDeviceToRegistry(newDevice);
    loadSavedDevices();
    onLoginSuccess(newDevice);
  };

  const handleDeleteDevice = (e, deviceId) => {
    e.stopPropagation();
    const updated = removeDeviceFromRegistry(deviceId);
    setSavedDevices(updated);
  };

  const currentLoginUrl = resolveDatabaseUrl(loginDeviceId);
  const currentRegUrl = regCustomUrl.trim() ? resolveDatabaseUrl(regCustomUrl) : resolveDatabaseUrl(regDeviceId || 'DEVICE_ID');

  return (
    <div className="login-page-container">
      {/* Ambient background glows */}
      <div className="login-bg-glow glow-1"></div>
      <div className="login-bg-glow glow-2"></div>

      <div className="login-modal-card">
        {/* Header Branding */}
        <div className="login-header">
          <img src={logoImg} alt="WAVE Logo" className="login-logo" />
          <div className="login-title-group">
            <h1 className="login-brand-title">WAVE SMART HUB</h1>
            <p className="login-brand-subtitle">Automattrix Real-Time IoT & Stream Control</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="login-tabs">
          <button
            className={`login-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            <LogIn size={15} /> Device Connect
          </button>
          <button
            className={`login-tab-btn ${activeTab === 'member' ? 'active' : ''}`}
            onClick={() => setActiveTab('member')}
          >
            <Key size={15} /> Member / Guest
          </button>
          <button
            className={`login-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <PlusCircle size={15} /> Register Node
          </button>
        </div>

        {/* TAB 2: MEMBER / GUEST PASSCODE LOGIN */}
        {activeTab === 'member' && (
          <div className="login-tab-content">
            <form onSubmit={handleMemberLoginSubmit} className="login-form">
              {memberError && (
                <div className="form-error-banner">
                  <AlertTriangle size={16} />
                  <span>{memberError}</span>
                </div>
              )}

              {memberSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#16a34a" />
                  <span>{memberSuccess}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <Key size={15} /> Unique Member Access Passcode / ID
                </label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="e.g. GUEST-4821 or FM-9102"
                  value={memberPasscode}
                  onChange={(e) => {
                    setMemberPasscode(e.target.value);
                    setMemberError(null);
                  }}
                  autoFocus
                  required
                />
                <span className="input-hint">
                  Enter the unique access passcode generated by the homeowner in their ORBIT Profile page.
                </span>
              </div>

              <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#4338ca' }}>
                  <Users size={14} /> Guest & Family Permissions
                </div>
                <div>
                  Family members enjoy full dashboard controls. Guests receive temporary light control access for configured devices.
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={isTestingMember || !memberPasscode.trim()}
              >
                {isTestingMember ? (
                  <>Validating Passcode...</>
                ) : (
                  <>
                    <Key size={18} />
                    <span>Verify & Enter Dashboard</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 1: LOGIN / CONNECT */}
        {activeTab === 'login' && (
          <div className="login-tab-content">
            <form onSubmit={handleLoginSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">
                  <Cpu size={15} /> Device ID / Node Key
                </label>
                <div className="input-with-button">
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. d5695"
                    value={loginDeviceId}
                    onChange={(e) => {
                      setLoginDeviceId(e.target.value);
                      setLoginPingResult(null);
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="ping-btn"
                    onClick={() => handleTestPing(loginDeviceId, setLoginPingResult, setIsTestingLogin)}
                    disabled={isTestingLogin || !loginDeviceId.trim()}
                    title="Test Device Connection"
                  >
                    {isTestingLogin ? <span className="spinner-mini"></span> : <Radio size={15} />}
                    <span>Test Ping</span>
                  </button>
                </div>
              </div>

              {/* Resolved Endpoint Preview & Live Status */}
              <div className="endpoint-preview-box">
                <div className="endpoint-header">
                  <span className="endpoint-label">Target RTDB Endpoint</span>
                  {loginPingResult && (
                    <span className={`endpoint-status ${loginPingResult.online ? 'online' : 'offline'}`}>
                      {loginPingResult.online ? (
                        <>
                          <Wifi size={12} /> {loginPingResult.latency}ms (Online)
                        </>
                      ) : (
                        <>
                          <WifiOff size={12} /> Unreachable
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="endpoint-url">{currentLoginUrl}</div>
              </div>

              {/* Quick Launch Default Device Button */}
              <div className="quick-connect-banner" onClick={() => handleQuickLogin('d5695')}>
                <div className="quick-connect-left">
                  <div className="pulse-indicator"></div>
                  <div>
                    <div className="quick-connect-title">⚡ Quick Launch Default Device</div>
                    <div className="quick-connect-sub">Primary Hub (d5695) • 1-Click Connect</div>
                  </div>
                </div>
                <ArrowRight size={18} className="quick-arrow" />
              </div>

              {/* Submit Connect Button */}
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isTestingLogin || !loginDeviceId.trim()}
              >
                {isTestingLogin ? (
                  <>Connecting to IoT Device...</>
                ) : (
                  <>
                    <span>Enter Dashboard</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Saved Registered Devices List */}
            {savedDevices.length > 0 && (
              <div className="saved-devices-section">
                <div className="saved-devices-title">
                  <Layers size={14} /> Registered Devices ({savedDevices.length})
                </div>
                <div className="saved-devices-list">
                  {savedDevices.map((dev) => (
                    <div
                      key={dev.deviceId}
                      className={`saved-device-card ${loginDeviceId === dev.deviceId ? 'selected' : ''}`}
                      onClick={() => {
                        setLoginDeviceId(dev.deviceId);
                        handleQuickLogin(dev.deviceId);
                      }}
                    >
                      <div className="saved-device-info">
                        <div className="saved-device-name">
                          {dev.name || `Device ${dev.deviceId}`}
                          {dev.isDefault && <span className="default-pill">Default</span>}
                        </div>
                        <div className="saved-device-id">ID: {dev.deviceId}</div>
                      </div>
                      <div className="saved-device-actions">
                        {!dev.isDefault && (
                          <button
                            type="button"
                            className="delete-device-btn"
                            onClick={(e) => handleDeleteDevice(e, dev.deviceId)}
                            title="Remove Device"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <span className="connect-tag">Connect</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REGISTER NEW DEVICE */}
        {activeTab === 'register' && (
          <div className="login-tab-content">
            <form onSubmit={handleRegisterSubmit} className="login-form">
              {regError && (
                <div className="form-error-banner">
                  <AlertTriangle size={16} />
                  <span>{regError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <Cpu size={15} /> Device ID / Node Key *
                </label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="e.g. d5695, node-sensor-02, rpi-temp-01"
                  value={regDeviceId}
                  onChange={(e) => {
                    setRegDeviceId(e.target.value);
                    setRegPingResult(null);
                  }}
                  required
                />
                <span className="input-hint">Unique identifier from your Firebase Realtime Database URL</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Server size={15} /> Device / Room Display Name
                </label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="e.g. Master Living Room Hub, Terrace Station"
                  value={regDeviceName}
                  onChange={(e) => setRegDeviceName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Radio size={15} /> Custom Firebase RTDB URL (Optional)
                </label>
                <input
                  type="url"
                  className="login-input"
                  placeholder={`https://rasptemp-${regDeviceId || 'DEVICE_ID'}-default-rtdb.firebaseio.com`}
                  value={regCustomUrl}
                  onChange={(e) => {
                    setRegCustomUrl(e.target.value);
                    setRegPingResult(null);
                  }}
                />
                <span className="input-hint">Leave blank to auto-format URL from Device ID</span>
              </div>

              {/* Resolved Endpoint Box */}
              <div className="endpoint-preview-box">
                <div className="endpoint-header">
                  <span className="endpoint-label">Configured URL</span>
                  {regPingResult && (
                    <span className={`endpoint-status ${regPingResult.online ? 'online' : 'offline'}`}>
                      {regPingResult.online ? (
                        <>
                          <CheckCircle2 size={12} /> Reachable ({regPingResult.latency}ms)
                        </>
                      ) : (
                        <>
                          <WifiOff size={12} /> {regPingResult.error || 'Offline'}
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="endpoint-url">{currentRegUrl}</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <ShieldCheck size={15} /> Firebase API Key (Optional)
                </label>
                <input
                  type="password"
                  className="login-input"
                  placeholder="AIzaSy... (uses default if empty)"
                  value={regApiKey}
                  onChange={(e) => setRegApiKey(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="register-actions-row">
                <button
                  type="button"
                  className="ping-btn secondary"
                  onClick={() => handleTestPing(currentRegUrl, setRegPingResult, setIsTestingReg)}
                  disabled={isTestingReg || !regDeviceId.trim()}
                >
                  {isTestingReg ? <span className="spinner-mini"></span> : <Radio size={15} />}
                  <span>Test Connection</span>
                </button>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={isTestingReg || !regDeviceId.trim()}
                >
                  <CheckCircle2 size={18} />
                  <span>Register & Connect</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Security Badge */}
        <div className="login-footer">
          <ShieldCheck size={14} color="#38a169" />
          <span>WAVE Encrypted Real-Time IoT Stream Gateway</span>
        </div>
      </div>
    </div>
  );
}
