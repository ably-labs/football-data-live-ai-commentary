import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '../.env.local' });

// Import routes
import { createHealthRouter } from './routes/health.js';
import { createAblyTokenRouter } from './routes/ably-token.js';
import { createAdminRouter } from './routes/admin.js';

// Import services
import { initializeAblyService } from './services/ably-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
console.log('Initializing Ably service...');
initializeAblyService().then(() => {
  console.log('Ably service initialized successfully');
}).catch((error) => {
  console.error('Failed to initialize Ably service:', error);
  process.exit(1);
});

// Routes
app.use('/api', createHealthRouter());
app.use('/api', createAblyTokenRouter());
app.use('/api', createAdminRouter());

// In production, serve the built client app
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(join(clientPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});