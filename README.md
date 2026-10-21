# Sample MERN with Microservices on AKS

A MERN application split into a React frontend and two Node.js microservices (`helloService`, `profileService`) backed by MongoDB, containerised and deployed on **Azure Kubernetes Service**.

**Start here: [DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step deployment guide with screenshots.

Based on [UnpredictablePrashant/SampleMERNwithMicroservices](https://github.com/UnpredictablePrashant/SampleMERNwithMicroservices).

## What's in this repository

| Path | Purpose |
|---|---|
| `frontend/` | React app, `Dockerfile` (multi-stage, served by nginx), `nginx.conf` |
| `backend/helloService/` | Express service on port 3001, `Dockerfile` |
| `backend/profileService/` | Express + Mongoose service on port 3002, `Dockerfile` |
| `k8s/` | Kubernetes manifests (namespace, MongoDB, services, frontend) |
| `docs/screenshots/` | Screenshots referenced by `DEPLOYMENT.md` |

## Running locally

For `helloService`, create a `.env` file:
```bash
PORT=3001
```

For `profileService`, create a `.env` file:
```bash
PORT=3002
MONGO_URL="specifyYourMongoURLHereWithDatabaseNameInTheEnd"
```

Install packages and start each service (`npm install`, then `node index.js`).

For the frontend:
```bash
cd frontend
npm install
npm start
```

`npm start` uses `frontend/.env.development`, which points the UI at `localhost:3001` and `localhost:3002`. Production builds call `/api/hello` and `/api/profile` instead, which nginx proxies to the services inside the cluster.
