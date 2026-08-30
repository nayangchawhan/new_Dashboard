import React, { useState } from 'react';
import SensorCard from '../components/SensorCard';
import SafeModeCard from '../components/SafeModeCard';
import LightCard from '../components/LightCard';
import ScheduleCard from '../components/ScheduleCard';
import HubTempCard from '../components/HubTempCard';
import LightDetailModal from '../components/LightDetailModal';
import { toggleLight, toggleSafeMode } from '../services/firebase';
import { emitTelemetryEvent } from '../services/api';

export default function DashboardPage({ telemetry, history = {}, activeActor = null, onNotify }) {
  const [selectedLight, setSelectedLight] = useState(null);

  const isOwner = !activeActor || activeActor.type === 'owner' || activeActor.role === 'Owner';
  const perms = activeActor?.permissions || {};
  const isAllowedLight = (num) => isOwner || (activeActor?.allowedDevices && activeActor.allowedDevices.includes(`light${num}`));
  const canAccessSafeMode = isOwner || Boolean(perms.canAccessSafeMode);
  const canEditSchedule = isOwner || Boolean(perms.canEditSchedule);

  const {
    temperature,
    humidity,
    battery,
    hubTemp,
    motion,
    light1,
    light2,
    light3,
    safeMode,
    schedule
  } = telemetry;

  const handleToggleLight = async (num, state) => {
    if (!isAllowedLight(num)) {
      onNotify(`Access Denied: You do not have permission to control Light ${num}.`, 'warning');
      return;
    }

    try {
      await toggleLight(num, state, activeActor);
      await emitTelemetryEvent('device_toggle', { device: `light${num}`, state, actor: activeActor?.name });
      onNotify(`Light ${num} turned ${state ? 'ON' : 'OFF'} (${activeActor?.name || 'Owner'})`, 'success');
    } catch (err) {
      onNotify(`Error updating Light ${num}: ${err.message}`, 'danger');
    }
  };

  const handleToggleSafeMode = async (state) => {
    if (!canAccessSafeMode) {
      onNotify('Access Denied: Master Switch / Safe Mode is restricted to Homeowner / Family.', 'warning');
      return;
    }

    try {
      await toggleSafeMode(state, activeActor);
      await emitTelemetryEvent('device_toggle', { device: 'masterSwitch', state, actor: activeActor?.name });
      onNotify(`Safe Mode ${state ? 'ENABLED (Locked)' : 'DISABLED'} (${activeActor?.name || 'Owner'})`, state ? 'warning' : 'info');
    } catch (err) {
      onNotify(`Error updating Safe Mode: ${err.message}`, 'danger');
    }
  };

  return (
    <div className="dashboard-grid">
      {/* Sensor / Room Telemetry Card */}
      <SensorCard
        temperature={temperature}
        humidity={humidity}
        battery={battery}
        motion={motion}
      />

      {/* Safe Mode Master Switch Card */}
      <SafeModeCard
        safeMode={safeMode}
        isPermitted={canAccessSafeMode}
        onToggle={handleToggleSafeMode}
      />

      {/* Light 1 Card */}
      <LightCard
        title="Light 1"
        lightNum={1}
        state={light1}
        disabled={safeMode}
        isPermitted={isAllowedLight(1)}
        onToggle={(state) => handleToggleLight(1, state)}
        onExpand={() => setSelectedLight(1)}
      />

      {/* Light 2 Card */}
      <LightCard
        title="Light 2"
        lightNum={2}
        state={light2}
        disabled={safeMode}
        isPermitted={isAllowedLight(2)}
        onToggle={(state) => handleToggleLight(2, state)}
        onExpand={() => setSelectedLight(2)}
      />

      {/* Light 3 & Scheduler Card */}
      <ScheduleCard
        light3State={light3}
        disabled={safeMode}
        isPermitted={isAllowedLight(3)}
        canEditSchedule={canEditSchedule}
        activeActor={activeActor}
        scheduleData={schedule}
        onToggleLight3={(state) => handleToggleLight(3, state)}
        onNotify={onNotify}
        onExpand={() => setSelectedLight(3)}
      />

      {/* Hub / Raspberry Pi Temperature Card */}
      <HubTempCard
        hubTemp={hubTemp}
      />

      {/* Light 24-Hour Duration & Session Analytics Modal */}
      {selectedLight && (
        <LightDetailModal
          lightNum={selectedLight}
          title={`Light ${selectedLight}`}
          historyData={
            selectedLight === 1 ? history.light1History :
            selectedLight === 2 ? history.light2History :
            selectedLight === 3 ? history.light3History : {}
          }
          currentState={
            selectedLight === 1 ? light1 :
            selectedLight === 2 ? light2 :
            selectedLight === 3 ? light3 : false
          }
          disabled={safeMode}
          onToggle={(state) => handleToggleLight(selectedLight, state)}
          onClose={() => setSelectedLight(null)}
        />
      )}
    </div>
  );
}
