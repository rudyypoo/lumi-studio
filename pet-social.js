/* Consensual multiplayer sessions. Each participant writes only their response
   or their own contribution. Firebase rules are the authority, not these checks. */
(function(root){'use strict';
const ACTIVITIES={stargaze:{name:'Make a constellation',verb:'Place my star',description:'Each add a star to light a constellation together.'},picnic:{name:'Bring-a-treat picnic',verb:'Bring my treat',description:'Each bring a treat and watch your pets meet in the garden.'}};
function canInvite(self,peer,online){return !!self&&!!peer&&self.uid!==peer.uid&&self.petId!==peer.petId&&online;}
function invite(self,peer,activity,now,id){if(!canInvite(self,peer,true)||!ACTIVITIES[activity])throw Error('Choose an online friend and activity.');return {id,fromUid:self.uid,fromPet:self.petId,toUid:peer.uid,toPet:peer.petId,activity,status:'pending',createdAt:now,expiresAt:now+120000};}
function reply(event,uid,response,now){if(event.toUid!==uid||event.status!=='pending'||now>=event.expiresAt||!['accepted','declined'].includes(response))throw Error('This invitation is no longer available.');return response;}
function complete(event){return event.status==='accepted'&&!!event.ready?.[event.fromUid]&&!!event.ready?.[event.toUid];}
const api={ACTIVITIES,canInvite,invite,reply,complete};
if(typeof module!=='undefined')module.exports=api;else root.LumiPetSocial=api;
})(typeof window!=='undefined'?window:globalThis);
