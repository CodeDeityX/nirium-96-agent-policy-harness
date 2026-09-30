'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {hash,files,manifest,verify}=require('./integrity.cjs');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'config/upstream.json')));
const expected=JSON.parse(fs.readFileSync(path.join(root,'expected/expected-results.json')));
const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
const results=path.join(root,'results',stamp),work=path.join(root,'work',stamp);
fs.mkdirSync(results,{recursive:true});fs.mkdirSync(work,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(results,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
const repo=path.join(work,'nirium'),sdk=path.join(repo,'packages/sdk');
const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const env={...process.env};
for(const key of Object.keys(env))if(/^npm_config_/i.test(key)||['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','G1_EVIDENCE','G1_ADAPTER_BUILD','NIRIUM_SDK_ROOT'].includes(key))delete env[key];
env.npm_config_cache=path.join(work,'npm-cache');env.npm_config_registry='https://registry.npmjs.org';
env.npm_config_userconfig=path.join(work,'empty-user.npmrc');env.npm_config_globalconfig=path.join(work,'empty-global.npmrc');
fs.writeFileSync(env.npm_config_userconfig,'');fs.writeFileSync(env.npm_config_globalconfig,'');
let stage='ENVIRONMENT',baseline='NOT_RUN',g1='NOT_RUN',summary={},failure=null;
function run(name,exe,args,cwd=root,extra={}){
 console.log('Running '+name);
 const start=new Date().toISOString();const result=cp.spawnSync(exe,args,{cwd,env:{...env,...extra},encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:600000});
 write(name+'.stdout.log',result.stdout??'');write(name+'.stderr.log',(result.stderr??'')+(result.error?'\n'+result.error.message:''));
 write(name+'.result.json',{executable:exe,args,cwd,startedUtc:start,finishedUtc:new Date().toISOString(),exitCode:result.status,signal:result.signal,error:result.error?.code??null});
 if(result.status!==0){const e=new Error(name+' failed');e.command=name;throw e;}return result.stdout??'';
}
function git(name,args,cwd=repo){return run(name,'git',['-c','core.autocrlf=false','-c','core.longpaths=true',...args],cwd);}
function npm(name,args){return run(name,process.execPath,[npmCli,...args],sdk);}
function snapshot(name){const tracked=git('tracked-'+name,['ls-files','-z']).split('\0').filter(Boolean);const data=tracked.map(p=>({path:p,sha256:hash(path.join(repo,p))}));write('tracked-hashes-'+name+'.json',data);return data;}
try{
 verify(root);
 write('environment.json',{powershell:process.env.HARNESS_PS_VERSION,node:process.versions.node,platform:process.platform,arch:process.arch,isolatedNpmCache:true,userNpmConfig:'empty per-run file',globalNpmConfig:'empty per-run file'});
 assert.equal(process.platform,config.platform);assert.equal(process.versions.node,config.node);assert.ok(process.env.HARNESS_PS_VERSION?.startsWith(config.powershell+'.'));
 assert.ok(fs.existsSync(npmCli),'Official Node Windows distribution with adjacent npm CLI is required');
 const npmVersion=run('npm-version',process.execPath,[npmCli,'--version']).trim();assert.equal(npmVersion,config.npm);run('git-version','git',['--version']);
 stage='DEPENDENCY_ACCESS';git('clone',['clone','--no-checkout',config.repository,repo],work);
 stage='BASELINE_IDENTITY';git('checkout',['checkout','--detach',config.commit]);
 assert.equal(git('head',['rev-parse','HEAD']).trim(),config.commit);write('status-before.txt',git('status-before',['status','--porcelain=v1','--branch']));
 assert.equal(git('lock-blob',['hash-object','packages/sdk/package-lock.json']).trim(),config.lockBlob);
 const original=snapshot('before');
 for(const [name,wanted] of [['package.json',config.packageSha256],['package-lock.json',config.lockSha256]]){assert.equal(hash(path.join(sdk,name)),wanted);fs.copyFileSync(path.join(sdk,name),path.join(results,name+'.before'));}
 write('dependency-hashes-before.json',{package:hash(path.join(sdk,'package.json')),lock:hash(path.join(sdk,'package-lock.json'))});
 const workflow=path.join(repo,'.github/workflows/sdk-test.yml');assert.equal(hash(workflow),config.workflowSha256);const text=fs.readFileSync(workflow,'utf8');
 assert.ok(text.includes('- run: npm install --no-audit --no-fund --legacy-peer-deps'));assert.ok(text.includes('pre-existing mismatch'));fs.copyFileSync(workflow,path.join(results,'sdk-test.yml'));
 const before=JSON.parse(fs.readFileSync(path.join(sdk,'package-lock.json')));
 assert.ok(Object.values(before.packages).filter(x=>x.resolved).every(x=>new URL(x.resolved).hostname==='registry.npmjs.org'));
 write('install-review.json',{scripts:JSON.parse(fs.readFileSync(path.join(sdk,'package.json'))).scripts,installScriptPackages:Object.entries(before.packages).filter(([,x])=>x.hasInstallScript).map(([p,x])=>({path:p,version:x.version})),mode:config.installArgs,reason:'Pinned upstream CI parity, not MPP certification'});
 stage='DEPENDENCY_ACCESS';npm('npm-install',config.installArgs);
 stage='BASELINE_IDENTITY';npm('npm-ls',['ls','--depth=0']);
 const after=JSON.parse(fs.readFileSync(path.join(sdk,'package-lock.json')));const normalized=structuredClone(before);normalized.version='0.15.0';normalized.packages[''].version='0.15.0';assert.deepEqual(after,normalized,'Unexpected lock drift');
 assert.equal(hash(path.join(sdk,'package.json')),config.packageSha256);
 fs.copyFileSync(path.join(sdk,'package-lock.json'),path.join(results,'package-lock.json.after'));
 write('dependency-hashes-after.json',{package:hash(path.join(sdk,'package.json')),lock:hash(path.join(sdk,'package-lock.json'))});
 write('install-only.diff',git('install-diff',['diff','--binary']));
 const resolved=config.resolved.map(item=>{const location=item.path==='.'?sdk:path.join(sdk,item.path);const p=JSON.parse(fs.readFileSync(path.join(location,'package.json')));assert.equal(p.version,item.version,'Resolved version drift '+item.name);return {...item,actual:p.version,sha256:hash(path.join(location,'package.json'))}});write('resolved-versions.json',resolved);
 stage='UPSTREAM_BASELINE';npm('upstream-build',['run','build']);npm('upstream-test',['test']);
 const jest=fs.readFileSync(path.join(results,'upstream-test.stderr.log'),'utf8'),tap=fs.readFileSync(path.join(results,'upstream-test.stdout.log'),'utf8');
 assert.match(jest,new RegExp('Tests:\\s+'+expected.upstream.jest+' passed'));assert.match(tap,new RegExp('# pass '+expected.upstream.node+'(?:\\r?\\n|$)'));baseline='PASS';
 stage='HARNESS_COMPILE';const built=path.join(work,'adapter');run('adapter-compile',process.execPath,[path.join(sdk,'node_modules/typescript/bin/tsc'),'--project',path.join(root,'tsconfig.json'),'--outDir',built]);
 const testEnv={NIRIUM_SDK_ROOT:sdk,G1_ADAPTER_BUILD:path.join(built,'policy-signer.js'),G1_EVIDENCE:results};
 stage='G1';run('network-guard',process.execPath,[path.join(root,'test/network-guard.cjs')],root,testEnv);
 run('g1',process.execPath,['--test',path.join(root,'test/g1.test.cjs')],root,{...testEnv,NODE_V8_COVERAGE:path.join(results,'v8-coverage')});
 const ledger=JSON.parse(fs.readFileSync(path.join(results,'g1-ledger.json')));assert.equal(ledger.length,expected.currentCount);assert.equal(new Set(ledger.map(x=>x.id)).size,ledger.length);
 for(const exp of expected.cases){const got=ledger.find(x=>x.id===exp.id);assert.ok(got,exp.id);assert.equal(got.actual,'PASS',exp.id);assert.equal(got.signerCallCount,exp.signerCalls,exp.id);assert.equal(got.externalNetworkAttempts,0,exp.id);assert.equal(got.transactionsBroadcast,0);assert.equal(got.signedAuthorizationEscapedHarness,false);}
 write('expected-vs-actual.json',expected.cases.map(exp=>({id:exp.id,expectedSignerCalls:exp.signerCalls,actualSignerCalls:ledger.find(x=>x.id===exp.id).signerCallCount,result:'PASS'})));
 const coverage=[];for(const f of files(path.join(results,'v8-coverage'))){if(!f.endsWith('.json'))continue;for(const script of JSON.parse(fs.readFileSync(path.join(results,'v8-coverage',f))).result){const functions=script.functions.filter(f=>f.ranges[0].count>0&&/^(initX402|x402Fetch|wrapFetchWithPayment|createPaymentPayload|build|signAuthEntries|authorizeEntry)$/.test(f.functionName));if(functions.length&&/nirium\/packages\/sdk\//.test(script.url))coverage.push({url:script.url,functions});}}
 write('real-path-coverage.json',coverage);assert.ok(coverage.some(x=>x.url.endsWith('/exact/client/index.js')&&x.functions.some(f=>f.functionName==='createPaymentPayload')));
 g1='PASS';stage='PRODUCTION_INTEGRITY';const final=snapshot('after');const orig=new Map(original.map(x=>[x.path,x.sha256]));const changed=final.filter(x=>orig.get(x.path)!==x.sha256).map(x=>x.path);assert.deepEqual(changed,['packages/sdk/package-lock.json']);
 write('production-source.diff',git('production-diff',['diff','--exit-code','--','packages/sdk/src']));write('status-final.txt',git('status-final',['status','--porcelain=v1','--branch']));
 write('worktree.diff',git('worktree-diff',['diff','--binary']));write('integrity-comparison.json',{changedTrackedFiles:changed,productionSourceMutation:false,candidateSourceManifestVerified:true});
 summary={RUN_VERDICT:'PASS',UPSTREAM_BASELINE:baseline,G1_EXISTING_CASES:'PASS',G1_STALE_ALLOW_POLICY_VERSION:'PASS',G1_STALE_ALLOW_EXPIRY:'PASS',G1_FRESHNESS_FAIL_CLOSED:'PASS',currentCounts:{upstream:58,g1:ledger.length,existing:25,freshness:10},historicalCounts:expected.historical,signerCalls:ledger.reduce((n,x)=>n+x.signerCallCount,0),testAuthorizations:ledger.reduce((n,x)=>n+x.authorizationCount,0),externalNetworkAttempts:0,TRANSACTIONS_BROADCAST:0,REAL_KEYS_USED:0,KINE_ACCESSED:false,PRODUCTION_NIRIUM_SOURCE_MUTATION:false,PUBLISHED:false,...expected.limits};
 console.log('PASS: upstream 58; G1 '+ledger.length+' including 10 freshness cases.');
}catch(e){failure=e;const verdict=stage==='DEPENDENCY_ACCESS'?'NIRIUM_96_PUBLIC_HARNESS_BLOCKED_DEPENDENCY_ACCESS':stage==='UPSTREAM_BASELINE'?'BLOCKED_UPSTREAM_BASELINE':stage==='G1'?'NIRIUM_96_PUBLIC_HARNESS_BLOCKED_G1':'NIRIUM_96_PUBLIC_HARNESS_BLOCKED_'+stage;
 summary={RUN_VERDICT:verdict,stage,UPSTREAM_BASELINE:baseline,G1:g1,error:e.message,command:e.command??null,...expected.limits};console.error(verdict+': '+e.message);process.exitCode=1;
}finally{
 const npmLogs=path.join(work,'npm-cache/_logs');if(fs.existsSync(npmLogs))fs.cpSync(npmLogs,path.join(results,'npm-logs'),{recursive:true});
 summary.finishedUtc=new Date().toISOString();write('summary.json',summary);manifest(results);verify(results);console.log('Results: '+results);
}
