'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness.cjs');
const {S,ctx,networkPassphrase,asset,payTo,makeStore,setup,decision,fetchPayment}=H;
const ledger=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function barrier(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function rejectsExpected(s,promise,code){await assert.rejects(promise,e=>{(s.observedErrors??=[]).push(e.message);return e.message.includes(code)});}
async function until(predicate){const deadline=Date.now()+2000;while(!predicate()){if(Date.now()>deadline)throw Error('HARNESS_BARRIER_TIMEOUT');await delay(1)}}
function check(id,expected,fn,scope='real Agent/x402 signing path'){
 test(id,{timeout:5000},async()=>{
  const store=makeStore(id);
  const row={id,expected,scope,actual:'RUNNING',realModules:['Nirium Agent','@x402/fetch','@x402/core','@x402/stellar ExactStellarScheme','Stellar SDK 16.2.0 AssembledTransaction/XDR/Ed25519','public-R1 candidate with freshness + G1 composition'],simulatedModules:['merchant fetch challenge and paid response','RPC getLatestLedger and simulateTransaction','Horizon ledger times','policy and confirmed state'],signedAuthorizationEscapedHarness:false,transactionsBroadcast:0,keysUsed:'ephemeral unfunded in-memory test key only',productionSourceMutation:false,limitations:['No remote node verification/settlement','L01 reads do not reserve','L02 direct signer bypass','legacy preimage lacks separate credential-address field']};
  if(id==='G1-SELF-ESCALATION'){
   row.realModules=['Nirium Agent.initX402/client construction only','Stellar SDK 16.2.0 XDR HashIdPreimage','public-R1 candidate with freshness + G1 composition'];
   row.simulatedModules=['administrative invocation injected at adapter boundary','spending-credential policy fixture'];
   row.limitations.push('No Agent.x402Fetch, AssembledTransaction or actual administrator/governance execution in this case');
  }
  if(id==='G1-FRACTIONATION')row.policyState={source:'simulated confirmed state',limit:'2000',deniedSpent:'1996',allowedControlSpent:'1000',requested:'499',reservation:false};
  ledger.push(row);
  try{await ctx.run(store,()=>fn(store));assert.equal(store.fallback,0);row.actual='PASS';}catch(e){row.actual='FAIL';row.error=String(e.message);throw e;}finally{
   row.signerCallCount=store.calls;row.authorizationCount=store.authorizations;row.policyDecision=store.decisions;row.networkRequestsAttempted=store.network;row.externalNetworkAttempts=store.network.filter(e=>e.layer.startsWith('BLOCKED')).length;
   row.decisionNote=id==='G1-POLICY-ERROR'?'provider threw; no decision':id==='G1-TIMEOUT'?'provider unresolved; deadline expired':id==='G1-LATE-ALLOW'?'ALLOW recorded after deadline and ignored':'see ordered policyDecision and expected outcome';
   row.acceptedPayloads=store.payloads;row.contexts=store.contexts.map(c=>({requestId:c.requestId,contextHash:c.contextHash,semantic:c.semantic}));
   row.freshnessChecks=store.freshness;row.freshnessScenario=store.freshnessScenario??null;row.observedErrors=store.observedErrors??[];
  }
 });
}
check('G1-ALLOW','one signer call; cryptographically valid result incorporated into real x402 payment',async s=>{
 const {agent}=setup(s,c=>decision(c));assert.equal((await fetchPayment(agent)).status,200);assert.equal(s.calls,1);assert.equal(s.authorizations,1);assert.equal(s.payloads.length,1);
 const c=s.contexts[0].semantic;assert.equal(c.asset,asset);assert.equal(c.to,payTo);assert.equal(c.from,s.key.publicKey());assert.equal(c.amount,'499');assert.equal(c.expirationLedger,112);assert.ok(BigInt(c.nonce)>1000n);assert.equal(c.subInvocations,0);
});
for(const [id,kind,code] of [['G1-DENY','DENY','POLICY_DENIED'],['G1-WAIT','WAIT','POLICY_WAIT']])check(id,'zero signer calls and no paid retry',async s=>{
 const {agent}=setup(s,c=>decision(c,kind));await assert.rejects(fetchPayment(agent),new RegExp(code));assert.equal(s.calls,0);assert.equal(s.payloads.length,0);
});
check('G1-POLICY-ERROR','provider error fails closed',async s=>{const {agent}=setup(s,()=>{throw Error('fixture unavailable')});await assert.rejects(fetchPayment(agent),/POLICY_UNAVAILABLE/);assert.equal(s.calls,0)});
check('G1-TIMEOUT','provider never resolves; zero signer calls',async s=>{const {agent}=setup(s,()=>new Promise(()=>{}),{timeoutMs:20});await assert.rejects(fetchPayment(agent),/POLICY_TIMEOUT/);assert.equal(s.calls,0)});
check('G1-LATE-ALLOW','late ALLOW remains unable to sign after timeout',async s=>{const {agent}=setup(s,async c=>{await delay(80);return decision(c)},{timeoutMs:20});await assert.rejects(fetchPayment(agent),/POLICY_TIMEOUT/);await delay(100);assert.deepEqual(s.decisions,['ALLOW']);assert.equal(s.calls,0)});
check('G1-DECISION-BINDING','decision A rejected for B; only A signs',async s=>{let first;const {agent}=setup(s,c=>first??(first=decision(c)));await fetchPayment(agent,'100','A');await assert.rejects(fetchPayment(agent,'101','B'),/DECISION_BINDING_MISMATCH/);assert.equal(s.calls,1);assert.equal(s.payloads.length,1);assert.notEqual(s.contexts[0].contextHash,s.contexts[1].contextHash)});
check('G1-CONCURRENT-ISOLATION','B resolves DENY before A ALLOW; A only signs its exact input',async s=>{
 let resolveA,resolveB;const seen=[];
 const {agent}=setup(s,c=>new Promise(resolve=>{seen.push(c.semantic.amount);if(c.semantic.amount==='101')resolveA=()=>resolve(decision(c));else resolveB=()=>resolve(decision(c,'DENY'))}));
 const a=fetchPayment(agent,'101','A');const b=fetchPayment(agent,'202','B');const bRejected=assert.rejects(b,/POLICY_DENIED/);
 await until(()=>resolveA&&resolveB);resolveB();await bRejected;assert.equal(s.calls,0);resolveA();await a;
 assert.equal(s.calls,1);assert.equal(s.payloads[0].semantic.amount,'101');assert.deepEqual(s.decisions,['DENY','ALLOW']);
});
check('G1-CONCURRENT-ALLOW-PAIR','two reverse-order ALLOW results stay bound to their own requests',async s=>{
 const pending=new Map();const {agent}=setup(s,c=>new Promise(r=>pending.set(c.semantic.amount,()=>r(decision(c)))));
 const a=fetchPayment(agent,'111','A'),b=fetchPayment(agent,'222','B');await until(()=>pending.size===2);
 pending.get('222')();await b;pending.get('111')();await a;
 assert.equal(s.calls,2);assert.deepEqual(s.payloads.map(x=>x.semantic.amount),['222','111']);assert.equal(new Set(s.payloads.map(x=>x.preimageHash)).size,2);
});
check('G1-FRACTIONATION','confirmed-state fixture 1996/2000 rejects 499; sufficient-capacity control signs',async s=>{
 let confirmedSpent=1996n;
 const {agent}=setup(s,c=>decision(c,confirmedSpent+BigInt(c.semantic.amount)<=2000n?'ALLOW':'DENY'));
 await assert.rejects(fetchPayment(agent,'499'),/POLICY_DENIED/);assert.equal(s.calls,0);
 confirmedSpent=1000n;await fetchPayment(agent,'499');assert.equal(s.calls,1);assert.equal(s.payloads.length,1);
});
check('G1-SELF-ESCALATION','administrative boundary injection DENY, zero signer calls',async s=>{
 const {signer}=setup(s,c=>decision(c,c.semantic.method==='transfer'?'ALLOW':'DENY'));
 const call=new S.xdr.InvokeContractArgs({contractAddress:new S.Address(asset).toScAddress(),functionName:'expand_policy',args:[S.nativeToScVal(999999n,{type:'i128'})]});
 const invocation=new S.xdr.SorobanAuthorizedInvocation({function:S.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),subInvocations:[]});
 const pre=S.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(new S.xdr.HashIdPreimageSorobanAuthorization({networkId:S.hash(Buffer.from(networkPassphrase)),nonce:S.xdr.Int64.fromString('9001'),signatureExpirationLedger:112,invocation}));
 await assert.rejects(signer.signAuthEntry(pre.toXDR('base64'),{address:s.key.publicKey()}),/POLICY_DENIED/);assert.equal(s.calls,0);assert.equal(s.contexts[0].semantic.method,'expand_policy');
},'boundary injection of real XDR; exact scheme only expresses transfer; no claim x402Fetch executed admin action');
check('G1-SIGNER-ERROR-NO-RETRY','one possibly-issued signature; zero retries and no payment payload',async s=>{const {agent}=setup(s,c=>decision(c),{throwAfter:true});await assert.rejects(fetchPayment(agent),/SIGNER_OUTCOME_UNKNOWN/);assert.equal(s.calls,1);assert.equal(s.authorizations,1);assert.equal(s.payloads.length,0)});
check('G1-SIGNATURE-RESULT-INTEGRITY','signature over mutated amount rejected; no payment payload',async s=>{
 const {agent}=setup(s,c=>decision(c),{mutate(input){const p=S.xdr.HashIdPreimage.fromXDR(input,'base64');p.sorobanAuthorization().invocation().function().contractFn().args()[2]=S.nativeToScVal(999n,{type:'i128'});return p.toXDR('base64')}});
 await assert.rejects(fetchPayment(agent),/SIGNER_OUTCOME_UNKNOWN/);assert.equal(s.calls,1);assert.equal(s.payloads.length,0);
});
const mutations={
 NETWORK:a=>a.networkId(Buffer.alloc(32,7)),
 DESTINATION:a=>a.invocation().function().contractFn().args()[1]=S.nativeToScVal(S.Keypair.random().publicKey(),{type:'address'}),
 ASSET:a=>a.invocation().function().contractFn().contractAddress(new S.Address(S.StrKey.encodeContract(Buffer.alloc(32,23))).toScAddress()),
 NONCE:a=>a.nonce(S.xdr.Int64.fromString('777777')),
 EXPIRY:a=>a.signatureExpirationLedger(999),
 TREE:a=>a.invocation().subInvocations([S.xdr.SorobanAuthorizedInvocation.fromXDR(a.invocation().toXDR())])
};
for(const [field,mutate] of Object.entries(mutations))check('G1-SIGNED-'+field+'-TAMPER','signature for changed '+field+' cannot enter x402 payload',async s=>{
 const {agent}=setup(s,c=>decision(c),{mutate(input){const p=S.xdr.HashIdPreimage.fromXDR(input,'base64');mutate(p.sorobanAuthorization());return p.toXDR('base64')}});
 await assert.rejects(fetchPayment(agent),/SIGNER_OUTCOME_UNKNOWN/);assert.equal(s.calls,1);assert.equal(s.authorizations,1);assert.equal(s.payloads.length,0);
});
check('G1-PREIMAGE-NETWORK-REJECTION','preimage from different network fails before signer',async s=>{
 const {agent,signer}=setup(s,c=>decision(c,'DENY'));await assert.rejects(fetchPayment(agent),/POLICY_DENIED/);
 const p=S.xdr.HashIdPreimage.fromXDR(s.contexts[0].authEntry,'base64');mutations.NETWORK(p.sorobanAuthorization());
 await assert.rejects(signer.signAuthEntry(p.toXDR('base64'),{address:s.key.publicKey()}),/POLICY_UNAVAILABLE/);assert.equal(s.calls,0);
},'real x402 captures original XDR; altered preimage injected at adapter boundary');
check('G1-PREIMAGE-ACCOUNT-REJECTION','transfer.from different from configured signer fails before signer',async s=>{
 const {agent,signer}=setup(s,c=>decision(c,'DENY'));await assert.rejects(fetchPayment(agent),/POLICY_DENIED/);
 const p=S.xdr.HashIdPreimage.fromXDR(s.contexts[0].authEntry,'base64');p.sorobanAuthorization().invocation().function().contractFn().args()[0]=S.nativeToScVal(S.Keypair.random().publicKey(),{type:'address'});
 await assert.rejects(signer.signAuthEntry(p.toXDR('base64'),{address:s.key.publicKey()}),/POLICY_UNAVAILABLE/);assert.equal(s.calls,0);
},'real x402 captures original XDR; altered preimage injected at adapter boundary');
check('G1-SIGNER-IDENTITY-CHANGE','underlying signer identity change cannot issue authorization',async s=>{
 let raw;const setupResult=setup(s,c=>{raw.address=S.Keypair.random().publicKey();return decision(c)});raw=setupResult.raw;
 await assert.rejects(fetchPayment(setupResult.agent),/SIGNER_OUTCOME_UNKNOWN/);assert.equal(s.calls,0);
});
check('G1-NO-SECRET-FALLBACK','DENY has no fallback and mixed signer/secret config rejected',async s=>{
 const {agent,signer}=setup(s,c=>decision(c,'DENY'));assert.throws(()=>agent.initX402({signer,secretKey:'not-a-real-key',network:'stellar:testnet'}),/both/);await assert.rejects(fetchPayment(agent),/POLICY_DENIED/);assert.equal(s.calls,0);
});
check('L01','two independent preflights see 400 and each sign 300; reservation NOT_SOLVED',async s=>{
 const {agent}=setup(s,c=>decision(c,BigInt(c.semantic.amount)<=400n?'ALLOW':'DENY'));
 await Promise.all([fetchPayment(agent,'300','A'),fetchPayment(agent,'300','B')]);assert.equal(s.calls,2);assert.equal(s.payloads.length,2);assert.equal(s.payloads.reduce((n,p)=>n+BigInt(p.semantic.amount),0n),600n);
});
check('L02','direct raw signer bypasses DENY wrapper; bypass NOT_SOLVED',async s=>{
 const {agent,raw}=setup(s,c=>decision(c,'DENY'));await assert.rejects(fetchPayment(agent),/POLICY_DENIED/);assert.equal(s.calls,0);
 const input=s.contexts[0].authEntry;await raw.signAuthEntry(input,{address:s.key.publicKey(),networkPassphrase});assert.equal(s.calls,1);assert.equal(s.payloads.length,0);
});

