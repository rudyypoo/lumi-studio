/* Consensual multiplayer sessions. Each participant writes only their response
   or their own contribution. Firebase rules are the authority, not these checks. */
(function(root){'use strict';
const ACTIVITIES={stargaze:{name:'Make a constellation',verb:'Place my star',description:'Each add a star to light a constellation together.'},picnic:{name:'Bring-a-treat picnic',verb:'Bring my treat',description:'Each bring a treat and watch your pets meet in the garden.'}};
function canInvite(self,peer,online){return !!self&&!!peer&&self.uid!==peer.uid&&self.petId!==peer.petId&&online;}
function invite(self,peer,activity,now,id){if(!canInvite(self,peer,true)||!ACTIVITIES[activity])throw Error('Choose an online friend and activity.');return {id,fromUid:self.uid,fromPet:self.petId,toUid:peer.uid,toPet:peer.petId,activity,status:'pending',createdAt:now,expiresAt:now+120000};}
function reply(event,uid,response,now){if(event.toUid!==uid||event.status!=='pending'||now>=event.expiresAt||!['accepted','declined'].includes(response))throw Error('This invitation is no longer available.');return response;}
function complete(event){return event.status==='accepted'&&!!event.ready?.[event.fromUid]&&!!event.ready?.[event.toUid];}
function friends(pets,presence,self,now,connected=true){
 return ['p1','p2','p3'].filter(id=>id!==self.petId).map(id=>{
  const candidates=[];
  for(const [uid,tabs] of Object.entries(presence||{}))for(const record of Object.values(tabs||{})){
   if(record&&uid!==self.uid&&record.petId===id&&Number.isFinite(record.at)&&now-record.at>=-5000&&now-record.at<45000)candidates.push({uid,at:record.at});
  }
  candidates.sort((a,b)=>b.at-a.at);
  return {petId:id,name:pets?.[id]?.name||({p1:'Mochi',p2:'Pip',p3:'Clover'})[id],uid:connected?candidates[0]?.uid:null,status:!connected?'unknown':candidates.length?'online':'offline'};
 });
}
function incoming(sessions,uid,now){return Object.values(sessions||{}).filter(e=>e.toUid===uid&&e.status==='pending'&&e.expiresAt>now&&ACTIVITIES[e.activity]).sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id))[0]||null;}
const api={ACTIVITIES,canInvite,invite,reply,complete,friends,incoming};
if(typeof module!=='undefined')module.exports=api;else root.LumiPetSocial=api;
})(typeof window!=='undefined'?window:globalThis);
