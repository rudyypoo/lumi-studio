/* Pocket Lumi: one authenticated player, one owned pet. The board is optional. */
(function(){'use strict';
const E=window.LumiPetEngine,S=window.LumiPetSocial,$=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),demo=params.get('preview')==='1'&&location.pathname.endsWith('/pocket-preview.html');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let root,ctx,cloud=null,petId=null,pets={},sessions={},presence={},owner=false,unsubs=[],epoch=0,busy=false,tab='care',menu=null,cursor=0,notice='',noticeUntil=0,game=null,lastUI=0,nameDraft='',selectedPeer=null,selectedItem=null,promptId=null,lastFrame=0,socialBusy=false;
const actions={care:[['feed','Warm meal','Fill a little tummy'],['snack','Berry treat','A little joy'],['clean','Bubble bath','Clean & feel better'],['rest','Cozy rest','Restore energy'],['medicine','Medicine','Care for a sick pet']],play:[['game','Star catch','Timing · A/B/C'],['explore','Go exploring','Discover keepsakes · +12 stars']]};
const now=()=>cloud?.now?.()||Date.now();
const lightPet=({journal,careLog,...pet})=>pet;
const own=()=>petId&&pets[petId]?E.applyOwned(lightPet(pets[petId]),petId,{type:'tick'},now()).pet:null;
function say(text){notice=text;noticeUntil=Date.now()+6500;if($('pocketNotice'))$('pocketNotice').textContent=text;}
function setStatus(text){if($('tamaStatus'))$('tamaStatus').textContent=text;}
function onlinePeers(){return friends().filter(peer=>peer.status==='online').map(({uid,petId})=>({uid,petId}));}
function mine(){return Object.values(sessions||{}).filter(e=>cloud&&(e.fromUid===cloud.uid||e.toUid===cloud.uid)&&e.expiresAt>now()&&['pending','accepted'].includes(e.status)).sort((a,b)=>b.createdAt-a.createdAt);}
function socialScene(){const peers=onlinePeers();return mine().find(e=>e.status==='accepted'&&peers.some(p=>p.uid===(e.fromUid===cloud.uid?e.toUid:e.fromUid)));}
function mount(){root=$('panel-tamagotchi');if(!root)return;root.className='pocket pocket-ingame';
 root.innerHTML=`${demo?'<div class="pocket-preview-banner">Local multiplayer playground · test data only</div>':''}<div class="pocket-heading"><div><span class="pocket-eyebrow">YOUR LITTLE WORLD</span><h2>Pocket Lumi</h2></div><span class="pocket-status" id="tamaStatus" role="status">Open My studio to save & play.</span></div>
 <div class="pocket-console"><div class="toy-loop" aria-hidden="true"></div><div class="pocket-device blue" id="pocketDevice"><div class="toy-faceplate" aria-hidden="true"></div><div class="pocket-brand">pocket <span>lumi</span><i>✦</i></div><div class="pocket-bezel"><div class="pocket-screen"><canvas id="tamaScreen" width="240" height="240" aria-label="Your own virtual pet’s screen"></canvas><div id="pocketScreenUI" class="pocket-screen-ui"></div></div></div><div class="toy-speaker" aria-hidden="true"><i></i><i></i><i></i></div><div class="pocket-buttons" aria-label="Pet controls"><button data-key="A" aria-label="A: next">A</button><button data-key="B" aria-label="B: select">B</button><button data-key="C" aria-label="C: back">C</button></div><div class="pocket-key-hints"><span>NEXT</span><span>SELECT</span><span>BACK</span></div><div class="pocket-device-footer">A LITTLE WORLD OF YOUR OWN</div></div><div class="pocket-footnote">A next · B select · C back<br>Keyboard: arrows · Enter · Escape</div><div id="pocketNotice" class="screen-reader-only" role="status" aria-live="polite"></div></div>
 <details class="player-settings" id="pocketPlayerSettings" hidden><summary>Player &amp; friend connections</summary><div class="pocket-card" id="pocketLink"></div></details>`;
 ctx=$('tamaScreen').getContext('2d');
 const settings=$('pocketPlayerSettings');if($('playerConnectionSettings'))$('playerConnectionSettings').append(settings);
 settings.addEventListener('click',event=>{if(event.target.closest('#pocketAssign'))assign();});
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  if(window.LumiCollection&&b.closest('#pocketScreenUI')&&b.id!=='pocketConnect')return;
  if(b.dataset.key)press(b.dataset.key);
  else if(b.dataset.choice!==undefined){cursor=Number(b.dataset.choice);choose();}
  else if(b.dataset.screen){openMenu(b.dataset.screen);}
  else if(b.dataset.catch)press('B');
  else if(b.dataset.quit)press('C');
  else if(b.dataset.end)endSession(b.dataset.end);
  else if(b.id==='pocketConnect')document.querySelector('[data-device=connect]')?.click();
 });
 root.addEventListener('input',event=>{if(event.target.id==='pocketName')nameDraft=event.target.value;});
 root.addEventListener('keydown',event=>{if(event.target.matches('input,select,textarea'))return;const key={ArrowLeft:'A',ArrowRight:'A',ArrowDown:'A',Escape:'C'}[event.key];if(key){event.preventDefault();event.stopPropagation();press(key);}});
 update();requestAnimationFrame(frame);
 if(demo)connect(window.createPocketDemoCloud(params.get('player')||'p1'));
 window.addEventListener('pagehide',()=>disconnect());
}
function friends(){return S.friends(pets,presence,{uid:cloud?.uid,petId},now(),!!cloud&&cloud.online!==false);}
function incoming(){return cloud?S.incoming(sessions,cloud.uid,now()):null;}
function openMenu(next){menu=next;cursor=0;game=null;if(next==='rename')nameDraft=own()?.name||'';update();}
function activeEvent(){return mine().find(e=>e.status==='accepted'||e.fromUid===cloud?.uid)||null;}
function menuTitle(){return ({camera:'Pocket camera',main:'Your little world',stats:'How am I doing?',care:'Care time',play:'Little adventures',decorate:'Make it yours',friends:'Your people',activity:'Play together',album:'Your memories',keepsakes:'Your collection',rename:'A name of my own',item:'A little makeover',session:'Together'})[menu]||'Pocket Lumi';}
function menuChoices(){
 const p=own(),entry=(label,run,detail='',disabled=false)=>({label,run,detail,disabled});if(!p)return[];
 const inc=incoming();if(inc)return [entry('Yes, let’s play',()=>respond(inc.id,'accepted'),'Join this invitation',busy||!onlinePeers().some(x=>x.uid===inc.fromUid)),entry('No thanks',()=>respond(inc.id,'declined'),'Keep playing on your own',busy||cloud?.online===false)];
 if(menu==='main')return [['stats','My stats','Tummy, mood & stars'],['care','Care','Food, bath & rest'],['play','Adventure','Play or go exploring'],['decorate','Decorate','Make your room your own'],['friends','Friends','Who’s around?'],['album','Memories','Your little story'],['rename','Pet name','Choose a name'],['camera','Camera','Capture this moment']].map(([id,label,detail])=>entry(label,()=>openMenu(id),detail));
 if(menu==='care')return actions.care.map(([id,label,detail])=>entry(label,()=>act(id),detail,busy));
 if(menu==='play')return [...actions.play.map(([id,label,detail])=>entry(label,()=>act(id),detail,busy)),entry('My keepsakes',()=>openMenu('keepsakes'),Object.keys(p.discoveries||{}).length+'/6 found')];
 if(menu==='decorate')return E.catalog.map(item=>entry(item.name,()=>{selectedItem=item.id;openMenu('item');},p.decor[item.slot]===item.id?'Placed':p.owned[item.id]?'Owned · place it':item.cost+' stars'));
 if(menu==='item'){const item=E.catalog.find(x=>x.id===selectedItem);return item?[entry(p.owned[item.id]?'Place in my room':'Buy & place',async()=>{await edit({type:'decorate',item:item.id});openMenu('decorate');},p.owned[item.id]?'Already owned':item.cost+' stars',busy||(!p.owned[item.id]&&p.coins<item.cost)),entry('Back',()=>openMenu('decorate'))]:[];}
 if(menu==='friends'){const event=activeEvent();return [...(event?[entry('Current meetup',()=>openMenu('session'),event.status==='pending'?'Invitation waiting':'Visit in progress')]:[]),...friends().map(peer=>entry(peer.name,()=>{selectedPeer=peer.petId;openMenu('activity');},peer.status==='unknown'?'Connection lost':peer.status==='online'?'● Online · invite to play':'○ Offline'))];}
 if(menu==='activity'){const peer=friends().find(x=>x.petId===selectedPeer);if(!peer)return[];return [...Object.entries(S.ACTIVITIES).map(([id,a])=>entry(a.name,()=>invite(peer.uid,id),a.description,peer.status!=='online'||busy)),entry('Back to friends',()=>openMenu('friends'))];}
 if(menu==='session'){const event=activeEvent();if(!event)return [entry('Back to friends',()=>openMenu('friends'))];if(event.status==='pending')return [entry('Cancel invitation',()=>endSession(event.id),'No pressure to join',busy)];return [...(!S.complete(event)?[entry(event.ready?.[cloud.uid]?'Waiting for your friend':S.ACTIVITIES[event.activity].verb,()=>contribute(event.id),event.ready?.[cloud.uid]?'Your part is ready':'Add your own part',busy||!!event.ready?.[cloud.uid]||!socialScene())]:[]),entry('Back to my room',()=>endSession(event.id),'Leave this activity',busy)];}
 if(menu==='album')return [...(p.memories||[])].reverse().map(m=>entry(m.text,()=>{},new Date(m.at).toLocaleDateString()));
 if(menu==='keepsakes')return Object.keys(p.discoveries||{}).map(name=>entry(name,()=>{},'Found on an adventure'));
 if(menu==='rename')return [entry('Save name',async()=>{const result=await edit({type:'rename',name:nameDraft});if(result)openMenu('main');},'',busy),entry('Back',()=>openMenu('main'))];
 if(menu==='camera')return [entry('Take photo',()=>{const c=document.createElement('canvas');c.width=c.height=160;c.getContext('2d').drawImage($('tamaScreen'),0,0,160,160);window.LumiCollection?.photo(c.toDataURL('image/jpeg',.76));},'Open in journal')];
 if(menu==='stats')return [entry('Back to menu',()=>openMenu('main'))];
 return [];
}
function choose(){if(busy||socialBusy)return;const list=menuChoices(),choice=list[cursor];if(choice&&!choice.disabled)choice.run();update();}
function renderScreen(){const host=$('pocketScreenUI');if(!host)return;const p=own(),inc=incoming(),peers=friends(),event=activeEvent();let html='';
 const controls=(list,compact=false)=>{const start=compact?0:Math.floor(cursor/4)*4;return `<div class="screen-choices">${list.slice(start,compact?list.length:start+4).map((choice,i)=>`<button type="button" class="screen-choice ${cursor===start+i?'selected':''}" data-choice="${start+i}" ${choice.disabled?'disabled':''}><strong>${esc(choice.label)}</strong>${choice.detail?'<small>'+esc(choice.detail)+'</small>':''}</button>`).join('')}</div>${!compact&&list.length>4?'<div class="screen-pagination">'+(Math.floor(cursor/4)+1)+' / '+Math.ceil(list.length/4)+' · A next</div>':''}`;};
 if(!p)html=`<div class="screen-welcome"><strong>${cloud?'Your little life awaits':'Welcome to Pocket Lumi'}</strong><p>${cloud?'Ask the studio owner to link your player code in My studio.':'Open your private studio to load your own pet.'}</p><button id="pocketConnect" type="button">Open My studio</button></div>`;
 else if(inc){const list=menuChoices();cursor=Math.min(cursor,list.length-1);html=`<section class="screen-panel screen-invite" role="dialog" aria-modal="false" aria-label="Play invitation"><div class="screen-eyebrow">A FRIEND IS ASKING TO PLAY</div><h3>${esc(pets[inc.fromPet]?.name||'Your friend')} invited you!</h3><p>${esc(S.ACTIVITIES[inc.activity].name)}</p>${controls(list,true)}${cloud?.online===false?'<p>Reconnect to respond.</p>':Date.now()<noticeUntil&&notice.startsWith('Could not respond:')?'<p>'+esc(notice)+'</p>':''}<small class="screen-help">B choose · C no thanks</small></section>`;}
 else if(game)html='<div class="screen-game-controls"><button type="button" data-catch="1">Catch · B</button><button type="button" data-quit="1">Leave · C</button></div>';
 else if(menu==='session'&&event&&S.complete(event))html=`<div class="screen-home-controls"><button type="button" data-screen="main">Menu</button><button type="button" data-end="${esc(event.id)}">Leave meetup · B / C</button></div>`;
 else if(menu){const list=menuChoices();cursor=list.length?Math.min(cursor,list.length-1):0;let content='';
  if(menu==='stats')content=`<div class="screen-stat-summary">${esc(p.name)} · ${esc(p.stage)} · ${Math.floor(p.age/E.DAY)} days<br>✦ ${p.coins} stars${p.sick?' · Feeling poorly':''}</div><div class="screen-meters">${[['food','Full tummy'],['joy','Happiness'],['clean','Cleanliness'],['energy','Energy']].map(([key,label])=>`<div class="screen-meter-label"><span>${label}</span><b>${Math.round(p[key])}%</b></div><meter min="0" max="100" value="${Math.round(p[key])}" aria-label="${label}">${Math.round(p[key])}%</meter>`).join('')}</div>`;
  if(menu==='rename')content=`<label class="screen-input-label" for="pocketName">Pet name</label><input id="pocketName" aria-label="Pet name" maxlength="16" value="${esc(nameDraft)}" autocomplete="off">`;
  if(menu==='decorate')content=`<p class="screen-wallet">✦ ${p.coins} stars · select a piece</p>`;
  if(menu==='item'){const item=E.catalog.find(x=>x.id===selectedItem);content=`<p class="screen-description">${esc(item?.name||'')}<br>${p.owned[selectedItem]?'Already yours. Place it for free.':'Spend '+(item?.cost||0)+' of your '+p.coins+' stars?'}${item&&!p.owned[item.id]&&p.coins<item.cost?'<br>Earn more stars in Adventure.':''}</p>`;}
  if(menu==='activity'){const peer=peers.find(x=>x.petId===selectedPeer);content=`<p class="screen-peer-status">${esc(peer?.name||'Your friend')} · ${peer?.status==='online'?'online':peer?.status==='unknown'?'connection lost':'offline'}</p>`;}
  if(menu==='session'&&event){const friend=pets[event.fromUid===cloud.uid?event.toPet:event.fromPet]?.name||'Your friend';content=`<p>${esc(S.ACTIVITIES[event.activity].name)}<br>with ${esc(friend)}</p><p>${event.status==='pending'?'Waiting for them to choose.':S.complete(event)?'You both added your part!':!socialScene()?'Your friend is offline. Wait or head home.':'You both said yes. Add your part.'}</p>`;}
  const complete=menu==='session'&&event&&S.complete(event);
  html=`<section class="screen-panel ${menu==='stats'?'screen-stats':''} ${menu==='session'?'screen-session':''} ${complete?'screen-completed':''}" aria-label="In-game ${esc(menuTitle())}"><div class="screen-menu-header"><h3>${esc(menuTitle())}</h3><button type="button" data-quit="1" aria-label="Back in game">×</button></div>${content}${controls(list,['stats','rename','item','session'].includes(menu))}${!list.length?'<p class="screen-empty">'+(menu==='album'?'Your first memories are ahead.':'Go exploring to find keepsakes.')+'</p>':''}</section>`;
 }
 else html=`<div class="screen-presence" aria-label="Friend presence">${peers.map(peer=>`<button type="button" data-screen="friends" class="friend-presence ${peer.status}" aria-label="${esc(peer.name)} ${peer.status}"><i></i>${esc(peer.name)} <small>${peer.status==='unknown'?'?':peer.status}</small></button>`).join('')}</div><div class="screen-home-controls"><button type="button" data-screen="main">Menu</button><button type="button" data-screen="stats">✦ ${p.coins} · Stats</button><button type="button" data-screen="friends">Friends ${peers.filter(x=>x.status==='online').length}/2</button></div>`;
 if(p&&menu&&!inc&&!game)html='<div class="screen-presence" aria-label="Friend presence">'+peers.map(peer=>'<button type="button" data-screen="friends" class="friend-presence '+peer.status+'" aria-label="'+esc(peer.name)+' '+peer.status+'"><i></i>'+esc(peer.name)+' <small>'+peer.status+'</small></button>').join('')+'</div>'+html;
 if(Date.now()<noticeUntil&&notice&&!inc)html+=`<div class="screen-toast" role="status">${esc(notice)}</div>`;
 if(host.dataset.view!==html){host.innerHTML=html;host.dataset.view=html;if(window.LumiCollection)host.querySelectorAll('button:not(#pocketConnect)').forEach(b=>{b.tabIndex=-1;});}
}
function update(){if(!root)return;
 const p=own();$('pocketDevice').classList.toggle('blue',petId!=='p2'&&petId!=='p3');$('pocketDevice').classList.toggle('pink',petId==='p2');$('pocketDevice').classList.toggle('lilac',petId==='p3');
 if(p&&!busy)setStatus(demo?'Local playground':cloud?.online===false?'Offline · reconnect to save':'Private studio · your pet only');
 const inc=incoming();if((inc?.id||null)!==promptId){promptId=inc?.id||null;cursor=0;if(inc){$('pocketNotice').textContent=(pets[inc.fromPet]?.name||'Your friend')+' is asking to play '+S.ACTIVITIES[inc.activity].name;}}
 renderScreen();window.LumiCollection?.sync({pets,petId,peers:friends(),ready:!!p,invite:inc?.id});
}

