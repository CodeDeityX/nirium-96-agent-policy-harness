'use strict';
// R2: raw-byte verification with exact payload coverage. No runtime source repair.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const exclusions=['.git','work','results','node_modules'];
function fail(category,relativePath){const e=new Error(category+' '+relativePath);e.category=category;e.relativePath=relativePath;throw e;}
function safeName(rel){return typeof rel==='string' && rel.length>0 && !rel.includes('\\') && !rel.includes(':') && !rel.startsWith('/') && rel.split('/').every(x=>/^[A-Za-z0-9_.@+ -]+$/.test(x)&&x!=='.'&&x!=='..'&&!/[. ]$/.test(x));}
function checked(root,rel){
 const abs=path.join(root,rel);let stat;
 try{stat=fs.lstatSync(abs);}catch{fail('MISSING_FILE',rel);}
 if(stat.isSymbolicLink())fail('UNSAFE_LINK',rel);
 const relative=path.relative(fs.realpathSync(root),fs.realpathSync(abs));
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))fail('PATH_ESCAPE',rel);
 if(!stat.isDirectory()&&!stat.isFile())fail('UNSUPPORTED_FILE',rel);
 return stat;
}
function files(root,skip=[]){
 const found=[];
 function walk(dir,lead=''){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const rel=lead+entry.name;
   if(skip.includes(rel))continue;
   if(!safeName(rel))fail('UNSAFE_PATH',rel.replace(/[^A-Za-z0-9_./-]/g,'?'));
   const stat=checked(root,rel);
   if(stat.isDirectory())walk(path.join(root,rel),rel+'/');else found.push(rel);
  }
 }
 walk(root);return found.sort();
}
function verify(root,{source=true,expectedDigest}={}){
 root=path.resolve(root);const manifestPath=path.join(root,'SHA256SUMS.txt');
 if(!checked(root,'SHA256SUMS.txt').isFile())fail('INVALID_MANIFEST','SHA256SUMS.txt');
 const raw=fs.readFileSync(manifestPath),digest=crypto.createHash('sha256').update(raw).digest('hex');
 if(expectedDigest!==undefined&&digest!==expectedDigest)fail('MANIFEST_CHANGED','SHA256SUMS.txt');
 if(raw.length===0)fail('EMPTY_MANIFEST','SHA256SUMS.txt');
 const text=raw.toString('utf8');
 if(!Buffer.from(text).equals(raw)||!text.endsWith('\n')||text.includes('\r'))fail('MALFORMED_MANIFEST','SHA256SUMS.txt');
 const entries=new Map(),folded=new Set();
 for(const line of text.slice(0,-1).split('\n')){
  if(!/^[a-f0-9]{64}  .+$/.test(line))fail('MALFORMED_MANIFEST','SHA256SUMS.txt');
  const rel=line.slice(66);
  if(!safeName(rel)||rel==='SHA256SUMS.txt'||(source&&exclusions.includes(rel.split('/')[0])))fail('UNSAFE_MANIFEST_PATH','SHA256SUMS.txt');
  if(folded.has(rel.toLowerCase()))fail('DUPLICATE_ENTRY',rel);
  folded.add(rel.toLowerCase());entries.set(rel,line.slice(0,64));
 }
 const actual=files(root,['SHA256SUMS.txt',...(source?exclusions:[])]),present=new Set(actual);
 for(const rel of entries.keys())if(!present.has(rel))fail('MISSING_FILE',rel);
 for(const rel of actual)if(!entries.has(rel))fail('UNEXPECTED_OR_OMITTED_FILE',rel);
 for(const [rel,wanted] of entries)if(hash(path.join(root,rel))!==wanted)fail('HASH_MISMATCH',rel);
 if(hash(manifestPath)!==digest)fail('MANIFEST_CHANGED','SHA256SUMS.txt');
 return {status:'PASS',manifestSha256:digest,verifiedFileCount:entries.size};
}
function manifest(root){
 root=path.resolve(root);const resultRoot=path.resolve(__dirname,'../results'),rel=path.relative(resultRoot,root);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail('RESULT_OUTPUT_REQUIRED','SHA256SUMS.txt');
 const list=files(root,['SHA256SUMS.txt']);
 fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),list.map(f=>hash(path.join(root,f))+'  '+f).join('\n')+'\n');return list.length;
}
module.exports={hash,files,manifest,verify};
