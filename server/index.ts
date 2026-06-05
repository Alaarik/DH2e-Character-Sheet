import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './auth.js';
import characterRoutes from './routes/characters.js';
import weaponsRoutes from './routes/weapons.js';
import armorRoutes from './routes/armor.js';
import powerRoutes from './routes/powers.js';
import talentRoutes from './routes/talents.js';
import chargenRoutes from './routes/chargen.js';
import gearRoutes from './routes/gear.js';

// Initialize
dotenv.config();
import './db.js'; // Initialize database on startup

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/weapons', weaponsRoutes);
app.use('/api/armor', armorRoutes);
app.use('/api/powers', powerRoutes);
app.use('/api/talents', talentRoutes);
app.use('/api/chargen', chargenRoutes);
app.use('/api/gear', gearRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the Vite build
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}`);
  console.log(`[Server] DEV_MODE=${process.env.DEV_MODE === 'true' ? 'ON (mock auth)' : 'OFF'}`);
});
