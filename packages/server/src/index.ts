import express from 'express';
import { initDB } from './db/schema.js';
import { createQueries } from './db/queries.js';
import { sessionRoutes } from './routes/sessions.js';
import { scoreRoutes } from './routes/scores.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Trust proxy for correct IP detection behind nginx
app.set('trust proxy', true);

const db = initDB(process.env.DB_PATH || './data/hexgame.db');
const queries = createQueries(db);

app.use('/api/sessions', sessionRoutes(queries));
app.use('/api/scores', rateLimit, scoreRoutes(queries));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HexGame server listening on port ${PORT}`);
});
