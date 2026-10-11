import {readConfig} from './config.ts';
import {createAnalysisServer} from './http.ts';
try {
  const config = readConfig();
  const server = createAnalysisServer(config);
  server.on('error', () => {console.error('RedFlag server failed to listen.'); process.exitCode=1;});
  // Controlled local demo only. An Internet deployment needs managed per-user auth and quotas.
  server.listen(config.port,'127.0.0.1',() => {console.info(`RedFlag analysis server listening on 127.0.0.1:${config.port}`);});
} catch {console.error('RedFlag server configuration is missing or invalid. See docs/gemini-backend.md.'); process.exitCode=1;}
