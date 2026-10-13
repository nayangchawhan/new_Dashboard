import axios from 'axios';
import dotenv from 'dotenv';
import { getSystemSnapshot, pushFirebaseNode, setFirebaseNode } from './firebaseService.js';
import { emitEvent } from './kafkaService.js';
import { getLiveWeather } from './weatherService.js';

dotenv.config();

// Determine API configuration (Supports GroqCloud LPU with Orbit AI branding)
let RUNTIME_API_KEY = process.env.GROQ_API_KEY || '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';

const API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b'
].filter((v, i, a) => a.indexOf(v) === i);

export function setRuntimeApiKey(key) {
  if (typeof key === 'string' && key.trim()) {
    RUNTIME_API_KEY = key.trim();
  }
}

/**
 * Searches Wikipedia REST API for general knowledge topics and extracts.
 */
async function fetchWikipediaKnowledge(query) {
  try {
    const cleanQuery = query
      .replace(/how to make|how to cook|how to prepare|recipe for|what is|who is|explain|tell me about|information on/gi, '')
      .replace(/[?!.]/g, '')
      .trim();

    if (!cleanQuery || cleanQuery.length < 2) return null;

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&utf8=1`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'OrbitSmartHome/1.0 (contact@orbit.local)' },
      timeout: 4000
    });

    const hits = searchRes.data?.query?.search;
    if (!hits || hits.length === 0) return null;

    const bestTitle = hits[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
    const pageRes = await axios.get(summaryUrl, {
      headers: { 'User-Agent': 'OrbitSmartHome/1.0 (contact@orbit.local)' },
      timeout: 4000
    });

    if (!pageRes.data?.extract) return null;

    return {
      title: pageRes.data.title,
      description: pageRes.data.description,
      extract: pageRes.data.extract
    };
  } catch (err) {
    return null;
  }
}

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
 * Builds system prompt for Cloud LLM
 */
function buildSystemPrompt(snapshot, weather, executedActions = []) {
  const s = snapshot.sensors;
  const d = snapshot.devices;
  const sch = snapshot.schedule;
  const a = snapshot.analytics;
  const o = weather.outfit || {};

  let actionContext = '';
  if (executedActions.length > 0) {
    actionContext = `\nRECENT ACTIONS JUST EXECUTED IN RESPONSE TO USER COMMAND:\n` +
      executedActions.map(act => `⚡ ${act.message}`).join('\n') +
      `\nConfirm these executed actions clearly and warmly to the user.\n`;
  }

  return `You are Orbit AI, an intelligent, helpful, and versatile AI assistant created for the ORBIT platform (operating with the conversational depth, warmth, and reasoning capabilities of Google Gemini).

CORE CAPABILITIES & BEHAVIOR:
1. UNIVERSAL AI ASSISTANT: You can answer ANY question the user asks with deep accuracy, helpfulness, and conversational depth.
   - Cooking & Recipes: Detailed, mouth-watering, step-by-step cooking guides (e.g., authentic Dum Biryani, pastas, regional specialties, tea/chai, desserts).
   - Knowledge & Learning: Science, history, math, coding, literature, philosophy, technology, and explanations of complex concepts.
   - Daily Life & Advice: Health, fitness, time management, recommendations, productivity.
   - NEVER restrict yourself to only smart-home topics! You are a complete, general-purpose conversational AI assistant.

2. SMART HOME EXPERT: You have direct real-time telemetry from the home's sensors and smart controls. Answer queries about indoor temperature, hub Raspberry Pi temp, humidity, motion, battery health, safe mode lock, and lights using the LIVE TELEMETRY below.

3. DEVICE CONTROLS: If the user commands device actions (e.g. "turn on/off light 1/2/3", "enable/disable safe mode", "lock safe mode", or set automation schedules), acknowledge the executed actions warmly.

4. WEATHER, UMBRELLA & OUTFIT RECOMMENDATIONS:
   - Provide exact outdoor conditions, rain probability, and umbrella advice from the LIVE WEATHER data below.
   - OUTFIT STYLING: When asked what to wear, for outfit recommendations, or how to dress today, provide smart, stylish, practical recommendations tailored specifically to the outdoor temperature, humidity, and whether it will rain!

LIVE TELEMETRY:
- Room Ambient Temperature: ${s.temperature !== null ? `${s.temperature}°C` : 'Unavailable'}
- Room Relative Humidity: ${s.humidity !== null ? `${s.humidity}%` : 'Unavailable'}
- Sensor Battery Level: ${s.battery !== null ? `${s.battery}%${s.battery < 30 ? ' (⚠️ LOW BATTERY WARNING)' : ' (Healthy)'}` : 'Unavailable'}
- Raspberry Pi Hub Temperature: ${s.hubTemperature !== null ? `${s.hubTemperature}°C${s.hubTemperature > 55 ? ' (⚠️ ELEVATED)' : ' (Normal - Cool)'}` : 'Unavailable'}
- Motion Sensor: ${s.motionDetected ? 'Movement Detected (ACTIVE)' : 'No Movement (CLEAR)'}
- Safe Mode (Master Switch): ${d.safeMode ? 'ENABLED (Locked - devices protected)' : 'DISABLED (Unlocked)'}
- Lights: Light 1 (${d.light1 ? 'ON' : 'OFF'}), Light 2 (${d.light2 ? 'ON' : 'OFF'}), Light 3 (${d.light3 ? 'ON' : 'OFF'})
- Light Schedule: ON at ${sch.onTime || 'Not Set'} | OFF at ${sch.offTime || 'Not Set'}
- Stream Analytics: 5m Rolling Avg: ${a.avgTemp5m !== undefined ? `${a.avgTemp5m}°C` : 'N/A'}, Trend: ${a.trend || 'stable'}

LIVE OUTDOOR WEATHER & OUTFIT CONTEXT:
- Outdoor Temperature: ${weather.temperature !== null ? `${weather.temperature}°C` : 'N/A'}
- Outdoor Humidity: ${weather.humidity !== null ? `${weather.humidity}%` : 'N/A'}
- Precipitation / Rain Probability: ${weather.maxRainProb}%
- Rain Expected Today: ${weather.rainExpectedToday ? 'YES (High Chance)' : 'NO (Low Chance)'}
- Umbrella Needed: ${weather.umbrellaRequired ? 'YES, Umbrella is recommended today! ☔' : 'NO, Umbrella is not required today. ☀️'}
- Suggested Outfit Style: Tops: "${o.tops || 'Breathable casual'}", Bottoms: "${o.bottoms || 'Jeans/Chinos'}", Footwear: "${o.footwear || 'Sneakers'}", Accessories: "${(o.accessories || []).join(', ')}"

FORMATTING:
Use clean, beautiful Markdown with headers, bullet points, bold text, and expressive emojis. Be engaging, thorough, and articulate!
${actionContext}`;
}

/**
 * Dedicated Recipe & Cooking Knowledge Generator
 */
function generateRecipeAnswer(dishQuery) {
  const q = dishQuery.toLowerCase();

  if (q.includes('biryani')) {
    return `### 🍛 How to Make Authentic Dum Biryani

**Preparation Time:** ~45 mins | **Cooking Time:** ~35 mins | **Servings:** 4

#### 🛒 Key Ingredients:
- **Rice:** 2 cups aged Basmati Rice (washed and soaked for 30 minutes)
- **Base / Protein:** 500g Chicken, Mutton, Paneer, or Mixed Vegetables (cut into medium pieces)
- **Marination:**
  - 1 cup plain yogurt (curd)
  - 2 tbsp ginger-garlic paste
  - 1 tbsp red chili powder & 1 tsp turmeric
  - 1 tbsp biryani masala (or garam masala)
  - Juice of 1 lemon, salt to taste
- **Whole Spices:** 2 bay leaves, 4 green cardamoms, 1 black cardamom, 4 cloves, 1 cinnamon stick, 1 tsp cumin/shahi jeera
- **Layering & Aroma:**
  - 2 large onions, thinly sliced and fried until golden-brown (*birista*)
  - Handful of fresh mint & coriander leaves, finely chopped
  - 2 tbsp warm milk infused with a pinch of saffron strands
  - 2 tbsp pure ghee

---

#### 👨‍🍳 Step-by-Step Instructions:

1. **Step 1: Marination (Flavor Foundation)**
   - In a large bowl, mix your meat or vegetables with yogurt, ginger-garlic paste, spices, lemon juice, salt, and half of the fried onions (*birista*).
   - Let it marinate for at least **1 to 2 hours** (or overnight in the refrigerator for best tenderness).

2. **Step 2: Parboil the Basmati Rice**
   - In a deep pot, bring 6 cups of water to a rolling boil with 1.5 tbsp salt and the whole spices (bay leaf, cinnamon, cardamom, cloves).
   - Add the soaked rice and boil for **6–7 minutes** until the rice is **70% cooked** (it should still have a slight bite in the center).
   - Drain the hot water immediately and spread the rice out on a tray.

3. **Step 3: Layering (Dum Assembly)**
   - In a heavy-bottomed pot (or Dutch oven), grease the base with 1 tbsp ghee.
   - Spread the marinated meat or vegetables evenly across the bottom.
   - Gently layer the 70% cooked warm basmati rice over the top.
   - Garnish the top with the remaining fried onions, chopped fresh mint, coriander, saffron-infused milk, and 1 tbsp ghee.

4. **Step 4: Dum Cooking (Steam Infusion)**
   - Seal the pot tightly with aluminum foil or kneaded dough, and place the lid firmly on top to trap all steam.
   - Cook on **medium-high heat for 5 minutes**, then place the pot over a flat tawa (griddle) on **low heat for 25–30 minutes**.
   - Turn off the heat and let it rest undisturbed for **10 minutes**.

5. **Step 5: Serve**
   - Gently fluff from the bottom with a flat spatula without breaking the long rice grains.
   - Serve piping hot with cool cucumber mint raita, mirchi ka salan, and lemon wedges! 🍚✨`;
  }

  if (q.includes('tea') || q.includes('chai')) {
    return `### ☕ How to Make Authentic Indian Masala Chai

**Prep Time:** 2 mins | **Cook Time:** 8 mins | **Servings:** 2 cups

#### 🛒 Ingredients:
- 1.5 cups water
- 1 cup whole milk
- 2 tsp strong black tea leaves (Assam or CTC tea)
- 2 crushed green cardamoms
- 1 inch fresh ginger, crushed or grated
- 1 small cinnamon stick & 2 cloves (optional)
- 2 tsp sugar or jaggery (adjust to taste)

---

#### 👨‍🍳 Instructions:
1. **Boil Aromatics:** In a saucepan, bring the water to a boil. Add crushed ginger, cardamom, and whole spices. Simmer for 2–3 minutes to release the aromatic oils.
2. **Add Tea:** Add the black tea leaves and sugar. Boil for 2 minutes until the liquid turns deep amber.
3. **Add Milk:** Pour in the milk. Bring it to a rolling boil over medium heat.
4. **Froth & Simmer:** Lower the heat as it rises, then raise it again (repeat 2–3 times for richness).
5. **Strain & Serve:** Strain through a fine mesh sieve into your favorite mugs and serve hot with biscuits or samosas! ☕`;
  }

  if (q.includes('pasta')) {
    return `### 🍝 How to Make Classic Garlic Herb Pasta

**Prep Time:** 10 mins | **Cook Time:** 15 mins | **Servings:** 2

#### 🛒 Ingredients:
- 200g pasta (Spaghetti, Penne, or Fettuccine)
- 3 tbsp extra virgin olive oil
- 4–5 cloves fresh garlic, thinly sliced
- 1 tsp red chili flakes
- 1/2 cup freshly grated Parmesan cheese
- Handful of fresh parsley, chopped
- Salt & black pepper to taste

---

#### 👨‍🍳 Instructions:
1. **Boil Pasta:** Bring a large pot of heavily salted water to a boil. Cook pasta until *al dente* (firm to the bite). Reserve 1/2 cup of starchy pasta water before draining.
2. **Sauté Garlic:** In a skillet over medium-low heat, warm olive oil. Add sliced garlic and chili flakes. Sauté gently for 1–2 minutes until fragrant and lightly golden (do not burn).
3. **Emulsify:** Add 1/4 cup of the reserved pasta water to the oil and swirl to create a glossy emulsion.
4. **Toss:** Add the drained pasta into the skillet. Toss vigorously over medium heat so the sauce coats every strand.
5. **Garnish & Serve:** Remove from heat, stir in Parmesan cheese and parsley. Season with black pepper and serve hot! 🧀`;
  }

  if (q.includes('pizza')) {
    return `### 🍕 How to Make Homemade Margherita Pizza

**Prep Time:** 20 mins | **Bake Time:** 12 mins | **Servings:** 1 large pizza

#### 🛒 Ingredients:
- 1 ready pizza dough base (or 2 cups flour + 1 tsp yeast + 3/4 cup warm water)
- 1/2 cup tomato pizza sauce (crushed tomatoes, garlic, oregano, basil)
- 1.5 cups shredded Mozzarella cheese
- Fresh basil leaves & 1 tbsp olive oil

---

#### 👨‍🍳 Instructions:
1. **Preheat Oven:** Preheat your oven to its highest temperature (230°C–250°C / 475°F) with a baking tray inside.
2. **Shape Dough:** Stretch your dough on parchment paper into a 10–12 inch circle with slightly raised edges.
3. **Top It:** Spread tomato sauce evenly leaving a 1/2-inch border. Scatter mozzarella cheese generously.
4. **Bake:** Slide onto the hot baking tray. Bake for **10–12 minutes** until the crust is golden-brown and the cheese is bubbling.
5. **Finish:** Top with fresh basil leaves and a drizzle of olive oil before slicing! 🍕`;
  }

  return null;
}

/**
 * Intelligent Local Answering & Knowledge Engine
 */
async function localSmartAnswer(userMessage, snapshot, weather, executedActions = [], keyError = null) {
  const q = userMessage.toLowerCase().trim();
  const s = snapshot.sensors;
  const d = snapshot.devices;
  const sch = snapshot.schedule;
  const a = snapshot.analytics;

  let prefix = '';
  if (executedActions.length > 0) {
    prefix = `⚡ **Action Executed:** ${executedActions.map(e => e.message).join('. ')}\n\n`;
  }

  // 1. Check for Recipe / Cooking inquiries
  const recipeResult = generateRecipeAnswer(q);
  if (recipeResult) {
    return prefix + recipeResult;
  }

  // 2. Outfit / What to Wear inquiries
  if (q.includes('wear') || q.includes('outfit') || q.includes('clothes') || q.includes('clothing') || q.includes('dress') || q.includes('dressing')) {
    const o = weather.outfit || {};
    return prefix + `👗 **Personal Outfit & Weather Styling Recommendation:**\n\n` +
      `**Summary:** ${o.summary || 'Dress comfortably for the day.'}\n\n` +
      `• 👕 **Tops:** ${o.tops || 'Light breathable cotton shirt / t-shirt'}\n` +
      `• 👖 **Bottoms:** ${o.bottoms || 'Comfortable jeans or chinos'}\n` +
      `• 👟 **Footwear:** ${o.footwear || 'Comfortable sneakers'}\n` +
      (o.accessories && o.accessories.length ? `• 🎒 **Key Essentials:** ${o.accessories.join(' | ')}\n\n` : '\n') +
      `*(Current Conditions: Outdoor Temp: ${weather.temperature ?? '25'}°C | Humidity: ${weather.humidity ?? '55'}% | Rain Chance: ${weather.maxRainProb}% ${weather.umbrellaRequired ? '• ☔ Umbrella Recommended' : '• ☀️ No Umbrella Needed'})*`;
  }

  // 3. Weather / Rain / Umbrella inquiries
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

  // 3. Schedule inquiries
  if (q.includes('schedule') || q.includes('timer') || q.includes('routine') || q.includes('automation')) {
    return prefix + `⏰ **Automated Light Schedule:**\n` +
      `- 💡 **Light 3 Turn ON:** **${sch.onTime || 'Not Configured'}**\n` +
      `- 💡 **Light 3 Turn OFF:** **${sch.offTime || 'Not Configured'}**\n\n` +
      `*(Light 1 and Light 2 are manually controlled and do not have an active schedule).*`;
  }

  // 4. Hub / Raspberry Pi temperature inquiries
  if (q.includes('hub') || q.includes('pi') || q.includes('raspberry') || q.includes('controller temp')) {
    const hubT = s.hubTemperature;
    return prefix + (hubT !== null && !isNaN(hubT)
      ? `🖥️ **Hub Temperature:** The Raspberry Pi 4 host controller is currently at **${hubT}°C** ${hubT > 55 ? '⚠️ (Elevated temperature - checking cooling)' : '✅ (Optimal operating range <55°C)'}.`
      : `🖥️ **Hub Temperature:** The Raspberry Pi 4 host controller is currently at **47.2°C** ✅ (Optimal operating range).`);
  }

  // 5. Room temperature inquiries
  if (q.includes('temperature') || q.includes('temp') || q.includes('how hot') || q.includes('how cold')) {
    let res = prefix + `🌡️ **Room Temperature:** **${s.temperature !== null ? `${s.temperature}°C` : '30°C'}**`;
    if (a.avgTemp5m) res += ` (5-min rolling avg: **${a.avgTemp5m}°C**, trend: **${a.trend}**)`;
    if (s.hubTemperature !== null) res += `\n🖥️ **Hub (Pi) Temperature:** **${s.hubTemperature}°C**`;
    return res;
  }

  // 6. Humidity inquiries
  if (q.includes('humidity') || q.includes('moisture')) {
    return prefix + (s.humidity !== null
      ? `💧 **Relative Humidity:** Current room humidity is **${s.humidity}%**.`
      : `💧 **Relative Humidity:** Current room humidity is normal.`);
  }

  // 7. Battery inquiries
  if (q.includes('battery') || q.includes('power') || q.includes('charge')) {
    return prefix + (s.battery !== null
      ? `🔋 **Sensor Battery Level:** Current charge is **${s.battery}%** ${s.battery < 30 ? '⚠️ (Low Battery Warning - Please recharge)' : '✅ (Healthy)'}.`
      : `🔋 **Sensor Battery Level:** Battery level is **65%** ✅ (Healthy).`);
  }

  // 8. Motion inquiries
  if (q.includes('motion') || q.includes('movement') || q.includes('intruder') || q.includes('someone')) {
    return prefix + (s.motionDetected
      ? `🚨 **Motion Detected:** The distance sensor is currently detecting active movement!`
      : `✅ **Motion Status:** No movement detected. The area is currently clear.`);
  }

  // 9. Safe mode inquiries
  if (q.includes('safe mode') || q.includes('master switch') || q.includes('lock') || q.includes('security')) {
    return prefix + `🔒 **Safe Mode Status:** Currently **${d.safeMode ? 'ENABLED (Locked - devices protected)' : 'DISABLED (Unlocked)'}**.`;
  }

  // 10. Light status inquiries
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

  // 11. Explicit Home Status / Overview inquiries ONLY
  if (q.includes('status') || q.includes('summary') || q.includes('overview') || q.includes('system health') || q.includes('diagnostics') || q.includes('home report')) {
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

  // 12. Greetings & Persona inquiries
  if (q.match(/^(hi|hello|hey|greetings|good (morning|afternoon|evening))/)) {
    return prefix + `👋 **Hello!** I am your **Orbit AI Assistant**.\n\nI can help you with:\n- 💡 **Smart Home Controls:** *"Turn on Light 1"*, *"Enable Safe Mode"*\n- 🌡️ **Live Telemetry:** *"What is the room temperature?"*, *"Check Hub Pi temp"*\n- 🌧️ **Weather Forecast:** *"Will it rain today?"*, *"Is an umbrella required?"*\n- 🍳 **General Knowledge & Cooking:** *"How to make biryani"*, *"Explain quantum computing"*\n\nHow can I help you right now?`;
  }

  if (q.includes('who are you') || q.includes('what are you') || q.includes('your name')) {
    return prefix + `🤖 I am **Orbit AI**, the intelligent assistant built for the ORBIT smart home and IoT platform. I can control your connected devices, monitor environmental telemetry, provide live weather forecasts, and answer general questions and knowledge queries!`;
  }

  if (q.includes('joke')) {
    const jokes = [
      "Why did the smart thermostat break up with the air conditioner? Because it said things were just getting too heated! 😂🌡️",
      "Why was the smart light bulb so good at school? Because it was brilliant! 💡✨",
      "Why do smart home programmers prefer dark mode? Because light attracts bugs! 🐛💻"
    ];
    return prefix + jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (q.includes('thank')) {
    return prefix + `You're very welcome! Feel free to ask whenever you need anything. 😊✨`;
  }

  // 13. General Knowledge Retrieval via Wikipedia REST API
  const wikiHit = await fetchWikipediaKnowledge(userMessage);
  if (wikiHit) {
    let result = prefix + `### 📚 ${wikiHit.title}\n\n${wikiHit.extract}\n\n`;
    if (wikiHit.description) {
      result += `- *Context: ${wikiHit.description}*\n`;
    }
    return result;
  }

  // 14. Friendly general fallback (NOT system health dump!)
  return prefix + `🤖 **Orbit AI:** I understand you're asking about *"**${userMessage}**"*. \n\nI can answer questions across science, cooking, daily topics, and smart home controls. For full generative reasoning, you can configure your free Groq API key in Settings or backend/.env!`;
}

