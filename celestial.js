/* The collection is read-only except for the single, authenticated game instance. */
(() => {
 const E=window.LumiPetEngine, R=window.LumiPetRenderer, $=id=>document.getElementById(id);
 const root=$('panel-tamagotchi'), dialog=$('collectionDialog'), content=$('collectionContent');
 let openedInvite=null;
 let state={pets:{},petId:null,peers:[]}, mode='all', tool='', journalTab='Timeline', category='Stickers', draft={}, photo=null, writing=false, slotKey='';
 const names={p1:'Mochi',p2:'Pip',p3:'Clover'}, colors={p1:'blush',p2:'ivory',p3:'lavender'};
 const pieces={Stickers:[['✿','Daisy'],['✦','Starlight'],['☾','Little moon']],Charms:[['✧','Crystal'],['♧','Clover'],['☽','Crescent']],Keychains:[['☆','Star tag'],['❀','Bloom tag'],['◈','Gem tag']],Hippers:[['ʕ•ᴥ•ʔ','Tiny bear'],['(•ᴗ•)','Mochi'],['(ᵔᴥᵔ)','Tiny pup']],Hats:[['♕','Crown'],['⌂','Cottage cap'],['⋈','Ribbon']]};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safePhoto=s=>typeof s==='string'&&s.length<=50000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(s);
 function adorn(shell={}){
  return Object.entries(pieces).map(([key,list])=>{
   const selected=shell?.[key], item=list[selected?.item];if(!item)return '';
   const position=['left','center','right'].includes(selected.position)?selected.position:'center';
   return '<span class="shell-piece '+key.toLowerCase()+' place-'+position+'" aria-hidden="true">'+item[0]+'</span>';
  }).join('');
 }
 function toy(id,shell,preview=false){
  const own=id===state.petId, online=own&&state.ready||state.peers.find(p=>p.petId===id)?.status==='online';
  return '<article class="collection-item"><div class="display-toy '+colors[id]+'"><span class="toy-star" aria-hidden="true">✧</span><canvas class="collection-lcd" data-pet="'+id+'" width="240" height="240" role="img" aria-label="'+escape(state.pets[id]?.name||names[id])+' on its LCD"></canvas><div class="display-buttons" aria-hidden="true"><i></i><i></i><i></i></div>'+adorn(shell)+'</div>'+
    (preview?'':'<div class="collection-caption"><strong>'+escape(state.pets[id]?.name||names[id])+'</strong><span>'+ (own?'Your pocket':state.pets[id]?(online?'● Online':'Offline'):'Not linked')+'</span></div>'+
     (own?'<button class="open-pocket" type="button" aria-label="Open My Pocket Lumi"></button>':''))+'</article>';
 }
 function renderToys(container){
  container.querySelectorAll('canvas[data-pet]').forEach(c=>{
   const id=c.dataset.pet, raw=state.pets[id];
   let pet=E.newOwned(id,Date.now()-60001);
   if(raw){const {journal,careLog,...light}=raw;pet=E.applyOwned(light,id,{type:'tick'},Date.now()).pet;}
   else {pet.stage='baby';pet.name='Unlinked';}
   R.render(c.getContext('2d'),{pets:{[id]:pet}},id,{collection:true},Date.now());
  });
 }
 function sync(next){
  const changed=state.pets!==next.pets;state=next;
  if(state.ready&&state.invite&&state.invite!==openedInvite){openedInvite=state.invite;mode='mine';}
  if(!state.ready&&mode==='mine') mode='all';
  const grid=$('allPockets');if(!grid)return;
  root.dataset.mode=mode;
  root.dataset.player=state.petId||'p1';
  const key=JSON.stringify([state.petId,state.ready,state.peers.map(p=>[p.petId,p.status]),E.PET_IDS.map(id=>[state.pets[id]?.name,state.pets[id]?.shell])]);
  if(key!==slotKey){slotKey=key;grid.innerHTML=E.PET_IDS.map(id=>toy(id,state.pets[id]?.shell)).join('');const shell=root.querySelector('.live-shell-pieces');if(shell)shell.innerHTML=adorn(state.pets[state.petId]?.shell);}
  if(mode==='all')renderToys(grid);
  if(changed&&tool==='journal'&&dialog.open)journal(true);
 }
 function setMode(value){
  if(value==='mine'&&!state.ready){dialog.close();$('openStudio').click();return;}
  mode=value;sync(state);dialog.close();
  if(mode==='mine')root.querySelector('[data-key="A"]')?.focus({preventScroll:true});
 }
 function tabs(list,active,attr){return '<div class="celestial-tabs">'+list.map(x=>'<button type="button" data-'+attr+'="'+x+'" aria-pressed="'+(active===x)+'">'+x+'</button>').join('')+'</div>';}
 function journal(feedOnly=false){
  const entries=E.PET_IDS.flatMap(id=>{const p=state.pets[id];return [
    ...(Array.isArray(p?.journal)?p.journal:[]).filter(x=>x&&Number.isFinite(x.at)&&Math.abs(x.at)<8.64e15).map(x=>({...x,id,name:p.name})),
    ...(Array.isArray(p?.careLog)?p.careLog:[]).filter(x=>x&&Number.isFinite(x.at)&&Math.abs(x.at)<8.64e15).map(x=>({...x,id,care:true}))];
  }).filter(x=>journalTab==='Care Log'?x.care:journalTab==='Photo Album'?!x.care&&safePhoto(x.image):journalTab==='Personal Posts'?!x.care&&x.id===state.petId:true).sort((a,b)=>b.at-a.at);
  const verbs={feed:'had a meal',snack:'had a treat',clean:'had a bath',rest:'took a nap',medicine:'took medicine',game:'played Star Catch'};
  const markup=tabs(['Timeline','Care Log','Photo Album','Personal Posts'],journalTab,'journal-tab')+
   (state.ready&&['Timeline','Personal Posts'].includes(journalTab)?'<form id="journalForm"><label for="journalText">Write a moment</label><textarea id="journalText" maxlength="240" rows="2"></textarea><label for="journalImage">Add a picture</label><input id="journalImage" type="file" accept="image/png,image/jpeg,image/webp">'+(photo?'<img class="journal-preview" alt="Pocket camera preview" src="'+photo+'">':'')+'<button class="action" type="submit">Share with studio</button><p class="collection-message" role="status"></p></form>':'')+
   '<div class="journal-feed">'+(entries.length?entries.slice(0,60).map(x=>'<article><header><strong>'+escape(x.name)+'</strong><time>'+escape(new Date(x.at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}))+'</time></header>'+
    (x.care?'<p>'+escape(verbs[x.type]||'spent time in their pocket')+'</p>':'<p>'+escape(x.text)+'</p>'+(safePhoto(x.image)?'<img src="'+x.image+'" alt="Shared studio photo" loading="lazy">':''))+'</article>').join(''):'<p class="journal-empty">'+(state.ready?'No moments here yet.':'Connect to your private studio to see its journal.')+'</p>')+'</div>';
  if(!feedOnly){content.innerHTML=markup;return;}
  const scratch=document.createElement('template');scratch.innerHTML=markup;
  const feed=scratch.content.querySelector('.journal-feed');
  if(feed)content.querySelector('.journal-feed')?.replaceWith(feed);
 }
 function customize(){
  if(!state.ready){content.innerHTML='<p>Connect your own pocket to customize it.</p>';return;}
  content.innerHTML='<div class="customizer"><div id="customPreview">'+toy(state.petId,draft,true)+'</div><div>'+tabs(Object.keys(pieces),category,'category')+
  '<div class="accessory-options">'+pieces[category].map(([icon,name],i)=>'<button type="button" data-piece="'+i+'" aria-pressed="'+(draft[category]?.item===i)+'"><span>'+icon+'</span>'+name+'</button>').join('')+
  '<button type="button" data-piece="-1">Remove</button></div><label for="accessoryPosition">Placement</label><select id="accessoryPosition" '+(draft[category]?'':'disabled')+'>'+['left','center','right'].map(x=>'<option '+((draft[category]?.position||'center')===x?'selected':'')+'>'+x+'</option>').join('')+
  '</select><button type="button" class="action" id="saveShell">Save design</button><p class="collection-message" role="status"></p></div></div>';
  renderToys($('customPreview'));
 }
 function open(which){
  tool=which;
  $('collectionTitle').textContent={view:'Display mode',journal:'Studio journal',customize:'Customization studio'}[which];
  if(which==='view')content.innerHTML='<div class="view-options"><button class="action" data-mode="all">All Pocket Lumis</button><button class="action" data-mode="mine">My Pocket Lumi</button></div>';
  if(which==='journal')journal();
  if(which==='customize'){draft=structuredClone(state.pets[state.petId]?.shell||{});customize();}
  if(!dialog.open)dialog.showModal();
 }
 async function compactImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000)throw Error('Choose a PNG, JPEG or WebP under 12 MB.');
  const bitmap=await createImageBitmap(file);
  try{const c=document.createElement('canvas'), scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height));
   c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));
   const g=c.getContext('2d');g.fillStyle='#fff8ec';g.fillRect(0,0,c.width,c.height);g.drawImage(bitmap,0,0,c.width,c.height);
   for(const q of [.8,.65,.45,.3]){const s=c.toDataURL('image/jpeg',q);if(safePhoto(s))return s;}
   throw Error('This photo is too detailed. Try a smaller image.');
  }finally{bitmap.close();}
 }
 document.querySelector('.collection-tools').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)open(b.dataset.tool);});
 $('closeCollection').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{photo=null;});
 content.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||writing)return;
  if(b.dataset.mode)setMode(b.dataset.mode);
  if(b.dataset.journalTab){journalTab=b.dataset.journalTab;journal();}
  if(b.dataset.category){category=b.dataset.category;customize();}
  if(b.dataset.piece!==undefined){const i=Number(b.dataset.piece);if(i<0)delete draft[category];else draft[category]={item:i,position:draft[category]?.position||'center'};customize();}
  if(b.id==='saveShell'){writing=true;b.disabled=true;try{await window.LumiTama.saveExtra('shell',draft);content.querySelector('.collection-message').textContent='Design saved.';}catch(err){content.querySelector('.collection-message').textContent=err.message;}finally{writing=false;b.disabled=false;}}
 });
 content.addEventListener('change',e=>{if(e.target.id==='accessoryPosition'&&draft[category]){draft[category].position=e.target.value;customize();}});
 content.addEventListener('submit',async e=>{
  if(e.target.id!=='journalForm')return;e.preventDefault();if(writing)return;writing=true;
  const form=e.target, b=form.querySelector('button'), status=form.querySelector('.collection-message'), text=$('journalText').value.trim().slice(0,240), file=$('journalImage').files[0];b.disabled=true;
  try{const image=file?await compactImage(file):photo;if(!text&&!image)throw Error('Write a moment or add a picture first.');
   await window.LumiTama.saveExtra('journal',{at:Date.now(),text,...(safePhoto(image)?{image}:{})});photo=null;journal();
  }catch(err){status.textContent=err.message;}finally{writing=false;b.disabled=false;}
 });
 document.addEventListener('DOMContentLoaded',()=>{
  const grid=document.createElement('div');grid.id='allPockets';grid.className='all-pockets';root.prepend(grid);
  root.querySelector('.pocket-device')?.insertAdjacentHTML('beforeend','<div class="live-shell-pieces"></div>');
  grid.addEventListener('click',e=>{if(e.target.closest('.open-pocket'))setMode('mine');});
  sync(state);
 });
 window.LumiCollection={sync,photo(image){if(!safePhoto(image))return;photo=image;journalTab='Timeline';open('journal');}};
})();
