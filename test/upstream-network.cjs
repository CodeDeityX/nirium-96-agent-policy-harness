'use strict';
// Test-only outbound guard. Upstream's WebSocket tests need real localhost I/O.
// This is not OS isolation. Record attempts before rejecting remote transport.
const fs=require('fs'),p=require('path'),net=require('net');
const allowed=h=>['localhost','127.0.0.1','::1','[::1]'].includes(h);
function deny(layer,host){if(process.env.G1_EVIDENCE)fs.appendFileSync(p.join(process.env.G1_EVIDENCE,'upstream-blocked-network.jsonl'),JSON.stringify({layer,host:String(host)})+'\n');throw Error('UPSTREAM_REMOTE_NETWORK_FORBIDDEN');}
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let a=args[0];if(Array.isArray(a))a=a[0];const host=typeof a==='object'?(a.host??'localhost'):(typeof args[1]==='string'?args[1]:'localhost');if((typeof a==='object'&&a.path)||typeof a==='string'||!allowed(host))deny('Socket.connect',host);return connect.apply(this,args);};
for(const method of ['lookup','resolve','resolve4','resolve6']){const dns=require('dns'),original=dns[method];dns[method]=function(host,...args){if(!allowed(host))deny('dns.'+method,host);return original.call(this,host,...args);};}
require('dgram').createSocket=()=>deny('dgram','disabled');
const fetch=globalThis.fetch;globalThis.fetch=function(input,...args){const url=new URL(typeof input==='string'?input:input.url);if(!allowed(url.hostname))deny('fetch',url.hostname);return fetch.call(this,input,...args);};