function linkPanel(){if(!$('pocketLink'))return;if($('pocketPlayerSettings')){$('pocketPlayerSettings').hidden=!cloud;$('pocketPlayerSettings').open=!!cloud&&!petId;}if(!cloud){$('pocketLink').hidden=true;return;}$('pocketLink').hidden=false;
 $('pocketLink').innerHTML=`<h3>Your player connection</h3><p>This browser stays linked to your own pet. To link another browser, give its player code to the studio owner.</p><label class="small" for="pocketPlayerCode">This browser’s player code</label><input id="pocketPlayerCode" readonly value="${esc(cloud.uid)}" aria-label="This browser’s player code">${owner?'<div class="pocket-subhead">Link your people</div><p>Have your friends join this studio first, then paste each person’s player code here.</p><label for="pocketLinkCode">Player code to link</label><input id="pocketLinkCode" aria-label="Player code to link"><label for="pocketLinkPet">Their pet</label><select id="pocketLinkPet" aria-label="Their pet"><option value="p2">Second pet · Pip</option><option value="p3">Third pet · Clover</option><option value="p1">Your pet · another browser</option></select><button class="pocket-start" id="pocketAssign">Link player</button>':''}`;
}
async function assign(){const active=cloud,uid=$('pocketLinkCode').value.trim(),id=$('pocketLinkPet').value;if(!owner||!active)return;if(!/^[a-zA-Z0-9_-]{10,128}$/.test(uid)){say('Paste the player code from their connected browser.');return;}
 try{const member=await active.get('members/'+uid);if(!member)throw Error('This player has not joined this studio. Copy your private invitation from My studio and have them open it in the same browser, then link their code again.');const existing=await active.get('pocketAccess/'+uid);if(existing&&existing.petId!==id)throw Error('This player is already linked to their own pet. Existing assignments cannot be switched here.');await active.set('pocketAccess/'+uid,{petId:id});say('Player linked to their own pet.');}catch(e){say('Could not link player: '+e.message);}}
