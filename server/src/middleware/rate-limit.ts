import type { Request, Response, NextFunction } from 'express';

const submissions = new Map<string, number>();

const COOLDOWN_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

// Clean up old entries periodically
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS;
  for (const [ip, timestamp] of submissions) {
    if (timestamp < cutoff) {
      submissions.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') {
    next();
    return;
  }

  const ip = req.ip || 'unknown';
  const lastSubmission = submissions.get(ip);

  if (lastSubmission && Date.now() - lastSubmission < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (Date.now() - lastSubmission)) / 1000);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
    return;
  }

  submissions.set(ip, Date.now());
  next();
}