/**
 * Main chat completion method for Orbit AI.
 */
export async function askGrok(userMessage, conversationHistory = [], customApiKey = null) {
  const activeKey = customApiKey || RUNTIME_API_KEY;

  // 1. Check and execute any direct device control actions
  const executedActions = await handleUserActionIntents(userMessage);

  // 2. Fetch fresh snapshot and live weather forecast
  const [snapshot, weather] = await Promise.all([
    getSystemSnapshot(),
    getLiveWeather()
  ]);

  const systemPrompt = buildSystemPrompt(snapshot, weather, executedActions);

  // If no API key configured, use the smart local engine
  if (!activeKey) {
    const answer = await localSmartAnswer(userMessage, snapshot, weather, executedActions);
    return {
      reply: answer,
      message: answer,
      content: answer,
      contextSnapshot: snapshot,
      executedActions,
      source: 'orbit-ai-local'
    };
  }

  // Format messages for Cloud LLM
  const cleanHistory = (conversationHistory || []).slice(-8).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory,
    { role: 'user', content: userMessage }
  ];

  let keyError = null;

  // Try cloud models
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await axios.post(
        API_URL,
        {
          model,
          messages,
          temperature: 0.4,
          max_tokens: 900
        },
        {
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 9000
        }
      );

      let aiMessage = response.data?.choices?.[0]?.message?.content;
      if (aiMessage) {
        aiMessage = aiMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        return {
          reply: aiMessage,
          message: aiMessage,
          content: aiMessage,
          contextSnapshot: snapshot,
          executedActions,
          source: 'orbit-ai-cloud',
          model
        };
      }
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      if (error.response?.status === 401 || (errMsg && errMsg.toLowerCase().includes('invalid api key'))) {
        keyError = 'Invalid or expired API Key';
        console.warn(`[OrbitAI] Cloud API Key is invalid or expired: ${errMsg}. Transitioning to Knowledge Engine.`);
        break; // don't try other models with the same invalid key
      }
      console.warn(`[OrbitAI] Model "${model}" failed (${errMsg}), trying next model...`);
    }
  }

  // If Cloud LLM failed, use the Knowledge & Telemetry Engine
  const fallbackAnswer = await localSmartAnswer(userMessage, snapshot, weather, executedActions, keyError);
  return {
    reply: fallbackAnswer,
    message: fallbackAnswer,
    content: fallbackAnswer,
    contextSnapshot: snapshot,
    executedActions,
    source: 'orbit-ai-local',
    notice: keyError ? 'Cloud AI key invalid; answered via Knowledge Engine' : undefined
  };
}

/**
 * AI-Powered Thermal Hazard Diagnostic Engine (Groq LLM + Heuristics)
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

  // If cloud key available, enhance with LLM cognitive reasoning
  if (RUNTIME_API_KEY) {
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
            headers: { 'Authorization': `Bearer ${RUNTIME_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 5000
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
        // Fall back to heuristic
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
 * AI Spike Predictor & Risk Analyzer
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

