/* Lumi Pocket: deterministic, renderer-independent game rules. Browser + Node. */
(function(root){'use strict';
const HOUR=3600000,DAY=24*HOUR;
const VERSION=3,PET_IDS=['p1','p2','p3'];
const catalog=[
 {id:'rose',name:'Rose cottage',slot:'wall',cost:0,color:'#f9dbe5'},
 {id:'mint',name:'Mint morning',slot:'wall',cost:35,color:'#d5eee5'},
 {id:'lilac',name:'Lavender dusk',slot:'wall',cost:35,color:'#e4dcf6'},
 {id:'night',name:'Starry midnight',slot:'wall',cost:65,color:'#354060'},
 {id:'rug',name:'Strawberry rug',slot:'rug',cost:30},
 {id:'cloud',name:'Cloud rug',slot:'rug',cost:45},
 {id:'plant',name:'Little fern',slot:'plant',cost:25},
 {id:'flowers',name:'Daisy pot',slot:'plant',cost:40},
 {id:'lamp',name:'Moon lamp',slot:'lamp',cost:55},
 {id:'bow',name:'Cherry bow',slot:'hat',cost:40},
 {id:'crown',name:'Tiny crown',slot:'hat',cost:85}
];
function pet(name,color,now){return {name,color,born:now,last:now,age:0,stage:'egg',form:'mochi',food:85,joy:85,clean:100,energy:100,sick:false,coins:100,skills:{cozy:0,brave:0,playful:0},owned:{rose:true},decor:{wall:'rose'},discoveries:{},lastExplore:0,lastGift:0,lastTogether:0,visits:0};}
function create(now=Date.now()){return {version:VERSION,revision:0,pets:{p1:pet('Mochi','rose',now),p2:pet('Pip','mint',now),p3:pet('Clover','lilac',now)},bond:0,garden:{level:1},album:[{text:'Three tiny eggs. One little universe.',at:now}],receipts:{}};}
function upgrade(input,now=Date.now()){
 const s=JSON.parse(JSON.stringify(input));
 if(s.version===VERSION)return normalize(s);
 if(s.version!==2)throw Error('Unsupported save version');
 normalize(s);s.pets.p3=s.pets.p3||pet('Clover','lilac',now);
 s.version=VERSION;s.revision++;note(s,'Clover joined your little universe.',now);
 return s;
}
// RTDB omits empty objects. Restore optional collections at every boundary.
function normalize(s){s.receipts=s.receipts||{};s.album=s.album||[];for(const p of Object.values(s.pets)){p.discoveries=p.discoveries||{};p.owned=p.owned||{rose:true};p.decor=p.decor||{wall:'rose'};}return s;}
function note(s,text,now){s.album.push({text,at:now});s.album=s.album.slice(-30);}
function stage(age){return age<60000?'egg':age<DAY?'baby':age<3*DAY?'child':age<6*DAY?'teen':'adult';}
function evolve(p){const k=p.skills;return k.cozy>=k.brave&&k.cozy>=k.playful?'bloom':k.brave>k.playful?'comet':'bun';}
function advance(s,now){normalize(s);for(const p of Object.values(s.pets)){
 const elapsed=Math.max(0,now-p.last);if(!elapsed)continue;
 p.age+=elapsed;p.last=now;const hours=Math.min(48,elapsed/HOUR);
 // Long absences stop at a recoverable floor. No death or permanent damage.
 p.food=Math.max(10,p.food-hours*4);p.joy=Math.max(10,p.joy-hours*3);
 p.clean=Math.max(10,p.clean-hours*2);p.energy=Math.max(15,p.energy-hours*1.5);
 if(p.clean<25&&p.food<30)p.sick=true;
 const next=stage(p.age);if(next!==p.stage){p.stage=next;if(next==='adult')p.form=evolve(p);note(s,p.name+' grew into '+(next==='adult'?p.form+' form':'a '+next)+'!',now);}
 }return s;}
function apply(input,a,now=Date.now()){
 const s=normalize(JSON.parse(JSON.stringify(input)));if(s.version!==VERSION)throw Error('Unsupported save version');
 if(a.id&&s.receipts[a.id])return {state:s,message:'Already saved.'};
 advance(s,now);const p=s.pets[a.pet];if(!p)throw Error('Choose a pet first.');
 let message='';
 const add=(key,n)=>{p[key]=Math.min(100,p[key]+n);};
 if(a.type==='tick')return {state:s,message:''};
 if(p.stage==='egg'&&!['rename'].includes(a.type))return {state:s,message:'Your egg will hatch in a minute.'};
 switch(a.type){
 case 'feed':add('food',28);add('energy',5);message='A warm meal. Happy little tummy!';break;
 case 'snack':add('food',10);add('joy',12);p.skills.cozy++;message='A berry just for you.';break;
 case 'clean':add('clean',100);p.sick=false;message='A bubble bath makes everything better.';break;
 case 'rest':add('energy',35);add('joy',5);message='A cozy rest under the quilt.';break;
 case 'medicine':p.sick=false;add('food',10);message='Feeling better. Thank you for caring.';break;
 case 'rename':{const name=String(a.name||'').trim().slice(0,16);if(!name)return {state:s,message:'Enter a name first.'};p.name=name;message='Hello, '+name+'!';break;}
 case 'decorate':{const item=catalog.find(x=>x.id===a.item);if(!item)throw Error('Unknown decoration');
 if(!p.owned[item.id]){if(p.coins<item.cost)return {state:s,message:'Earn a few more stars first.'};p.coins-=item.cost;p.owned[item.id]=true;p.skills.cozy+=3;}
 p.decor[item.slot]=item.id;message=item.name+' is home.';break;}
 case 'explore':{if(now-p.lastExplore<5*60000)return {state:s,message:'Next adventure in '+Math.ceil((5*60000-(now-p.lastExplore))/60000)+' min.'};
 if(p.energy<25)return {state:s,message:'Rest before your next adventure.'};
 const places=['Dewdrop woods','Seashell cove','Starlight hill'];const finds=['Acorn charm','Pink seashell','Fallen star','Tiny feather','Moon pebble','Wild strawberry'];
 const roll=Math.abs(Number(a.seed)||0)%finds.length;p.lastExplore=now;p.energy-=12;p.skills.brave+=3;p.coins+=12;p.discoveries[finds[roll]]=true;add('joy',12);
 message=places[roll%3]+': found '+finds[roll]+' +12 stars';note(s,p.name+' found a '+finds[roll].toLowerCase()+'.',now);break;}
 case 'game':{const score=Math.max(0,Math.min(10,Math.floor(Number(a.score)||0)));if(now-(p.lastGame||0)<15000)return {state:s,message:'Take a little breather between games.'};
 p.lastGame=now;p.coins+=score*2+3;p.skills.playful+=score;add('joy',score*2+5);p.energy=Math.max(15,p.energy-5);message=score+'/10 · earned '+(score*2+3)+' stars!';break;}
 case 'gift':{const other=PET_IDS.includes(a.target)&&a.target!==a.pet?s.pets[a.target]:null;
 if(!other)return {state:s,message:'Choose another pet to send your gift to.'};
 if(now-p.lastGift<HOUR)return {state:s,message:'Your next gift will be ready in an hour.'};if(p.coins<10)return {state:s,message:'A gift costs 10 stars.'};p.coins-=10;other.coins+=15;other.joy=Math.min(100,other.joy+15);p.lastGift=now;s.bond+=2;s.garden.level=1+Math.floor(s.bond/15);message='A little surprise for '+other.name+'.';note(s,p.name+' left '+other.name+' a gift.',now);break;}
 case 'together':if(now-p.lastTogether<HOUR)return {state:s,message:'The next picnic is ready in an hour.'};p.lastTogether=now;p.visits++;s.bond+=3;for(const guest of Object.values(s.pets))guest.joy=Math.min(100,guest.joy+20);s.garden.level=1+Math.floor(s.bond/15);message='A picnic for three. Your garden grew a little closer.';note(s,PET_IDS.map(id=>s.pets[id].name).join(', ')+' shared a garden picnic.',now);break;
 default:throw Error('Unknown action');
 }
 s.revision++;if(a.id){s.receipts[a.id]=now;const keys=Object.keys(s.receipts).sort((x,y)=>s.receipts[x]-s.receipts[y]);for(const id of keys.slice(0,Math.max(0,keys.length-100)))delete s.receipts[id];}
 return {state:s,message};
}
const api={create,upgrade,normalize,advance,apply,catalog,stage,evolve,HOUR,DAY,VERSION,PET_IDS};
// Live play stores and transacts one owned pet at a time. Social sessions never
// edit a partner's pet. Legacy aggregate rules remain for old local saves only.
const OWNED_ACTIONS=['feed','snack','clean','rest','medicine','rename','decorate','explore','game','tick'];
api.newOwned=(id,now=Date.now())=>{if(!PET_IDS.includes(id))throw Error('Invalid pet');const s=create(now);return {...s.pets[id],v:4,memories:[],receipts:{}};};
api.applyOwned=(input,id,a,now=Date.now())=>{
 if(!PET_IDS.includes(id)||!OWNED_ACTIONS.includes(a.type))throw Error('This action cannot control another pet.');
 const s={version:VERSION,revision:input.revision||0,pets:{[id]:input},album:input.memories||[],receipts:input.receipts||{}};
 const r=apply(s,{...a,pet:id},now),p=r.state.pets[id];
 return {pet:{...p,v:4,revision:r.state.revision,memories:r.state.album,receipts:r.state.receipts},message:r.message};
};
// Display everyone at the same time without writing to another player's save.
api.scenePets=(pets,now=Date.now())=>Object.fromEntries(PET_IDS.filter(id=>pets?.[id]).map(id=>[id,api.applyOwned(pets[id],id,{type:'tick'},now).pet]));
if(typeof module!=='undefined')module.exports=api;else root.LumiPetEngine=api;
})(typeof window!=='undefined'?window:globalThis);
