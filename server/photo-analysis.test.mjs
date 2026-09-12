import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createPhotoAnalysisService, createAnalysisFileStorage, analyzePhotoWithGateway, AnalysisError } from './photo-analysis.mjs'
import { validateAnalysisRecord } from '../src/analysis/contract.mjs'
const bytes=Buffer.from('test image bytes')
const result=(summary='A closed tote.')=>({summary,objects:[{id:'one',name:'Tote',category:'container',quantity:1,confidence:'high',evidence:'Closed plastic container.',region:null,readableLabel:'C-001',suggestedCrateId:'invented-by-model',locationHint:'Beside a shelf'}],questions:[]})
const wait=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
function storage(){const objects=new Map([['garage/photos/one.jpg',{bytes,etag:'source'}],['garage/workspace.json',{bytes:Buffer.from('workspace untouched'),etag:'workspace'}]]);let n=0;return{objects,read:async key=>objects.get(key)??null,write:async(key,value,options)=>{const old=objects.get(key);if(options.createOnly?Boolean(old):!old||old.etag!==options.ifMatch)throw new Error('CAS');objects.set(key,{bytes:Buffer.from(value),etag:String(++n)})}}}
function setup(overrides={}){const store=storage(),messages=[];let calls=0;const service=createPhotoAnalysisService({storage:store,configured:()=>true,enqueue:async m=>messages.push(m),analyze:async()=>{calls++;return result()},...overrides});return{store,messages,service,calls:()=>calls}}
test('queued photo completes durably across instances without modifying workspace or accepting invented crate links',async()=>{
 const {store,service,messages,calls}=setup();const before=store.objects.get('garage/workspace.json')
 assert.equal(await service.get('one.jpg'),null)
 const queued=await service.queue('one.jpg');assert.equal(queued.status,'queued');assert.equal(messages.length,1)
 const complete=await service.process('one.jpg');assert.equal(complete.status,'complete');assert.equal(complete.result.objects[0].suggestedCrateId,null)
 assert.equal(validateAnalysisRecord(complete),true)
 const fresh=createPhotoAnalysisService({storage:store});assert.deepEqual(await fresh.get('one.jpg'),complete)
 assert.deepEqual(await service.queue('one.jpg'),complete);assert.equal(calls(),1);assert.equal(store.objects.get('garage/workspace.json'),before)
})
test('missing configuration and enqueue failures are durable failures with photo retained',async()=>{
 for(const options of [{configured:()=>false},{enqueue:async()=>{throw new Error('private queue credentials')}}]){
  const{store,service}=setup(options);const saved=await service.queue('one.jpg');assert.equal(saved.status,'failed');assert.ok(['not_configured','queue_unavailable'].includes(saved.errorCode));assert.equal(validateAnalysisRecord(saved),true);assert.equal(store.objects.get('garage/photos/one.jpg').bytes,bytes)
 }
})
test('concurrent consumers invoke provider once and duplicate completed deliveries do not reprocess',async()=>{
 const gate=wait(),entered=wait();let calls=0;const {service}=setup({analyze:async()=>{calls++;entered.resolve();await gate.promise;return result()}})
 await service.queue('one.jpg');const first=service.process('one.jpg');await entered.promise
 assert.equal((await service.process('one.jpg')).status,'processing');assert.equal(calls,1)
 gate.resolve();await first;await service.process('one.jpg');assert.equal(calls,1)
})
test('expired lease can recover and late old result cannot replace newer analysis',async()=>{
 let time=1000,calls=0;const old=wait(),entered=wait();const {service}=setup({now:()=>time,analyze:async()=>{calls++;if(calls===1){entered.resolve();await old.promise;return result('Old result')}return result('New result')}})
 await service.queue('one.jpg');const first=service.process('one.jpg');await entered.promise;time+=100000
 assert.equal((await service.process('one.jpg')).result.summary,'New result');old.resolve();await first
 assert.equal((await service.get('one.jpg')).result.summary,'New result')
})
test('transient provider failures retry with a bounded attempt count; invalid results are terminal',async()=>{
 const {service}=setup({analyze:async()=>{throw new AnalysisError('provider_unavailable',503,true)}});await service.queue('one.jpg')
 await assert.rejects(service.process('one.jpg'),e=>e.retryable);await assert.rejects(service.process('one.jpg'),e=>e.retryable)
 const final=await service.process('one.jpg');assert.equal(final.status,'failed');assert.equal(final.attempts,3)
 const invalid=setup({analyze:async()=>({items:['fabricated']})});await invalid.service.queue('one.jpg');assert.equal((await invalid.service.process('one.jpg')).errorCode,'invalid_result')
 const permanent=setup({analyze:async()=>{throw new AnalysisError('provider_unavailable',503,false)}});await permanent.service.queue('one.jpg');assert.equal((await permanent.service.process('one.jpg')).attempts,1)
})
test('source changes cannot be analyzed against the earlier hash; arbitrary paths never reach storage',async()=>{
 const {store,service}=setup();await service.queue('one.jpg');store.objects.set('garage/photos/one.jpg',{bytes:Buffer.from('changed'),etag:'changed'})
 assert.equal((await service.process('one.jpg')).errorCode,'photo_unavailable')
 for(const photo of ['../workspace.json','https://example.test/private.jpg','one.jpg?token=private'])await assert.rejects(service.queue(photo),e=>e.status===400)
 await assert.rejects(service.queue('missing.jpg'),e=>e.status===404)
})
test('local analysis files survive restart and missing config does not leave a processing spinner',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'garage-analysis-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.mkdir(path.join(dir,'photos'));await fs.writeFile(path.join(dir,'photos','one.jpg'),bytes)
 const local=createPhotoAnalysisService({storage:createAnalysisFileStorage(dir),configured:()=>false})
 assert.equal((await local.queue('one.jpg')).errorCode,'not_configured')
 const restarted=createPhotoAnalysisService({storage:createAnalysisFileStorage(dir),configured:()=>false});assert.deepEqual(await restarted.get('one.jpg'),await local.get('one.jpg'))
})
test('Gateway uses a fresh runtime OIDC token, strict output schema and only server-read image bytes',async()=>{
 const requests=[];let tokens=0
 const options={getToken:async()=>`runtime-test-${++tokens}`,fetchImpl:async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result())}}]}),{status:200})}}
 await analyzePhotoWithGateway(bytes,{filename:'one.jpg'},options);await analyzePhotoWithGateway(bytes,{filename:'one.jpg'},options)
 assert.equal(tokens,2);assert.equal(requests[0].url,'https://ai-gateway.vercel.sh/v1/chat/completions');assert.equal(requests[1].init.headers.authorization,'Bearer runtime-test-2')
 const body=JSON.parse(requests[0].init.body);assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.model,'openai/gpt-4.1-mini');assert.equal(body.messages[1].content[1].image_url.url,`data:image/jpeg;base64,${bytes.toString('base64')}`)
})
test('provider errors log only fixed status, do not retry schema/credits failures, and reject refusals/truncation',async()=>{
 for(const status of [400,401,402,429,500]){
  const logs=[];await assert.rejects(analyzePhotoWithGateway(bytes,{filename:'one.jpg'},{getToken:async()=>'private-token',logError:d=>logs.push(d),fetchImpl:async()=>new Response('secret provider body',{status})}),e=>e.retryable===(status===429||status>=500))
  assert.deepEqual(logs,[{event:'garage-analysis-provider-failure',status}]);assert.doesNotMatch(JSON.stringify(logs),/secret|private|token|https/)
 }
 for(const choice of [{finish_reason:'length',message:{content:JSON.stringify(result())}},{finish_reason:'stop',message:{refusal:'no',content:JSON.stringify(result())}},{finish_reason:'stop',message:{content:'broken'}}])await assert.rejects(analyzePhotoWithGateway(bytes,{}, {getToken:async()=>'test',fetchImpl:async()=>new Response(JSON.stringify({choices:[choice]}))}),e=>e.code==='invalid_result')
})
