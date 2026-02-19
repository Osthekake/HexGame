import { Router } from 'express';
import geoip from 'geoip-lite';
import type { Queries } from '../db/queries.js';
import { validateScore } from '../validation.js';
import type { ActionType } from '@hexgame/shared';

const VALID_ACTION_TYPES: ActionType[] = [
  'rotateClockwise', 'rotateCounterClockwise', 'moveCursor',
];

export function scoreRoutes(queries: Queries): Router {
  const router = Router();

  // GET /api/scores
  router.get('/', (req, res) => {
    const variant = (req.query.variant as string) || 'alltime';
    const country = req.query.country as string | undefined;
    const referenceScore = req.query.referenceScore
      ? parseInt(req.query.referenceScore as string, 10)
      : undefined;

    let whereClause = '';
    const params: unknown[] = [];
    let resolvedCountry: string | undefined;

    switch (variant) {
      case 'today':
        whereClause = "WHERE date(created_at) = date('now')";
        break;
      case 'region': {
        const regionCountry = country || (() => {
          const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
          const ipStr = Array.isArray(ip) ? ip[0] : ip;
          return geoip.lookup(ipStr)?.country || '';
        })();
        resolvedCountry = regionCountry || 'XX';

        whereClause = 'WHERE country = ?';
        params.push(resolvedCountry);
        break;
      }
      case 'alltime':
      default:
        break;
    }

    const top10 = queries.getTopScores(10, whereClause, params);

    let around: typeof top10 = [];
    if (referenceScore !== undefined && !isNaN(referenceScore)) {
      const rank = queries.getScoreRank(referenceScore, whereClause, params);
      if (rank > 10) {
        const offset = Math.max(0, rank - 6);
        around = queries.getScoresAround(offset, 11, whereClause, params);
      }
    }

    const formatRow = (row: typeof top10[0]) => ({
      rank: row.rank,
      nickname: row.nickname,
      country: row.country,
      score: row.score,
      createdAt: row.created_at,
    });

    res.json({
      top10: top10.map(formatRow),
      around: around.map(formatRow),
      ...(resolvedCountry !== undefined && { country: resolvedCountry }),
    });
  });

  // POST /api/scores
  router.post('/', (req, res) => {
    const { sessionId, nickname, score, actions } = req.body;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const session = queries.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (session.used) {
      res.status(409).json({ error: 'Session already used' });
      return;
    }

    // Validate nickname
    if (!nickname || typeof nickname !== 'string') {
      res.status(400).json({ error: 'nickname is required' });
      return;
    }
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      res.status(400).json({ error: 'nickname must be 1-20 characters' });
      return;
    }
    if (/<[^>]*>/.test(trimmed)) {
      res.status(400).json({ error: 'nickname contains invalid characters' });
      return;
    }

    // Validate score
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
      res.status(400).json({ error: 'score must be a non-negative integer' });
      return;
    }

    // Validate actions
    if (!Array.isArray(actions) || actions.length === 0) {
      res.status(400).json({ error: 'actions must be a non-empty array' });
      return;
    }
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!VALID_ACTION_TYPES.includes(action.type)) {
        res.status(400).json({ error: `Invalid action type at index ${i}: ${action.type}` });
        return;
      }
      if (typeof action.timestamp !== 'number') {
        res.status(400).json({ error: `Invalid timestamp at index ${i}` });
        return;
      }
      if (action.type === 'moveCursor' && (typeof action.x !== 'number' || typeof action.y !== 'number')) {
        res.status(400).json({ error: `moveCursor at index ${i} missing x/y coordinates` });
        return;
      }
    }

    // Validate score via replay
    const result = validateScore(session.seed, actions, score);
    if (!result.valid) {
      res.status(400).json({ valid: false, reason: result.reason });
      return;
    }

    // Auto-detect country from IP
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const ipStr = Array.isArray(ip) ? ip[0] : ip;
    const geo = geoip.lookup(ipStr);
    const country = geo?.country || '';

    // Atomically mark session used + insert score
    queries.markSessionUsedAndInsertScore(
      sessionId, trimmed, country, score, session.seed, JSON.stringify(actions)
    );

    // Compute rank
    const rank = queries.getScoreRank(score);

    res.json({ valid: true, rank });
  });

  return router;
}
