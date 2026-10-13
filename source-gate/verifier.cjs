const fs=require('fs');function verify(raw,results){if(!raw||!results)throw Error('missing evidence');return raw.every(e=>e.eventId&&e.caseId)&&results.rows.length>0;}module.exports={verify};
