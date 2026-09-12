export const ANALYSIS_VERSION = 'garage-photo-v1'
export const ANALYSIS_MODEL = 'openai/gpt-4.1-mini'
export const ANALYSIS_ERRORS = ['not_configured', 'provider_unavailable', 'invalid_result', 'queue_unavailable', 'photo_unavailable', 'storage_unavailable', 'attempts_exhausted']
export const OBJECT_CATEGORIES = ['container', 'tool', 'equipment', 'furniture', 'vehicle', 'household', 'material', 'other']
export const isPhotoFilename = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(jpg|png|webp)$/.test(value)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const text = (value, max, empty = false) => typeof value === 'string' && value === value.trim() && value.length <= max && (empty || value.length > 0)
const time = value => Number.isFinite(value) && value >= 0 && value <= 8.64e15
const nullableText = (value, max) => value === null || text(value, max)
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1

export function validateAnalysisResult(value) {
  if (!exact(value, ['summary', 'objects', 'questions']) || !text(value.summary, 1200)
    || !Array.isArray(value.objects) || value.objects.length > 40
    || !Array.isArray(value.questions) || value.questions.length > 8 || !value.questions.every(v => text(v, 240))) return false
  const ids = new Set()
  for (const item of value.objects) {
    if (!exact(item, ['id', 'name', 'category', 'quantity', 'confidence', 'evidence', 'region', 'readableLabel', 'suggestedCrateId', 'locationHint'])
      || !text(item.id, 80) || ids.has(item.id) || !text(item.name, 160) || !OBJECT_CATEGORIES.includes(item.category)
      || !(item.quantity === null || Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10000)
      || !['high', 'medium', 'low'].includes(item.confidence) || !text(item.evidence, 600)
      || !nullableText(item.readableLabel, 160) || !nullableText(item.suggestedCrateId, 120) || !nullableText(item.locationHint, 240)) return false
    if (item.region !== null && (!exact(item.region, ['x', 'y', 'w', 'h']) || !Object.values(item.region).every(unit)
      || item.region.w <= 0 || item.region.h <= 0 || item.region.x + item.region.w > 1.000001 || item.region.y + item.region.h > 1.000001)) return false
    ids.add(item.id)
  }
  return true
}

export function validateAnalysisRecord(value) {
  if (!exact(value, ['version', 'photoFilename', 'sourceSha256', 'analysisVersion', 'model', 'status', 'createdAt', 'updatedAt', 'attempts', 'leaseId', 'leaseUntil', 'errorCode', 'result'])
    || value.version !== 1 || !isPhotoFilename(value.photoFilename) || !/^[a-f0-9]{64}$/.test(value.sourceSha256)
    || !text(value.analysisVersion, 80) || !text(value.model, 120)
    || !['queued', 'processing', 'complete', 'failed'].includes(value.status)
    || !time(value.createdAt) || !time(value.updatedAt) || value.updatedAt < value.createdAt
    || !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > 100
    || !(value.errorCode === null || ANALYSIS_ERRORS.includes(value.errorCode))) return false
  if (value.status === 'processing') {
    if (!text(value.leaseId, 120) || !time(value.leaseUntil) || value.leaseUntil <= value.updatedAt) return false
  } else if (value.leaseId !== null || value.leaseUntil !== null) return false
  if (value.status === 'complete') return value.errorCode === null && validateAnalysisResult(value.result)
  return value.result === null && (value.status === 'failed' ? value.errorCode !== null : value.errorCode === null)
}

const string = maxLength => ({ type: 'string', minLength: 1, maxLength })
const nullable = value => ({ anyOf: [value, { type: 'null' }] })
const strictObject = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
export const ANALYSIS_RESULT_SCHEMA = strictObject({
  summary: string(1200),
  objects: { type: 'array', maxItems: 40, items: strictObject({
    id: string(80), name: string(160), category: { type: 'string', enum: OBJECT_CATEGORIES },
    quantity: nullable({ type: 'integer', minimum: 1, maximum: 10000 }),
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence: string(600),
    region: nullable(strictObject(Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, { type: 'number', minimum: 0, maximum: 1 }])))),
    readableLabel: nullable(string(160)), suggestedCrateId: nullable(string(120)), locationHint: nullable(string(240)),
  }) },
  questions: { type: 'array', maxItems: 8, items: string(240) },
})