check('G1-ALLOW-CURRENT-VERSION','v7 ALLOW, v7 current, unexpired: exactly one signature',async s=>{
 const now=1000;s.freshnessScenario={decisionVersion:'v7',currentVersion:'v7',now,expiresAt:2000};
 const {agent}=setup(s,c=>decision(c),{now:()=>now,currentPolicyVersion:async()=> 'v7'});
 await fetchPayment(agent);assert.equal(s.calls,1);assert.equal(s.freshness.length,1);assert.equal(s.payloads.length,1);
});
check('G1-STALE-ALLOW-POLICY-VERSION','v7 ALLOW becomes stale at v8 final check; zero signer calls',async s=>{
 const entered=barrier(),release=barrier();let current='v7';
 const {agent}=setup(s,c=>decision(c),{currentPolicyVersion:async()=>{entered.resolve();await release.promise;return current}});
 const request=fetchPayment(agent);const rejected=rejectsExpected(s,request,'POLICY_VERSION_STALE');
 await entered.promise;current='v8';release.resolve();await rejected;assert.equal(s.calls,0);
 s.freshnessScenario={decisionVersion:'v7',versionAtCheck:current,barrier:'version changed before freshness source returned',clock:1000,expiresAt:2000};
});
check('G1-ALLOW-EXPIRED','expiry boundary reached before signing; zero signer calls',async s=>{
 let now=1000;const {agent}=setup(s,c=>{const d=decision(c);now=2000;return d},{now:()=>now});
 await rejectsExpected(s,fetchPayment(agent),'POLICY_DECISION_EXPIRED');assert.equal(s.calls,0);
 s.freshnessScenario={decisionVersion:'v7',currentVersion:'v7',nowAtDecision:1000,nowAtCheck:now,expiresAt:2000};
});
check('G1-FRESHNESS-SOURCE-ERROR','freshness unavailable fails closed; zero signer calls',async s=>{
 const {agent}=setup(s,c=>decision(c),{currentPolicyVersion:async()=>{throw Error('fixture offline')}});
 await rejectsExpected(s,fetchPayment(agent),'POLICY_FRESHNESS_UNAVAILABLE');assert.equal(s.calls,0);
});
check('G1-STALE-ALLOW-CONCURRENT-REVISION','A and B obtain v7 ALLOW; A signs at v7 and B is stale at v8',async s=>{
 const both=barrier(),letA=barrier(),letB=barrier();let arrivals=0,current='v7';
 // The freshness API receives the bound base context. Decode the actual XDR
 // to route barriers; economic identity never comes from a URL or label.
 const byAmount=require('../src/stellar-policy-signer.cjs').decode;
 // Both requests share one adapter and one explicit freshness source.
 const shared=setup(s,c=>decision(c),{currentPolicyVersion:async c=>{
  if(++arrivals===2)both.resolve();const amount=byAmount(c.authEntry,c.account,c.networkPassphrase).amount;
  await (amount==='101'?letA:letB).promise;return current;
 }});
 const a=fetchPayment(shared.agent,'101','A');const b=fetchPayment(shared.agent,'202','B');
 const bRejected=rejectsExpected(s,b,'POLICY_VERSION_STALE');
 await both.promise;assert.deepEqual(s.decisions,['ALLOW','ALLOW']);letA.resolve();await a;
 current='v8';letB.resolve();await bRejected;
 assert.equal(s.calls,1);assert.equal(s.payloads[0].semantic.amount,'101');
 assert.equal(new Set(s.contexts.map(c=>c.requestId)).size,2);
 s.freshnessScenario={bothDecisionVersion:'v7',AObserved:'v7',BObserved:'v8',order:['both evaluated','A checked and signed','revision v8','B checked and rejected'],clock:1000,expiresAt:2000};
});
for(const field of ['policyVersion','expiresAt'])check('G1-ALLOW-MISSING-'+field.toUpperCase(),'missing mandatory ALLOW metadata fails closed',async s=>{
 const {agent}=setup(s,c=>{const d=decision(c);delete d[field];return d});
 await rejectsExpected(s,fetchPayment(agent),'INVALID_POLICY_DECISION');assert.equal(s.calls,0);
});
check('G1-EXPIRY-DURING-FRESHNESS','expiry is rechecked after awaited version source',async s=>{
 let now=1000;const {agent}=setup(s,c=>decision(c),{now:()=>now,currentPolicyVersion:async()=>{now=2000;return 'v7'}});
 await rejectsExpected(s,fetchPayment(agent),'POLICY_DECISION_EXPIRED');assert.equal(s.calls,0);
 s.freshnessScenario={beforeVersionRead:1000,afterVersionRead:2000,expiresAt:2000};
});
check('G1-FRESHNESS-SOURCE-TIMEOUT','unresolved freshness source times out closed',async s=>{
 const {agent}=setup(s,c=>decision(c),{freshnessTimeoutMs:20,currentPolicyVersion:()=>new Promise(()=>{})});
 await rejectsExpected(s,fetchPayment(agent),'POLICY_FRESHNESS_UNAVAILABLE');assert.equal(s.calls,0);
});
check('G1-FRESHNESS-SOURCE-INVALID','empty current version is unavailable, not a matching decision',async s=>{
 const {agent}=setup(s,c=>decision(c),{currentPolicyVersion:async()=> ''});
 await rejectsExpected(s,fetchPayment(agent),'POLICY_FRESHNESS_UNAVAILABLE');assert.equal(s.calls,0);
});
after(()=>{
 const out=process.env.G1_EVIDENCE;if(!out)throw Error('Use RUN.ps1: missing result directory');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'g1-ledger.json'),JSON.stringify(ledger,null,2));
 fs.writeFileSync(path.join(out,'network-ledger.json'),JSON.stringify(H.requests,null,2));
 assert.equal(H.requests.filter(x=>x.layer==='BLOCKED_BROADCAST').length,0);
 assert.equal(H.requests.filter(x=>x.layer==='BLOCKED_NETWORK').length,0);
});

