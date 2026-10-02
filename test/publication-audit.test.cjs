'use strict';
// Offline negative fixtures: these contradictory strings are not current publication claims.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),p=require('node:path');
const {files}=require('../scripts/integrity.cjs'),{audit}=require('../scripts/publication-audit.cjs');
const root=p.resolve(__dirname,'..'),batch=p.join(root,'work','publication-audit-'+Date.now()+'-'+process.pid);
fs.mkdirSync(batch,{recursive:true});let n=0;
function fixture(){const d=p.join(batch,String(++n));fs.mkdirSync(d);for(const f of files(root,['.git','work','results','node_modules'])){const out=p.join(d,f);fs.mkdirSync(p.dirname(out),{recursive:true});fs.copyFileSync(p.join(root,f),out)}return d;}
test('current source passes and auditor never writes',()=>{const before=files(root,['.git','work','results','node_modules']).map(f=>[f,fs.readFileSync(p.join(root,f)).toString('base64')]);assert.equal(audit(root).status,'PASS');for(const [f,v] of before)assert.equal(fs.readFileSync(p.join(root,f)).toString('base64'),v)});
for(const claim of ['upstream 58','58 upstream','upstream total 122','lock normalization to 0.15.0','current package version 0.15.0','Stellar SDK 16.2.0','no official Nirium hook','Local unpublished','No commits, remote writes, publication','35/35 strict R2 equivalence','L01 is solved','L02 is solved'])test('reject stale claim: '+claim,()=>{const d=fixture();fs.appendFileSync(p.join(d,'docs/GUARANTEES.md'),'\n'+claim);assert.throws(()=>audit(d),/PUBLICATION_AUDIT_FAILED/)});
test('reject false self-escalation expectation',()=>{const d=fixture(),f=p.join(d,'expected/expected-results.json'),data=JSON.parse(fs.readFileSync(f));data.cases.find(x=>x.id==='G1-SELF-ESCALATION').expected='policy DENY';fs.writeFileSync(f,JSON.stringify(data));assert.throws(()=>audit(d),/PUBLICATION_AUDIT_FAILED/)});
test('reject absent required target',()=>{const d=fixture(),f=p.join(d,'README.md');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('1dc596932b0b124ad39bb54c4cb00b10c3b08e5e','wrong'));assert.throws(()=>audit(d),/PUBLICATION_AUDIT_FAILED/)});
test('historical R2 facts stay allowed only in named historical scope',()=>{const d=fixture();fs.appendFileSync(p.join(d,'docs/R2_REPAIR.md'),'\nHistorical upstream 58\n');assert.equal(audit(d).status,'PASS')});
test('reject generated environment artifact',()=>{const d=fixture();fs.writeFileSync(p.join(d,'private.log'),'generated');assert.throws(()=>audit(d),/PUBLICATION_AUDIT_FAILED/)});
test('reject private profile path even inside historical file',()=>{const d=fixture();fs.appendFileSync(p.join(d,'docs/R2_REPAIR.md'),'\n'+'C:'+String.fromCharCode(92)+'Users'+String.fromCharCode(92)+'example');assert.throws(()=>audit(d),/PUBLICATION_AUDIT_FAILED/)});
