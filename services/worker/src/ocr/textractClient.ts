import { log } from '../log.js';

export const textractClient = () => ({
  startExtraction: async (payload: Record<string, unknown>) => {
    log.info('textract stub', { payload });
  }
});
