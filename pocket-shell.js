/* Pocket Lumi: connection settings around an independently owned pet. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),dialog=$('studioDialog');
 let currentRoom='',invite='',joining=false;
 const message=text=>{$('cloudSetupHint').textContent=text;};
 const showStudio=()=>{if(!dialog.open)dialog.showModal();};
 function status(connected,text){
  $('connectionChip').classList.toggle('online',connected);
  document.body.classList.toggle('studio-connected',connected);
  $('connectionChipText').textContent=text;
  $('disconnect').disabled=!connected;
  $('createStudio').disabled=connected||joining;
  $('connect').disabled=joining;
 }
 $('openStudio').addEventListener('click',showStudio);
 $('closeStudio').addEventListener('click',()=>dialog.close());
 async function join(room,code){
  if(joining)return;
  joining=true;status(!!currentRoom,'Connecting…');message('Opening your studio…');
  try{
   const result=await window.LumiCloud.joinRoom(room,code);
   currentRoom=result.room;invite=result.invite||code||'';
   localStorage.setItem('lumi-room',currentRoom);
   $('studioRoom').value=currentRoom;$('studioInvite').value='';
   await window.LumiTama.connect(window.LumiCloud);
   message('Studio connected. Share its invitation to bring your friends here.');
   dialog.close();
  }catch(error){message('Could not open studio: '+error.message);showStudio();}
  finally{joining=false;status(!!currentRoom,currentRoom?'Private studio connected':'Not connected');}
 }
 $('studioForm').addEventListener('submit',event=>{event.preventDefault();join($('studioRoom').value.trim(),$('studioInvite').value.trim());});
 $('createStudio').addEventListener('click',async()=>{
  if(joining||currentRoom)return;
  joining=true;status(false,'Creating studio…');
  try{const result=await window.LumiCloud.createRoom();joining=false;await join(result.room,result.invite);}
  catch(error){joining=false;status(false,'Not connected');message('Could not create studio: '+error.message);}
 });
 $('disconnect').addEventListener('click',()=>{
  window.LumiTama.disconnect();currentRoom='';invite='';
  localStorage.removeItem('lumi-room');status(false,'Not connected');
  $('studioInviteLinkWrap').hidden=true;
  message('Disconnected. Your pet is saved. Reopen this studio to continue.');
 });
 $('copyStudioInvite').addEventListener('click',async()=>{
  if(!currentRoom){message('Open your studio first, then copy its invitation.');return;}
  try{
   if(!invite)invite=await window.LumiCloud.getOwnerInvite();
   const link=location.origin+location.pathname+'#room='+encodeURIComponent(currentRoom)+'&invite='+encodeURIComponent(invite);
   $('studioInviteLink').value=link;$('studioInviteLinkWrap').hidden=false;
   try{await navigator.clipboard.writeText(link);message('Invitation copied. Share it privately with your friends.');}
   catch{message('Copy the invitation link below and share it privately.');}
  }catch(error){message('Only the studio owner can copy an invitation from this browser. '+error.message);}
 });
 document.addEventListener('keydown',event=>{
  if(event.repeat||dialog.open||/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement?.tagName))return;
  const key={ArrowLeft:'A',ArrowRight:'A',ArrowDown:'A',Enter:'B',' ':'B',Escape:'C',Backspace:'C'}[event.key];
  if(key){event.preventDefault();window.LumiTama.press(key);}
 });
 const params=new URLSearchParams(location.hash.slice(1));
 $('studioRoom').value=params.get('room')||localStorage.getItem('lumi-room')||'';
 $('studioInvite').value=params.get('invite')||'';
 if(window.LumiCloud?.isConfigured())window.LumiCloud.initialize().then(()=>{
  if($('studioRoom').value)join($('studioRoom').value.trim(),$('studioInvite').value.trim());
 }).catch(error=>message('Could not connect: '+error.message));
 else message('The studio connection is not configured.');
})();
