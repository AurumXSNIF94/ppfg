import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import './firebase.js';
import dashboardRouter from './routes/dashboard.js';
import inboundRouter from './routes/inbound.js';
import exportHistoryRouter from './routes/exportHistory.js';
import gasRouter from './routes/gas.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((x) => x.trim()) : true,
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, service: 'ppfg-wms-api', status: 'ok', time: new Date().toISOString() });
});

app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/inbound', requireAuth, inboundRouter);
app.use('/api/export-history', requireAuth, exportHistoryRouter);
app.use('/api/gas', requireAuth, gasRouter);

app.use((error, _req, res, _next) => {
  console.error('[API]', error);
  res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`PPFG WMS API running on http://localhost:${port}`);
});
