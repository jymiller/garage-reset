export type AnalysisErrorCode = 'not_configured' | 'provider_unavailable' | 'invalid_result' | 'queue_unavailable' | 'photo_unavailable' | 'storage_unavailable' | 'attempts_exhausted'
export type AnalysisObject = {
  id: string; name: string; category: 'container' | 'tool' | 'equipment' | 'furniture' | 'vehicle' | 'household' | 'material' | 'other';
  quantity: number | null; confidence: 'high' | 'medium' | 'low'; evidence: string;
  region: { x: number; y: number; w: number; h: number } | null;
  readableLabel: string | null; suggestedCrateId: string | null; locationHint: string | null;
}
export type AnalysisResult = { summary: string; objects: AnalysisObject[]; questions: string[] }
export type AnalysisRecord = {
  version: 1; photoFilename: string; sourceSha256: string; analysisVersion: string; model: string;
  status: 'queued' | 'processing' | 'complete' | 'failed'; createdAt: number; updatedAt: number; attempts: number;
  leaseId: string | null; leaseUntil: number | null; errorCode: AnalysisErrorCode | null; result: AnalysisResult | null;
}
export const ANALYSIS_VERSION: string
export const ANALYSIS_MODEL: string
export const ANALYSIS_ERRORS: readonly AnalysisErrorCode[]
export const OBJECT_CATEGORIES: readonly AnalysisObject['category'][]
export const ANALYSIS_RESULT_SCHEMA: Record<string, unknown>
export function isPhotoFilename(value: unknown): value is string
export function validateAnalysisResult(value: unknown): value is AnalysisResult
export function validateAnalysisRecord(value: unknown): value is AnalysisRecord
