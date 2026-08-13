import { app } from './app.js';
import { assertProductionConfig, config } from './config.js';
import { connectDatabase } from './db.js';

try {
  assertProductionConfig();
  await connectDatabase();
  app.listen(config.app.port, () => {
    console.log('Lummina API listening on http://localhost:' + config.app.port);
    console.log('Runtime: Node.js / Express · Build: node-express-cms-v2');
    console.log('Cloudinary media configured: ' + (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret ? 'yes' : 'no'));
  });
} catch (error) {
  console.error('Unable to start Lummina API:', error.message);
  process.exitCode = 1;
}
