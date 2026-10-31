/* Lumi Studio · Firebase private-room adapter. No admin credentials in browser. */
(function(){
  'use strict';
  const cfg=window.LUMI_FIREBASE_CONFIG || {};
  let auth,db,roomId='',roomInvite='',currentUid='',promise=null;
  const configured=()=>!!(cfg.apiKey&&cfg.databaseURL&&cfg.projectId&&!cfg.apiKey.includes('PASTE')&&!cfg.databaseURL.includes('YOUR_'));
  function check(){if(!configured())throw Error('Edit firebase-config.js using your Firebase Web app configuration first.');if(!window.firebase)throw Error('Firebase SDK could not load; check internet or ad blockers.');}
  function randHex(bytes){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');}
  function validRoom(v){if(!/^[a-f0-9]{24,40}$/.test(v))throw Error('Invalid room ID. Use the private invitation link.');return v;}
  function validInvite(v){if(!/^[a-f0-9]{48,80}$/.test(v))throw Error('Invalid invitation. Ask the owner for a new private link.');return v;}
  function initialize(){
    check();
    if(promise)return promise;
    promise=(async()=>{
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      auth=firebase.auth();db=firebase.database();
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await new Promise((resolve,reject)=>{
        const off=auth.onAuthStateChanged(async user=>{
          if(user){currentUid=user.uid;off();resolve();}
          else {try{await auth.signInAnonymously();}catch(e){off();reject(e);}}
        },reject);
      });
      return {uid:currentUid};
    })();
    return promise;
  }
  function path(rel){if(!roomId)throw Error('Connect to a studio first.');if(!/^[a-zA-Z0-9_/-]+$/.test(rel))throw Error('Invalid data path');return 'rooms/'+roomId+'/'+rel;}
  async function createRoom(){
    await initialize();
    const rid=randHex(16),code=randHex(32);
    await db.ref('rooms/'+rid+'/owner').set(currentUid);
    await db.ref('rooms/'+rid+'/invite').set(code);
    await db.ref('rooms/'+rid+'/members/'+currentUid).set({role:'owner'});
    return {room:rid,invite:code};
  }
  async function joinRoom(rid,code=''){
    await initialize();validRoom(rid);
    const oldRoom=roomId;roomId=rid;
    try{
      const memberRef=db.ref(path('members/'+currentUid));
      const existing=(await memberRef.once('value')).val();
      if(!existing){
        validInvite(code);
        await memberRef.set({role:'guest',invite:code});
      }
      const allowed=(await memberRef.once('value')).val();
      if(!allowed)throw Error('This device has not joined that private room.');
      roomInvite=code||'';
      return {room:rid,invite:roomInvite};
    }catch(e){roomId=oldRoom;throw e;}
  }
  async function getOwnerInvite(){
    await initialize();
    const owner=(await db.ref(path('owner')).once('value')).val();
    if(owner!==currentUid)throw Error('Only the room creator can generate an invitation from this device.');
    roomInvite=(await db.ref(path('invite')).once('value')).val();
    return roomInvite;
  }
  async function pairDevice(uid){
    await initialize();
    if(!/^[a-zA-Z0-9_-]{20,128}$/.test(uid))throw Error('Paste the exact device UID from its Serial Monitor.');
    const owner=(await db.ref(path('owner')).once('value')).val();
    if(owner!==currentUid)throw Error('Only the room owner can authorize an Arduino.');
    await db.ref(path('members/'+uid)).set({role:'device'});
  }
  async function set(rel,value){await initialize();return db.ref(path(rel)).set(value);}
  async function get(rel){await initialize();return (await db.ref(path(rel)).once('value')).val();}
  async function transact(rel,fn){await initialize();return db.ref(path(rel)).transaction(fn,undefined,false);}
  function listen(rel,fn){
    const r=db.ref(path(rel));
    const callback=s=>fn(s.val());
    r.on('value',callback,e=>{console.error('Firebase listener error',rel,e);fn(null,e);});
    return ()=>r.off('value',callback);
  }
  window.LumiCloud={initialize,isConfigured:configured,createRoom,joinRoom,getOwnerInvite,pairDevice,set,get,transact,listen,get room(){return roomId},get uid(){return currentUid}};
})();
