import { log } from '../log.js';

export const runExtraction = async (payload: Record<string, unknown>) => {
  log.info('openai extraction stub', { payload });
  return {
    summary: 'Stub summary',
    tasks: ['Follow up with customer'],
    confidence: 0.9
  };
};
