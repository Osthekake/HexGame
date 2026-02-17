import { Router } from 'express';
import { randomUUID, randomInt } from 'crypto';
import geoip from 'geoip-lite';
import type { Queries } from '../db/queries.js';

export function sessionRoutes(queries: Queries): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const sessionId = randomUUID();
    const seed = randomInt(0, 2 ** 32);
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const ipStr = Array.isArray(ip) ? ip[0] : ip;

    // Auto-detect country from IP
    const geo = geoip.lookup(ipStr);
    const country = geo?.country || '';

    queries.createSession(sessionId, seed, ipStr);

    res.json({ sessionId, seed, country });
  });

  return router;
}
