'use strict';
// Read-only publication census. Historical data and negative fixtures are scoped explicitly.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {files}=require('./integrity.cjs');
function audit(root){
 const names=files(root,['.git','work','results','node_modules']),errors=[],exemptions=[];
 const stale=[/upstream\s+58|58\s+upstream/i,/(?:total|upstream)\s*[:=]?\s*122/i,/normaliz[^\n]*0\.15\.0/i,/(?:package|version)[^\n]*0\.15\.0/i,/16\.2\.0/,/no official Nirium hook/i,/local unpublished/i,/no commits, remote writes, publication/i,/35\/35[^\n]*strict[^\n]*equivalen/i,/L0[12][^\n]*(?:is|are|now) solved/i,/OUT_OF_PROCESS_SIGNER_BYPASS/];
 for(const name of names){
  let text=fs.readFileSync(path.join(root,name),'utf8');
  if(text.includes('\r'))errors.push({file:name,rule:'NON_LF_BYTES'});
  if(/(?:^|\/)(?:measurement-runs|environment|npm-cache)(?:\/|$)|\.zip$|\.log$|\.env(?:\.|$)/i.test(name))errors.push({file:name,rule:'PRIVATE_ARTIFACT'});
  const privatePatterns=[/[A-Za-z]:[\\/]+Users[\\/]/i,/\/home\/[A-Za-z0-9_.-]+\//,/\.codex[\\/]/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bS[A-Z2-7]{55}\b/,/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})\b/,/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,/NIRIUM[^\s]*REVIEW\.zip/i];
  for(const pattern of privatePatterns)if(pattern.test(text))errors.push({file:name,rule:'PRIVATE_PATH_OR_SECRET',pattern:String(pattern)});
  // Rule definitions and deliberately contradictory test strings are data, not current claims.
  if(['scripts/publication-audit.cjs','test/publication-audit.test.cjs'].includes(name)){exemptions.push({file:name,scope:'stale-pattern rule literals / negative fixture definitions only; privacy and LF still checked'});continue;}
  if(name==='docs/R2_REPAIR.md'){exemptions.push({file:name,scope:'explicitly historical R2 document; privacy and LF still checked'});continue;}
  if(name==='expected/expected-results.json'){const data=JSON.parse(text);delete data.historical;text=JSON.stringify(data);exemptions.push({file:name,scope:'historical property only'});}
  for(const pattern of stale)if(pattern.test(text))errors.push({file:name,rule:'STALE_CURRENT_CLAIM',pattern:String(pattern)});
 }
 try{
  const config=JSON.parse(fs.readFileSync(path.join(root,'config/upstream.json'))),expected=JSON.parse(fs.readFileSync(path.join(root,'expected/expected-results.json'))),readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.equal(config.commit,'1dc596932b0b124ad39bb54c4cb00b10c3b08e5e');assert.equal(config.tree,'c5552a44c8d386f689eb764617cf89081fbb7b21');assert.deepEqual(config.allowedLockChanges,[]);assert.equal(config.node,'22.18.0');assert.equal(config.npm,'10.9.3');
  assert.deepEqual(expected.upstream,{jest:56,node:114});assert.equal(expected.cases.length,35);assert.equal(expected.limits.L02_SAME_PROCESS_SIGNER_BYPASS,'NOT_SOLVED');
  const self=expected.cases.find(x=>x.id==='G1-SELF-ESCALATION');assert.match(self.expected,/CONTEXT_MISMATCH/);assert.match(self.expected,/zero policy consultation/);assert.match(self.expected,/zero signer/);assert.match(self.expected,/non-equivalence/);assert.doesNotMatch(self.expected,/DENY/);
  assert.match(expected.cases.find(x=>x.id==='G1-PREIMAGE-ACCOUNT-REJECTION').scope,/real x402Fetch.*simulated RPC/);
  assert.match(expected.cases.find(x=>x.id==='G1-PREIMAGE-NETWORK-REJECTION').scope,/private createPolicyGatedSigner/);
  for(const fact of [config.commit,config.tree,'56 Jest','114 Node','170 total','34/35 strict','35/35 adapted','G1-SELF-ESCALATION','CONTEXT_MISMATCH','L01 limitation','L02 limitation','Node 22.18.0','npm 10.9.3','docs/R2_REPAIR.md'])assert.ok(readme.includes(fact),'Required README fact missing: '+fact);
 }catch(e){errors.push({file:'current-contract',rule:'REQUIRED_FACT',message:e.message})}
 const result={status:errors.length?'FAIL':'PASS',filesScanned:names.length,errors,exemptions};
 if(errors.length){const e=Error('PUBLICATION_AUDIT_FAILED');e.result=result;throw e;}return result;
}
module.exports={audit};
if(require.main===module){try{console.log(JSON.stringify(audit(path.resolve(__dirname,'..')),null,2))}catch(e){console.error(JSON.stringify(e.result??{status:'FAIL',error:e.message},null,2));process.exitCode=1;}}
