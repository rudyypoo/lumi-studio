/* Pocket Lumi: one authenticated player, one owned pet. The board is optional. */
(function(){'use strict';
const E=window.LumiPetEngine,S=window.LumiPetSocial,$=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),demo=params.get('preview')==='1'&&location.pathname.endsWith('/pocket-preview.html');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let root,ctx,cloud=null,petId=null,pets={},sessions={},presence={},owner=false,unsubs=[],epoch=0,busy=false,tab='care',menu=null,cursor=0,notice='',noticeUntil=0,game=null,lastUI=0;
const actions={care:[['feed','Warm meal','Fill a little tummy'],['snack','Berry treat','A little joy'],['clean','Bubble bath','Clean & feel better'],['rest','Cozy rest','Restore energy'],['medicine','Medicine','Care for a sick pet']],play:[['game','Star catch','Timing · A/B/C'],['explore','Go exploring','Discover keepsakes · +12 stars']]};
const now=()=>cloud?.now?.()||Date.now();
const own=()=>petId&&pets[petId]?E.applyOwned(pets[petId],petId,{type:'tick'},now()).pet:null;
function say(text){notice=text;noticeUntil=Date.now()+6500;if($('pocketNotice'))$('pocketNotice').textContent=text;}
function setStatus(text){if($('tamaStatus'))$('tamaStatus').textContent=text;}
function onlinePeers(){const result=new Map();for(const [uid,tabs] of Object.entries(presence||{}))for(const record of Object.values(tabs||{})){
 if(cloud&&uid!==cloud.uid&&record.petId!==petId&&E.PET_IDS.includes(record.petId)&&now()-record.at<45000)result.set(record.petId,{uid,petId:record.petId});
 }return cloud?.online===false?[]:[...result.values()];}
function mine(){return Object.values(sessions||{}).filter(e=>cloud&&(e.fromUid===cloud.uid||e.toUid===cloud.uid)&&e.expiresAt>now()&&['pending','accepted'].includes(e.status)).sort((a,b)=>b.createdAt-a.createdAt);}
function socialScene(){const peers=onlinePeers();return mine().find(e=>e.status==='accepted'&&peers.some(p=>p.uid===(e.fromUid===cloud.uid?e.toUid:e.fromUid)));}
function mount(){root=$('panel-tamagotchi');if(!root)return;root.className='pocket';
 root.innerHTML=`${demo?'<div class="pocket-preview-banner">Local multiplayer playground · browser test data only. <a href="?preview=1&player=p1" target="_blank" rel="noopener">Your window</a> · <a href="?preview=1&player=p2" target="_blank" rel="noopener">Her window</a> · <a href="?preview=1&player=p3" target="_blank" rel="noopener">Friend’s window</a></div>':''}
 <div class="pocket-heading"><div><span class="pocket-eyebrow">Your own little life. A world to share.</span><h2>Pocket Lumi</h2><p>Your pet belongs to you. Meet your people when you both feel like it.</p></div><span class="pocket-status" id="tamaStatus" role="status">Connect through Overview to save & play.</span></div>
 <div class="pocket-layout"><div class="pocket-console"><div class="pocket-player-label" id="pocketPlayer">Your pocket</div><div class="pocket-device" id="pocketDevice"><div class="pocket-brand">pocket · lumi</div><div class="pocket-bezel"><canvas id="tamaScreen" width="240" height="240" aria-label="Your own virtual pet’s screen"></canvas></div><div class="pocket-buttons" aria-label="Pet controls"><button data-key="A" aria-label="A: next">A</button><button data-key="B" aria-label="B: select">B</button><button data-key="C" aria-label="C: back">C</button></div><div class="pocket-key-hints"><span>NEXT</span><span>SELECT</span><span>BACK</span></div><div class="pocket-device-footer">A LITTLE CLOSER, ALWAYS</div></div><div class="pocket-footnote">Keyboard: arrows · Enter · Escape</div><div id="pocketNotice" class="pocket-notice" role="status" aria-live="polite"></div></div>
 <div><div class="pocket-card" id="pocketSummary"></div><div class="pocket-tabs" role="tablist" aria-label="Pet activities">${[['care','Care'],['play','Adventure'],['decorate','Decorate'],['together','Together'],['album','Memories']].map(([id,label])=>`<button role="tab" data-tab="${id}" aria-controls="pocketContent">${label}</button>`).join('')}</div><div class="pocket-card" id="pocketContent" role="tabpanel"></div><div class="pocket-card" id="pocketLink"></div><p class="pocket-footnote">Always playable on the website. Your UNO Q can stay switched off.</p></div></div>`;
 ctx=$('tamaScreen').getContext('2d');
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  if(b.dataset.key)press(b.dataset.key);
  if(b.dataset.tab){tab=b.dataset.tab;menu=null;game=null;update();}
  if(b.dataset.action)act(b.dataset.action,b.dataset.item);
  if(b.id==='pocketRename')edit({type:'rename',name:$('pocketName').value});
  if(b.dataset.invite)invite(b.dataset.peer,b.dataset.invite);
  if(b.dataset.reply)respond(b.dataset.event,b.dataset.reply);
  if(b.dataset.ready)contribute(b.dataset.ready);
  if(b.dataset.end)endSession(b.dataset.end);
  if(b.id==='pocketAssign')assign();
  if(b.id==='pocketConnect')document.querySelector('[data-device=connect]').click();
 });
 root.addEventListener('keydown',event=>{if(!event.target.matches('[data-tab]')||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();const tabs=[...root.querySelectorAll('[data-tab]')],i=tabs.indexOf(event.target),next=tabs[(i+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];tab=next.dataset.tab;menu=null;game=null;update();next.focus();});
 update();requestAnimationFrame(frame);
 if(demo)connect(window.createPocketDemoCloud(params.get('player')||'p1'));
 window.addEventListener('pagehide',()=>disconnect());
}
function update(){if(!root)return;const p=own();
 root.querySelectorAll('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;});
 $('pocketDevice').classList.toggle('mint',petId==='p2');$('pocketDevice').classList.toggle('lilac',petId==='p3');
 $('pocketPlayer').textContent=petId?({p1:'Your pocket',p2:'Her pocket',p3:'Friend’s pocket'})[petId]:'Your pocket';
 if(!p){$('pocketSummary').innerHTML='<h3>A little life of your own</h3><p>'+(!cloud?'Join your private studio to meet your pet.':'Give your player code below to the studio owner. Once they link it, your own pet will appear here automatically.')+'</p>'+(!cloud?'<button class="pocket-start" id="pocketConnect">Connect my studio</button>':'');$('pocketContent').innerHTML='<p>Only your assigned pet can be fed, dressed, renamed or played with. Shared activities always need an invitation and acceptance.</p>';return;}
 const status=demo?'Local playground · your pet only':cloud?.online===false?'Offline · reconnect to save':'Private room · your pet only';if(!busy)setStatus(status);
 $('pocketSummary').innerHTML=`<div class="pocket-pet-heading"><div><span class="pocket-eyebrow">${esc(p.stage)} · ${Math.floor(p.age/E.DAY)} days old</span><h3>${esc(p.name)}${p.sick?' · feeling poorly':''}</h3></div><span class="pocket-coins">✦ ${p.coins} stars</span></div><div class="pocket-meters">${[['food','Full tummy'],['joy','Happiness'],['clean','Cleanliness'],['energy','Energy']].map(([key,label])=>`<div><div class="pocket-meter-label"><span>${label}</span><span>${Math.round(p[key])}%</span></div><div class="pocket-meter" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p[key])}"><i style="width:${p[key]}%"></i></div></div>`).join('')}</div>`;
 const button=(type,title,description,item='',equipped=false)=>`<button class="pocket-action" data-action="${type}" data-item="${item}" data-equipped="${equipped}" ${busy?'disabled':''}><strong>${esc(title)}</strong><small>${esc(description)}</small></button>`;
 let html=actions[tab]?'<div class="pocket-grid">'+actions[tab].map(([id,t,d])=>button(id,t,d)).join('')+'</div>':'';
 if(tab==='care')html+=`<div class="pocket-subhead">A name of their own</div><div class="pocket-rename"><input id="pocketName" aria-label="Pet name" maxlength="16" value="${esc(p.name)}"><button id="pocketRename">Save name</button></div><p>Egg → baby → child → teen → adult. Decorating favors Bloom, exploring favors Comet, and minigames favor Bun. Every form is loved. No death.</p>`;
 if(tab==='decorate')html='<p>Buy & place pieces in your own room. Owned pieces can be swapped freely.</p><div class="pocket-grid">'+E.catalog.map(i=>button('decorate',i.name,p.decor[i.slot]===i.id?'Placed ♡':p.owned[i.id]?'Owned · place it':i.cost+' stars',i.id,p.decor[i.slot]===i.id)).join('')+'</div>';
 if(tab==='play')html+='<div class="pocket-subhead">Your keepsakes · '+Object.keys(p.discoveries||{}).length+'/6</div><p>'+esc(Object.keys(p.discoveries||{}).join(' · ')||'Your first adventure is waiting.')+'</p><p>Explore every five minutes. Rest when energy is low. Earn decorating stars in Star Catch.</p>';
 if(tab==='album')html=[...(p.memories||[])].reverse().map(m=>`<div class="pocket-memory"><small>${esc(new Date(m.at).toLocaleDateString())}</small><p>${esc(m.text)}</p></div>`).join('')||'<p>Your first memories are still ahead.</p>';
 if(tab==='together'){
  const peers=onlinePeers();html='<h3>A little company?</h3><p>You can always play alone. Invite an online friend when you both want to meet. Your pets remain yours.</p>';
  html+=peers.length?peers.map(peer=>`<div class="pocket-social-peer"><strong>${esc(pets[peer.petId]?.name||'Your friend')} · online</strong><div class="pocket-grid">${Object.entries(S.ACTIVITIES).map(([id,a])=>`<button class="pocket-action" data-invite="${id}" data-peer="${esc(peer.uid)}"><strong>${a.name}</strong><small>${a.description}</small></button>`).join('')}</div></div>`).join(''):'<p class="pocket-empty">No other players are online right now. Your friends will appear here when they connect.</p>';
  for(const event of mine()){
   const incoming=event.toUid===cloud.uid,otherName=pets[incoming?event.fromPet:event.toPet]?.name||'Your friend',activity=S.ACTIVITIES[event.activity];if(!activity)continue;
   html+=`<div class="pocket-social-event"><strong>${esc(activity.name)} · ${esc(otherName)}</strong>`;
   if(event.status==='pending')html+=incoming?`<p>Would you like to join? It’s completely up to you.</p><button class="pocket-start" data-reply="accepted" data-event="${esc(event.id)}">Accept invitation</button> <button class="pocket-start" data-reply="declined" data-event="${esc(event.id)}">No thanks</button>`:'<p>Invitation sent. Waiting for your friend to choose.</p>';
   else if(S.complete(event))html+='<p>♡ '+(event.activity==='stargaze'?'A constellation, made by the two of you.':'Two treats, two happy pets. A little picnic to remember.')+'</p>';
   else if(!peers.some(p=>p.uid===(incoming?event.fromUid:event.toUid)))html+='<p>Your friend is offline. You can leave or wait for them to reconnect.</p>';
   else html+=event.ready?.[cloud.uid]?'<p>Your contribution is ready. Waiting for your friend.</p>':`<p>You both said yes. Add your part when you’re ready.</p><button class="pocket-start" data-ready="${esc(event.id)}">${activity.verb}</button>`;
   if(event.status==='accepted')html+=`<button class="pocket-start" data-end="${esc(event.id)}">Leave activity</button>`;
   else if(!incoming)html+=`<button class="pocket-start" data-end="${esc(event.id)}">Cancel invitation</button>`;
   html+='</div>';
  }
 }
 if(!(tab==='care'&&document.activeElement?.id==='pocketName'))$('pocketContent').innerHTML=html;
}
function linkPanel(){if(!$('pocketLink'))return;if(!cloud){$('pocketLink').hidden=true;return;}$('pocketLink').hidden=false;
 $('pocketLink').innerHTML=`<h3>Your player connection</h3><p>This browser stays linked to your own pet. To link another browser, give its player code to the studio owner.</p><label class="small" for="pocketPlayerCode">This browser’s player code</label><input id="pocketPlayerCode" readonly value="${esc(cloud.uid)}" aria-label="This browser’s player code">${owner?'<div class="pocket-subhead">Link your people</div><p>Have your girlfriend and her friend join the studio first, then paste each person’s player code here.</p><label for="pocketLinkCode">Player code to link</label><input id="pocketLinkCode" aria-label="Player code to link"><label for="pocketLinkPet">Their pet</label><select id="pocketLinkPet" aria-label="Their pet"><option value="p2">Her pet · Pip</option><option value="p3">Friend’s pet · Clover</option><option value="p1">Your pet · another browser</option></select><button class="pocket-start" id="pocketAssign">Link player</button>':''}`;
}
async function assign(){const active=cloud,uid=$('pocketLinkCode').value.trim(),id=$('pocketLinkPet').value;if(!owner||!active)return;if(!/^[a-zA-Z0-9_-]{10,128}$/.test(uid)){say('Paste the player code from their connected browser.');return;}
 try{const member=await active.get('members/'+uid);if(!member)throw Error('This player has not joined this studio. Copy your private invitation from Overview and have them open it in the same browser, then link their code again.');const existing=await active.get('pocketAccess/'+uid);if(existing&&existing.petId!==id)throw Error('This player is already linked to their own pet. Existing assignments cannot be switched here.');await active.set('pocketAccess/'+uid,{petId:id});say('Player linked to their own pet.');}catch(e){say('Could not link player: '+e.message);}}
