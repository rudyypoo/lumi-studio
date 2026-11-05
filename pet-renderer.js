/* Original pixel creatures and 240x240 scenes, shared by web/device clients. */
(function(root){'use strict';
const palettes={rose:['#eda7bc','#ffe7eb'],mint:['#88c9b1','#e5fff1'],lilac:['#bca2de','#f5ebff']};
function render(ctx,s,id,ui={},time=0){
 const p=s?.pets[id],tick=Math.floor(time/500),ink='#513c59';
 ctx.imageSmoothingEnabled=false;
 const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
 const text=(t,x,y,size=10,color=ink)=>{ctx.fillStyle=color;ctx.font='bold '+size+'px monospace';ctx.textAlign='left';ctx.fillText(String(t),x,y);};
 const ellipse=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
 const star=(x,y,c='#e8bb65')=>{rect(x+2,y,2,8,c);rect(x,y+3,6,2,c);};
 function creature(p,x,y,scale=3){
  const [body,light]=palettes[p.color]||palettes.rose;
  const px=(a,b,w,h,c)=>rect(x+a*scale,y+b*scale,w*scale,h*scale,c);
  if(p.stage==='egg'){
   for(let r=0;r<15;r++){const w=r<3?6+r*2:r>12?12-(r-12)*2:14;px((16-w)/2,r,w,1,ink);px((16-w)/2+1,r+0,Math.max(1,w-2),1,'#fff0c9');}
   px(4,5,3,3,body);px(9,10,3,3,body);return;
  }
  // Integer rectangles keep the silhouette crisp on a tiny TFT.
  const ears=p.stage==='adult'?p.form:p.stage==='teen'?'bun':'mochi';
  if(ears==='bun'){px(2,-6,4,10,ink);px(3,-5,2,9,body);px(10,-6,4,10,ink);px(11,-5,2,9,body);}
  if(ears==='bloom'){for(const [a,b] of [[5,-5],[9,-3],[5,-1],[1,-3]]){px(a,b,4,4,'#d173a5');}px(5,-2,3,3,'#ffe294');}
  if(ears==='comet'){px(-3,1,6,4,ink);px(-2,2,5,2,body);px(13,1,6,4,ink);px(13,2,5,2,body);px(7,-4,3,5,'#e4b357');}
  const rows=[8,12,14,16,16,16,16,16,16,14,12,8];
  rows.forEach((w,r)=>{px((16-w)/2,r,w,1,ink);if(r>0&&r<11)px((16-w)/2+1,r,w-2,1,body);});
  px(3,2,5,2,light);px(2,11,4,2,ink);px(10,11,4,2,ink);
  if(tick%9===0){px(4,5,2,1,ink);px(10,5,2,1,ink);}else{px(4,4,2,3,ink);px(10,4,2,3,ink);px(4,4,1,1,'#fff');px(10,4,1,1,'#fff');}
  px(2,7,3,1,'#e98ba5');px(11,7,3,1,'#e98ba5');px(7,7,2,1,ink);px(6,6,1,1,ink);px(9,6,1,1,ink);
  if(p.decor.hat==='bow'){px(8,-2,3,3,'#c95784');px(13,-2,3,3,'#c95784');px(11,-1,2,2,'#f2b3cd');}
  if(p.decor.hat==='crown'){px(4,-4,2,4,'#dfb452');px(10,-4,2,4,'#dfb452');px(7,-5,2,5,'#dfb452');px(4,-1,8,2,'#f3d884');}
 }
 rect(0,0,240,240,'#fff4eb');
 if(!p){text('LUMI POCKET',65,98,16);text('Three little lives.',64,123);text('One little universe.',58,140);return;}
 const wall=root.LumiPetEngine.catalog.find(x=>x.id===p.decor.wall)?.color||'#f9dbe5';
 const garden=ui.scene==='garden';rect(0,24,240,152,garden?'#d9eadb':wall);
 if(garden){ellipse(55,50,16,16,'#ffe2a0');rect(0,150,240,64,'#b4d2ad');for(let i=0;i<10;i++){star(10+i*25,165+(i%3)*12,i%2?'#fff5dd':'#f0b6ca');}}
 else{
  for(let x=12;x<240;x+=24){rect(x,35,1,130,'#ffffff40');rect(x-2,50,5,5,'#ffffff50');}
  rect(0,170,240,43,'#e7c8ad');rect(0,168,240,4,'#caa388');
  for(let x=0;x<240;x+=40)rect(x,174,1,39,'#d6b297');
  rect(151,40,61,65,'#fff3dc');rect(155,44,53,57,'#accddd');ellipse(190,57,9,9,'#fff0c0');rect(180,44,3,57,'#fff3dc');rect(155,72,53,3,'#fff3dc');
  rect(18,135,49,27,'#bc8d9a');rect(14,133,56,6,'#fff4e9');rect(18,139,45,15,'#edbacb');rect(18,160,4,12,'#937487');rect(61,160,4,12,'#937487');
  if(p.decor.rug)ellipse(123,186,57,15,p.decor.rug==='cloud'?'#fff9ed':'#e9a7bb');
  if(p.decor.plant){rect(202,150,15,20,'#bc8d70');rect(208,125,3,25,'#78a086');ellipse(202,132,9,4,'#78a086');ellipse(216,141,9,4,'#78a086');if(p.decor.plant==='flowers'){ellipse(210,125,8,8,'#fff1ba');ellipse(210,125,3,3,'#d6a95f');}}
  if(p.decor.lamp){rect(85,139,3,31,'#967c97');ellipse(86,130,11,13,'#fff3c4');ellipse(92,127,9,11,wall);}
 }
 if(garden){const guests=(ui.guests||[id]).filter(guest=>s.pets[guest]);guests.forEach((guest,i)=>{const x=guests.length===2?55+i*100:38+i*76;ellipse(x,186,24,5,'#654c6522');creature(s.pets[guest],x-24,144+((tick+i)%2?2:0),3);});
  if(ui.social?.activity==='stargaze'){
   rect(0,24,240,90,'#414767');const points=[[39,76],[82,45],[128,82],[172,43],[211,70]];
   points.forEach(([x,y],i)=>{star(x,y,ui.social.complete?'#ffe6a0':'#bdc4df');if(ui.social.complete&&i){ctx.strokeStyle='#aeb8de';ctx.beginPath();ctx.moveTo(points[i-1][0]+3,points[i-1][1]+4);ctx.lineTo(x+3,y+4);ctx.stroke();}});
   text(ui.social.complete?'OUR CONSTELLATION':'A STAR FROM EACH OF US',51,105,9,'#fff0d4');
  }else if(ui.social?.activity==='picnic'){rect(77,183,86,20,'#f3c3d0');for(let x=79;x<163;x+=12)rect(x,183,5,20,'#fff2de');if(ui.social.complete){ellipse(94,187,8,4,'#e7b56b');ellipse(143,187,7,4,'#e9a7c0');}}
 }
 else{ellipse(120,185,31,6,'#654c6522');creature(p,96,143+(tick%2?0:2),3);}
 if(p.sick)text('+',135,130,18,'#ba657d');
 if(p.food<30)text('hungry',12,118,9);else if(p.energy<30)text('sleepy',12,118,9);
 rect(0,0,240,24,'#fff8ef');text(p.name,10,16,11);text(p.stage.toUpperCase(),140,16,9);
 rect(0,214,240,26,'#fff8ef');text(ui.label||'A MENU   B SELECT   C BACK',10,230,9);
 if(ui.menu){rect(13,35,214,166,'#fff8f0');rect(13,35,214,3,'#db9fb9');text(ui.title||'POCKET MENU',24,54,11);
  ui.menu.forEach((item,i)=>{const y=67+i*23;if(i===ui.cursor)rect(21,y,198,21,'#f2d4e0');text((i===ui.cursor?'> ':'  ')+item,25,y+14,10);});}
 if(ui.game){rect(16,46,208,150,'#fff8f0');text('STAR CATCH',76,66,12);text(ui.game.round+'/10',99,85);rect(30,116,180,12,'#ebdce4');rect(104,111,32,22,'#b9d8b6');rect(30+ui.game.position*174,107,6,30,'#9a698a');text('B when the star is green',35,162,10);text('C to leave',86,180,9);}
 if(ui.notice){rect(12,174,216,35,'#fff7e7');const words=ui.notice.match(/.{1,31}(?:\s|$)|.{1,31}/g)||[];words.slice(0,2).forEach((line,i)=>text(line.trim(),20,188+i*12,9));}
}
root.LumiPetRenderer={render};
})(typeof window!=='undefined'?window:globalThis);
