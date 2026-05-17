import { app } from './server';
import { logger } from '../utils/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