async function edit(action){if(busy||!cloud||!petId||!pets[petId])return false;if(cloud.online===false){say('You are offline. Reconnect before making changes.');return false;}
 busy=true;update();const active=cloud,ownedId=petId,token=epoch,at=now(),a={...action,id:crypto.randomUUID()};let message='';setStatus('Saving your pet…');
 try{const result=await active.transact('pocketPets/'+ownedId,raw=>{if(!raw||raw.v!==4)return;const r=E.applyOwned(raw,ownedId,a,at);message=r.message;return r.pet;});if(epoch!==token)return false;if(!result.committed)throw Error('Your save changed. Reconnect and try again.');pets[ownedId]=result.snapshot.val();say(message);return true;}
 catch(e){if(epoch===token)say('Could not save: '+e.message);return false;}finally{if(epoch===token){busy=false;update();}}}
function act(type,item){menu=null;if(type==='game'){if(!own()||own().stage==='egg'){say('Your egg will hatch in a minute.');return;}game={round:0,score:0,position:0,started:performance.now()};say('B when the marker is green. Ten catches!');return;}edit({type,item,seed:Math.floor(Math.random()*1e6)});}
async function invite(uid,activity){const peer=onlinePeers().find(p=>p.uid===uid);if(!peer||!petId){say('That friend is no longer online.');return;}if(mine().some(e=>e.status==='pending'||(e.status==='accepted'&&!S.complete(e)))){say('Finish your current invitation first.');return;}
 const active=cloud,token=epoch,id=crypto.randomUUID(),event=S.invite({uid:active.uid,petId},peer,activity,now(),id);
 try{await active.set('pocketSessions/'+id,event);if(epoch===token){say('Invitation sent. They can accept or decline.');update();}}catch(e){if(epoch===token)say('Could not invite: '+e.message);}}
