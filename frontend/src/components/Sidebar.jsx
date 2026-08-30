import React from 'react';
import { Home, BarChart2, Video, Bot, Activity, User, LogOut } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, activeActor, onSwitchDevice }) {
  const isOwner = !activeActor || activeActor.type === 'owner' || activeActor.role === 'Owner';
  const perms = activeActor?.permissions || {};

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={22} />, allowed: isOwner || perms.canAccessDashboard !== false },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={22} />, allowed: isOwner || Boolean(perms.canAccessAnalytics) },
    { id: 'gesture', label: 'Gestures', icon: <Video size={22} />, allowed: isOwner || Boolean(perms.canAccessGestures) },
    { id: 'chatbot', label: 'Orbit AI', icon: <Bot size={22} />, allowed: isOwner || Boolean(perms.canAccessChatbot) },
    { id: 'health', label: 'Health', icon: <Activity size={22} />, allowed: isOwner || Boolean(perms.canAccessHealth) },
    { id: 'profile', label: 'Profile', icon: <User size={22} />, allowed: isOwner || Boolean(perms.canAccessProfile) },
  ];

  const navItems = allNavItems.filter(item => item.allowed);

  return (
    <aside className="sidebar">
      <ul className="sidebar-nav">
        {navItems.map((item) => (
          <li key={item.id} className="sidebar-item">
            <button
              onClick={() => setActiveTab(item.id)}
              className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
              <span className="sidebar-label">{item.label}</span>
              <span className="sidebar-tooltip">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {onSwitchDevice && (
        <div className="sidebar-bottom">
          <button
            onClick={onSwitchDevice}
            className="sidebar-btn logout"
            title="Switch Device / Logout"
            aria-label="Switch Device"
          >
            <LogOut size={20} />
            <span className="sidebar-label">Switch</span>
            <span className="sidebar-tooltip">Switch Device</span>
          </button>
        </div>
      )}
    </aside>
  );
}
