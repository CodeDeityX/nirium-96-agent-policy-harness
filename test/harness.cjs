'use strict';
const assert=require('node:assert/strict');
const {AsyncLocalStorage}=require('node:async_hooks');
const {stellar:S,sdkRequire}=require('../src/runtime.cjs');
const {decode}=require('../src/observe.cjs');
const ctx=new AsyncLocalStorage();
const requests=[];
const networkPassphrase=S.Networks.TESTNET;
// Default testnet asset from installed scheme; contract state remains simulated.
const asset=sdkRequire('@x402/stellar').USDC_TESTNET_ADDRESS;
const payTo=S.Keypair.random().publicKey();
let nonce=1000;
const fingerprint=b=>S.hash(Buffer.from(b)).toString('hex');
function event(layer,detail){const e={case:ctx.getStore()?.id??'setup',layer,detail};requests.push(e);ctx.getStore()?.network.push(e);}
// Deny actual sockets, HTTP, TLS, DNS and datagrams. All authorized test
// transport below is in-memory; no saved original transport is invoked.
for(const [mod,names] of [['node:http',['request','get']],['node:https',['request','get']],['node:net',['connect','createConnection']],['node:tls',['connect']],['node:dgram',['createSocket']],['node:dns',['lookup','resolve','resolve4','resolve6']]]){
 const m=require(mod);for(const n of names)m[n]=()=>{event('BLOCKED_NETWORK',mod+'.'+n);throw Error('NETWORK_FORBIDDEN')};
}
require('node:net').Socket.prototype.connect=function(){event('BLOCKED_NETWORK','Socket.connect');throw Error('NETWORK_FORBIDDEN')};
S.rpc.Server.prototype.getLatestLedger=async function(){event('SIMULATED_RPC','getLatestLedger');return {sequence:100,protocolVersion:23,id:'fixture'};};
S.Horizon.Server.prototype.ledgers=function(){event('SIMULATED_HORIZON','ledgers');const q={limit(){return q},order(){return q},async call(){return {records:[{closed_at:'2026-01-01T00:00:05Z'},{closed_at:'2026-01-01T00:00:00Z'}]}}};return q};
S.rpc.Server.prototype.simulateTransaction=async function(tx){
 event('SIMULATED_RPC','simulateTransaction');
 const op=tx.operations[0];
 const call=op.func.invokeContract();
 let auth=op.auth??[];
 if(!auth.length){
  const from=S.Address.fromScAddress(call.args()[0].address()).toString();
  const root=new S.xdr.SorobanAuthorizedInvocation({function:S.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),subInvocations:[]});
  const entry=new S.xdr.SorobanAuthorizationEntry({credentials:S.xdr.SorobanCredentials.sorobanCredentialsAddress(new S.xdr.SorobanAddressCredentials({address:new S.Address(from).toScAddress(),nonce:S.xdr.Int64.fromString(String(++nonce)),signatureExpirationLedger:0,signature:S.xdr.ScVal.scvVoid()})),rootInvocation:root});
  ctx.getStore()?.mutateAuth?.(entry);
  auth=[entry];
 }
 return {_parsed:true,id:'fixture',latestLedger:100,events:[],minResourceFee:'0',transactionData:new S.SorobanDataBuilder(),result:{auth,retval:S.xdr.ScVal.scvVoid()}};
};
S.rpc.Server.prototype.sendTransaction=async function(){event('BLOCKED_BROADCAST','sendTransaction');throw Error('BROADCAST_FORBIDDEN')};
const http=sdkRequire('@x402/core/http');
globalThis.fetch=async(input,init)=>{
 const r=new Request(input,init),store=ctx.getStore();
 if(new URL(r.url).origin!=='https://merchant.invalid'){event('BLOCKED_NETWORK','fetch');throw Error('NETWORK_FORBIDDEN')}
 event('SIMULATED_MERCHANT',r.headers.has('PAYMENT-SIGNATURE')?'paid retry':'402 challenge');
 if(r.headers.has('PAYMENT-SIGNATURE')){
  const payment=http.decodePaymentSignatureHeader(r.headers.get('PAYMENT-SIGNATURE'));
  const tx=S.TransactionBuilder.fromXDR(payment.payload.transaction,networkPassphrase);
  assert.equal(tx.signatures.length,0,'no envelope signing');
  const entries=tx.operations[0].auth;
  assert.equal(entries.length,1);
  const entry=entries[0],cred=entry.credentials().address();
  const pre=S.buildAuthorizationEntryPreimage(entry,cred.signatureExpirationLedger(),networkPassphrase).toXDR('base64');
  const semantic=decode(pre,store.key.publicKey(),networkPassphrase);
  assert.equal(semantic.amount,new URL(r.url).searchParams.get('amount'));
  assert.equal(semantic.asset,asset);assert.equal(semantic.to,payTo);
  assert.equal(S.Address.fromScAddress(cred.address()).toString(),store.key.publicKey());
  assert.equal(entry.rootInvocation().function().contractFn().toXDR('base64'),tx.operations[0].func.invokeContract().toXDR('base64'));
  assert.ok(store.signedInputs.includes(pre),'paid payload must contain this request authorized preimage');
  const map=S.scValToNative(cred.signature())[0];
  assert.ok(S.Keypair.fromPublicKey(S.StrKey.encodeEd25519PublicKey(Buffer.from(map.public_key))).verify(S.hash(Buffer.from(pre,'base64')),Buffer.from(map.signature)));
  store.payloads.push({preimageHash:fingerprint(Buffer.from(pre,'base64')),semantic,cryptographicSignatureVerified:true,envelopeSignatures:tx.signatures.length});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
 }
 const amount=new URL(r.url).searchParams.get('amount')||'499';
 const requirements={x402Version:2,resource:{url:r.url,description:'local-only fixture',mimeType:'application/json'},accepts:[{scheme:'exact',network:'stellar:testnet',asset,amount,payTo,maxTimeoutSeconds:60,extra:{areFeesSponsored:true}}]};
 return new Response(JSON.stringify(requirements),{status:402,headers:{'PAYMENT-REQUIRED':http.encodePaymentRequiredHeader(requirements),'content-type':'application/json'}});
};
// Require after network controls. Agent/fetch/client/scheme/build/signAuthEntries
// are the actual installed implementations, unpatched.
const {Agent}=sdkRequire('./dist/index.js');
function makeStore(id){return {id,key:S.Keypair.random(),network:[],decisions:[],calls:0,authorizations:0,signedInputs:[],payloads:[],contexts:[],freshness:[],fallback:0,returned:0,verified:0,observer:[],signerSamples:[],returnedShapes:[],errorDetails:[]};}
function rawSigner(store,behavior){return {address:store.key.publicKey(),async signAuthEntry(input,opts){
 const active=ctx.getStore();active.calls++;active.signedInputs.push(input);
 assert.equal(opts.address,store.key.publicKey());
 if(behavior?.throwBefore)throw Error('signer rejected before signature');
 const signingInput=behavior?.mutate?behavior.mutate(input):input;
 const sig=store.key.sign(S.hash(Buffer.from(signingInput,'base64'))).toString('base64');active.authorizations++;
 if(behavior?.throwAfter)throw Error('simulated signer failure after signature');
 active.returned++;const verified=store.key.verify(S.hash(Buffer.from(input,'base64')),Buffer.from(sig,'base64'));if(verified)active.verified++;active.signerSamples.push({verified,now:behavior?.now?.()??1000,address:behavior?.addressAtSign?.()??null});
 const result={signedAuthEntry:sig,signerAddress:store.key.publicKey()};active.returnedShapes.push({keys:Object.keys(result),signedAuthEntryPresent:true,type:typeof result.signedAuthEntry,nonempty:result.signedAuthEntry.trim().length>0});return result;
 },async signTransaction(){ctx.getStore().fallback++;throw Error('FALLBACK_FORBIDDEN')}};}
