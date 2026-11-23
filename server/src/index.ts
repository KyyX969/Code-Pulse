import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { getStore } from './db/index.js';
import { realtimeHub } from './ws/realtime.js';

async function bootstrap() {
  await getStore();
  const app = createApp();
  const server = http.createServer(app);
  realtimeHub.attach(server);

  server.listen(config.port, () => {
    console.log(`[CodePulse Server] Listening on http://localhost:${config.port}`);
    console.log(`[CodePulse WebSocket] Ready at ws://localhost:${config.port}/ws`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start CodePulse server:', err);
  process.exit(1);
});

