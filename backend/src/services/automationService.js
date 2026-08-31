import {
  getFirebaseNode,
  pushFirebaseNode,
  extractLatestValue,
  parseNumericValue
} from './firebaseService.js';
import { emitEvent } from './kafkaService.js';

let automationInterval = null;
let autoTriggerState = {
  safeModeAutoOn: false,
  light1AutoOn: false,
  lastTemp: null
};

/**
 * Checks live temperature and enforces thermal automation rules:
 * 1. Temp > 35°C => Auto Turn ON Safe Mode (Master Switch), <= 35°C => Auto Turn OFF Safe Mode
 * 2. Temp > 30°C => Auto Turn ON Light 1, <= 30°C => Auto Turn OFF Light 1
 */
export async function evaluateThermalAutomation() {
  try {
    const root = await getFirebaseNode('');
    if (!root) return;

    const rawTemp = extractLatestValue(root.temp);
    const temp = parseNumericValue(rawTemp);
    if (temp === null || isNaN(temp)) return;

    autoTriggerState.lastTemp = temp;

    const rawMaster = extractLatestValue(root.masterSwitch);
    const isSafeModeOn = rawMaster === 1 || rawMaster === true || rawMaster === '1' || rawMaster === 'on' || rawMaster === 'ON';

    const rawL1 = extractLatestValue(root.light1);
    const isLight1On = rawL1 === 1 || rawL1 === true || rawL1 === '1' || rawL1 === 'on' || rawL1 === 'ON';

    // -------------------------------------------------------------
    // RULE 1: Safe Mode (Threshold: 35.0°C)
    // -------------------------------------------------------------
    if (temp > 35.0) {
      if (!isSafeModeOn) {
        console.log(`[ThermalAutomation] 🔒 Temp ${temp}°C > 35°C: Auto-Enabling Safe Mode (Master Switch ON)...`);
        await pushFirebaseNode('masterSwitch', 1);
        autoTriggerState.safeModeAutoOn = true;

        await emitEvent('orbit.devices', {
          type: 'device_toggle',
          device: 'masterSwitch',
          state: true,
          trigger: 'thermal_auto_over_35',
          temperature: temp
        });

        // Log audit trail event
        await pushFirebaseNode('activityLogs', {
          action: 'Auto-Locked Safe Mode (Temp > 35°C)',
          device: 'Safe Mode (Master Switch)',
          state: 'ON',
          actorName: 'Thermal Safety Engine',
          actorRole: 'System Automation',
          actorType: 'system',
          details: `Temperature reached ${temp}°C, exceeding safety limit of 35.0°C.`,
          timestamp: Date.now(),
          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    } else if (temp <= 35.0) {
      if (isSafeModeOn && autoTriggerState.safeModeAutoOn) {
        console.log(`[ThermalAutomation] 🔓 Temp ${temp}°C <= 35°C: Auto-Disabling Safe Mode (Master Switch OFF)...`);
        await pushFirebaseNode('masterSwitch', 0);
        autoTriggerState.safeModeAutoOn = false;

        await emitEvent('orbit.devices', {
          type: 'device_toggle',
          device: 'masterSwitch',
          state: false,
          trigger: 'thermal_auto_restore_35',
          temperature: temp
        });

        // Log audit trail event
        await pushFirebaseNode('activityLogs', {
          action: 'Auto-Unlocked Safe Mode (Temp <= 35°C)',
          device: 'Safe Mode (Master Switch)',
          state: 'OFF',
          actorName: 'Thermal Safety Engine',
          actorRole: 'System Automation',
          actorType: 'system',
          details: `Temperature normalized to ${temp}°C, reducing below 35.0°C limit.`,
          timestamp: Date.now(),
          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    }

    // -------------------------------------------------------------
    // RULE 2: Light 1 (Threshold: 30.0°C)
    // -------------------------------------------------------------
    if (temp > 30.0) {
      if (!isLight1On) {
        console.log(`[ThermalAutomation] 💡 Temp ${temp}°C > 30°C: Auto-Switching ON Light 1...`);
        await pushFirebaseNode('light1', 1);
        autoTriggerState.light1AutoOn = true;

        await emitEvent('orbit.devices', {
          type: 'device_toggle',
          device: 'light1',
          state: true,
          trigger: 'thermal_auto_over_30',
          temperature: temp
        });

        // Log audit trail event
        await pushFirebaseNode('activityLogs', {
          action: 'Auto-Switched ON Light 1 (Temp > 30°C)',
          device: 'Light 1',
          state: 'ON',
          actorName: 'Thermal Indicator Engine',
          actorRole: 'System Automation',
          actorType: 'system',
          details: `Temperature reached ${temp}°C, exceeding 30.0°C threshold.`,
          timestamp: Date.now(),
          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    } else if (temp <= 30.0) {
      if (isLight1On && autoTriggerState.light1AutoOn) {
        console.log(`[ThermalAutomation] 💡 Temp ${temp}°C <= 30°C: Auto-Switching OFF Light 1...`);
        await pushFirebaseNode('light1', 0);
        autoTriggerState.light1AutoOn = false;

        await emitEvent('orbit.devices', {
          type: 'device_toggle',
          device: 'light1',
          state: false,
          trigger: 'thermal_auto_restore_30',
          temperature: temp
        });

        // Log audit trail event
        await pushFirebaseNode('activityLogs', {
          action: 'Auto-Switched OFF Light 1 (Temp <= 30°C)',
          device: 'Light 1',
          state: 'OFF',
          actorName: 'Thermal Indicator Engine',
          actorRole: 'System Automation',
          actorType: 'system',
          details: `Temperature normalized to ${temp}°C, dropping below 30.0°C threshold.`,
          timestamp: Date.now(),
          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          dateStr: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    }
  } catch (err) {
    console.warn('[ThermalAutomation] Evaluation cycle note:', err.message);
  }
}

/**
 * Initializes continuous background thermal automation monitoring.
 */
export function startThermalAutomationService(intervalMs = 4000) {
  if (automationInterval) clearInterval(automationInterval);

  console.log(`[ThermalAutomation] Service started (Interval: ${intervalMs}ms)`);
  console.log(`   - Rule 1: Temp > 35°C => Auto Turn ON Safe Mode, <= 35°C => Auto Turn OFF`);
  console.log(`   - Rule 2: Temp > 30°C => Auto Turn ON Light 1, <= 30°C => Auto Turn OFF`);

  // Run initial evaluation immediately
  evaluateThermalAutomation();

  automationInterval = setInterval(evaluateThermalAutomation, intervalMs);
  return automationInterval;
}

export function stopThermalAutomationService() {
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
}
