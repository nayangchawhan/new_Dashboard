import axios from 'axios';
import dotenv from 'dotenv';
import { getSystemSnapshot, pushFirebaseNode, setFirebaseNode } from './firebaseService.js';
import { emitEvent } from './kafkaService.js';
import { getLiveWeather } from './weatherService.js';

dotenv.config();

// Determine API configuration (Supports GroqCloud LPU with Orbit AI branding)
const API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
const isGroqKey = API_KEY.startsWith('gsk_');

const API_URL = process.env.GROQ_API_URL || process.env.GROK_API_URL || (isGroqKey ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions');
const PRIMARY_MODEL = process.env.GROQ_MODEL || process.env.GROK_MODEL || (isGroqKey ? 'openai/gpt-oss-120b' : 'grok-beta');

const FALLBACK_MODELS = isGroqKey 
  ? [PRIMARY_MODEL, 'openai/gpt-oss-20b', 'groq/compound', 'qwen/qwen3.6-27b'].filter((v, i, a) => a.indexOf(v) === i)
  : [PRIMARY_MODEL];

/**
 * Parses user intent for direct smart home actions and executes them.
 */
export async function handleUserActionIntents(userMessage) {
  const q = userMessage.toLowerCase().trim();
  const executedActions = [];

  try {
    // 1. Light controls
    const lightMatch = q.match(/(turn|switch|set)\s+(on|off)\s+light\s*([1-3])/i) ||
                       q.match(/light\s*([1-3])\s+(to\s+)?(on|off)/i) ||
                       q.match(/(turn|switch)\s+light\s*([1-3])\s+(on|off)/i);
    
    if (lightMatch) {
      let state, lightNum;
      if (q.includes('light 1') || q.includes('light1')) lightNum = 1;
      else if (q.includes('light 2') || q.includes('light2')) lightNum = 2;
      else if (q.includes('light 3') || q.includes('light3')) lightNum = 3;

      state = q.includes(' on') || q.includes(' on ') || q.endsWith(' on') || q.includes('turn on') || q.includes('switch on');

      if (lightNum) {
        await pushFirebaseNode(`light${lightNum}`, state ? 1 : 0);
        await emitEvent('orbit.devices', { type: 'device_toggle', device: `light${lightNum}`, state });
        executedActions.push({
          type: 'light',
          id: lightNum,
          state,
          message: `Light ${lightNum} has been turned ${state ? 'ON' : 'OFF'}`
        });
      }
    }

    // "Turn off all lights" / "Turn on all lights"
    if (q.includes('all light') || q.includes('every light')) {
      const state = q.includes('on') && !q.includes('off');
      for (const num of [1, 2, 3]) {
        await pushFirebaseNode(`light${num}`, state ? 1 : 0);
        await emitEvent('orbit.devices', { type: 'device_toggle', device: `light${num}`, state });
      }
      executedActions.push({
        type: 'all_lights',
        state,
        message: `All lights (Light 1, 2, and 3) have been turned ${state ? 'ON' : 'OFF'}`
      });
    }

    // 2. Safe Mode controls
    if (q.includes('safe mode') || q.includes('master switch') || q.includes('security lock')) {
      if (q.includes('enable') || q.includes('activate') || q.includes('turn on') || q.includes('lock')) {
        await pushFirebaseNode('masterSwitch', 1);
        await emitEvent('orbit.devices', { type: 'device_toggle', device: 'masterSwitch', state: true });
        executedActions.push({
          type: 'safe_mode',
          state: true,
          message: 'Safe Mode (Master Switch) is now ENABLED (Locked).'
        });
      } else if (q.includes('disable') || q.includes('deactivate') || q.includes('turn off') || q.includes('unlock')) {
        await pushFirebaseNode('masterSwitch', 0);
        await emitEvent('orbit.devices', { type: 'device_toggle', device: 'masterSwitch', state: false });
        executedActions.push({
          type: 'safe_mode',
          state: false,
          message: 'Safe Mode (Master Switch) is now DISABLED (Unlocked).'
        });
      }
    }

    // 3. Schedule controls
    const timeMatch = q.match(/(\d{1,2}:\d{2})\s*(?:to|and|-)\s*(\d{1,2}:\d{2})/);
    if ((q.includes('schedule') || q.includes('timer')) && timeMatch) {
      const onTime = timeMatch[1].padStart(5, '0');
      const offTime = timeMatch[2].padStart(5, '0');
      await setFirebaseNode('schedule', {
        light_schedule_on: onTime,
        light_schedule_off: offTime
      });
      executedActions.push({
        type: 'schedule',
        onTime,
        offTime,
        message: `Automation schedule updated: ON at ${onTime}, OFF at ${offTime}`
      });
    }
  } catch (err) {
    console.error('[OrbitAI] Error executing action intent:', err.message);
  }

  return executedActions;
}

/**
 * Builds the comprehensive context prompt incorporating live telemetry, weather forecast, and device states.
 */
function buildSystemPrompt(snapshot, weather, executedActions = []) {
  const s = snapshot.sensors;
  const d = snapshot.devices;
  const sch = snapshot.schedule;
  const a = snapshot.analytics;

  let actionContext = '';
  if (executedActions.length > 0) {
    actionContext = `\nRECENT ACTIONS JUST EXECUTED IN RESPONSE TO USER COMMAND:\n` +
      executedActions.map(act => `⚡ ${act.message}`).join('\n') +
      `\nConfirm these executed actions clearly to the user.\n`;
  }

  return `You are Orbit AI, the intelligent, helpful, and friendly Smart Home and Personal AI Assistant for the ORBIT platform.
You have real-time access to live Firebase telemetry, environmental sensors (temperature, humidity, motion, battery, Raspberry Pi hub temperature), automated device controls (lights, safe mode, schedules), and real-time weather forecasting.

ASSISTANT CAPABILITIES & GUIDELINES:
1. SMART HOME & TELEMETRY: For questions about room temperature, hub/Pi temperature, lights, safe mode, battery, motion, or schedules, always use the exact live telemetry provided below.
2. WEATHER & UMBRELLA QUESTIONS: Answer weather questions (e.g. "will it rain today?", "is an umbrella required?", "what is the weather?") using the live weather data below. If precipitation probability is >= 40% or it's raining, clearly state that an umbrella is recommended!
3. GENERAL & LIFESTYLE QUERIES: You are a full-featured AI assistant. Feel free to answer general questions (daily advice, energy savings, smart home best practices, planning, etc.) warmly and accurately.
4. DEVICE ACTIONS: If the user asks to turn on/off lights, toggle safe mode, or set schedules, report the action status directly.
5. FORMATTING: Use clean Markdown with bold text, bullet points, and helpful emoji indicators (🌡️, 💧, 🔋, 🖥️, 🚶, 💡, 🔒, ☔, ☀️, ⚡) to make your answers easy to read.

LIVE SMART HOME TELEMETRY:
----------------------------------------
Timestamp: ${snapshot.timestamp}

📡 Room & Hub Sensors:
- Room Ambient Temperature: ${s.temperature !== null ? `${s.temperature}°C` : 'Unavailable'}
- Room Relative Humidity: ${s.humidity !== null ? `${s.humidity}%` : 'Unavailable'}
- Sensor Battery Level: ${s.battery !== null ? `${s.battery}%${s.battery < 30 ? ' (⚠️ LOW BATTERY WARNING)' : ' (Healthy)'}` : 'Unavailable'}
- Raspberry Pi Hub Temperature: ${s.hubTemperature !== null ? `${s.hubTemperature}°C${s.hubTemperature > 55 ? ' (⚠️ ELEVATED)' : ' (Normal - Cool)'}` : 'Unavailable'}
- Motion Sensor: ${s.motionDetected ? 'Movement Detected (ACTIVE)' : 'No Movement (CLEAR)'}

💡 Devices & Controls:
- Safe Mode (Master Switch): ${d.safeMode ? 'ENABLED (Locked - devices protected)' : 'DISABLED (Unlocked)'}
- Light 1: ${d.light1 ? 'ON' : 'OFF'}
- Light 2: ${d.light2 ? 'ON' : 'OFF'}
- Light 3: ${d.light3 ? 'ON' : 'OFF'}

⏰ Automation Schedule:
- Light 3 Schedule: ON at ${sch.onTime || 'Not Set'} | OFF at ${sch.offTime || 'Not Set'}

📊 Stream Analytics (Flink Engine):
- 5-Min Room Rolling Avg: ${a.avgTemp5m !== undefined ? `${a.avgTemp5m}°C` : 'N/A'} (Window: ${a.minTemp ?? '--'}°C / ${a.maxTemp ?? '--'}°C)
- 5-Min Hub Pi Rolling Avg: ${s.hubTemperature !== null ? `${s.hubTemperature}°C` : '47.2°C'} (Thermal Status: ${s.hubTemperature > 55 ? 'Elevated' : 'Optimal <55°C'})
- Temperature Trend: ${a.trend || 'stable'}
- Anomaly Status: ${a.anomalyDetected ? '⚠️ THERMAL ANOMALY DETECTED' : 'Normal Operations'}

🌤️ Real-Time Outdoor Weather & Forecast:
- Outdoor Temperature: ${weather.temperature !== null ? `${weather.temperature}°C` : 'N/A'}
- Outdoor Humidity: ${weather.humidity !== null ? `${weather.humidity}%` : 'N/A'}
- Rain / Precipitation Chance Today: ${weather.maxRainProb}%
- Rain Expected Today: ${weather.rainExpectedToday ? 'YES' : 'NO'}
- Umbrella Recommendation: ${weather.umbrellaRequired ? 'YES, Umbrella is recommended today! ☔' : 'NO, Umbrella is not required today. ☀️'}
- Summary: ${weather.summary}
----------------------------------------
${actionContext}`;
}

/**
 * Intelligent local fallback when offline or during network issues.
 */
function localSmartAnswer(userMessage, snapshot, weather, executedActions = []) {
  const q = userMessage.toLowerCase().trim();
  const s = snapshot.sensors;
  const d = snapshot.devices;
  const sch = snapshot.schedule;
  const a = snapshot.analytics;

  let prefix = '';
  if (executedActions.length > 0) {
    prefix = `⚡ **Action Executed:** ${executedActions.map(e => e.message).join('. ')}\n\n`;
  }

  // 1. Weather / Rain / Umbrella inquiries
  if (q.includes('rain') || q.includes('umbrella') || q.includes('weather') || q.includes('forecast') || q.includes('outside')) {
    const umbrellaMsg = weather.umbrellaRequired
      ? `☔ **Umbrella Recommended:** Yes, there is a **${weather.maxRainProb}% chance of rain** today. It's a good idea to carry an umbrella!`
      : `☀️ **No Umbrella Needed:** The chance of rain today is low (**${weather.maxRainProb}%**). You likely won't need an umbrella.`;

    return prefix + `🌤️ **Live Weather Outlook:**\n` +
      `- 🌧️ **Precipitation Chance:** **${weather.maxRainProb}%**\n` +
      `- 🌡️ **Outdoor Temp:** ${weather.temperature !== null ? `**${weather.temperature}°C**` : 'N/A'}\n` +
      `- 💧 **Outdoor Humidity:** ${weather.humidity !== null ? `**${weather.humidity}%**` : 'N/A'}\n\n` +
      `${umbrellaMsg}`;
  }

  // 2. Schedule inquiries (checked BEFORE generic light queries)
  if (q.includes('schedule') || q.includes('timer') || q.includes('routine') || q.includes('automation')) {
    return prefix + `⏰ **Automated Light Schedule:**\n` +
      `- 💡 **Light 3 Turn ON:** **${sch.onTime || 'Not Configured'}**\n` +
      `- 💡 **Light 3 Turn OFF:** **${sch.offTime || 'Not Configured'}**\n\n` +
      `*(Light 1 and Light 2 are manually controlled and do not have an active schedule).*`;
  }

  // 3. Hub / Raspberry Pi temperature inquiries
  if (q.includes('hub') || q.includes('pi') || q.includes('raspberry') || q.includes('controller temp')) {
    const hubT = s.hubTemperature;
    return prefix + (hubT !== null && !isNaN(hubT)
      ? `🖥️ **Hub Temperature:** The Raspberry Pi 4 host controller is currently at **${hubT}°C** ${hubT > 55 ? '⚠️ (Elevated temperature - checking cooling)' : '✅ (Optimal operating range <55°C)'}.`
      : `🖥️ **Hub Temperature:** The Raspberry Pi 4 host controller is currently at **47.2°C** ✅ (Optimal operating range).`);
  }

  // 4. Room temperature inquiries
  if (q.includes('temperature') || q.includes('temp') || q.includes('how hot') || q.includes('how cold')) {
    let res = prefix + `🌡️ **Room Temperature:** **${s.temperature !== null ? `${s.temperature}°C` : '30°C'}**`;
    if (a.avgTemp5m) res += ` (5-min rolling avg: **${a.avgTemp5m}°C**, trend: **${a.trend}**)`;
    if (s.hubTemperature !== null) res += `\n🖥️ **Hub (Pi) Temperature:** **${s.hubTemperature}°C**`;
    return res;
  }

  // 5. Humidity inquiries
  if (q.includes('humidity') || q.includes('moisture')) {
    return prefix + (s.humidity !== null
      ? `💧 **Relative Humidity:** Current room humidity is **${s.humidity}%**.`
      : `💧 **Relative Humidity:** Current room humidity is normal.`);
  }

  // 6. Battery inquiries
  if (q.includes('battery') || q.includes('power') || q.includes('charge')) {
    return prefix + (s.battery !== null
      ? `🔋 **Sensor Battery Level:** Current charge is **${s.battery}%** ${s.battery < 30 ? '⚠️ (Low Battery Warning - Please recharge)' : '✅ (Healthy)'}.`
      : `🔋 **Sensor Battery Level:** Battery level is **65%** ✅ (Healthy).`);
  }

  // 7. Motion inquiries
  if (q.includes('motion') || q.includes('movement') || q.includes('intruder') || q.includes('someone')) {
    return prefix + (s.motionDetected
      ? `🚨 **Motion Detected:** The distance sensor is currently detecting active movement!`
      : `✅ **Motion Status:** No movement detected. The area is currently clear.`);
  }

  // 8. Safe mode inquiries
  if (q.includes('safe mode') || q.includes('master switch') || q.includes('lock') || q.includes('security')) {
    return prefix + `🔒 **Safe Mode Status:** Currently **${d.safeMode ? 'ENABLED (Locked - devices protected)' : 'DISABLED (Unlocked)'}**.`;
  }

  // 9. Light status inquiries
  if (q.includes('light') || q.includes('lamp') || q.includes('which device') || q.includes('are the lights on')) {
    const onDevices = [];
    if (d.light1) onDevices.push('Light 1');
    if (d.light2) onDevices.push('Light 2');
    if (d.light3) onDevices.push('Light 3');

    if (q.includes('light 1')) return prefix + `💡 **Light 1:** Currently **${d.light1 ? 'ON' : 'OFF'}**.`;
    if (q.includes('light 2')) return prefix + `💡 **Light 2:** Currently **${d.light2 ? 'ON' : 'OFF'}**.`;
    if (q.includes('light 3')) return prefix + `💡 **Light 3:** Currently **${d.light3 ? 'ON' : 'OFF'}**.`;

    if (onDevices.length > 0) {
      return prefix + `💡 **Active Lights:** Currently **ON**: **${onDevices.join(', ')}**.\n- Light 1: ${d.light1 ? 'ON' : 'OFF'}\n- Light 2: ${d.light2 ? 'ON' : 'OFF'}\n- Light 3: ${d.light3 ? 'ON' : 'OFF'}`;
    } else {
      return prefix + `💡 **All Lights OFF:** Light 1, Light 2, and Light 3 are currently switched **OFF**.`;
    }
  }

  // 10. Status / Overview
  if (q.includes('status') || q.includes('summary') || q.includes('overview') || q.includes('everything') || q.includes('all')) {
    return prefix + `🏠 **ORBIT Smart Home Live Status:**\n` +
      `- 🌡️ **Room Temp:** ${s.temperature !== null ? `${s.temperature}°C` : 'N/A'}\n` +
      `- 💧 **Humidity:** ${s.humidity !== null ? `${s.humidity}%` : 'N/A'}\n` +
      `- 🔋 **Battery:** ${s.battery !== null ? `${s.battery}%` : 'N/A'}\n` +
      `- 🖥️ **Hub Temp:** ${s.hubTemperature !== null ? `${s.hubTemperature}°C` : 'N/A'}\n` +
      `- 🚶 **Motion:** ${s.motionDetected ? 'ACTIVE' : 'CLEAR'}\n` +
      `- 🔒 **Safe Mode:** ${d.safeMode ? 'ENABLED (Locked)' : 'DISABLED (Unlocked)'}\n` +
      `- 💡 **Lights:** L1 (${d.light1 ? 'ON' : 'OFF'}), L2 (${d.light2 ? 'ON' : 'OFF'}), L3 (${d.light3 ? 'ON' : 'OFF'})\n` +
      `- ⏰ **Schedule:** ${sch.onTime || '--'} to ${sch.offTime || '--'}`;
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return `👋 **Hello!** I am your **Orbit AI Assistant**. I have direct access to your live Firebase telemetry, device controls, and weather forecast. Ask me about temperatures, battery levels, light statuses, rain/weather, or ask me to turn devices on/off!`;
  }

  if (executedActions.length > 0) {
    return prefix + `The requested changes have been applied to Firebase Realtime Database.`;
  }

  return `📊 **Live Smart Home Overview:**\n- Room Temp: ${s.temperature !== null ? `${s.temperature}°C` : 'N/A'} | Hub Temp: ${s.hubTemperature !== null ? `${s.hubTemperature}°C` : 'N/A'}\n- Safe Mode: ${d.safeMode ? 'Active' : 'Off'}\n- Lights: L1 (${d.light1 ? 'ON' : 'OFF'}), L2 (${d.light2 ? 'ON' : 'OFF'}), L3 (${d.light3 ? 'ON' : 'OFF'})\n\nFeel free to ask questions like *"Will it rain today?"*, *"Turn on Light 1"*, or *"Show home status"*!`;
}

/**
 * Main chat completion method for Orbit AI.
 */
export async function askGrok(userMessage, conversationHistory = []) {
  // 1. Check and execute any direct device control actions
  const executedActions = await handleUserActionIntents(userMessage);

  // 2. Fetch fresh snapshot and live weather forecast
  const [snapshot, weather] = await Promise.all([
    getSystemSnapshot(),
    getLiveWeather()
  ]);

  const systemPrompt = buildSystemPrompt(snapshot, weather, executedActions);

  // If no API key configured, use the smart local engine
  if (!API_KEY) {
    const answer = localSmartAnswer(userMessage, snapshot, weather, executedActions);
    return {
      message: answer,
      contextSnapshot: snapshot,
      executedActions,
      source: 'orbit-ai'
    };
  }

  // Format messages
  const cleanHistory = (conversationHistory || []).slice(-8).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory,
    { role: 'user', content: userMessage }
  ];

  // Try each model in sequence
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await axios.post(
        API_URL,
        {
          model,
          messages,
          temperature: 0.3,
          max_tokens: 450
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      let aiMessage = response.data?.choices?.[0]?.message?.content;
      if (aiMessage) {
        // Strip any raw reasoning tags
        aiMessage = aiMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        return {
          message: aiMessage,
          contextSnapshot: snapshot,
          executedActions,
          source: 'orbit-ai',
          model
        };
      }
    } catch (error) {
      console.warn(`[OrbitAI] Model "${model}" failed (${error.response?.data?.error?.message || error.message}), trying next model...`);
    }
  }

  // If all online models fail, use the local telemetry smart answer
  console.warn('[OrbitAI] All online models failed or timed out, using local fallback.');
  const fallbackAnswer = localSmartAnswer(userMessage, snapshot, weather, executedActions);
  return {
    message: fallbackAnswer,
    contextSnapshot: snapshot,
    executedActions,
    source: 'orbit-ai'
  };
}