async function respond(id,response){const event=sessions[id],active=cloud,token=epoch;if(!event||!active)return;try{if(active.online===false)throw Error('Reconnect before responding.');if(response==='accepted'&&!onlinePeers().some(p=>p.uid===event.fromUid))throw Error('Your friend is offline. Try again when they reconnect.');S.reply(event,active.uid,response,now());const result=await active.transact('pocketSessions/'+id+'/status',current=>current==='pending'?response:undefined);if(epoch===token){say(result.committed?(response==='accepted'?'You’re meeting up!':'No problem. Keep enjoying your own pocket.'):'This invitation has already changed.');update();}}catch(e){if(epoch===token)say(e.message);}}
async function contribute(id){const event=sessions[id],active=cloud,token=epoch;if(!event||!active||event.status!=='accepted'||event.expiresAt<=now()||![event.fromUid,event.toUid].includes(active.uid))return;
 if(active.online===false||!onlinePeers().some(p=>p.uid===(event.fromUid===active.uid?event.toUid:event.fromUid))){say('Wait for your friend to reconnect before joining in.');return;}
 try{await active.set('pocketSessions/'+id+'/ready/'+active.uid,true);if(epoch===token){say('Your part is ready.');update();}}catch(e){if(epoch===token)say('Could not join in: '+e.message);}}