async function edit(action){if(busy||!cloud||!petId||!pets[petId])return false;if(cloud.online===false){say('You are offline. Reconnect before making changes.');return false;}
 busy=true;update();const active=cloud,ownedId=petId,token=epoch,at=now(),a={...action,id:crypto.randomUUID()};let message='';setStatus('Saving your pet…');
 try{const result=await active.transact('pocketPets/'+ownedId,raw=>{if(!raw||raw.v!==4)return;const r=E.applyOwned(raw,ownedId,a,at);message=r.message;if(r.pet.revision!==raw.revision&&r.pet.receipts?.[a.id]===at&&['feed','snack','clean','rest','medicine','game'].includes(a.type)){r.pet.careLog=[...(Array.isArray(raw.careLog)?raw.careLog:[]),{at,type:a.type,name:r.pet.name}].slice(-30);}return r.pet;});if(epoch!==token)return false;if(!result.committed)throw Error('Your save changed. Reconnect and try again.');pets[ownedId]=result.snapshot.val();say(message);return true;}
 catch(e){if(epoch===token)say('Could not save: '+e.message);return false;}finally{if(epoch===token){busy=false;update();}}}
function act(type,item){if(type==='game'){if(!own()||own().stage==='egg'){say('Your egg will hatch in a minute.');update();return;}menu=null;game={round:0,score:0,position:0,started:performance.now()};say('B when the marker is green. Ten catches!');update();return;}edit({type,item,seed:Math.floor(Math.random()*1e6)});}
async function invite(uid,activity){if(socialBusy)return;const peer=onlinePeers().find(p=>p.uid===uid);if(!peer||!petId){say('That friend is no longer online.');return;}if(mine().some(e=>e.status==='pending'||(e.status==='accepted'&&!S.complete(e)))){say('Finish your current invitation first.');return;}
 const active=cloud,token=epoch,id=crypto.randomUUID(),event=S.invite({uid:active.uid,petId},peer,activity,now(),id);
 socialBusy=true;try{await active.set('pocketSessions/'+id,event);if(epoch===token){sessions[id]=event;openMenu('session');say('Invitation sent. They can accept or decline.');update();}}catch(e){if(epoch===token)say('Could not invite: '+e.message);}finally{if(epoch===token){socialBusy=false;update();}}}