// The compatibility view only renames fields for the historical stimuli. It makes no policy decision.
function view(c){return {...c,requestId:c.contextHash,authEntry:c.authorization.preimageXdr,account:c.signer,networkPassphrase:c.authorization.networkPassphrase,semantic:decode(c.authorization.preimageXdr,c.signer,c.authorization.networkPassphrase)};}
function setup(store,evaluate,options={}){
 store.mutateAuth=options.mutateAuth;
 const raw=rawSigner(store,options);
 options.configureRaw?.(raw,store);
 const policy={requireExpiry:true,now:options.now??(()=>1000),timeoutMs:options.timeoutMs??options.freshnessTimeoutMs??5000,
 evaluate:async (c,opts)=>{const active=ctx.getStore(),v=view(c);active.contexts.push(v);const d=await evaluate(v,opts);active.decisions.push(d?.decision??'invalid');return d;},
 currentVersion:async (c,opts)=>{const active=ctx.getStore(),v=view(c);const observation={contextHash:c.contextHash};active.freshness.push(observation);try{const result=await (options.currentPolicyVersion??(async()=> 'v7'))(v,opts);observation.observedVersion=result;return result;}catch(e){observation.error='freshness source error';throw e;}},
 onDecision:record=>{store.observer.push({outcome:record.outcome,contextHash:record.context?.contextHash,signerCallsAtReport:store.calls,returnedAtReport:store.returned});return options.onDecision?.(record,raw);}};
 const agent=new Agent({apiKey:'non-secret-test-placeholder',baseUrl:'https://backend.invalid'});
 agent.initX402({signer:raw,policy,network:'stellar:testnet',rpcUrl:'https://rpc.invalid'});
 // Private helper is lazy and used ONLY by the network-preimage boundary test.
 // RPC auth entries do not carry networkId; the real SDK derives it locally.
 function networkBoundarySigner(){const {createPolicyGatedSigner}=sdkRequire('./dist/x402-policy.js');return createPolicyGatedSigner(raw,policy,()=>({url:'https://merchant.invalid/artificial',method:'GET',requirements:{scheme:'exact',network:'stellar:testnet',asset,payTo,amount:'499',maxTimeoutSeconds:60}}));}
 return {agent,raw,policy,networkBoundarySigner};
}
const decision=(c,kind='ALLOW',fields={})=>({decision:kind,contextHash:c.contextHash,policyVersion:'v7',expiresAt:2000,...fields});
const fetchPayment=(agent,amount='499',label='request')=>agent.x402Fetch('https://merchant.invalid/'+label+'?amount='+amount);
module.exports={S,Agent,ctx,requests,networkPassphrase,asset,payTo,makeStore,setup,decision,fetchPayment,rawSigner,fingerprint};
