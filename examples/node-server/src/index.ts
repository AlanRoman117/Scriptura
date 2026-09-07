import { getDataDir } from '@scriptura/core';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

createApp().listen(PORT, () => {
  console.log(`Scriptura API running on http://localhost:${PORT}`);
  console.log(`Serving data from ${getDataDir()}`);
});
