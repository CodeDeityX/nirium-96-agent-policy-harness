'use strict';
const path=require('node:path'),fs=require('node:fs');
const {verify}=require('./integrity.cjs');
try{
 const root=path.resolve(__dirname,'..');console.log('Candidate files verified: '+verify(root));
 if(process.argv[2]){const dir=path.resolve(process.argv[2]);console.log('Result files verified: '+verify(dir));const summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));if(summary.RUN_VERDICT!=='PASS')throw Error('RESULT_NOT_PASS');console.log('Result verdict: PASS');}
}catch(e){console.error(e.message);process.exitCode=1;}
