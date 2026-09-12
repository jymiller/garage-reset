import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAnalysisResult, validateAnalysisRecord, isPhotoFilename, ANALYSIS_VERSION, ANALYSIS_MODEL } from './contract.mjs'
const result = () => ({ summary: 'A closed tote beside a shelf.', objects: [{ id:'object-1', name:'Closed tote', category:'container', quantity:1, confidence:'high', evidence:'A lidded container is visible.', region:{x:0.1,y:0.2,w:0.3,h:0.4}, readableLabel:null, suggestedCrateId:null, locationHint:'Beside the shelf' }], questions:['What is inside the tote?'] })
const record = () => ({ version:1, photoFilename:'one.jpg', sourceSha256:'a'.repeat(64), analysisVersion:ANALYSIS_VERSION, model:ANALYSIS_MODEL, status:'complete', createdAt:1, updatedAt:2, attempts:1, leaseId:null, leaseUntil:null, errorCode:null, result:result() })
test('results retain evidence and unknown counts without accepting dimensions or workspace mutations', () => {
  assert.equal(validateAnalysisResult(result()),true)
  const unknown = result(); unknown.objects[0].quantity=null; unknown.objects[0].region=null
  assert.equal(validateAnalysisResult(unknown),true)
  for(const patch of [{quantity:0},{quantity:2.5},{confidence:0.9},{category:'invented'},{volume:42},{region:{x:0.9,y:0,w:0.2,h:1}},{evidence:''}]) {
    const invalid=result();Object.assign(invalid.objects[0],patch);assert.equal(validateAnalysisResult(invalid),false)
  }
  assert.equal(validateAnalysisResult({...result(),items:[]}),false)
  assert.equal(validateAnalysisResult({...result(),objects:[result().objects[0],result().objects[0]]}),false)
})
test('job lifecycle and URLs validate strictly', () => {
  assert.equal(validateAnalysisRecord(record()),true)
  const queued={...record(),status:'queued',result:null,attempts:0}
  assert.equal(validateAnalysisRecord(queued),true)
  assert.equal(validateAnalysisRecord({...queued,status:'processing',leaseId:'lease',leaseUntil:50}),true)
  assert.equal(validateAnalysisRecord({...queued,status:'failed',errorCode:'not_configured'}),true)
  for(const patch of [{status:'processing'},{status:'failed'},{status:'complete'},{leaseId:'token'},{errorCode:'https://secret'},{updatedAt:0},{sourceSha256:'bad'},{unexpected:true}]) assert.equal(validateAnalysisRecord({...queued,...patch}),false)
  for(const name of ['../one.jpg','/api/photos/one.jpg','https://host/one.jpg','one.jpg?key=x','one.svg','one.jpg.json'])assert.equal(isPhotoFilename(name),false)
  for(const name of ['one.jpg','a-123.png','image_2.webp'])assert.equal(isPhotoFilename(name),true)
})
