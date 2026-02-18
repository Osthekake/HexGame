import type { GameAction } from '@hexgame/shared';

const API_BASE = `${window.location.origin}/HexGame/api`;

export interface SessionResponse {
  sessionId: string;
  seed: number;
  country: string;
}

export interface ScoreEntry {
  rank: number;
  nickname: string;
  country: string;
  score: number;
  createdAt: string;
}

export interface ScoresResponse {
  top10: ScoreEntry[];
  around: ScoreEntry[];
}

export interface SubmitScoreResponse {
  valid: boolean;
  rank?: number;
  reason?: string;
  error?: string;
}

export async function createSession(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function getScores(
  variant: 'alltime' | 'today' | 'region',
  referenceScore?: number,
  country?: string
): Promise<ScoresResponse> {
  const params = new URLSearchParams({ variant });
  if (referenceScore !== undefined) params.set('referenceScore', String(referenceScore));
  if (country) params.set('country', country);
  const res = await fetch(`${API_BASE}/scores?${params}`);
  if (!res.ok) throw new Error('Failed to fetch scores');
  return res.json();
}

export async function submitScore(data: {
  sessionId: string;
  nickname: string;
  score: number;
  actions: GameAction[];
}): Promise<SubmitScoreResponse> {
  const res = await fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
