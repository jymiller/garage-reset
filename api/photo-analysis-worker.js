import { QueueClient } from '@vercel/queue'
import { createBlobStorage } from '../server/vercel.mjs'
import { createPhotoAnalysisService, AnalysisError } from '../server/photo-analysis.mjs'
import { ANALYSIS_VERSION, isPhotoFilename } from '../src/analysis/contract.mjs'

const queue = new QueueClient()
const service = createPhotoAnalysisService({ storage: createBlobStorage() })
export default queue.handleNodeCallback(async message => {
  if (!message || Object.keys(message).length !== 2 || !isPhotoFilename(message.photo) || message.analysisVersion !== ANALYSIS_VERSION) return
  try { await service.process(message.photo) }
  catch (error) { throw error instanceof AnalysisError ? error : new AnalysisError('storage_unavailable', 503, true) }
}, {
  visibilityTimeoutSeconds: 120,
  retry: (error, metadata) => error instanceof AnalysisError && error.retryable && metadata.deliveryCount < 5
    ? { afterSeconds: Math.min(120, 10 * metadata.deliveryCount) } : { acknowledge: true },
})
