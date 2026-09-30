'use strict';
// R2: source first, exhaustive results verification separately.
const path=require('node:path'),fs=require('node:fs');const {verify}=require('./integrity.cjs');
try{
 const root=path.resolve(__dirname,'..');console.log(JSON.stringify({SOURCE_INTEGRITY:verify(root)}));
 if(process.argv[2]){const dir=path.resolve(process.argv[2]);console.log(JSON.stringify({RESULT_INTEGRITY:verify(dir,{source:false})}));const summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));if(summary.RUN_VERDICT!=='PASS')throw Error('RESULT_NOT_PASS');console.log('Result verdict: PASS');}
}catch(e){console.error('SOURCE_OR_RESULT_VERIFICATION_FAILED: '+(e.category?e.message:'VERIFICATION_ERROR'));process.exitCode=1;}
