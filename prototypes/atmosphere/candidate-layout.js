/* Move the original controls, retaining their IDs, listeners and state. */
(()=>{
 const about=document.createElement('a');about.href='about.html';about.textContent='About';about.style.cssText='font-size:13px;margin-inline:10px';document.getElementById('projectorToggle').before(about);
 const main=document.querySelector('main'),scene=document.querySelector('.scene'),panel=document.querySelector('.atmosphere-panel');
 const workbench=document.createElement('section');workbench.className='sky-workbench';workbench.setAttribute('aria-label','Sky preview and quick controls');
 scene.before(workbench);workbench.append(scene);
 const dock=document.createElement('div');dock.className='compact-dock';workbench.append(dock);
 const transport=document.querySelector('.transport'),timeline=document.getElementById('colorTime');
 dock.append(transport);const dockWindow=document.createElement('p');dockWindow.id='dockBestWindow';transport.querySelector('.time-row').after(dockWindow);const dockCloud=document.createElement('p');dockCloud.id='dockCloudEstimate';dockCloud.hidden=true;dockWindow.after(dockCloud);
 const fullDay=document.createElement('details');fullDay.className='full-day-controls';fullDay.innerHTML='<summary>Full-day timeline</summary>';
 fullDay.append(document.getElementById('time'),document.querySelector('.range-labels'));
 panel.append(fullDay);
 transport.append(timeline.closest('label'),document.getElementById('colorTimeLabel'));
 const quick=document.createElement('div');quick.className='quick-controls';
 quick.append(document.querySelector('.event-controls'),document.querySelector('.atmosphere-controls'));dock.append(quick);const terrainNote=document.createElement('p');terrainNote.id='terrainOptionNote';terrainNote.className='hint';terrainNote.hidden=TerrainOption.enabled;terrainNote.textContent='Terrain off · ground elevation is still looked up and cached. No surrounding terrain trace.';dock.append(terrainNote);
 const terrainLabel=document.createElement('label');terrainLabel.className='check-label terrain-toggle';terrainLabel.innerHTML='<input id="candidateTerrainEnabled" type="checkbox"> Terrain enabled';quick.querySelector('.atmosphere-controls').prepend(terrainLabel);document.getElementById('candidateTerrainEnabled').checked=TerrainOption.enabled;
 const weatherToggle=document.getElementById('candidateUseWeather').closest('label');weatherToggle.lastChild.textContent=' Enable weather forecast';weatherToggle.title='Download cloud cover, temperature and wind forecasts; refresh automatically while enabled.';quick.querySelector('.atmosphere-controls').prepend(weatherToggle);
 const gestureSelect=document.getElementById('candidateGesture');gestureSelect.options[0].textContent='Swipe timeline';gestureSelect.options[1].textContent='Pan terrain';
 const gestureButtons=document.createElement('div');gestureButtons.className='sky-gesture-buttons';gestureButtons.setAttribute('role','group');gestureButtons.setAttribute('aria-label','Sky gesture');gestureSelect.closest('label').style.display='none';for(const [value,text] of [['time','Swipe timeline'],['pan','Pan terrain']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.gesture=value;button.setAttribute('aria-pressed',String(gestureSelect.value===value));button.onclick=()=>{gestureSelect.value=value;gestureSelect.onchange?.();};gestureButtons.append(button);}scene.append(gestureButtons);
 const labels={'candidateAod':'Haze (AOD) ','peakPadding':'Window ± min ','candidateGesture':'Sky gesture '};
 for(const [id,text] of Object.entries(labels)){const node=document.getElementById(id).parentNode;for(const child of node.childNodes)if(child.nodeType===3)child.textContent=text;}
 const toggle=document.getElementById('atmosphereEnabled').parentNode;toggle.lastChild.textContent=' Atmospheric sky';toggle.title='Turn off to use the production sky renderer.';
 dock.append(document.querySelector('.color-times'));document.querySelector('.color-times').hidden=true;const eventTable=document.createElement('section');eventTable.className='sky-event-table';eventTable.setAttribute('aria-label','Predicted event times');eventTable.innerHTML='<p id=selectedEventCountdown role=timer></p><table><thead><tr id=skyEventHead></tr></thead><tbody id=skyEventRows></tbody></table><small id=skyEventZone></small>';transport.after(eventTable);
 const tools=document.querySelector('.view-tools');dock.append(tools);
 const badge=document.createElement('span');badge.id='skyTimeBadge';badge.className='sky-time-badge';scene.append(badge);
 const liveButton=document.createElement('button');liveButton.id='skyRealtime';liveButton.type='button';liveButton.className='sky-realtime';liveButton.textContent='Go Realtime';liveButton.setAttribute('aria-pressed','false');liveButton.onclick=async()=>{liveButton.disabled=true;try{await chooseRealtime();}finally{liveButton.disabled=false;CandidateAtmosphere.refresh();}};scene.append(liveButton);
 const countdown=document.createElement('div');countdown.id='skyNextEvent';countdown.className='sky-next-event';countdown.setAttribute('role','timer');countdown.setAttribute('aria-live','off');countdown.innerHTML='<small>NEXT MILESTONE · LIVE CLOCK</small><strong id="skyNextEventText">Loading prediction…</strong><span id="skyNextEventTime"></span>';scene.append(countdown);
 const skyStatus=document.createElement('div');skyStatus.className='sky-status-strip';skyStatus.setAttribute('aria-label','Sky time and status');
 const timeGroup=document.createElement('div');timeGroup.className='sky-time-group';const bestWindow=document.createElement('span');bestWindow.id='skyBestWindow';const cloud=document.createElement('span');cloud.id='skyCloudEstimate';cloud.hidden=true;const displayStatus=document.createElement('strong');displayStatus.id='skyDisplayStatus';displayStatus.textContent='Loading sky prediction…';displayStatus.setAttribute('role','status');timeGroup.append(displayStatus,badge,bestWindow,cloud);skyStatus.append(timeGroup,countdown);gestureButtons.append(liveButton);for(const [direction,text] of [[-1,'Prev'],[1,'Next']]){const button=document.createElement('button');button.type='button';button.id=direction<0?'skyPrevEvent':'skyNextMilestone';button.textContent=text;button.title=(direction<0?'Previous':'Next')+' predicted milestone';button.onclick=()=>CandidateAtmosphere.jumpMilestone(direction);gestureButtons.append(button);}
 gestureButtons.append(document.getElementById('jumpColorPeak'),document.getElementById('centerSunset'));gestureButtons.setAttribute('aria-label','Sky view and event controls');
 const geometry=document.createElement('div');geometry.className='sky-status-geometry';geometry.append(document.getElementById('compass'),scene.querySelector('.scene-bottom'));skyStatus.append(geometry);scene.append(skyStatus);
 const sidebar=document.querySelector('aside'),drawer=document.createElement('details');drawer.id='candidateLocations';drawer.innerHTML='<summary>Location, saved places & terrain <span>⌄</span></summary>';
 sidebar.before(drawer);drawer.append(sidebar);
 const wide=matchMedia('(min-width: 761px) and (min-height: 541px), (min-width: 1101px)');function placeLocationControls(){drawer.open=wide.matches;if(wide.matches)document.body.insertBefore(drawer,main);else (document.querySelector('.sky-resize-bar')||scene).after(drawer);}placeLocationControls();wide.addEventListener('change',placeLocationControls);
 function placeEventTable(){if(wide.matches)skyStatus.insertBefore(eventTable,geometry);else transport.after(eventTable);}placeEventTable();wide.addEventListener('change',placeEventTable);
 const heading=panel.querySelector('h2');heading.textContent='Color forecast';
 // Explanations stay available without displacing the sky or graph.
 const explanation=document.createElement('details');explanation.className='forecast-explanation';explanation.innerHTML='<summary>Curve legend & model details</summary>';
 const legend=panel.querySelector('.chart-legend');explanation.append(legend);
 for(const hint of Array.from(panel.children).filter(n=>n.matches('p.hint')))explanation.append(hint);
 panel.append(explanation);
 const chart=document.getElementById('colorChart'),comparison=document.getElementById('showColorComponents').parentNode;
 heading.after(comparison);comparison.after(chart);
 const miniLegend=document.createElement('p');miniLegend.className='mini-chart-legend';miniLegend.innerHTML='<span style="color:#ffd28a">━ Brightness</span> · <span style="color:#ff8e87">━ Color potential</span>';chart.before(miniLegend);
 document.getElementById('source').closest('details').classList.add('terrain-settings');
 // Detailed clocks, terrain metrics and methods remain below the forecast.
 main.querySelector('header').append(document.getElementById('projectorToggle'));const projectorWindow=document.createElement('small');projectorWindow.id='projectorBestWindow';document.getElementById('projectionCurrentZone').after(projectorWindow);const projectorCloud=document.createElement('small');projectorCloud.id='projectorCloudEstimate';projectorCloud.hidden=true;projectorWindow.after(projectorCloud);
})();
