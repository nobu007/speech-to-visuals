import { app } from './server';
import { logger } from '../utils/logger';
import { llmService } from '../analysis/llm-service';
import { triggerStartupWarmup } from './startup-warmup';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  triggerStartupWarmup(llmService);
});
