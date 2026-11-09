var fs=require('fs'),vm=require('vm'),assert=require('assert'),source=fs.readFileSync('static/app.js','utf8');
var storage={'localsunset.lastScene.v1':'private scene','localsunset.lastView.v1':'private view','unrelated.app':'keep'};
storage.removeItem=function(key){delete this[key];};var writes=0;storage.setItem=function(){writes++;};
var scene={stillVisible:true},context={localStorage:storage,cacheWritesEnabled:true,result:scene,resultDirty:false};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function forgetBrowserCache()'),source.indexOf('\nlet resultDirty')),context);
vm.runInContext(source.slice(source.indexOf('function persistView()'),source.indexOf('function restoreScene()')),context);
context.forgetBrowserCache();context.persistView();
assert.equal(storage['localsunset.lastScene.v1'],undefined);assert.equal(storage['localsunset.lastView.v1'],undefined);assert.equal(storage['unrelated.app'],'keep');assert.equal(writes,0);assert.strictEqual(context.result,scene);
console.log('PASS: clear browser cache preserves the current image/unrelated storage and prevents periodic re-caching until another trace.');
