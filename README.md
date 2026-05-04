# Cloud Static Hosting Software

A full-stack, distributed serverless deployment platform built to mimic Vercel's core infrastructure. It allows users to import React/Vite applications via a GitHub URL, automatically clones, builds, and deploys them to Cloudflare R2 storage (can be easily changed to AWS S3), and serves them instantly via a dynamic reverse proxy.

## Architecture & How It Works

The platform consists of four decoupled microservices operating on an event-driven architecture using Redis.

1. **Frontend (React + Vite + Tailwind CSS)**
   - The user-facing UI where developers submit their GitHub repository URLs.
   - Constantly polls the backend to display real-time build status (Uploaded -> Processing -> Deployed).
   
2. **Upload Service (Express API)**
   - Ingests the GitHub URL from the frontend.
   - Clones the raw repository locally and pushes all source files to an S3-compatible storage bucket (Cloudflare R2).
   - Enqueues a deployment job containing the generated project ID into a **Redis Queue**.
   - Handles the `/status` polling endpoint for the frontend.
   - Cleans up its local disk automatically after the upload succeeds.

3. **Deploy Service (Background Worker)**
   - Operates entirely in the background, listening to the Redis queue (`brPop`).
   - When a job is picked up, it downloads the raw source code from R2.
   - Executes a sandboxed `npm install` and `npm run build` locally.
   - Intelligently detects the output directory (supporting both Vite's `dist` and Create React App's `build`) and uploads the final production build back to R2.
   - Safely cleans up local files and `node_modules` to prevent disk exhaustion.

4. **Request Handler (Reverse Proxy)**
   - The edge routing service. It listens for incoming HTTP requests and resolves the requested subdomain (e.g., `http://<project-id>.localhost:3001`).
   - Dynamically proxies and streams the appropriate compiled static assets (HTML, CSS, JS) directly from Cloudflare R2 back to the user without downloading them locally.

## Prerequisites

Before starting, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16+)
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) (for running Redis locally)
- A Cloudflare R2 / AWS S3 account for storage.

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aerobrid/cloud-static-hosting.git
   cd cloud-static-hosting
   ```

2. **Start a local Redis Server:**
   ```bash
   docker run -p 6379:6379 -d redis
   ```

3. **Set up Environment Variables:**
   You must create a `.env` file inside **three** backend services (`upload-service`, `deploy-service`, and `request-handler`).
   
   Create a `.env` file in each directory and populate it with your S3/R2 credentials:
   ```env
   R2_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=<your-access-key>
   R2_SECRET_ACCESS_KEY=<your-secret-key>
   R2_BUCKET_NAME=vercel-clone
   ```

4. **Install Dependencies:**
   Navigate into each of the four directories and run `npm install`:
   ```bash
   cd frontend && npm install
   cd ../upload-service && npm install
   cd ../deploy-service && npm install
   cd ../request-handler && npm install
   ```

## Running the Platform Locally

To bring the entire platform online, you need to start the development servers for all four services simultaneously. Open **four separate terminal windows**:

**Terminal 1 (Upload Service):**
```bash
cd upload-service
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 (Deploy Service):**
```bash
cd deploy-service
npm run dev
# Background worker (No exposed port)
```

**Terminal 3 (Request Handler):**
```bash
cd request-handler
npm run dev
# Runs on http://localhost:3001
```

**Terminal 4 (Frontend UI):**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

## Usage

1. Open your browser and navigate to the **Frontend UI** at `http://localhost:5173`.
2. Paste a link to a valid React repository.
3. Click **Deploy**. You will see the UI progress through the deployment phases. It may take some time to compile.
4. Once completed, the UI will present you with a live localhost link (e.g., `http://1a2b3c4d5.localhost:3001`).
5. Click the link! The **Request Handler** will intercept the subdomain and serve your fully compiled application directly from Cloudflare R2.

## API Endpoints

### Upload Service
- `POST /deploy`
  - Body: `{ "repoUrl": "https://github.com/..." }`
  - Clones the repo, uploads to R2, pushes to Redis, and returns `{ "id": "12345", "status": "uploaded" }`.
- `GET /status?id=<project_id>`
  - Queries Redis for the current state of a deployment.
  - Returns `{ "status": "processing" | "deployed" | "uploaded" }`.

### Request Handler
- `GET /*`
  - Wildcard route. Extracts the `<project_id>` from the Host header (subdomain) and streams `dist/<project_id>/*` from R2.
