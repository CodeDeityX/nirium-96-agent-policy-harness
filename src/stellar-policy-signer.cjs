'use strict';
// Composition around the public-R1 candidate. This supports the installed
// SEP-43 HashIdPreimage -> Ed25519 signature boundary, not signed-entry XDR.
const {stellar:S}=require('./runtime.cjs');
if(!process.env.G1_ADAPTER_BUILD)throw Error('Use RUN.ps1: missing compiled adapter');
const {createPolicySigner}=require(process.env.G1_ADAPTER_BUILD);
const reject=code=>{throw new Error(code)};
function decode(input,account,networkPassphrase){
  const p=S.xdr.HashIdPreimage.fromXDR(input,'base64');
  if(p.toXDR('base64')!==input)reject('NON_CANONICAL_PREIMAGE');
  if(p.switch().name!=='envelopeTypeSorobanAuthorization')reject('UNSUPPORTED_PREIMAGE_TYPE');
  const a=p.sorobanAuthorization();
  const networkId=Buffer.from(a.networkId()).toString('hex');
  if(networkId!==S.hash(Buffer.from(networkPassphrase)).toString('hex'))reject('PREIMAGE_NETWORK_MISMATCH');
  const root=a.invocation();
  if(root.function().switch().name!=='sorobanAuthorizedFunctionTypeContractFn')reject('UNSUPPORTED_INVOCATION');
  const call=root.function().contractFn();
  const method=call.functionName().toString();
  const args=call.args();
  let from=null,to=null,amount=null;
  if(method==='transfer'){
    if(args.length!==3 || args[0].switch().name!=='scvAddress' || args[1].switch().name!=='scvAddress' || args[2].switch().name!=='scvI128')reject('INVALID_TRANSFER');
    from=S.Address.fromScAddress(args[0].address()).toString();
    to=S.Address.fromScAddress(args[1].address()).toString();
    amount=S.scValToNative(args[2]).toString();
    if(from!==account)reject('TRANSFER_FROM_MISMATCH');
    if(BigInt(amount)<=0n)reject('INVALID_AMOUNT');
  }
  return Object.freeze({networkId,account,accountBinding:'configured signer + transfer.from; legacy preimage has no credential-address field',asset:S.Address.fromScAddress(call.contractAddress()).toString(),method,from,to,amount,nonce:a.nonce().toString(),expirationLedger:a.signatureExpirationLedger(),invocationXdr:root.toXDR('base64'),subInvocations:root.subInvocations().length});
}
function createStellarPolicySigner(config){
  const raw=config.signer;
  const account=raw.address;
  const sign=raw.signAuthEntry.bind(raw);
  // Validate the returned signature against the exact approved preimage. A
  // signature over altered amount/destination/network/invocation is rejected.
  const verifiedSigner={address:account,async signAuthEntry(input,opts){
    if(raw.address!==account)reject('SIGNER_IDENTITY_CHANGED');
    const result=await sign(input,opts);
    if(!result || typeof result.signedAuthEntry!=='string')reject('INVALID_SIGNATURE_RESULT');
    const bytes=Buffer.from(result.signedAuthEntry,'base64');
    if(bytes.length!==64 || bytes.toString('base64')!==result.signedAuthEntry || (result.signerAddress && result.signerAddress!==account))reject('INVALID_SIGNATURE_RESULT');
    if(!S.Keypair.fromPublicKey(account).verify(S.hash(Buffer.from(input,'base64')),bytes))reject('SIGNATURE_NOT_FOR_APPROVED_PREIMAGE');
    return result;
  }};
  return createPolicySigner({...config,signer:verifiedSigner,evaluate:async ctx=>{
    const semantic=decode(ctx.authEntry,ctx.account,ctx.networkPassphrase);
    return config.evaluate(Object.freeze({...ctx,semantic}));
  }});
}
module.exports={decode,createStellarPolicySigner};
