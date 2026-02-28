# Sherlock: Deep-Tier Supply Chain Fraud Detection

**SHERLOCK** is an interactive, real-time dashboard built to visualize massive supply chain networks and flag sophisticated carousel fraud loops using AI semantic validation and network topology mapping.

This project is separated into two parts:
- A Node.js API Backend (Main folder)
- A Vite + React Dashboard UI (`/frontend` folder)

## 🚨 How to run this locally without it crashing 🚨

You must run **TWO SEPARATE TERMINAL WINDOWS** at the same time for this app to work! If you only run one, the app will crash or the screen will be blank.

---

### Step 1: Set up the Backend Server (Terminal 1)

1. Open your terminal and navigate to the root folder of this project (`sherlock-scf-fraud-detection-system`).
2. Run standard install:
   ```bash
   npm install
   ```
3. **CRITICAL STEP:** Create a plain text file named exactly `.env` in the root folder. Paste this exact line into it so the app can connect to the live Neon database:
   ```env
   DATABASE_URL="postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   ```
4. Start the backend Node server by running:
   ```bash
   node index.js
   ```
*(Leave this terminal open and running in the background!)*

---

### Step 2: Set up the React Frontend (Terminal 2)

1. Open a **brand new** Terminal window.
2. Navigate into the frontend sub-folder:
   ```bash
   cd frontend
   ```
3. Install the specific React packages (if you skip this, it will fail to start):
   ```bash
   npm install
   ```
4. Start the Vite dashboard:
   ```bash
   npm run dev
   ```

### Step 3: View the App!
The terminal should give you a local URL (usually `http://localhost:5173`). Click it or type it into your browser to explore the dashboard.

---

## Technical Stack Overview
- **UI:** React 18, Vite, Tailwind CSS, Shadcn UI, Framer Motion
- **Data Viz:** XYFlow (ReactFlow), Recharts, d3.js-inspired trees
- **Backend:** Node.js, Express, PostgreSQL (Neon Serverless)
- **Live Updates:** Custom WebSockets (`ws`) mock-engine
