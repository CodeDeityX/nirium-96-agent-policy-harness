'use strict';
const assert=require('node:assert/strict');
const H=require('./harness.cjs');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
const store=H.makeStore('NETWORK-GUARD-SELF-CHECK');
await H.ctx.run(store,async()=>{
 for(const [mod,method] of [['node:http','request'],['node:https','get'],['node:net','connect'],['node:tls','connect'],['node:dns','lookup'],['node:dgram','createSocket']])assert.throws(()=>require(mod)[method]('blocked.invalid'),/NETWORK_FORBIDDEN/);
 assert.throws(()=>new (require('node:net').Socket)().connect(443,'blocked.invalid'),/NETWORK_FORBIDDEN/);
 await assert.rejects(fetch('https://blocked.invalid'),/NETWORK_FORBIDDEN/);
 await assert.rejects(new H.S.rpc.Server('https://rpc.invalid').sendTransaction({}),/BROADCAST_FORBIDDEN/);
});
assert.equal(store.network.length,9);
fs.writeFileSync(path.join(process.env.G1_EVIDENCE,'network-guard-self-check.json'),JSON.stringify({status:'PASS',scope:'in-process intercepted transport entrypoints, not an OS firewall',attemptedPhysicalConnections:0,checks:store.network},null,2));
console.log('PASS: 8 network entrypoints and RPC broadcast rejected locally before I/O');
})().catch(e=>{console.error(e.message);process.exitCode=1});
