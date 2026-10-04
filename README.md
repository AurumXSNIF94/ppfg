# PPFG WMS — Fullstack Warehouse Management System

A fullstack **Warehouse Management System (WMS)** built around inbound and finished-goods warehouse administration.

The project combines a React frontend, Express API, Firebase authentication/database, and Google Apps Script integration into a single operational workflow.

## Project Goal

The objective is to move warehouse administration from fragmented manual processes toward a centralized application where users can monitor, record, and manage warehouse data through a structured interface.

## Architecture

```
React + Vite Frontend
        │
        │ Firebase ID Token
        ▼
Express API / Cloudflare Pages Function
        │
        ├── Firebase Realtime Database
        │
        └── Google Apps Script / Sheets
```

## Core Modules

- Google Authentication
- Dashboard and inbound analytics
- Inbound entry
- Dynamic carton-row input
- Inbound stock CRUD
- Export / history monitoring
- WMS Google Sheets synchronization
- Responsive sidebar and mobile navigation
- API authentication using Firebase ID tokens

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| UI | Tailwind CSS |
| Charts | Chart.js + react-chartjs-2 |
| Routing | React Router |
| Authentication | Firebase Authentication |
| Database | Firebase Realtime Database |
| Backend | Node.js + Express |
| Admin SDK | Firebase Admin SDK |
| Integration | Google Apps Script |
| Deployment | Cloudflare Pages / Docker |

## Repository Structure

```
backend/
├── src/
│   ├── middleware/
│   ├── routes/
│   ├── firebase.js
│   └── server.js
└── .env.example

functions/
src/
├── components/
├── config/
├── pages/
└── services/api.js

Dockerfile
wrangler.toml
```

## Security Approach

- Firebase ID tokens are used for authenticated API requests.
- Firebase Admin credentials stay on the server side.
- Environment files and service-account credentials are excluded from source control.
- The production architecture can serve frontend and API from the same origin.

## Local Development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

For local development, the Vite configuration proxies `/api` requests to the backend.

## Production Options

The repository includes configurations for:

- Single-container deployment with Docker
- Cloudflare Pages Functions
- Separate frontend/backend deployment

## Portfolio Value

This project demonstrates the ability to translate warehouse requirements into a working information system across:

- Warehouse administration
- Inventory data
- Finished Goods workflows
- Authentication
- API design
- Database integration
- External spreadsheet integration
- Responsive operational interfaces

## Related Projects

- [Gudang Warna — Inventory & Warehouse Operations](https://github.com/AurumXSNIF94/gudang-warna)
- [FinishGoodWH — Finished Goods / Carton Tracker](https://github.com/AurumXSNIF94/FinishGoodWH)

## Author

**Masfiyal Illah**  
Inventory Control • ERP • Production Planning • Warehouse Operations
