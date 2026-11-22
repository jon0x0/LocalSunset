/* Allowlisted proxy on the local candidate server; static hosting stays direct. */
(function(root){
 const nativeFetch=root.fetch.bind(root);
 function url(value){const u=new URL(value,root.location.href);return (root.location.port==='5175'||root.location.port==='5176')&&u.protocol==='https:'?root.location.origin+'/prototype-data?url='+encodeURIComponent(u.href):u.href;}
 root.CandidateProxy={url};
 root.fetch=(input,options)=>nativeFetch(typeof input==='string'||input instanceof URL?url(String(input)):input,options);
})(globalThis);