async function respond(id,response){if(socialBusy)return;const event=sessions[id],active=cloud,token=epoch;if(!event||!active)return;socialBusy=true;try{if(active.online===false)throw Error('Reconnect before responding.');if(response==='accepted'&&!onlinePeers().some(p=>p.uid===event.fromUid))throw Error('Your friend is offline. Try again when they reconnect.');S.reply(event,active.uid,response,now());const result=await active.transact('pocketSessions/'+id+'/status',current=>current==='pending'?response:undefined);if(epoch===token){if(result.committed){sessions[id]={...event,status:response};if(response==='accepted'){game=null;openMenu('session');}}say(result.committed?(response==='accepted'?'You’re meeting up!':'No problem. Keep enjoying your own pocket.'):'This invitation has already changed.');update();}}catch(e){if(epoch===token)say('Could not respond: '+e.message);}finally{if(epoch===token){socialBusy=false;update();}}}
async function contribute(id){if(socialBusy)return;const event=sessions[id],active=cloud,token=epoch;if(!event||!active||event.status!=='accepted'||event.expiresAt<=now()||![event.fromUid,event.toUid].includes(active.uid))return;
 if(active.online===false||!onlinePeers().some(p=>p.uid===(event.fromUid===active.uid?event.toUid:event.fromUid))){say('Wait for your friend to reconnect before joining in.');return;}
 socialBusy=true;try{await active.set('pocketSessions/'+id+'/ready/'+active.uid,true);if(epoch===token){sessions[id]={...event,ready:{...event.ready,[active.uid]:true}};say('Your part is ready.');update();}}catch(e){if(epoch===token)say('Could not join in: '+e.message);}finally{if(epoch===token){socialBusy=false;update();}}}
