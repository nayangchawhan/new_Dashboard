import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Mail,
  MapPin,
  Thermometer,
  Bell,
  Save,
  Send,
  UserPlus,
  Trash2,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Filter,
  Radio,
  Lock,
  Key,
  Home,
  Phone,
  Wifi,
  Battery,
  Droplets,
  Calendar,
  Copy,
  Check,
  Smartphone,
  AlertOctagon,
  Sparkles,
  BarChart2,
  Activity,
  Bot,
  Video,
  Sliders,
  CheckSquare
} from 'lucide-react';
import {
  saveUserProfile,
  addGuest,
  removeGuest,
  subscribeGuests,
  subscribeActivityLogs,
  subscribeUserProfile
} from '../services/firebase';
import { sendTemperatureAlertEmail } from '../services/emailService';

export default function ProfilePage({
  userProfile,
  setUserProfile,
  activeActor,
  setActiveActor,
  telemetry = {},
  onNotify
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'guests' | 'logs'

  // Comprehensive Owner Profile Form State
  const [formData, setFormData] = useState({
    userName: userProfile?.userName || 'Nayan Chawhan',
    email: userProfile?.email || 'nayangc2005@gmail.com',
    secondaryEmail: userProfile?.secondaryEmail || 'admin@orbit.local',
    phone: userProfile?.phone || '+91 9876543210',
    emergencyContactName: userProfile?.emergencyContactName || 'Family Contact',
    emergencyContactPhone: userProfile?.emergencyContactPhone || '+91 9876543211',
    homeName: userProfile?.homeName || 'ORBIT Smart Residence',
    homeAddress: userProfile?.homeAddress || 'Sector 4, Automattrix Heights',
    city: userProfile?.city || 'Bengaluru',
    country: userProfile?.country || 'India',
    location: userProfile?.location || 'ORBIT Smart Home • Living Room Node',
    wifiSsid: userProfile?.wifiSsid || 'ORBIT-IoT-5G',
    threshold: userProfile?.threshold || 30.0,
    lowTempThreshold: userProfile?.lowTempThreshold || 16.0,
    humidityThreshold: userProfile?.humidityThreshold || 70.0,
    batteryThreshold: userProfile?.batteryThreshold || 25.0,
    emailAlertsEnabled: userProfile?.emailAlertsEnabled ?? true,
    autoLockOnBreach: userProfile?.autoLockOnBreach ?? true,
    soundAlertsEnabled: userProfile?.soundAlertsEnabled ?? true,
    role: userProfile?.role || 'Primary Homeowner / Administrator',
    avatar: userProfile?.avatar || '👨‍💼',
    installedDate: userProfile?.installedDate || '2026-01-15'
  });

  const [saving, setSaving] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Guest Management State
  const [guests, setGuests] = useState([]);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [justAddedGuest, setJustAddedGuest] = useState(null);
  const [guestFormData, setGuestFormData] = useState({
    name: '',
    email: '',
    role: 'Guest', // 'Guest' | 'Family Member' | 'Viewer'
    accessExpiry: '24h',
    customKey: '',
    allowedDevices: ['light1', 'light2', 'light3'],
    canAccessAnalytics: true,
    canAccessHealth: true,
    canAccessProfile: true,
    canAccessGestures: true,
    canAccessChatbot: true,
    canAccessSafeMode: true,
    canEditSchedule: true,
    notes: ''
  });

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all'); // 'all' | 'owner_family' | 'guest' | 'system'

  // Subscribe to real-time updates from Firebase
  useEffect(() => {
    const unsubProfile = subscribeUserProfile((p) => {
      if (p) {
        setUserProfile(p);
        setFormData({
          userName: p.userName || 'Nayan Chawhan',
          email: p.email || 'nayangc2005@gmail.com',
          secondaryEmail: p.secondaryEmail || 'admin@orbit.local',
          phone: p.phone || '+91 9876543210',
          emergencyContactName: p.emergencyContactName || 'Family Contact',
          emergencyContactPhone: p.emergencyContactPhone || '+91 9876543211',
          homeName: p.homeName || 'ORBIT Smart Residence',
          homeAddress: p.homeAddress || 'Sector 4, Automattrix Heights',
          city: p.city || 'Bengaluru',
          country: p.country || 'India',
          location: p.location || 'ORBIT Smart Home • Living Room Node',
          wifiSsid: p.wifiSsid || 'ORBIT-IoT-5G',
          threshold: p.threshold || 30.0,
          lowTempThreshold: p.lowTempThreshold || 16.0,
          humidityThreshold: p.humidityThreshold || 70.0,
          batteryThreshold: p.batteryThreshold || 25.0,
          emailAlertsEnabled: p.emailAlertsEnabled ?? true,
          autoLockOnBreach: p.autoLockOnBreach ?? true,
          soundAlertsEnabled: p.soundAlertsEnabled ?? true,
          role: p.role || 'Primary Homeowner / Administrator',
          avatar: p.avatar || '👨‍💼',
          installedDate: p.installedDate || '2026-01-15'
        });
      }
    });

    const unsubGuests = subscribeGuests((list) => {
      setGuests(list);
    });

    const unsubLogs = subscribeActivityLogs((logs) => {
      setActivityLogs(logs);
    });

    return () => {
      unsubProfile();
      unsubGuests();
      unsubLogs();
    };
  }, [setUserProfile]);

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await saveUserProfile(formData);
      setUserProfile(updated);
      onNotify('Comprehensive Owner Profile & System Settings saved to Firebase!', 'success');
    } catch (err) {
      onNotify('Failed to save profile: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Handle Test EmailJS Dispatch
  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    onNotify(`Sending test alert email to ${formData.email} via EmailJS (service_f6r9fah)...`, 'info');

    const result = await sendTemperatureAlertEmail({
      userName: formData.userName,
      temperature: telemetry.temperature ?? 31.5,
      threshold: formData.threshold,
      location: formData.location,
      toEmail: formData.email
    });

    if (result.success) {
      onNotify(`✅ EmailJS Alert successfully delivered to ${formData.email}!`, 'success');
    } else {
      onNotify(`⚠️ EmailJS Notice: ${result.error || 'Check service status in console'}`, 'warning');
    }
    setTestEmailSending(false);
  };

  // Handle Add Guest
  const handleAddGuest = async (e) => {
    e.preventDefault();
    if (!guestFormData.name.trim()) {
      onNotify('Please enter guest name.', 'warning');
      return;
    }

    try {
      const added = await addGuest(guestFormData, activeActor);
      setJustAddedGuest(added);
      onNotify(`Access granted! Generated Passcode: ${added.accessKey}`, 'success');
      setShowAddGuestModal(false);
      setGuestFormData({
        name: '',
        email: '',
        role: 'Guest',
        accessExpiry: '24h',
        customKey: '',
        allowedDevices: ['light1', 'light2', 'light3'],
        canAccessAnalytics: true,
        canAccessHealth: true,
        canAccessProfile: true,
        canAccessGestures: true,
        canAccessChatbot: true,
        canAccessSafeMode: true,
        canEditSchedule: true,
        notes: ''
      });
    } catch (err) {
      onNotify('Error adding guest: ' + err.message, 'danger');
    }
  };

  // Handle Remove Guest
  const handleRemoveGuest = async (guestId, guestName) => {
    if (window.confirm(`Revoke smart home access passcode for ${guestName}?`)) {
      try {
        await removeGuest(guestId, guestName, activeActor);
        if (justAddedGuest?.id === guestId) setJustAddedGuest(null);
        onNotify(`Access revoked for ${guestName}`, 'info');
      } catch (err) {
        onNotify('Error revoking guest access: ' + err.message, 'danger');
      }
    }
  };

  // Copy Passcode helper
  const handleCopyPasscode = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    onNotify(`Copied Passcode "${text}" to clipboard!`, 'info');
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Filter logs
  const filteredLogs = activityLogs.filter((log) => {
    if (logFilter === 'owner_family') return log.actorType === 'owner' || log.actorType === 'family';
    if (logFilter === 'guest') return log.actorType === 'guest';
    if (logFilter === 'system') return log.actorType === 'system' || log.actorType === 'sensor';
    return true;
  });

  // Export Activity Logs CSV
  const handleExportLogsCSV = () => {
    if (!activityLogs.length) return;
    let csv = 'data:text/csv;charset=utf-8,ID,Timestamp,Date,Time,Actor_Name,Actor_Role,Action,Device,State,Details\n';
    activityLogs.forEach((l) => {
      const row = [
        l.id,
        l.timestamp,
        `"${l.dateStr}"`,
        `"${l.timeStr}"`,
        `"${l.actorName}"`,
        `"${l.actorRole}"`,
        `"${l.action}"`,
        `"${l.device}"`,
        `"${l.state}"`,
        `"${l.details}"`
      ].join(',');
      csv += row + '\n';
    });
    const encoded = encodeURI(csv);
    const link = document.createElement('a');
    link.href = encoded;
    link.download = `orbit_activity_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avatarOptions = ['👨‍💼', '👩‍💼', '🧑‍💻', '🏠', '⚡', '🛡️', '👑', '🌟'];

  return (
    <div className="profile-page-container">
      {/* Profile Header Hero Card */}
      <div className="card profile-hero-card">
        <div className="profile-hero-content">
          <div className="profile-avatar-large">{formData.avatar}</div>
          <div className="profile-hero-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {formData.userName}
              </h2>
              <span className="profile-role-badge">
                <Shield size={13} /> {formData.role}
              </span>
              <span className="profile-node-badge">
                <Home size={12} /> {formData.homeName}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              📍 <strong>{formData.location}</strong> ({formData.city}, {formData.country}) • 📧 <strong>{formData.email}</strong> • ⚡ Safety Threshold: <strong>{formData.threshold}°C</strong>
            </p>
          </div>
        </div>

        <div className="profile-hero-actions">
          <button
            type="button"
            className="test-email-btn"
            onClick={handleSendTestEmail}
            disabled={testEmailSending}
            title="Dispatch a live test email using EmailJS service_f6r9fah and template_o5h6xwq"
          >
            <Send size={15} />
            <span>{testEmailSending ? 'Dispatching...' : 'Test Email Alert'}</span>
          </button>
        </div>
      </div>

      {/* Acting Actor Switcher (Owner vs Guest Identity) */}
      <div className="acting-identity-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
          <Key size={16} color="#6366f1" />
          <span>Currently Operating As:</span>
          <strong>{activeActor?.name || formData.userName} ({activeActor?.role || 'Owner'})</strong>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`identity-btn ${(!activeActor || activeActor.role === 'Owner' || activeActor.type === 'owner') ? 'active' : ''}`}
            onClick={() => setActiveActor({ name: formData.userName, role: 'Owner', type: 'owner' })}
          >
            👨‍💼 Owner ({formData.userName})
          </button>
          {guests.map((g) => (
            <button
              key={g.id}
              className={`identity-btn ${activeActor?.id === g.id ? 'active' : ''}`}
              onClick={() => setActiveActor({
                id: g.id,
                name: g.name,
                role: g.role,
                type: g.role === 'Family Member' ? 'family' : 'guest',
                permissions: g.permissions || {},
                allowedDevices: g.allowedDevices || []
              })}
            >
              {g.avatar || '👤'} {g.name} ({g.accessKey || g.role})
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="modal-tabs-bar" style={{ padding: '4px 0' }}>
        <div className="modal-tabs-left">
          <button
            className={`modal-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} /> Owner Profile & Property ({formData.homeName})
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'guests' ? 'active' : ''}`}
            onClick={() => setActiveTab('guests')}
          >
            <Key size={16} /> Guest & Member Access Keys ({guests.length})
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={16} /> Control Audit Logs ({activityLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: OWNER COMPREHENSIVE PROFILE & SETTINGS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="card profile-form-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Comprehensive Homeowner & Smart Property Profile</h3>
              <span className="card-subtitle">
                Configure owner identity, property parameters, safety thresholds, and automated alert destinations
              </span>
            </div>
            <Home size={24} color="#6366f1" />
          </div>

          {/* Section 1: Owner Personal Details */}
          <div className="profile-section-block">
            <h4 className="profile-section-title">
              <User size={16} /> 1. Personal & Contact Information
            </h4>
            <div className="profile-grid">
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">
                  Full Name <span style={{ fontSize: '11px', color: '#6366f1' }}>({`{{user_name}}`})</span>
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  placeholder="e.g. Nayan Chawhan"
                  required
                />
              </div>

              {/* Primary Alert Email */}
              <div className="form-group">
                <label className="form-label">
                  Primary Alert Email <span style={{ fontSize: '11px', color: '#6366f1' }}>({`{{to_email}}`})</span>
                </label>
                <input
                  type="email"
                  className="profile-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. nayangc2005@gmail.com"
                  required
                />
                <span className="form-hint">EmailJS alert emails will be delivered here.</span>
              </div>

              {/* Secondary Email */}
              <div className="form-group">
                <label className="form-label">
                  Secondary / Emergency Email
                </label>
                <input
                  type="email"
                  className="profile-input"
                  value={formData.secondaryEmail}
                  onChange={(e) => setFormData({ ...formData, secondaryEmail: e.target.value })}
                  placeholder="e.g. backup@example.com"
                />
              </div>

              {/* Primary Phone */}
              <div className="form-group">
                <label className="form-label">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="profile-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              {/* Emergency Contact Name */}
              <div className="form-group">
                <label className="form-label">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  placeholder="e.g. Emergency Contact Person"
                />
              </div>

              {/* Emergency Contact Phone */}
              <div className="form-group">
                <label className="form-label">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  className="profile-input"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="e.g. +91 9876543211"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Property & Network Information */}
          <div className="profile-section-block">
            <h4 className="profile-section-title">
              <Home size={16} /> 2. Home Property & Smart Node Location
            </h4>
            <div className="profile-grid">
              {/* Home Title */}
              <div className="form-group">
                <label className="form-label">
                  Property / Home Title
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.homeName}
                  onChange={(e) => setFormData({ ...formData, homeName: e.target.value })}
                  placeholder="e.g. ORBIT Smart Villa"
                />
              </div>

              {/* Node Location */}
              <div className="form-group">
                <label className="form-label">
                  Node / Room Location <span style={{ fontSize: '11px', color: '#6366f1' }}>({`{{location}}`})</span>
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. ORBIT Smart Home • Living Room Node"
                  required
                />
              </div>

              {/* Street Address */}
              <div className="form-group">
                <label className="form-label">
                  Street Address
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.homeAddress}
                  onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                  placeholder="e.g. Sector 4, Smart City"
                />
              </div>

              {/* City & Country */}
              <div className="form-group">
                <label className="form-label">
                  City / State & Country
                </label>
                <div className="city-country-row">
                  <input
                    type="text"
                    className="profile-input"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City (e.g. Bengaluru)"
                  />
                  <input
                    type="text"
                    className="profile-input"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Country (e.g. India)"
                  />
                </div>
              </div>

              {/* Wi-Fi SSID */}
              <div className="form-group">
                <label className="form-label">
                  Hub Wi-Fi SSID
                </label>
                <input
                  type="text"
                  className="profile-input"
                  value={formData.wifiSsid}
                  onChange={(e) => setFormData({ ...formData, wifiSsid: e.target.value })}
                  placeholder="e.g. ORBIT-IoT-5G"
                />
              </div>

              {/* Installation Date */}
              <div className="form-group">
                <label className="form-label">
                  System Setup / Commission Date
                </label>
                <input
                  type="date"
                  className="profile-input"
                  value={formData.installedDate}
                  onChange={(e) => setFormData({ ...formData, installedDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Safety Triggers & Multi-Sensors */}
          <div className="profile-section-block">
            <h4 className="profile-section-title">
              <Thermometer size={16} /> 3. Multi-Sensor Safety Triggers & Thresholds
            </h4>

            {/* High Temperature Safety Box */}
            <div className="threshold-config-box">
              <div className="threshold-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Thermometer size={20} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    High Temperature Alert Threshold <span style={{ fontSize: '11px', color: '#991b1b' }}>({`{{threshold}}`})</span>
                  </h4>
                </div>
                <span className="threshold-value-pill">
                  Trigger at: <strong>{formData.threshold}°C</strong>
                </span>
              </div>

              <div className="threshold-slider-row">
                <input
                  type="range"
                  min="20"
                  max="50"
                  step="0.5"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: '#ef4444', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min="20"
                  max="50"
                  step="0.5"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  className="profile-input"
                  style={{ width: '90px', textAlign: 'center', fontWeight: 700 }}
                />
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0' }}>
                When sensor temperature &gt; <strong>{formData.threshold}°C</strong>, EmailJS automatically sends an alert to <strong>{formData.email}</strong>.
              </p>
            </div>

            {/* Secondary Thresholds Grid */}
            <div className="secondary-thresholds-grid">
              <div style={{ background: '#f0f9ff', padding: '14px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>
                  <Thermometer size={16} /> Low Temperature Alert
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="number"
                    value={formData.lowTempThreshold}
                    onChange={(e) => setFormData({ ...formData, lowTempThreshold: parseFloat(e.target.value) })}
                    className="profile-input"
                    style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>°C (Freeze warning)</span>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                  <Droplets size={16} /> High Humidity Warning
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="number"
                    value={formData.humidityThreshold}
                    onChange={(e) => setFormData({ ...formData, humidityThreshold: parseFloat(e.target.value) })}
                    className="profile-input"
                    style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>% RH (Molds limit)</span>
                </div>
              </div>

              <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#b45309' }}>
                  <Battery size={16} /> Low Battery Notification
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="number"
                    value={formData.batteryThreshold}
                    onChange={(e) => setFormData({ ...formData, batteryThreshold: parseFloat(e.target.value) })}
                    className="profile-input"
                    style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '13px', color: '#b45309', fontWeight: 600 }}>% (Low battery alert)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: System Automation & Toggles */}
          <div className="profile-section-block">
            <h4 className="profile-section-title">
              <Shield size={16} /> 4. Security, Avatar & Notification Toggles
            </h4>

            {/* Avatar Selector */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Select Profile Avatar</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {avatarOptions.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar: av })}
                    style={{
                      fontSize: '22px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: formData.avatar === av ? '2px solid #6366f1' : '1px solid #cbd5e1',
                      background: formData.avatar === av ? '#eef2ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Toggle 1: EmailJS Alerts */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="#6366f1" />
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>Enable Automated EmailJS Alerts</strong>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      Send thermal and critical condition emails to <code>{formData.email}</code>.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.emailAlertsEnabled}
                  onChange={(e) => setFormData({ ...formData, emailAlertsEnabled: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: '#6366f1', cursor: 'pointer' }}
                />
              </div>

              {/* Toggle 2: Auto-Lock Safe Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Lock size={18} color="#ef4444" />
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>Auto-Lock Safe Mode on Motion Intrusion</strong>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      Lock switches and dispatch emergency email alert if motion is detected during Safe Mode.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoLockOnBreach}
                  onChange={(e) => setFormData({ ...formData, autoLockOnBreach: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: '#ef4444', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Save Profile Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="save-profile-btn" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving to Firebase...' : 'Save Comprehensive Profile & Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: GUEST & FAMILY ACCESS PASSCODES */}
      {activeTab === 'guests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Newly Generated Access Passcode Banner */}
          {justAddedGuest && (
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #86efac',
              borderRadius: '16px',
              padding: '18px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 800, fontSize: '16px' }}>
                  <Sparkles size={18} /> Access Key Generated for {justAddedGuest.name}!
                </div>
                <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
                  Share this Passcode with <strong>{justAddedGuest.name}</strong>. They can enter it on the Login page tab: <strong>"🔑 Member / Guest"</strong>.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '2px', color: '#0f766e', background: '#ffffff', padding: '6px 14px', borderRadius: '8px', border: '1px solid #99f6e4' }}>
                  {justAddedGuest.accessKey}
                </span>
                <button
                  type="button"
                  className="add-guest-btn"
                  onClick={() => handleCopyPasscode(justAddedGuest.accessKey, 'banner')}
                  style={{ background: '#059669' }}
                >
                  {copiedKeyId === 'banner' ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedKeyId === 'banner' ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Top Access Control Header Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '18px 20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Family & Guest Unique Access Codes
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Generate unique passcodes allowing family members and guests to log into this smart hub directly from the login page
              </span>
            </div>
            <button className="add-guest-btn" onClick={() => setShowAddGuestModal(true)}>
              <UserPlus size={16} /> Generate Member Passcode
            </button>
          </div>

          {/* Guests List */}
          {guests.length === 0 ? (
            <div className="card empty-tab-state">
              <Key size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto' }} />
              <h4 style={{ color: '#475569', margin: '0 0 4px 0' }}>No Active Member Passcodes Generated</h4>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Click "Generate Member Passcode" to grant access to your smart home.
              </p>
            </div>
          ) : (
            <div className="guest-cards-grid">
              {guests.map((guest) => {
                const perms = guest.permissions || {};
                return (
                  <div key={guest.id} className="card guest-card">
                    <div className="guest-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="guest-avatar">{guest.avatar || '👤'}</div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {guest.name}
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {guest.email || 'Direct Passcode Access'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`guest-role-tag ${guest.role === 'Family Member' ? 'family' : 'guest'}`}>
                          {guest.role}
                        </span>
                        <button
                          className="guest-delete-btn"
                          onClick={() => handleRemoveGuest(guest.id, guest.name)}
                          title="Revoke Access"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Unique Passcode Highlight */}
                    <div style={{
                      background: '#f8faff',
                      border: '1px solid #c7d2fe',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#4338ca', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Member Login Passcode
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#1e1b4b', marginTop: '2px' }}>
                          {guest.accessKey || guest.id}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="time-pill-btn"
                        onClick={() => handleCopyPasscode(guest.accessKey || guest.id, guest.id)}
                        style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedKeyId === guest.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        <span>{copiedKeyId === guest.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="guest-card-body">
                      <div className="guest-info-row">
                        <Clock size={13} />
                        <span>Access Expiry: <strong>{guest.accessExpiry === 'permanent' ? 'Permanent' : guest.accessExpiry.toUpperCase()}</strong></span>
                      </div>

                      <div className="guest-info-row">
                        <Lock size={13} />
                        <span>Allowed Devices: <strong>{(guest.allowedDevices || []).map(d => d.toUpperCase()).join(', ') || 'Read-Only (None)'}</strong></span>
                      </div>

                      {/* Permissions overview badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {guest.role === 'Family Member' ? (
                          <>
                            {perms.canAccessAnalytics && <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>📊 Analytics</span>}
                            {perms.canAccessHealth && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>🩺 Health</span>}
                            {perms.canAccessProfile && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>👤 Profile</span>}
                            {perms.canAccessSafeMode && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>🔒 Safe Mode</span>}
                            {perms.canEditSchedule && <span style={{ fontSize: '10px', background: '#f3e8ff', color: '#6b21a8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>⏰ Scheduler</span>}
                          </>
                        ) : (
                          <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            🔒 Health, Analytics & Profile Disabled
                          </span>
                        )}
                      </div>

                      {guest.notes && (
                        <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          "{guest.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Guest / Family Member Modal with Granular Permission Questions */}
          {showAddGuestModal && (
            <div className="metric-modal-backdrop" onClick={() => setShowAddGuestModal(false)}>
              <div className="metric-modal-container" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                <div className="metric-modal-header">
                  <div className="metric-modal-header-left">
                    <div className="metric-modal-icon-badge" style={{ background: '#6366f1' }}>
                      <Key size={22} color="#ffffff" />
                    </div>
                    <div>
                      <h3 className="metric-modal-title">Generate Member Access Passcode</h3>
                      <p className="metric-modal-subtitle">Configure granular permissions and duration</p>
                    </div>
                  </div>
                  <button className="metric-modal-close-btn" onClick={() => setShowAddGuestModal(false)}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddGuest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Member / Guest Name *</label>
                    <input
                      type="text"
                      className="profile-input"
                      value={guestFormData.name}
                      onChange={(e) => setGuestFormData({ ...guestFormData, name: e.target.value })}
                      placeholder="e.g. Alex Smith, Mom, John"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address (Optional)</label>
                    <input
                      type="email"
                      className="profile-input"
                      value={guestFormData.email}
                      onChange={(e) => setGuestFormData({ ...guestFormData, email: e.target.value })}
                      placeholder="e.g. alex@example.com"
                    />
                  </div>

                  <div className="modal-split-row">
                    <div className="form-group">
                      <label className="form-label">Access Role</label>
                      <select
                        className="profile-input"
                        value={guestFormData.role}
                        onChange={(e) => setGuestFormData({ ...guestFormData, role: e.target.value })}
                      >
                        <option value="Guest">Guest (Lights Only)</option>
                        <option value="Family Member">Family Member (Custom Granular Access)</option>
                        <option value="Viewer">Viewer (Read-Only Telemetry)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Access Expiry</label>
                      <select
                        className="profile-input"
                        value={guestFormData.accessExpiry}
                        onChange={(e) => setGuestFormData({ ...guestFormData, accessExpiry: e.target.value })}
                      >
                        <option value="24h">24 Hours</option>
                        <option value="7d">7 Days</option>
                        <option value="30d">30 Days</option>
                        <option value="permanent">Permanent</option>
                      </select>
                    </div>
                  </div>

                  {/* Role-Specific Granular Permission Questions */}
                  {guestFormData.role === 'Family Member' ? (
                    <div style={{ background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#3730a3' }}>
                        <Sliders size={16} /> Family Member Permission Questions
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        Select the dashboard sections and administrative controls permitted for this family member:
                      </div>

                      <div className="family-permissions-grid">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessAnalytics}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessAnalytics: e.target.checked })}
                          />
                          📊 Stream Analytics Page
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessHealth}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessHealth: e.target.checked })}
                          />
                          🩺 Pipeline Health Page
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessProfile}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessProfile: e.target.checked })}
                          />
                          👤 Owner & Property Profile
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessGestures}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessGestures: e.target.checked })}
                          />
                          📹 Camera Gestures
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessChatbot}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessChatbot: e.target.checked })}
                          />
                          🤖 Orbit AI Chatbot
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canAccessSafeMode}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canAccessSafeMode: e.target.checked })}
                          />
                          🔒 Master Safe Mode Switch
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={guestFormData.canEditSchedule}
                            onChange={(e) => setGuestFormData({ ...guestFormData, canEditSchedule: e.target.checked })}
                          />
                          ⏰ Light 3 Scheduler Edit
                        </label>
                      </div>
                    </div>
                  ) : guestFormData.role === 'Guest' ? (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={18} color="#b45309" />
                      <div>
                        <strong>Guest Access Policy:</strong> Health, Analytics, and Profile pages are automatically disabled. Guests only get access to the Dashboard for the selected devices below.
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={18} color="#16a34a" />
                      <div>
                        <strong>Viewer Role:</strong> Real-time read-only view of telemetry. Device toggles are disabled.
                      </div>
                    </div>
                  )}

                  {guestFormData.role !== 'Viewer' && (
                    <div className="form-group">
                      <label className="form-label">Allowed Smart Devices</label>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                        {['light1', 'light2', 'light3'].map((d, i) => (
                          <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={guestFormData.allowedDevices.includes(d)}
                              onChange={(e) => {
                                const list = e.target.checked
                                  ? [...guestFormData.allowedDevices, d]
                                  : guestFormData.allowedDevices.filter(x => x !== d);
                                setGuestFormData({ ...guestFormData, allowedDevices: list });
                              }}
                            />
                            Light {i + 1}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Custom Passcode (Optional - auto-generated if blank)</label>
                    <input
                      type="text"
                      className="profile-input"
                      value={guestFormData.customKey}
                      onChange={(e) => setGuestFormData({ ...guestFormData, customKey: e.target.value.toUpperCase() })}
                      placeholder="e.g. GUEST-ALEX or FM-MOM"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <input
                      type="text"
                      className="profile-input"
                      value={guestFormData.notes}
                      onChange={(e) => setGuestFormData({ ...guestFormData, notes: e.target.value })}
                      placeholder="e.g. Guest staying in 2nd bedroom"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="time-pill-btn" onClick={() => setShowAddGuestModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="save-profile-btn">
                      <Key size={15} /> Generate Passcode
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL & ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className="card" style={{ padding: '20px' }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div>
              <h3 className="card-title">Real-Time Control Logs & Audit Trail</h3>
              <span className="card-subtitle">
                Complete record of actions by Owner, Family Members, Guests, and Automated Sensors
              </span>
            </div>
            <button className="modal-export-btn" onClick={handleExportLogsCSV}>
              <Download size={14} /> Export Audit Log (CSV)
            </button>
          </div>

          {/* Log Filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: `All Events (${activityLogs.length})` },
              { id: 'owner_family', label: 'Owner & Family' },
              { id: 'guest', label: 'Guests' },
              { id: 'system', label: 'Sensors & System' }
            ].map((f) => (
              <button
                key={f.id}
                className={`time-pill-btn ${logFilter === f.id ? 'active' : ''}`}
                onClick={() => setLogFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Log Table */}
          {filteredLogs.length === 0 ? (
            <div className="empty-tab-state">
              <FileText size={32} color="#cbd5e1" style={{ margin: '0 auto 8px auto' }} />
              <p>No activity logs found for the selected filter.</p>
            </div>
          ) : (
            <div className="table-wrapper-box">
              <table className="modal-data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor / User</th>
                    <th>Action</th>
                    <th>Device</th>
                    <th>State</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono" style={{ fontSize: '12px' }}>
                        {log.timeStr} <span style={{ color: '#94a3b8', fontSize: '10px' }}>{log.dateStr}</span>
                      </td>
                      <td>
                        <span className={`actor-badge ${log.actorType || 'system'}`}>
                          {log.actorName} ({log.actorRole})
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#1e293b' }}>
                        {log.action}
                      </td>
                      <td>
                        <span className="device-tag">{log.device}</span>
                      </td>
                      <td>
                        <span className={`table-status-pill ${log.state === 'ON' ? 'text-amber' : log.state === 'OFF' ? 'text-sky' : 'text-indigo'}`}>
                          {log.state}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
