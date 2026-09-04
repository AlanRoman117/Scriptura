import express from 'express';
import { createRouter } from '@scriptura/api';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.get('*', async (req, res) => {
  const result = await createRouter({
    path: req.path,
    query: req.query as Record<string, string>,
  });
  res.status(result.status).json(result.body);
});

app.listen(PORT, () => {
  console.log(`Scriptura API running on http://localhost:${PORT}`);
});
