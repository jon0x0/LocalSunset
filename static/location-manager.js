/* Saved places are edited as a draft and committed with a snapshot check. */
(function(root){
 function normalize(rows){
  const names=new Set();return rows.map(row=>{
   const p={...row,name:String(row.name||'').trim()};
   if(!p.name||p.name.length>120)throw Error('Each place needs a name of at most 120 characters.');
   if(names.has(p.name))throw Error('Duplicate place name: '+p.name);names.add(p.name);
   for(const [key,min,max] of [['lat',-90,90],['lon',-180,180],['height',0,10000]]){
    if(p[key]===''||p[key]===null||p[key]===undefined)throw Error(p.name+': enter '+key+'.');
    p[key]=Number(p[key]);if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(p.name+': invalid '+key+'.');
   }
   if(p.ground===''||p.ground===null||p.ground===undefined){delete p.ground;delete p.near;}
   else {p.ground=Number(p.ground);p.near=p.near===''||p.near==null?100:Number(p.near);if(!Number.isFinite(p.ground)||p.ground< -12000||p.ground>10000||!Number.isFinite(p.near)||p.near<50||p.near>1000)throw Error(p.name+': invalid ground elevation or DEM exclusion distance.');}
   return p;
  });
 }
 function uniqueName(base,rows){base=(base||'Saved place').slice(0,110);let name=base,n=2;while(rows.some(p=>p.name===name))name=base+' ('+(n++)+')';return name;}
 const policy={normalize,uniqueName};if(typeof module!=='undefined')module.exports=policy;
 if(typeof document==='undefined')return;
 const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 const button=(text,fn)=>{const b=make('button',text);b.type='button';b.onclick=fn;return b;};
 const compact=make('section');compact.className='saved-places-compact';compact.setAttribute('aria-label','Saved places');
 const label=make('label','SAVED PLACES');label.htmlFor='saved';const row=make('div');row.className='saved-places-row';
 const saveButton=$('save'),oldHeading=saveButton.closest('.saved-heading');saveButton.type='button';saveButton.textContent='Save as…';
 const manageButton=button('Manage…',()=>openManager());row.append($('saved'),saveButton,manageButton);compact.append(label,row);$('searchForm').querySelector('.searchbox').after(compact);oldHeading?.remove();
 // Keep the legacy element for integrations, with deletion now inside Manage.
 $('remove').hidden=true;
 const selectSaved=$('saved').onchange;
 $('saved').onchange=()=>{selectSaved();if($('saved').value)status('Selected '+$('saved').value+'. Apply location to update the sky.');};
 function dialog(title){const d=make('dialog');d.className='places-dialog';const h=make('h2',title);h.id='placesTitle'+document.querySelectorAll('.places-dialog').length;d.setAttribute('aria-labelledby',h.id);d.append(h);document.body.append(d);return d;}
 async function commit(snapshot,edited){return api('/api/locations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected:snapshot,locations:normalize(edited)})});}
 const saveDialog=dialog('Save location as'),saveForm=make('form'),nameLabel=make('label','Place name'),nameInput=make('input'),saveMessage=make('p');
 nameInput.required=true;nameInput.maxLength=120;nameLabel.append(nameInput);saveMessage.setAttribute('role','status');saveForm.append(nameLabel,saveMessage);saveDialog.append(saveForm);
 const saveActions=make('div');saveActions.className='places-actions';const saveConfirm=make('button','Save place');saveConfirm.type='submit';saveActions.append(button('Cancel',()=>saveDialog.close()),saveConfirm);saveForm.append(saveActions);let saveSnapshot=[];
 saveButton.onclick=async()=>{try{saveSnapshot=await api('/api/locations');nameInput.value=uniqueName(currentName,saveSnapshot);saveMessage.textContent='Save the currently selected coordinates as a new named place. Existing places are kept.';saveDialog.showModal();nameInput.select();}catch(e){status(e.message);}};
 saveForm.onsubmit=async e=>{e.preventDefault();saveConfirm.disabled=true;try{const name=nameInput.value.trim();await commit(saveSnapshot,[...saveSnapshot,{...coordinates(),name}]);await loadSaved();$('saved').value=name;saveDialog.close();status('Place saved.');}catch(error){saveMessage.textContent=error.message;}finally{saveConfirm.disabled=false;}};
 const manager=dialog('Manage saved places'),hint=make('p','Edit, add, delete or move places. Changes take effect only when you choose Save changes.'),body=make('div'),list=make('div'),editor=make('form'),message=make('p');
 body.className='places-manager-body';list.className='places-list';list.setAttribute('aria-label','Places in saved order');editor.className='place-editor';message.setAttribute('role','status');
 const fields={};for(const [key,text,type,min,max] of [['name','Name','text'],['lat','Latitude','number',-90,90],['lon','Longitude','number',-180,180],['height','Height above ground · m','number',0,10000],['ground','Ground elevation override · m (optional)','number',-12000,10000],['near','Nearby DEM exclusion · m','number',50,1000]]){
  const l=make('label',text),input=make('input');input.type=type;input.setAttribute('aria-label','Saved place '+text);if(type==='number'){input.step='any';input.min=min;input.max=max;}else input.maxLength=120;
  input.required=['name','lat','lon','height'].includes(key);input.oninput=()=>{if(index>=0){draft[index][key]=input.value;renderList();}};l.append(input);editor.append(l);fields[key]=input;
 }
 editor.onsubmit=e=>{e.preventDefault();};let snapshot=[],draft=[],index=-1;
 const controls=make('div');controls.className='places-actions';
 const add=button('Add manually',()=>{draft.push({name:'',lat:'',lon:'',height:2});index=draft.length-1;render();fields.name.focus();});
 const up=button('Move up',()=>move(-1)),down=button('Move down',()=>move(1)),remove=button('Delete',()=>{if(index<0)return;draft.splice(index,1);index=Math.min(index,draft.length-1);render();});controls.append(add,up,down,remove);
 body.append(list,editor);manager.append(hint,controls,body,message);const actions=make('div');actions.className='places-actions';const saveChanges=button('Save changes',async()=>{saveChanges.disabled=true;try{await commit(snapshot,draft);await loadSaved();manager.close();status('Saved places updated. Choose a place and Apply location to update the sky.');}catch(error){message.textContent=error.message;}finally{saveChanges.disabled=false;}});actions.append(button('Cancel',()=>manager.close()),saveChanges);manager.append(actions);
 function move(delta){const next=index+delta;if(index<0||next<0||next>=draft.length)return;[draft[index],draft[next]]=[draft[next],draft[index]];index=next;render();}
 function renderList(){list.replaceChildren();draft.forEach((p,i)=>{const b=button((i+1)+'. '+(p.name||'New place'),()=>{index=i;render();});b.className='place-row';b.setAttribute('aria-pressed',String(i===index));list.append(b);});if(!draft.length)list.append(make('p','No saved places. Use Add manually to create one.'));}
 function render(){renderList();editor.hidden=index<0;for(const [key,input] of Object.entries(fields))input.value=index<0?'':draft[index][key]??(key==='near'?100:'');up.disabled=index<=0;down.disabled=index<0||index>=draft.length-1;remove.disabled=index<0;}
 async function openManager(){try{snapshot=await api('/api/locations');draft=JSON.parse(JSON.stringify(snapshot));index=draft.findIndex(p=>p.name===$('saved').value);if(index<0&&draft.length)index=0;message.textContent='';render();manager.showModal();}catch(error){status(error.message);}}
})(typeof globalThis!=='undefined'?globalThis:this);
