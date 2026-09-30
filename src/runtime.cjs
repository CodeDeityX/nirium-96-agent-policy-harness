'use strict';
const {createRequire}=require('node:module');
const path=require('node:path');
if(!process.env.NIRIUM_SDK_ROOT)throw Error('Use RUN.ps1: missing isolated SDK root');
const sdkRequire=createRequire(path.resolve(process.env.NIRIUM_SDK_ROOT,'package.json'));
const stellarRequire=createRequire(sdkRequire.resolve('@x402/stellar/exact/client'));
module.exports={sdkRequire,stellarRequire,stellar:stellarRequire('@stellar/stellar-sdk')};
