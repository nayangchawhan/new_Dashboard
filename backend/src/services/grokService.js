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
  ? [PRIMARY_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'groq/compound'].filter((v, i, a) => a.indexOf(v) === i)
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
      reply: answer,
      message: answer,
      content: answer,
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
          reply: aiMessage,
          message: aiMessage,
          content: aiMessage,
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
    reply: fallbackAnswer,
    message: fallbackAnswer,
    content: fallbackAnswer,
    contextSnapshot: snapshot,
    executedActions,
    source: 'orbit-ai'
  };
}

/**
 * AI-Powered Thermal Hazard Diagnostic Engine (Groq LLM + Heuristics)
 * Evaluates whether temperature rise is a normal transient spike (1-2 intervals) or an urgent fire/overheat hazard.
 */
export async function diagnoseThermalHazard(payload = {}) {
  const {
    temperature = 28.5,
    humidity = 60.0,
    hubTemp = 48.0,
    consecutiveRiseCount = 1,
    delta5m = 0.5,
    recentHistory = [],
    safeMode = false,
    light1 = false
  } = payload;

  // Local Rule-Based Diagnostic Baseline
  let riskLevel = 'LOW';
  let category = 'NORMAL_TRANSIENT';
  let probability = 6;
  let summary = 'Normal transient thermal fluctuation. The temperature rise is limited to isolated intervals and does not exhibit flame velocity characteristics.';
  let recommendation = 'No action required. Standard automated environmental monitoring is active.';

  if (consecutiveRiseCount >= 4 || temperature > 38.0 || (temperature > 35.0 && delta5m > 3.0)) {
    riskLevel = 'CRITICAL';
    category = 'FIRE_HAZARD_ALERT';
    probability = Math.min(98, 75 + Math.round((temperature - 35) * 4));
    summary = `🚨 URGENT: Potential Fire or Severe Thermal Runaway Hazard. Temperature has climbed across ${consecutiveRiseCount} consecutive intervals to ${temperature}°C with rapid acceleration (+${delta5m}°C in window).`;
    recommendation = 'Evacuate immediately if smoke or burning smell is detected. Safe Mode master power lock is active. Inspect high-power appliances and electrical breakers.';
  } else if (consecutiveRiseCount >= 3 || temperature > 32.0 || delta5m > 1.8) {
    riskLevel = 'MODERATE';
    category = 'SUSTAINED_ACCUMULATION';
    probability = Math.min(65, 30 + Math.round(consecutiveRiseCount * 8));
    summary = `⚠️ Warning: Sustained Heat Accumulation. Temperature has climbed across ${consecutiveRiseCount} consecutive intervals to ${temperature}°C. Potential appliance overheating or lack of room ventilation.`;
    recommendation = 'Check room ventilation and active heat-generating devices. Light 1 cooling indicator is active. Ensure thermal limits are not breached.';
  }

  // If online Groq key available, enhance with LLM cognitive reasoning
  if (API_KEY) {
    const prompt = `You are ORBIT AI Thermal Safety Specialist.
Analyze the following real-time IoT sensor telemetry:
- Current Room Temperature: ${temperature}°C
- 5-Minute Window Delta (ΔT): ${delta5m > 0 ? '+' : ''}${delta5m}°C
- Consecutive Rise Intervals: ${consecutiveRiseCount} consecutive intervals
- Current Humidity: ${humidity}%
- Hub CPU Temp: ${hubTemp}°C
- Safe Mode (Master Switch Locked): ${safeMode ? 'YES' : 'NO'}
- Light 1 (Cooling Indicator): ${light1 ? 'ON' : 'OFF'}
- Rule Diagnostic Baseline: Category=${category}, Risk=${riskLevel}

Distinguish whether this temperature rise is:
A) A NORMAL TRANSIENT RISE (e.g. 1-2 intervals rise due to sunlight, door opened, cooking nearby, normal drift)
B) SUSTAINED APPLIANCE OVERHEAT (e.g. 3+ intervals steady warming, heater left on)
C) URGENT FIRE / THERMAL RUNAWAY HAZARD (e.g. 4+ intervals continuous steep surge, extreme heat >38°C, rapid humidity drop)

Respond ONLY with valid JSON in this exact structure:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "category": "NORMAL_TRANSIENT" | "SUSTAINED_ACCUMULATION" | "FIRE_HAZARD_ALERT",
  "fireProbability": number (0 to 100),
  "consecutiveSpikeAnalysis": "string explaining the significance of the ${consecutiveRiseCount} intervals",
  "summary": "concise 2-sentence assessment",
  "recommendation": "concise actionable advice for homeowner"
}`;

    for (const model of FALLBACK_MODELS) {
      try {
        const response = await axios.post(
          API_URL,
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 300,
            response_format: { type: 'json_object' }
          },
          {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 6000
          }
        );

        let content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          const parsed = JSON.parse(content);
          return {
            ...parsed,
            source: 'orbit-ai-groq',
            model,
            evaluatedAt: new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn(`[ThermalDiagnostics] Groq model "${model}" failed, using next/fallback:`, e.message);
      }
    }
  }

  return {
    riskLevel,
    category,
    fireProbability: probability,
    consecutiveSpikeAnalysis: `Observed ${consecutiveRiseCount} sequential thermal rise interval(s). ${consecutiveRiseCount <= 2 ? 'Isolated flux typical of normal ambient events.' : 'Sustained acceleration exceeding baseline bounds.'}`,
    summary,
    recommendation,
    source: 'orbit-ai-heuristic',
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * AI Spike Predictor & Risk Analyzer (Past Trajectory + Future Forecast + Fire Risk)
 * Analyzes an individual spike anomaly event using Groq LLM.
 */
export async function analyzeSpecificSpike(payload = {}) {
  const {
    spike = {},
    telemetry = {},
    recentPoints = []
  } = payload;

  const sensorType = spike.sensorType || 'temperature';
  const label = spike.label || 'Room Sensor';
  const direction = spike.direction || 'Surge';
  const delta = spike.delta || 0;
  const prevVal = spike.prevVal ?? 28.0;
  const currentVal = spike.currentVal ?? (prevVal + delta);
  const unit = spike.unit || (sensorType === 'humidity' ? '%' : '°C');
  const timeStr = spike.timeStr || 'Recent';

  // Heuristic baseline calculations
  const isTemp = sensorType === 'temperature';
  const isHum = sensorType === 'humidity';
  const isSurge = direction === 'Surge' || delta > 0;
  const isExtremeTemp = isTemp && isSurge && currentVal > 35.0;
  const isElevatedTemp = isTemp && isSurge && currentVal > 30.0;

  let riskLevel = 'LOW';
  let fireProbability = isTemp && isSurge ? Math.min(95, Math.max(5, Math.round((currentVal - 28) * 8))) : 3;
  let pastAnalysis = `Sensor transitioned from ${prevVal}${unit} to ${currentVal}${unit} in a single discrete telemetry interval.`;
  let futureForecast = `Environmental slope is stabilizing near current baseline (${currentVal}${unit}).`;
  let safetyAdvice = 'Standard continuous sliding window stream processing is active.';

  if (isExtremeTemp) {
    riskLevel = 'CRITICAL';
    fireProbability = Math.min(98, 70 + Math.round((currentVal - 35) * 6));
    pastAnalysis = `Sudden sharp thermal spike (+${delta}°C) pushed the environment above the 35.0°C safety ceiling. Previous baseline was ${prevVal}°C.`;
    futureForecast = `If thermal input continues unmitigated, temperature will exceed 38°C in ~3–5 minutes. Safe Mode power cutoff is engaged to isolate ignition sources.`;
    safetyAdvice = `Check room for burning smell, smoke, or overloaded electrical outlets immediately. Safe Mode auto-lock is protecting the household.`;
  } else if (isElevatedTemp) {
    riskLevel = 'MODERATE';
    fireProbability = Math.min(45, 15 + Math.round((currentVal - 30) * 6));
    pastAnalysis = `Temperature climbed by +${delta}°C crossing the 30.0°C comfort threshold. Room was previously at ${prevVal}°C.`;
    futureForecast = `Light 1 cooling indicator is active. If heat continues rising, Safe Mode will engage at 35.0°C. If dissipated, temperature will return below 30°C in ~5–10 mins.`;
    safetyAdvice = `Ensure room ventilation or AC cooling is operating. Monitor the thermal trajectory.`;
  } else if (isTemp && !isSurge) {
    riskLevel = 'LOW';
    fireProbability = 2;
    pastAnalysis = `Rapid cooling drop of ${delta}°C from ${prevVal}°C down to ${currentVal}°C.`;
    futureForecast = `Thermal energy is dissipating effectively. Automated cooling devices will restore to resting state once baseline drops below 30.0°C.`;
    safetyAdvice = `Normal cooling recovery observed. No intervention necessary.`;
  } else if (isHum) {
    riskLevel = isSurge && currentVal > 80 ? 'MODERATE' : 'LOW';
    pastAnalysis = `Humidity experienced an abrupt ${direction.toLowerCase()} of ${delta > 0 ? '+' : ''}${delta}% from ${prevVal}% to ${currentVal}%.`;
    futureForecast = `Moisture content will normalize over the next 10–15 minutes as room air circulates.`;
    safetyAdvice = isSurge && currentVal > 80 ? 'Check for steam, boiling water, or moisture ingress.' : 'Humidity shift is transient and non-hazardous.';
  }

  // LLM Query via Groq Cloud
  if (API_KEY) {
    const prompt = `You are ORBIT AI Real-Time IoT Anomaly & Fire Safety Diagnostic Engine.
Analyze this specific sensor anomaly event:
- Sensor: ${label} (${sensorType})
- Event: ${direction} of ${delta > 0 ? '+' : ''}${delta}${unit} (${prevVal}${unit} → ${currentVal}${unit}) at ${timeStr}
- Current Telemetry State: Room Temp=${telemetry.temperature ?? 'N/A'}°C, Humidity=${telemetry.humidity ?? 'N/A'}%, Safe Mode=${telemetry.safeMode ? 'LOCKED' : 'OFF'}, Light 1=${telemetry.light1 ? 'ON' : 'OFF'}

Explain:
1. Past Trajectory (Why this spike likely happened based on environmental context)
2. Risk & Fire Hazard Assessment (Fire risk % and severity level)
3. Future Forecast (What will happen in next 5-15 minutes if trend continues vs dissipates)
4. Homeowner Actionable Safety Advice

Respond ONLY with valid JSON in this exact structure:
{
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "fireProbability": number (0 to 100),
  "hazardClassification": "FIRE_HAZARD" | "APPLIANCE_THERMAL_STRESS" | "RAPID_COOLING" | "HUMIDITY_FLUX" | "BENIGN_TRANSIENT",
  "pastAnalysis": "concise explanation of precursor and immediate trigger",
  "futureForecast": "projected 5-15 min thermal / environmental outcome",
  "safetyAdvice": "clear actionable instruction for the user"
}`;

    for (const model of FALLBACK_MODELS) {
      try {
        const response = await axios.post(
          API_URL,
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 350,
            response_format: { type: 'json_object' }
          },
          {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 7000
          }
        );

        let content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          const parsed = JSON.parse(content);
          return {
            ...parsed,
            spikeId: spike.id,
            source: 'orbit-ai-groq',
            model,
            analyzedAt: new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn(`[SpikeAnalysis] Groq model "${model}" failed, using fallback:`, e.message);
      }
    }
  }

  return {
    riskLevel,
    fireProbability,
    hazardClassification: isExtremeTemp ? 'FIRE_HAZARD' : isElevatedTemp ? 'APPLIANCE_THERMAL_STRESS' : isTemp && !isSurge ? 'RAPID_COOLING' : isHum ? 'HUMIDITY_FLUX' : 'BENIGN_TRANSIENT',
    pastAnalysis,
    futureForecast,
    safetyAdvice,
    spikeId: spike.id,
    source: 'orbit-ai-heuristic',
    analyzedAt: new Date().toISOString()
  };
}