async function endSession(id){if(socialBusy)return;const event=sessions[id],active=cloud,token=epoch;if(!event||!active||![event.fromUid,event.toUid].includes(active.uid))return;
 socialBusy=true;try{await active.transact('pocketSessions/'+id+'/status',current=>current==='accepted'?'ended':current==='pending'&&event.fromUid===active.uid?'cancelled':undefined);if(token===epoch){delete sessions[id];openMenu('friends');say('Back to your own little world.');update();}}catch(e){if(token===epoch)say(e.message);}finally{if(epoch===token){socialBusy=false;update();}}}
function press(key){if(!['A','B','C'].includes(key))return;if(!own()){if(key==='B')document.querySelector('[data-device=connect]')?.click();return;}if(busy||socialBusy)return;
 const inc=incoming();if(inc){if(key==='C')respond(inc.id,'declined');else if(key==='A'){cursor=(cursor+1)%2;update();}else choose();return;}
 if(game){if(key==='C'){game=null;openMenu('play');say('Game left. No stars awarded.');update();return;}if(key==='B'){if(performance.now()-game.started<250)return;if(game.position>=.41&&game.position<=.59)game.score++;game.round++;game.started=performance.now();if(game.round===10){const score=game.score;game=null;openMenu('play');edit({type:'game',score});}}return;}
 if(key==='C'){if(menu==='session'){const event=activeEvent();if(event)endSession(event.id);else openMenu('friends');}else if(menu==='main'){menu=null;cursor=0;update();}else if(menu==='activity')openMenu('friends');else if(menu==='item')openMenu('decorate');else openMenu('main');return;}
 if(!menu){openMenu('main');return;}const list=menuChoices();if(key==='A'){cursor=(cursor+1)%Math.max(1,list.length);update();}else choose();
}
function frame(t){if(root){const p=own(),event=socialScene(),inc=incoming();if(game&&inc&&lastFrame)game.started+=t-lastFrame;if(game&&!inc)game.position=(Math.sin((t-game.started)/400)+1)/2;
 const visiblePets=E.scenePets(Object.fromEntries(Object.entries(pets).map(([id,p])=>[id,lightPet(p)])),now());if(p)visiblePets[petId]=p;
 window.LumiPetRenderer.render(ctx,p?{pets:visiblePets}:null,petId,{welcomeHint:!cloud?'Open My studio to begin':!petId?'Link your player code':'Loading your little friend…',scene:event?'garden':'room',guests:event?[event.fromPet,event.toPet]:null,social:event?{activity:event.activity,complete:S.complete(event)}:null,game:inc?null:game,label:inc?'A CHOOSE  B OK  C DECLINE':menu?'A NEXT   B OK   C BACK':'A MENU   B SELECT   C BACK'},t);
 if(t-lastUI>1000){lastUI=t;if(!$('pocketName')?.matches(':focus')||incoming())update();}}
 lastFrame=t;requestAnimationFrame(frame);}
