# Sherlock SCF Fraud Detection System

A highly modular REST API backend and interactive React dashboard for a Multi-Tier Supply Chain Finance (SCF) Fraud Detection system.

## Project Structure

This project is divided into two main parts:

- **Backend (Root):** Node.js Express application with a Neon PostgreSQL database. Handles 8 distinct fraud detection features (Triple-match, Duplicates, Relationship gaps, Velocity, Feasibility, Dilution, Cascades, and the Master Risk score).
- **Frontend (`/frontend`):** Vite React application with Tailwind CSS and Recharts/XYFlow for visualizing the fraud detection data.

## Local Setup Instructions

### 1. Backend Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory and add the Neon database connection string:
   ```env
   DATABASE_URL="your_neon_db_url_here"
   ```

3. **Initialize Database (First time only):**
   ```bash
   node db/init_schema.js
   ```

4. **Start Server:**
   ```bash
   node index.js
   ```

### 2. Frontend Setup

1. **Navigate to Frontend Directory:**
   ```bash
   cd frontend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
