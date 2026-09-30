'use strict';
// R2 dedicated source-integrity controls, separate from the 35 G1 cases.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {test}=require('node:test');const {files,verify}=require('../scripts/integrity.cjs');
const root=path.resolve(__dirname,'..'),batch=path.join(root,'work','integrity-'+Date.now()+'-'+process.pid);
fs.mkdirSync(batch,{recursive:true});
const payload=files(root,['.git','work','results','node_modules']);
const monitor=path.join(batch,'monitor.cjs');
fs.writeFileSync(monitor,String.raw`
const fs=require('node:fs'),p=require('node:path');
const log=process.env.R2_MONITOR_LOG,mode=process.env.R2_MONITOR_MODE;
function reject(name){fs.appendFileSync(log,JSON.stringify({attempt:name})+'\n');if(mode==='late')fs.appendFileSync(p.join(process.cwd(),'SHA256SUMS.txt'),'\n');throw Error('MONITOR_BLOCKED');}
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('node:child_process')[name]=()=>reject('child_process.'+name);
for(const [mod,names] of [['http',['request','get']],['https',['request','get']],['net',['connect','createConnection']],['tls',['connect']],['dgram',['createSocket']],['dns',['lookup','resolve','resolve4','resolve6']]])for(const name of names)require('node:'+mod)[name]=()=>reject(mod+'.'+name);
require('node:net').Socket.prototype.connect=()=>reject('Socket.connect');globalThis.fetch=()=>reject('fetch');
if(mode==='finalization'){const original=fs.writeFileSync;fs.writeFileSync=function(file,...args){if(String(file).endsWith('summary.json'))throw Error('TEST_FINALIZATION_FAILURE');return original.call(this,file,...args)};}
`);
function fixture(name){const dir=path.join(batch,name+' with spaces');fs.mkdirSync(dir);for(const rel of payload){const dest=path.join(dir,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,rel),dest);}return dir;}
function execute(name,mutate,category,mode='block'){
 const dir=fixture(name),manifest=path.join(dir,'SHA256SUMS.txt');mutate?.(dir,manifest);
 const before=fs.existsSync(manifest)?fs.readFileSync(manifest):null,log=path.join(batch,name+'.attempts.jsonl');fs.writeFileSync(log,'');
 const executable=process.platform==='win32'?'powershell.exe':process.execPath;
 const args=process.platform==='win32'?['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(dir,'RUN.ps1')]:['--require',monitor,path.join(dir,'scripts/run.cjs')];
 const environment={...process.env,R2_MONITOR_LOG:log,R2_MONITOR_MODE:mode};delete environment.HARNESS_PS_VERSION;
 if(process.platform==='win32')environment.NODE_OPTIONS='--require '+JSON.stringify(monitor);
 const result=cp.spawnSync(executable,args,{cwd:dir,env:environment,encoding:'utf8',timeout:30000});
 const attempts=fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 const runs=fs.readdirSync(path.join(dir,'results'));let summary=null;
 try{summary=JSON.parse(fs.readFileSync(path.join(dir,'results',runs[0],'summary.json')));}catch{}
 fs.writeFileSync(path.join(batch,name+'.result.json'),JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr,attempts,summary},null,2));
 assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/PASS: upstream/);
 if(category){assert.equal(summary.stage,'SOURCE_INTEGRITY');assert.equal(summary.sourceIntegrity.initial.status,'FAIL');assert.equal(summary.sourceIntegrity.initial.category,category);assert.deepEqual(attempts,[]);assert.equal(summary.UPSTREAM_BASELINE,'NOT_RUN');assert.equal(summary.G1,'NOT_RUN');}
 if(mode!=='late'){if(before)assert.deepEqual(fs.readFileSync(manifest),before);else assert.equal(fs.existsSync(manifest),false);}
 return {dir,summary,attempts,result};
}
test('A published test bytes with exactly the stale published hash',()=>execute('A',(dir,m)=>{
 const actual=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir,'test/g1.test.cjs'))).digest('hex');
 assert.equal(actual,'068edf698857099aa123ace5dff94e8ada445d7a197c8d20e4904de7a7489fd1');
 fs.writeFileSync(m,fs.readFileSync(m,'utf8').replace(actual+'  test/g1.test.cjs','00761d669c882d67a5b1409edf24eaf4e0fbb50f3863d6d459eac27708e2e0be  test/g1.test.cjs'));
},'HASH_MISMATCH'));
test('B one byte source mutation',()=>execute('B',d=>fs.appendFileSync(path.join(d,'src/runtime.cjs'),' '),'HASH_MISMATCH'));
test('C missing source',()=>execute('C',d=>fs.unlinkSync(path.join(d,'test/g1.test.cjs')),'MISSING_FILE'));
test('D absent manifest',()=>execute('D-absent',(_,m)=>fs.unlinkSync(m),'MISSING_FILE'));
test('D empty manifest',()=>execute('D-empty',(_,m)=>fs.writeFileSync(m,''),'EMPTY_MANIFEST'));
test('E malformed manifest',()=>execute('E-malformed',(_,m)=>fs.appendFileSync(m,'not a hash\n'),'MALFORMED_MANIFEST'));
test('E duplicate entry',()=>execute('E-duplicate',(_,m)=>fs.appendFileSync(m,fs.readFileSync(m,'utf8').split('\n')[0]+'\n'),'DUPLICATE_ENTRY'));
test('E omitted entry',()=>execute('E-omitted',(_,m)=>fs.writeFileSync(m,fs.readFileSync(m,'utf8').split('\n').filter(x=>!x.endsWith('  test/g1.test.cjs')).join('\n')),'UNEXPECTED_OR_OMITTED_FILE'));
test('F unexpected source',()=>execute('F-extra',d=>fs.writeFileSync(path.join(d,'src/unexpected.cjs'),'x'),'UNEXPECTED_OR_OMITTED_FILE'));
for(const [name,unsafe] of [['traversal','../escape'],['absolute','/tmp/escape'],['drive','C:/escape']])test('F unsafe '+name,()=>execute('F-'+name,(_,m)=>fs.appendFileSync(m,'0'.repeat(64)+'  '+unsafe+'\n'),'UNSAFE_MANIFEST_PATH'));
test('F directory link escape',()=>execute('F-link',d=>fs.symlinkSync(batch,path.join(d,'escape'),process.platform==='win32'?'junction':'dir'),'UNSAFE_LINK'));
test('missing config remains inside source reporting path',()=>execute('config-missing',d=>fs.unlinkSync(path.join(d,'config/upstream.json')),'MISSING_FILE'));
test('malformed stale config fails before parse',()=>execute('config-malformed',d=>fs.writeFileSync(path.join(d,'config/upstream.json'),'{'),'HASH_MISMATCH'));
test('G manifest changed after initial validation never final PASS',()=>{
 const {summary,attempts}=execute('G',null,null,'late');assert.equal(summary.sourceIntegrity.initial.status,'PASS');assert.equal(summary.sourceIntegrity.final.status,'FAIL');assert.equal(summary.sourceIntegrity.final.category,'MANIFEST_CHANGED');assert.equal(summary.candidateSourceManifestVerified,false);assert.equal(attempts.length,1);
});
test('H intact gate passes; external monitor blocks first operational child',()=>{
 const {dir,summary,attempts}=execute('H');assert.equal(verify(dir).status,'PASS');assert.equal(summary.sourceIntegrity.initial.status,'PASS');assert.equal(summary.sourceIntegrity.final.status,'PASS');assert.equal(attempts.length,1);assert.equal(summary.G1,'NOT_RUN');
 const v=cp.spawnSync(process.execPath,[path.join(dir,'scripts/verify.cjs')],{encoding:'utf8'});assert.equal(v.status,0);
});
test('result finalization failure keeps nonzero and prints no success',()=>{const {result}=execute('finalization',null,null,'finalization');assert.match(result.stderr,/RESULT_FINALIZATION_FAILED/);});
