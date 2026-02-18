import type Database from 'better-sqlite3';

export interface SessionRow {
  id: string;
  seed: number;
  created_at: string;
  ip_address: string | null;
  used: number;
}

export interface ScoreRow {
  id: number;
  session_id: string;
  nickname: string;
  country: string;
  score: number;
  seed: number;
  actions: string;
  created_at: string;
}

export interface RankedScoreRow extends ScoreRow {
  rank: number;
}

export function createQueries(db: Database.Database) {
  const stmts = {
    createSession: db.prepare(
      'INSERT INTO sessions (id, seed, ip_address) VALUES (?, ?, ?)'
    ),
    getSession: db.prepare<[string], SessionRow>(
      'SELECT * FROM sessions WHERE id = ?'
    ),
    markSessionUsed: db.prepare(
      'UPDATE sessions SET used = 1 WHERE id = ?'
    ),
    insertScore: db.prepare(
      'INSERT INTO scores (session_id, nickname, country, score, seed, actions) VALUES (?, ?, ?, ?, ?, ?)'
    ),
  };

  return {
    createSession(id: string, seed: number, ipAddress: string) {
      stmts.createSession.run(id, seed, ipAddress);
    },

    getSession(id: string): SessionRow | undefined {
      return stmts.getSession.get(id);
    },

    markSessionUsed(id: string) {
      stmts.markSessionUsed.run(id);
    },

    insertScore(sessionId: string, nickname: string, country: string, score: number, seed: number, actions: string) {
      stmts.insertScore.run(sessionId, nickname, country, score, seed, actions);
    },

    getTopScores(limit: number, whereClause: string = '', params: unknown[] = []): RankedScoreRow[] {
      const sql = `
        SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) AS rank
        FROM scores
        ${whereClause}
        ORDER BY score DESC, created_at ASC
        LIMIT ?
      `;
      return db.prepare(sql).all(...params, limit) as RankedScoreRow[];
    },

    getScoreRank(score: number, whereClause: string = '', params: unknown[] = []): number {
      const sql = `
        SELECT COUNT(*) AS cnt FROM scores
        ${whereClause ? whereClause + ' AND' : 'WHERE'} score > ?
      `;
      const row = db.prepare(sql).get(...params, score) as { cnt: number };
      return row.cnt + 1;
    },

    getScoresAround(offset: number, limit: number, whereClause: string = '', params: unknown[] = []): RankedScoreRow[] {
      const sql = `
        SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) AS rank
        FROM scores
        ${whereClause}
        ORDER BY score DESC, created_at ASC
        LIMIT ? OFFSET ?
      `;
      return db.prepare(sql).all(...params, limit, offset) as RankedScoreRow[];
    },

    markSessionUsedAndInsertScore(sessionId: string, nickname: string, country: string, score: number, seed: number, actions: string) {
      const tx = db.transaction(() => {
        stmts.markSessionUsed.run(sessionId);
        stmts.insertScore.run(sessionId, nickname, country, score, seed, actions);
      });
      tx();
    },
  };
}

export type Queries = ReturnType<typeof createQueries>;