function disconnect(){epoch++;for(const stop of unsubs)stop();unsubs=[];cloud=null;petId=null;pets={};sessions={};presence={};owner=false;busy=false;menu=null;game=null;socialBusy=false;promptId=null;cursor=0;update();linkPanel();}
async function connect(c){disconnect();cloud=c;const token=epoch;setStatus('Loading your player connection…');
 try{owner=(await c.get('owner'))===c.uid;if(token!==epoch)return;let access=await c.get('pocketAccess/'+c.uid);if(token!==epoch)return;
  if(!access&&owner){await c.set('pocketAccess/'+c.uid,{petId:'p1'});if(token!==epoch)return;access={petId:'p1'};}
  linkPanel();update();
  unsubs.push(c.listen('pocketAccess/'+c.uid,async value=>{if(token!==epoch)return;if(value?.petId===petId)return;if(petId){connect(c);return;}if(!E.PET_IDS.includes(value?.petId)){setStatus('Ask the studio owner to link your player code.');return;}petId=value.petId;
   try{const old=await c.get('shared/pocketV2/pets/'+petId);if(token!==epoch)return;const id=petId,at=now();await c.transact('pocketPets/'+id,raw=>raw|| (old?{...old,v:4,memories:[],receipts:{}}:E.newOwned(id,at)));if(token!==epoch)return;linkPanel();
    unsubs.push(c.listen('pocketPets',(value,error)=>{if(token!==epoch)return;if(error){setStatus('Pet permissions need setup: '+error.message);return;}pets=value||{};update();}));
    unsubs.push(c.listen('pocketSessions',(value,error)=>{if(token!==epoch)return;if(error){say('Shared activities need the new Firebase permissions.');return;}const next=value||{};for(const previous of Object.values(sessions)){const changed=next[previous.id];if(previous.fromUid===c.uid&&previous.status==='pending'&&changed?.status==='declined')say((pets[previous.toPet]?.name||'Your friend')+' is not joining this time.');if(previous.toUid===c.uid&&previous.status==='pending'&&changed?.status==='cancelled')say('Your friend cancelled the invitation.');if(previous.status==='accepted'&&changed?.status==='ended'&&[previous.fromUid,previous.toUid].includes(c.uid)){say('The meetup ended. Back to your own little world.');menu=null;}}sessions=next;update();}));
    unsubs.push(c.listen('pocketPresence',(value,error)=>{if(token!==epoch||error)return;presence=value||{};update();}));
    unsubs.push(c.presence(id,e=>{if(token===epoch)say('Could not announce online status: '+e.message);}));
   }catch(e){if(token===epoch)setStatus('Could not load your pet: '+e.message);}
  }));
 }catch(e){if(token===epoch){setStatus('Player permissions need setup: '+e.message);linkPanel();}}
}
async function saveExtra(kind,value){
 if(!cloud||!petId||!pets[petId]||cloud.online===false)throw Error('Connect your own pocket first.');
 if(!['journal','shell'].includes(kind))throw Error('Unknown customization.');
 const active=cloud,id=petId,token=epoch;
 const result=await active.transact('pocketPets/'+id,raw=>{
  if(!raw||raw.v!==4)return;
  return {...raw,[kind]:kind==='journal'?[...(Array.isArray(raw.journal)?raw.journal:[]),value].slice(-8):value};
 });
 if(!result.committed)throw Error('Could not save. Please try again.');
 if(token===epoch){pets[id]=result.snapshot.val();update();}
}
window.LumiTama={saveExtra,connect,disconnect,press,start:()=>{},refresh:()=>{if(cloud)connect(cloud);}};
document.addEventListener('DOMContentLoaded',mount);
})();
