'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function files(root,skip=[]){const found=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const abs=path.join(dir,entry.name),rel=path.relative(root,abs).replaceAll('\\','/');if(skip.some(s=>rel===s||rel.startsWith(s+'/')))continue;if(entry.isSymbolicLink())throw Error('SYMLINK_NOT_SUPPORTED');if(entry.isDirectory())walk(abs);else found.push(rel)}}walk(root);return found.sort();}
function manifest(root,skip=[]){const list=files(root,['SHA256SUMS.txt',...skip]);fs.writeFileSync(path.join(root,'SHA256SUMS.txt'),list.map(f=>hash(path.join(root,f))+'  '+f).join('\n')+'\n');return list.length;}
function verify(root){const text=fs.readFileSync(path.join(root,'SHA256SUMS.txt'),'utf8').trim();let count=0;for(const line of text.split(/\r?\n/)){if(!/^[a-f0-9]{64}  .+/.test(line))throw Error('INVALID_MANIFEST');const rel=line.slice(66),abs=path.resolve(root,rel);if(!abs.startsWith(path.resolve(root)+path.sep))throw Error('UNSAFE_MANIFEST_PATH');if(hash(abs)!==line.slice(0,64))throw Error('HASH_MISMATCH '+rel);count++}return count;}
module.exports={hash,files,manifest,verify};
