import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {Binance,UncertainExecution} from '../server/exchange.ts';
const ticket={symbol:'BTCUSDT',side:'BUY' as const,qty:.01,entry:60000,stop:59000};
const position={symbol:'BTCUSDT',qty:.01,entry:60000,mark:62000,stop:59000,stopId:'old',breakEven:60060};
test('signed requests use only the hard-coded demo host and valid HMAC',async()=>{
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=(async(input:unknown,init:RequestInit)=>{const url=new URL(String(input));assert.equal(url.origin,'https://demo-fapi.binance.com');const sig=url.searchParams.get('signature');url.searchParams.delete('signature');assert.equal(sig,createHmac('sha256','test-secret').update(url.searchParams.toString()).digest('hex'));assert.equal((init.headers as any)['X-MBX-APIKEY'],'test-key');called=true;return new Response('{}',{status:200})}) as typeof fetch;
 try{await new Binance('test-key','test-secret').request('/fapi/v3/account');assert.ok(called)}finally{globalThis.fetch=original}
});
test('entry is post-only with a bounded client ID and a separate protective stop',async()=>{const b=new Binance('test','test');const calls:any[]=[];b.validate=async()=>{};b.request=async(path,params,method)=>{calls.push({path,params,method});return {orderId:123}};await b.place(ticket,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');assert.equal(calls[0].params.timeInForce,'GTX');assert.ok(calls[0].params.newClientOrderId.length<=36);assert.equal(calls[1].path,'/fapi/v1/algoOrder');assert.equal(calls[1].params.reduceOnly,true);assert.equal(calls[1].params.quantity,ticket.qty);assert.equal(calls[1].params.timeInForce,'GTC');assert.equal(calls[1].params.closePosition,undefined);assert.ok(calls[1].params.clientAlgoId.length<=36)});
test('failed protective stop attempts entry cancellation and reports uncertainty',async()=>{const b=new Binance('test','test');const calls:any[]=[];b.validate=async()=>{};b.request=async(path,params,method)=>{calls.push({path,method});if(path==='/fapi/v1/algoOrder')throw new Error('Stop rejected');return {orderId:123}};await assert.rejects(b.place(ticket,'id'),UncertainExecution);assert.equal(calls.at(-1).method,'DELETE')});
test('failed replacement stop never cancels existing protection',async()=>{const b=new Binance('test','test');const calls:any[]=[];b.filters=async()=>[{filterType:'PRICE_FILTER',tickSize:'.1'}];b.request=async(path,params,method)=>{calls.push({path,method});throw new Error('New stop rejected')};await assert.rejects(b.breakeven(position,'id'));assert.equal(calls.length,1);assert.equal(calls[0].method,'POST')});
test('successful replacement is accepted before old stop cancellation',async()=>{const b=new Binance('test','test');const calls:any[]=[];b.filters=async()=>[{filterType:'PRICE_FILTER',tickSize:'.1'}];b.request=async(path,params,method)=>{calls.push({path,params,method});return {}};await b.breakeven(position,'id');assert.deepEqual(calls.map(x=>x.method),['POST','DELETE']);assert.equal(calls[1].params.algoId,'old')});
test('close is reduce-only and cannot report success without a fill',async()=>{const b=new Binance('test','test');b.request=async(_path,params)=>{assert.equal(params?.reduceOnly,true);return {status:'NEW'}};await assert.rejects(b.close(position,'id'),UncertainExecution)});
test('cancel cannot report success for an already filled order',async()=>{const b=new Binance('test','test');b.request=async()=>({status:'FILLED'});await assert.rejects(b.cancel({id:'1',symbol:'BTCUSDT',side:'BUY',qty:.1,price:100,protective:false}),UncertainExecution)});
test('timestamp recovery is bounded and never replays writes',async()=>{
 const original=globalThis.fetch;let calls=0,syncs=0;
 globalThis.fetch=(async()=>{calls++;return new Response(JSON.stringify({code:-1021,msg:'Timestamp outside window'}),{status:400})}) as typeof fetch;
 try {
  const b=new Binance('test','test');b.syncTime=async()=>{syncs++};
  await assert.rejects(b.request('/fapi/v3/account'),/-1021/);assert.equal(calls,2);assert.equal(syncs,1);
  calls=0;syncs=0;
  await assert.rejects(b.request('/fapi/v1/order',{},'POST'),/-1021/);assert.equal(calls,1);assert.equal(syncs,0);
 } finally {globalThis.fetch=original}
});
test('network recovery retries a read once but never a write',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;throw new TypeError('fetch failed')}) as typeof fetch;
 try {
  const b=new Binance('test','test');
  await assert.rejects(b.request('/fapi/v3/account'),/unreachable/);assert.equal(calls,2);
  calls=0;await assert.rejects(b.request('/fapi/v1/order',{},'POST'),UncertainExecution);assert.equal(calls,1);
 } finally {globalThis.fetch=original}
});
