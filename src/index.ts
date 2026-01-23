import './utils/prototypes'

import dotenv from 'dotenv';
import { env } from './utils/helpers';
import express from 'express';
import { fileURLToPath } from 'url';
import { initialize } from './utils/initialize';
import path from 'path';
// Initialize Prisma client
import { prisma } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = env('PORT', 3000);


app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, 'public')));

await initialize(app)

// Start server
app.listen(port, () => {
  if (env('NODE_ENV') !== 'test') {
    console.log(`Server running at http://localhost:${port}`);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