async function endSession(id){const event=sessions[id],active=cloud,token=epoch;if(!event||!active||![event.fromUid,event.toUid].includes(active.uid))return;
 try{await active.transact('pocketSessions/'+id+'/status',current=>current==='accepted'?'ended':current==='pending'&&event.fromUid===active.uid?'cancelled':undefined);if(token===epoch){say('Back to your own little world.');update();}}catch(e){if(token===epoch)say(e.message);}}
const top=['Care','Play','Decorate','Together','Memories'];
function menuItems(){if(menu==='main')return top;if(menu==='decorate')return E.catalog.map(x=>x.name+' '+(pets[petId].owned[x.id]?'OWNED':x.cost+'*'));if(menu==='album')return (own().memories||[]).map(m=>m.text.slice(0,30));if(menu==='together')return ['Open Together on website'];return actions[menu].map(x=>x[1]);}
function press(key){if(!['A','B','C'].includes(key)||!own()||busy)return;if(game){if(key==='C'){game=null;say('Game left. No stars awarded.');return;}if(key==='B'){if(performance.now()-game.started<250)return;if(game.position>=.41&&game.position<=.59)game.score++;game.round++;game.started=performance.now();if(game.round===10){const score=game.score;game=null;edit({type:'game',score});}}return;}
 if(key==='C'){menu=null;return;}if(!menu){menu='main';cursor=0;return;}const list=menuItems();if(key==='A'){cursor=(cursor+1)%Math.max(1,list.length);return;}if(key==='B'){if(menu==='main'){tab=['care','play','decorate','together','album'][cursor];menu=tab;cursor=0;update();}else if(menu==='decorate')act('decorate',E.catalog[cursor].id);else if(menu==='album'||menu==='together'){menu=null;update();}else act(actions[menu][cursor][0]);}}
