# 🚀 AWS EC2 & Docker Deployment Guide for ORBIT Smart Home Platform

This guide walks you through containerizing the entire **ORBIT Smart Home Dashboard** (Frontend + Backend + Real-Time Streaming Pipeline) and deploying it to **Amazon Web Services (AWS) EC2**.

---

## 🏗️ Architecture on AWS EC2

```text
[ Internet / Browser ]
         │
         ▼ (Port 80 / 443)
┌───────────────────────────────────────────────────────────┐
│ AWS EC2 Instance (Ubuntu 22.04 LTS / 24.04 LTS)           │
│                                                           │
│  ┌───────────────────────┐       ┌─────────────────────┐  │
│  │ orbit-frontend        │       │ orbit-backend       │  │
│  │ (Nginx + React SPA)   ├──────►│ (Node.js Express)   │  │
│  │ Port 80 / 3000        │ /api/ │ Port 5000           │  │
│  └───────────────────────┘       └──────────┬──────────┘  │
│                                             │             │
│                                             ▼             │
│                                  ┌─────────────────────┐  │
│                                  │ orbit-kafka + ZK    │  │
│                                  │ Port 9092           │  │
│                                  └─────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites
1. An **AWS Account** ([aws.amazon.com](https://aws.amazon.com))
2. Your SSH Key Pair (`.pem` file) downloaded from AWS.

---

## 🛠️ Step 1: Launch an AWS EC2 Instance

1. Open the [AWS EC2 Management Console](https://console.aws.amazon.com/ec2/).
2. Click **"Launch Instance"**.
3. Configure the following:
   - **Name**: `orbit-smart-home-server`
   - **AMI**: `Ubuntu Server 24.04 LTS (HVM), SSD Volume Type` (64-bit x86)
   - **Instance Type**: 
     - `t2.micro` or `t3.micro` (*Free Tier eligible* — for Frontend + Backend Core)
     - `t3.small` or `t3.medium` (*Recommended* if running Kafka/Zookeeper simultaneously)
   - **Key Pair**: Select or create a key pair (e.g. `orbit-key.pem`).
4. **Network Settings (Security Group Inbound Rules)**:
   Ensure you allow the following ports:

| Type | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- |
| **SSH** | `22` | `My IP` or `0.0.0.0/0` | Secure Shell Access |
| **HTTP** | `80` | `0.0.0.0/0` (Anywhere) | **Public Dashboard Web UI** |
| **Custom TCP** | `3000` | `0.0.0.0/0` | Optional Frontend Port |
| **Custom TCP** | `5000` | `0.0.0.0/0` | Backend API Port |
| **HTTPS** | `443` | `0.0.0.0/0` | SSL / Secure Web (Optional) |

5. Click **"Launch Instance"**.

---

## 💻 Step 2: Connect to your EC2 Instance via SSH

From your local machine terminal:

```bash
chmod 400 orbit-key.pem
ssh -i orbit-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

---

## 🐳 Step 3: Install Docker & Docker Compose on EC2

Run this single command script to install Docker, Docker Compose, and Git:

```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker & dependencies
sudo apt install -y docker.io docker-compose-v2 git curl

# 3. Enable Docker service and add ubuntu user to docker group
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# 4. Apply group permissions (or log out and log back in)
newgrp docker

# 5. Verify Docker installation
docker --version
docker compose version
```

---

## 📥 Step 4: Clone & Configure ORBIT on EC2

### Option A: Clone from your GitHub repository
```bash
git clone https://github.com/your-username/wave_latest_dashboard.git
cd wave_latest_dashboard/Dashboard
```

### Option B: Or copy your files directly from Windows to EC2 via SCP
From your Windows PowerShell (run from your local project root):
```powershell
scp -i orbit-key.pem -r d:\Professional\Automatrix\wave_latest_dashboard\Dashboard ubuntu@<YOUR_EC2_PUBLIC_IP>:~/orbit-dashboard
```

---

## ⚙️ Step 5: Configure Environment Variables

Create your `.env` file on the EC2 instance:

```bash
cat << 'EOF' > .env
# Backend API & Database
PORT=5000
FIREBASE_DATABASE_URL=https://rasptemp-d5695-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=rasptemp-d5695

# Grok / xAI API Key
GROK_API_KEY=your_grok_api_key_here
GROK_MODEL=grok-beta

# Kafka Event Streaming
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=orbit-backend
EOF
```

---

## 🚀 Step 6: Build & Run Docker Containers

To build and start all services in the background:

```bash
docker compose up -d --build
```

To verify all containers are running healthy:

```bash
docker compose ps
```

You will see:
- `orbit-frontend` (Port 80) $\rightarrow$ **UP**
- `orbit-backend` (Port 5000) $\rightarrow$ **UP**
- `orbit-kafka` (Port 9092) $\rightarrow$ **UP**
- `orbit-zookeeper` (Port 2181) $\rightarrow$ **UP**

---

## 🌐 Step 7: Access Your Live Dashboard

Open your web browser and navigate to:
```text
http://<YOUR_EC2_PUBLIC_IP>
```
*(No port number needed! It opens directly on Port 80)*

Or access the backend API health check at:
```text
http://<YOUR_EC2_PUBLIC_IP>:5000/api/health
```

---

## 🛠️ Useful Management Commands on EC2

| Task | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f` |
| **View Frontend Logs** | `docker compose logs -f frontend` |
| **View Backend Logs** | `docker compose logs -f backend` |
| **Restart Containers** | `docker compose restart` |
| **Stop All Containers** | `docker compose down` |
| **Update to Latest Code & Rebuild** | `git pull && docker compose up -d --build` |
| **Check Memory / CPU Usage** | `docker stats` |

---

## 🔒 Step 8: (Optional) Attach a Free SSL Certificate (HTTPS)

If you have a domain name pointing to your EC2 IP (e.g. `orbit.yourdomain.com`):

```bash
# 1. Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain Free SSL Certificate
sudo certbot --nginx -d orbit.yourdomain.com
```

Your smart home system will now be accessible securely at `https://orbit.yourdomain.com`! 🎉
EOF
