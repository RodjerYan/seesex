import 'dotenv/config';
import express from 'express';

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// Минимальный health-endpoint для render.yaml healthCheckPath (каркас S1).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xtracker-api', uptime: process.uptime() });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`xtracker-api listening on :${port}`);
});