function frame(t){if(root){const p=own(),event=socialScene();let opts=null,start=0;if(menu&&p){opts=menuItems();start=Math.floor(cursor/5)*5;}if(game)game.position=(Math.sin((t-game.started)/400)+1)/2;
 const visiblePets={...pets};if(p)visiblePets[petId]=p;
 window.LumiPetRenderer.render(ctx,p?{pets:visiblePets}:null,petId,{welcomeHint:!cloud?'Connect your studio below':!petId?'Ask owner to link your code':'Loading your little friend…',scene:event?'garden':'room',guests:event?[event.fromPet,event.toPet]:null,social:event?{activity:event.activity,complete:S.complete(event)}:null,menu:opts?.slice(start,start+5),cursor:cursor-start,title:menu==='main'?'YOUR LITTLE WORLD':(menu||'').toUpperCase(),game,notice:Date.now()<noticeUntil?notice:'',label:menu?'A NEXT   B OK   C HOME':'A MENU   B SELECT   C HOME'},t);
 if(t-lastUI>10000&&!busy&&!root.contains(document.activeElement?.closest('input,select'))){lastUI=t;update();}}
 requestAnimationFrame(frame);}
function disconnect(){epoch++;for(const stop of unsubs)stop();unsubs=[];cloud=null;petId=null;pets={};sessions={};presence={};owner=false;busy=false;menu=null;game=null;update();linkPanel();}
async function connect(c){disconnect();cloud=c;const token=epoch;setStatus('Loading your player connection…');
 try{owner=(await c.get('owner'))===c.uid;if(token!==epoch)return;let access=await c.get('pocketAccess/'+c.uid);if(token!==epoch)return;
  if(!access&&owner){await c.set('pocketAccess/'+c.uid,{petId:'p1'});if(token!==epoch)return;access={petId:'p1'};}
  linkPanel();update();
  unsubs.push(c.listen('pocketAccess/'+c.uid,async value=>{if(token!==epoch)return;if(value?.petId===petId)return;if(petId){connect(c);return;}if(!E.PET_IDS.includes(value?.petId)){setStatus('Ask the studio owner to link your player code.');return;}petId=value.petId;
   try{const old=await c.get('shared/pocketV2/pets/'+petId);if(token!==epoch)return;const id=petId,at=now();await c.transact('pocketPets/'+id,raw=>raw|| (old?{...old,v:4,memories:[],receipts:{}}:E.newOwned(id,at)));if(token!==epoch)return;
    unsubs.push(c.listen('pocketPets',(value,error)=>{if(token!==epoch)return;if(error){setStatus('Pet permissions need setup: '+error.message);return;}pets=value||{};update();}));
    unsubs.push(c.listen('pocketSessions',(value,error)=>{if(token!==epoch)return;if(error){say('Shared activities need the new Firebase permissions.');return;}sessions=value||{};update();}));
    unsubs.push(c.listen('pocketPresence',(value,error)=>{if(token!==epoch||error)return;presence=value||{};update();}));
    unsubs.push(c.presence(id,e=>{if(token===epoch)say('Could not announce online status: '+e.message);}));
   }catch(e){if(token===epoch)setStatus('Could not load your pet: '+e.message);}
  }));
 }catch(e){if(token===epoch){setStatus('Player permissions need setup: '+e.message);linkPanel();}}
}
window.LumiTama={connect,disconnect,press,start:()=>{},refresh:()=>{if(cloud)connect(cloud);}};
document.addEventListener('DOMContentLoaded',mount);
})();
