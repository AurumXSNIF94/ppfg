# PPFG WMS — Fullstack Admin

PPFG WMS is a React/Vite warehouse admin application with a dedicated Express API backend.

## Architecture
- Frontend: React 19 + Vite + Tailwind CSS
- Authentication: Firebase Authentication (Google)
- Database: Firebase Realtime Database
- Backend: Node.js + Express + Firebase Admin SDK
- Integration: Google Apps Script through the backend proxy
- API auth: Firebase ID token (Authorization: Bearer <token>)

## Project structure
```
backend/
  src/middleware/
  src/routes/
  src/firebase.js
  src/server.js
  .env.example
src/
  components/
  config/
  pages/
  services/api.js
package.json
```

## Run locally
### Frontend
```bash
npm install
npm run dev
```
Set VITE_API_URL=http://localhost:4000 in .env.local when the API is not on the same origin.

### Backend
```bash
cd backend
npm install
```
Copy .env.example to .env and configure Firebase Admin credentials, then run:
```bash
npm run dev
```
The API runs on http://localhost:4000.

### Firebase Admin credentials
Use a service-account JSON file with GOOGLE_APPLICATION_CREDENTIALS, or set FIREBASE_SERVICE_ACCOUNT_JSON. Also set FIREBASE_DATABASE_URL and CLIENT_ORIGIN.

Never commit service-account JSON or .env files.

## API
All application API routes require a valid Firebase ID token.
- GET /api/health
- GET /api/dashboard
- GET /api/inbound
- POST /api/inbound
- PATCH /api/inbound/:id
- DELETE /api/inbound/:id
- GET /api/export-history
- GET /api/gas?...

## Current admin modules
- Google authentication
- Dashboard / inbound analytics
- Inbound entry with dynamic carton rows
- Inbound stock CRUD
- Export history
- WMS Google Sheets sync monitoring
- Responsive sidebar and mobile navigation

## Deployment
Deploy frontend and backend separately. Set CLIENT_ORIGIN to the deployed frontend origin and VITE_API_URL to the public backend URL. Never expose Firebase Admin credentials to the browser.


## Single-container production

The included `Dockerfile` builds the Vite frontend and serves it from the Express backend. This avoids the browser calling `localhost` in production. Configure Firebase Admin credentials and `FIREBASE_DATABASE_URL`, then run `docker build -t ppfg-wms .` and `docker run --env-file backend/.env -p 4000:4000 ppfg-wms`. Open the deployed host; the same origin serves both the admin UI and `/api/*`.

For local development, run the backend on port 4000 and the Vite frontend on port 5173. `vite.config.js` proxies `/api` to the backend, so `VITE_API_URL` can remain empty.
