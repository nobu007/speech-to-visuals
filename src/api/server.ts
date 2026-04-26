import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';

const app = express();

// JSON body parser (50MB limit per REQ-402)
app.use(express.json({ limit: '50mb' }));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
}));

// Security headers
app.use(helmet());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
}));

// Routes
app.use('/api/v1', healthRouter);

// Root health check (direct path)
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

export { app };
export default app;
