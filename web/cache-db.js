/* Private per-origin IndexedDB cache. Does not contain preset locations. */
const WebCache=(()=>{
 let opened;
 function db(){return opened||(opened=new Promise((resolve,reject)=>{const r=indexedDB.open('localsunset-browser-cache-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
 async function get(key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result&&r.result.value);r.onerror=()=>reject(r.error);});}
 async function put(key,value,bytes=0){try{const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').put({key,value,bytes:bytes||JSON.stringify(value).length});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return true;}catch(error){return false;}}
 async function stats(){const d=await db();return new Promise((resolve,reject)=>{let files=0,bytes=0;const r=d.transaction('records').objectStore('records').openCursor();r.onsuccess=()=>{const c=r.result;if(!c){resolve({files,bytes});return;}files++;bytes+=c.value.bytes||0;c.continue();};r.onerror=()=>reject(r.error);});}
 async function clear(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
 return {get,put,stats,clear};
})();
