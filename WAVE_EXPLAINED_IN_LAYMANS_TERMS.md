# WAVE Smart Hub: The Complete Guide in Plain English (Layman's Terms)

> **What is WAVE?**  
> Imagine having a personal digital butler for your home. It keeps an eye on your room's temperature and humidity, lets you turn lights ON and OFF with sleek buttons, wave your hand in front of your webcam like a magic wand to flip switches, or simply chat in plain English with an AI assistant to control everything. If a room suddenly gets too hot or someone walks in while you're away, it immediately sends you an alert and an email.

---

## Table of Contents
1. [The Big Picture: How WAVE Works in Simple Terms](#1-the-big-picture-how-wave-works-in-simple-terms)
2. [A Step-by-Step Tour of Every Screen & Button](#2-a-step-by-step-tour-of-every-screen--button)
   - [Screen 1: Login & Device Connection (Choosing Your Room)](#screen-1-login--device-connection-choosing-your-room)
   - [Screen 2: Live Smart Controls (Your Digital Remote)](#screen-2-live-smart-controls-your-digital-remote)
   - [Screen 3: Analytics & Smart Charts (Watching Trends & Spikes)](#screen-3-analytics--smart-charts-watching-trends--spikes)
   - [Screen 4: Camera Hand Gestures (Touch-Free Magic Wand)](#screen-4-camera-hand-gestures-touch-free-magic-wand)
   - [Screen 5: Orbit AI Assistant (Your Smart Home Copilot)](#screen-5-orbit-ai-assistant-your-smart-home-copilot)
   - [Screen 6: System Health (The Engine Check Light)](#screen-6-system-health-the-engine-check-light)
3. [Real-Life Stories: A Day in the Life with WAVE](#3-real-life-stories-a-day-in-the-life-with-wave)
4. [Common Questions & Answers (FAQ)](#4-common-questions--answers-faq)

---

## 1. The Big Picture: How WAVE Works in Simple Terms

To understand how the entire project works, imagine 4 simple parts working together like a team:

```
[1. Sensors & Lights in your Room] 
         │ (Sends sensor numbers / Receives switch commands)
         ▼
[2. The Cloud Whiteboard (Firebase)] 
         │ (Stores the numbers so everyone can see them instantly)
         ▼
[3. The Brain (Backend & AI Server)] 
         │ (Calculates averages, detects sudden jumps, listens to AI commands)
         ▼
[4. Your Screen (WAVE Dashboard)]
   (Where you click buttons, see graphs, wave your hand, or chat with AI)
```

1. **The Sensors & Switches (In Your Room)**:  
   Tiny electronic chips measure temperature, humidity, and whether anyone is moving in the room. Relay switches control your physical lights.
2. **The Cloud Whiteboard (Firebase Realtime Database)**:  
   Whenever a sensor takes a reading, it writes the number on a secure online "whiteboard". As soon as a number is written, your dashboard sees it instantly—no need to refresh the page!
3. **The Brain (Node.js & AI Server)**:  
   This computer brain checks if temperatures are safe, calculates trends, processes hand gestures from your camera, and talks to the AI model.
4. **The Dashboard (On Your Phone or Computer Screen)**:  
   A beautiful, futuristic interface where you can see live numbers, tap buttons, view colored graphs, and control your home.

---

## 2. A Step-by-Step Tour of Every Screen & Button

---

### Screen 1: Login & Device Connection (Choosing Your Room)

```
+-------------------------------------------------------------+
|                       WAVE SMART HUB                        |
|                                                             |
|   [ Connect Device ]            [ Register New Device ]     |
|                                                             |
|   Enter Device ID:  [ d5695          ]  [ Test Ping ]       |
|   Status: ✅ Online (32ms response time)                    |
|                                                             |
|   [ ⚡ Quick Launch Default Device (d5695)              -> ]|
|   [ Enter Dashboard                                     -> ]|
|                                                             |
|   Saved Devices:                                            |
|   • Living Room Hub (d5695) - [ Connect ]                   |
+-------------------------------------------------------------+
```

#### What is this screen for?
Think of each smart home box (like a Raspberry Pi in your living room) as having its own unique name tag or phone number—called a **Device ID** (such as `d5695`).

#### What can you do here?
- **Connect in 1 Click**: Just click **"⚡ Quick Launch Default Device (d5695)"** and you are instantly in your dashboard!
- **Test Before You Enter**: Clicking **"Test Ping"** checks if your room's device is currently plugged in and online. It even tells you how fast the connection is (e.g. `32ms`).
- **Register New Rooms**: Have a second smart device in your bedroom or kitchen? Click **"Register New Device"**, give it a name like "Master Bedroom", and save it. It stays in your saved list so you can switch between rooms anytime.
- **Switch Device / Logout**: Inside the dashboard, you can tap the **"Switch Device"** button at the top-right to easily jump to another room.

---

### Screen 2: Live Smart Controls (Your Digital Remote)

```
+-------------------------------------------------------------+
| [ Room Telemetry ]      [ Safe Mode Lock ]   [ Light 1 ]    |
| • Temp: 27.2°C          Status: UNLOCKED     [ (●) ON ]     |
| • Humidity: 54%         [ Lock Master ]                     |
| • Battery: 100%                                             |
| • Motion: Clear                                             |
+-------------------------------------------------------------+
| [ Light 2 ]             [ Light 3 & Timer ]  [ Hub Health ] |
| [ ( ) OFF ]             [ (●) ON ]           • Temp: 48.7°C |
|                         Timer: 22:00 - 06:00 • Status: Cool |
+-------------------------------------------------------------+
```

#### What is this screen for?
This is your main dashboard. It shows you the current conditions in your room and gives you physical control over your lights.

#### What are all the cards and buttons?
1. **Room Telemetry Card**:
   - **Temperature**: Current room temperature (e.g. `27.2°C`).
   - **Humidity**: How dry or humid the air is (e.g. `54%`).
   - **Sensor Battery**: Tells you if the wireless sensor needs charging (turns red if below `30%`).
   - **Motion Sensor**: Shows a green "Clear" badge when no one is around, or turns orange with "Movement Detected" when someone walks by.
2. **Safe Mode (The Security Lock)**:
   - Think of this as the master padlock for your home.
   - When Safe Mode is **ON (Locked)**, all light switches are locked so nobody can accidentally turn them on or off.
   - **Security Alarm**: If Safe Mode is locked and the motion sensor detects someone moving in the room, it immediately triggers an emergency security alert and sends an email to notify you!
3. **Light 1 & Light 2 Switches**:
   - Interactive 3D buttons. Click them, and the green ball smoothly pops up to turn the light ON, or disappears to turn it OFF.
4. **Light 3 & Automatic Night Schedule**:
   - A special light that you can set on an automatic timer.
   - For example: Set **ON time** to `22:00` (10:00 PM) and **OFF time** to `06:00` (6:00 AM). Click **"Update Schedule"** and the system will automatically handle turning the light on and off every day.
5. **Hub Temperature Card**:
   - Shows the temperature of the mini-computer running your home. If it gets too hot (above `55°C`), it warns you before it can overheat.
6. **Automatic Email Alerts**:
   - If room temperature exceeds `30°C`, battery drops below `30%`, or unauthorized motion occurs during Safe Mode, you receive an instant email notification.

---

### Screen 3: Analytics & Smart Charts (Watching Trends & Spikes)

```
+-------------------------------------------------------------+
| ⚡ 5-MINUTE ROLLING WINDOW STREAM ENGINE                    |
| • Room 5m Average: 27.33°C (🟢 Normal)                      |
| • Hub 5m Average:  48.97°C (🟢 Cool)                        |
| • Trend:           Stable (±0.04°C)                         |
+-------------------------------------------------------------+
| [ Room Temperature History ]                                |
| 🟢 Green line when ≤ 30°C   | 🔴 Red line when > 30°C       |
|                                                             |
| ~~~~\______/~~~~~~~~~~~~~~~~~                               |
| (Shows live colored graph line matching exact room values)  |
+-------------------------------------------------------------+
```

#### What is this screen for?
While the main dashboard shows you what's happening *right this second*, the Analytics screen helps you see what happened *over time*.

#### What do these smart features do?
1. **Why do we need a "5-Minute Rolling Average"?**
   - If someone briefly opens a door or breathes near a sensor, the temperature might jump for 2 seconds and then drop.
   - The 5-Minute Window automatically averages all readings taken in the last 5 minutes. This tells you the *true* comfort level of the room without being misled by tiny 1-second blips.
2. **Why do the graph lines change colors automatically?**
   - **Temperature Graph**:
     - **🟢 Green Line**: The temperature is pleasant and safe ($\le 30^\circ\text{C}$).
     - **🔴 Red Line**: The temperature is getting hot ($> 30^\circ\text{C}$).
   - **Humidity Graph**:
     - **🔵 Blue Line**: Air humidity is in the comfortable sweet spot ($30\%$ to $70\%$).
     - **🔴 Red Line**: Air is too humid ($> 70\%$) or too dry ($< 30\%$).
   - **Battery Graph**:
     - **🟢 Green Line**: Healthy battery ($> 60\%$).
     - **🟡 Yellow Line**: Moderate battery ($30\% - 60\%$).
     - **🔴 Red Line**: Low battery ($< 30\%$).
3. **Sudden Spike Alarm (The Fast Hazard Detector)**:
   - What if a heater is left on or a fire starts?
   - The system constantly checks: if the temperature suddenly jumps by **$2.0^\circ\text{C}$ or more** in a single reading, or humidity jumps by **$6\%$ or more**, a glowing red alert banner immediately flashes on screen:  
     `⚡ Sudden Temperature Surge: +3.5°C in 30s! Current: 31.2°C`

---

### Screen 4: Camera Hand Gestures (Touch-Free Magic Wand)

```
+-------------------------------------------------------------+
|                 VISION GESTURE LIGHT CONTROL                |
|                                                             |
|   [ Open Palm 🖐️ ] -> Turns Light ON                        |
|   [ Pinch / Fist 🤏 ] -> Turns Light OFF                    |
|                                                             |
|   +--------------------------+  Status: 🟢 Camera Active    |
|   |   Webcam Video Feed      |  Detected: LIGHT_ON (96%)    |
|   |   (Draws hand skeleton)  |  Target:   Living Room Light |
|   +--------------------------+                              |
|   [ ⏹️ Stop Camera ]                                        |
+-------------------------------------------------------------+
```

#### What is this screen for?
Control your room lights without touching any switch or screen—just by showing your hand to your webcam!

#### How does it work?
1. Click **"Start Camera"**. Your webcam turns on.
2. The system tracks 21 points on your hand (fingertips, knuckles, wrist).
3. **Show an Open Palm 🖐️**: The computer sees your fingers spread out and turns **Light 1 ON**.
4. **Pinch Your Fingers / Make a Fist 🤏**: The computer sees your thumb and index finger touch and turns **Light 1 OFF**.
5. **Smart Cooldown**: It waits a second between gestures so it doesn't accidentally flicker the lights if your hand moves around.
6. **When is this useful?** When your hands are wet or dirty while cooking in the kitchen, or when you're sitting on the sofa and don't want to get up.

---

### Screen 5: Orbit AI Assistant (Your Smart Home Copilot)

```
+-------------------------------------------------------------+
|                      ORBIT AI ASSISTANT                     |
|                                                             |
|  User: "Is the bedroom hot and can you turn off Light 1?"   |
|                                                             |
|  🤖 Orbit AI:                                               |
|  "The bedroom temperature is currently 27.2°C (Optimal).   |
|   I have switched Light 1 OFF for you! 💡"                  |
|                                                             |
|  [ Type your message here...                  ] [ Send 📤 ] |
|  [ 💡 Turn On Light 1 ] [ 🔒 Safe Mode ] [ 🌡️ Sensor Check ]|
+-------------------------------------------------------------+
```

#### What is this screen for?
Talk to your home just like you would text a friend. Powered by advanced artificial intelligence, Orbit AI understands natural everyday English.

#### What can it do?
- **Control Hardware Directly**: Type *"Turn off all lights"*, *"Turn on Light 2"*, or *"Enable safe mode"*, and the AI actually executes the physical action immediately.
- **Answer Real-Time Questions**: Ask *"How hot is the room?"*, *"Is the sensor battery low?"*, or *"Did anyone walk by today?"*, and it inspects live sensor values to answer you accurately.
- **Voice Response (Text-to-Speech)**: Click the speaker button, and Orbit AI will read its answer aloud to you!
- **Quick Action Chips**: Tap pre-made shortcut buttons like "Turn On Lights" or "Check Sensor Health" for instant answers.

---

### Screen 6: System Health (The Engine Check Light)

```
+-------------------------------------------------------------+
|                  PIPELINE & SERVICE HEALTH                  |
|                                                             |
|  [ Firebase Cloud ]    [ Node.js Backend ]  [ Apache Kafka ]|
|  Status: 🟢 UP         Status: 🟢 UP        Status: 🟢 UP   |
|  Latency: 32ms         Port: 5000           Events: Active  |
|                                                             |
|  [ Apache Flink ]      [ AI Model Engine ]  [ System State ]|
|  Status: 🟢 UP         Status: 🟢 READY     Overall: HEALTHY|
+-------------------------------------------------------------+
```

#### What is this screen for?
Just like the dashboard in your car has warning lights to tell you if the engine or battery has a problem, this screen shows the health of every part of the smart home system.

#### What does each card tell you?
- **Firebase Cloud**: Tells you if the cloud database is reachable and how fast it is responding.
- **Node.js Backend**: Confirms that the main computer brain is running smoothly.
- **Apache Kafka & Flink**: Shows that live data is streaming without any bottlenecks or crashes.

---

## 3. Real-Life Stories: A Day in the Life with WAVE

Here is how all these features work together in your everyday routine:

### 🌅 Morning (7:00 AM)
- You wake up. The automated timer has already turned off Light 3 at `06:00 AM`.
- You glance at your phone dashboard and see the room temperature is a crisp `24.5°C` (🟢 Green line on the graph).

### 🍳 Afternoon Cooking (1:30 PM)
- Your hands are covered in flour while baking. You don't want to touch any phone or switch.
- You simply open your palm 🖐️ in front of the laptop camera on your kitchen counter. Light 1 turns ON instantly.
- When done, you pinch your fingers 🤏. The light turns OFF.

### ☀️ Hot Afternoon & Sudden Spike (3:15 PM)
- Direct sunlight hits the room sensor and the temperature jumps from `26°C` to `31.5°C`.
- The graph line dynamically turns from **🟢 Green** to **🔴 Red**.
- A high-temperature toast alert pops up and sends an email to notify you that the room has crossed the $30^\circ\text{C}$ threshold.

### 🌙 Leaving Home & Bedtime (10:00 PM)
- Before leaving or going to sleep, you open the Chatbot and type: *"Goodnight Orbit, lock safe mode and turn off all lights."*
- Orbit AI replies: *"All lights are now OFF and Safe Mode is LOCKED. Sleep well!"*
- If an intruder opens the door while you're away, the motion sensor immediately detects movement and sends an emergency security email.

---

## 4. Common Questions & Answers (FAQ)

#### Q1: What is a "Device ID" like `d5695`?
> **Answer**: Think of it like a unique house address or phone number for your smart hardware box. Entering `d5695` connects the dashboard directly to the database that your device is reporting to.

#### Q2: What does the 5-Minute Window do?
> **Answer**: It averages temperature readings over the last 5 minutes so you get a smooth, reliable picture of your room's comfort, ignoring momentary 1-second temperature fluctuations.

#### Q3: Why did my graph line turn Red?
> **Answer**: By design, whenever your room temperature rises above **$30^\circ\text{C}$**, the line turns **🔴 Red** to give you an immediate visual cue that the room is warm. When it is at or below $30^\circ\text{C}$, it stays **🟢 Green**.

#### Q4: What happens if Safe Mode is enabled?
> **Answer**: Safe Mode acts like a master security lock. Manual light switching is temporarily locked, and if the motion sensor detects any movement in the room, it immediately flags a security breach and emails you.

#### Q5: Can I add more rooms or devices?
> **Answer**: Yes! Go to the Login screen, click **"Register New Device"**, enter the new Device ID and name (e.g. "Terrace Sensor"), and save it. You can switch between all your registered rooms in one click.

---

*WAVE Smart Hub — Created by Automattrix to make smart home automation simple, beautiful, and accessible to everyone.*
