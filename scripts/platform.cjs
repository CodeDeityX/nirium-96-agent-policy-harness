'use strict';
// R2: resolve native npm layouts without shell command construction.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function npmCli(){
 const base=path.dirname(fs.realpathSync(process.execPath));
 const candidates=[path.join(base,'node_modules/npm/bin/npm-cli.js'),path.resolve(base,'../lib/node_modules/npm/bin/npm-cli.js')];
 if(process.platform==='linux')for(const dir of (process.env.PATH||'').split(path.delimiter)){
  if(!dir||dir.startsWith('/mnt/'))continue;
  try{const real=fs.realpathSync(path.join(dir,'npm'));if(real.endsWith('/npm/bin/npm-cli.js'))candidates.push(real);}catch{}
 }
 for(const candidate of candidates)try{const real=fs.realpathSync(candidate);if(fs.statSync(real).isFile()&&!(process.platform==='linux'&&real.startsWith('/mnt/')))return real;}catch{}
 throw Error('NATIVE_NPM_CLI_NOT_FOUND');
}
function environment(){
 const release=os.release();let distro=null;
 if(process.platform==='linux')try{distro=fs.readFileSync('/etc/os-release','utf8');}catch{}
 return {node:process.versions.node,platform:process.platform,arch:process.arch,kernel:release,distro,wsl:process.platform==='linux'&&/microsoft/i.test(release),container:fs.existsSync('/.dockerenv'),nodeExecutable:fs.realpathSync(process.execPath)};
}
module.exports={npmCli,environment};
