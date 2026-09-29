import { Router } from 'express';

const router = Router();

function baseUrl() {
  return (process.env.GAS_API_URL || '').replace(/\/$/, '');
}

router.get('/', async (req, res, next) => {
  try {
    const base = baseUrl();
    if (!base) return res.status(503).json({ success: false, message: 'GAS_API_URL is not configured.' });

    const url = new URL(base);
    for (const [key, value] of Object.entries(req.query)) url.searchParams.set(key, String(value));

    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();

    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error) { next(error); }
});

export default router;
