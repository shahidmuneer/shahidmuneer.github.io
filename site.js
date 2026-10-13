'use strict';
const menuButton=document.querySelector('.menu-toggle');
const navLinks=document.querySelector('#nav-links');
function closeMenu(){menuButton.setAttribute('aria-expanded','false');navLinks.classList.remove('is-open');}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));navLinks.classList.toggle('is-open',open);});
navLinks.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menuButton.getAttribute('aria-expanded')==='true'){closeMenu();menuButton.focus();}});
document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))closeMenu();});
const filterButtons=[...document.querySelectorAll('[data-filter]')];
const papers=[...document.querySelectorAll('.paper-card')];
filterButtons.forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.filter;filterButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));let count=0;papers.forEach(p=>{const show=filter==='all'||p.dataset.year===filter||(filter==='first'&&p.dataset.first==='true');p.hidden=!show;if(show)count++;});document.querySelector('#paper-count').textContent=`${count} PUBLICATION${count===1?'':'S'}`;}));
const tabs=[...document.querySelectorAll('[data-topic]')];
let topic=0;
const topicLabels=['FREQUENCY FORENSICS','MULTI-AGENT VERIFICATION','AUDIO-VISUAL DETECTION','ROBUST WATERMARKING','GENERATIVE AI SAFETY'];
function selectTopic(index){topic=index;tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.querySelector(`#research-panel-${i}`).hidden=i!==index;});document.querySelector('#research-figure-label').textContent=topicLabels[index]+' / CONCEPTUAL VIEW';document.querySelector('#figure-index').textContent=`0${index+1} / 05`;drawResearch(performance.now());}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectTopic(index));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();selectTopic(next);tabs[next].focus();}});});
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let paused=motionPreference.matches,frame=0,heroVisible=true,researchVisible=false;
const motionButton=document.querySelector('#motion-toggle');
const heroCanvas=document.querySelector('#neural-canvas'),researchCanvas=document.querySelector('#research-canvas');
const rc=researchCanvas.getContext('2d');
function syncMotionButton(){motionButton.textContent=paused?'▶':'Ⅱ';motionButton.setAttribute('aria-label',paused?'Play visual animation':'Pause visual animation');motionButton.setAttribute('aria-pressed',String(paused));}
function setPaused(value){paused=value;document.dispatchEvent(new CustomEvent('portrait-motion',{detail:{paused}}));syncMotionButton();cancelAnimationFrame(frame);if(!paused&&!document.hidden)frame=requestAnimationFrame(animate);else{drawHero(0);drawResearch(0);}}
motionButton.addEventListener('click',()=>setPaused(!paused));
motionPreference.addEventListener('change',e=>setPaused(e.matches));
syncMotionButton();
function dimensions(canvas,ctx){const box=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);const width=Math.round(box.width*ratio),height=Math.round(box.height*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}ctx.setTransform(ratio,0,0,ratio,0,0);return [box.width,box.height];}
function drawHero(time){window.faceHero?.render(time,paused);}
function drawResearch(time){if(!rc)return;const [w,h]=dimensions(researchCanvas,rc);rc.clearRect(0,0,w,h);const t=time*.0006;rc.strokeStyle='#27364777';rc.lineWidth=.5;for(let x=15;x<w;x+=30){rc.beginPath();rc.moveTo(x,20);rc.lineTo(x,h-20);rc.stroke();}for(let y=20;y<h;y+=30){rc.beginPath();rc.moveTo(15,y);rc.lineTo(w-15,y);rc.stroke();}
const dot=(x,y,r,color)=>{rc.beginPath();rc.arc(x,y,r,0,Math.PI*2);rc.fillStyle=color;rc.fill();};
if(topic===0){for(let j=0;j<3;j++){rc.beginPath();rc.strokeStyle=['#72dce7','#c3f86a','#7285b5'][j];rc.lineWidth=1.5;for(let x=15;x<w-15;x++){const u=(x-15)/(w-30),wave=Math.sin(u*18+j*.8+t)*Math.exp(-u*1.2)*12,spike=j===1?Math.pow(Math.abs(Math.sin(u*40)),18)*27:j===2?Math.exp(-Math.pow((u-.5)*9,2))*38:0;const y=65+j*60-wave-spike;x===15?rc.moveTo(x,y):rc.lineTo(x,y);}rc.stroke();}rc.font='8px monospace';['NATURAL SPECTRUM','GENERATOR ARTIFACTS','DIFFUSION SIGNATURE'].forEach((x,i)=>{rc.fillStyle=['#72dce7','#c3f86a','#91a7d4'][i];rc.fillText(x,20,88+i*60);});}
else if(topic===1){const nodes=Array.from({length:7},(_,i)=>({x:w/2+Math.cos(i*Math.PI/3)*w*.32,y:h/2+Math.sin(i*Math.PI/3)*h*.32}));nodes[6]={x:w/2,y:h/2};nodes.forEach((p,i)=>{rc.strokeStyle='#72dce755';rc.beginPath();rc.moveTo(p.x,p.y);rc.lineTo(w/2,h/2);rc.stroke();dot(p.x,p.y,i===6?11:6,i===6?'#c3f86a':'#72dce7');const f=(t*.4+i*.2)%1;dot(p.x+(w/2-p.x)*f,p.y+(h/2-p.y)*f,2,'#c3f86a');});rc.fillStyle='#a6b9cb';rc.font='8px monospace';rc.fillText('EVIDENCE → DEBATE → CONSENSUS',20,h-12);}
else if(topic===2){rc.strokeStyle='#72dce7aa';rc.beginPath();rc.ellipse(w*.4,h*.43,48,72,0,0,Math.PI*2);rc.stroke();for(let i=0;i<24;i++){const a=i*Math.PI/12;dot(w*.4+Math.cos(a)*48,h*.43+Math.sin(a)*72,2,'#72dce7');}[-19,19].forEach(x=>{dot(w*.4+x,h*.37,3,'#c3f86a');});rc.strokeStyle='#c3f86a';rc.beginPath();rc.ellipse(w*.4,h*.57,19,4+Math.abs(Math.sin(t))*5,0,0,Math.PI*2);rc.stroke();rc.beginPath();for(let x=0;x<90;x++){const y=h*.47+Math.sin(x*.3+t)*Math.sin(x/90*Math.PI)*24;x?rc.lineTo(w*.66+x,y):rc.moveTo(w*.66+x,y);}rc.stroke();rc.fillStyle='#a6b9cb';rc.font='8px monospace';rc.fillText('FACIAL LANDMARKS × AUDIO ALIGNMENT',20,h-12);}
else if(topic===3){for(let i=0;i<17;i++)for(let j=0;j<9;j++){const x=w*.1+i*w*.047,y=40+j*18+Math.sin(i*.5+t)*7;dot(x,y,1.5+Math.sin(i+j+t)*.6,(i+j)%4===0?'#c3f86a':'#72dce780');}rc.strokeStyle='#c3f86a70';rc.strokeRect(w*.25,55,w*.5,130);rc.fillStyle='#a6b9cb';rc.font='8px monospace';rc.fillText('EMBEDDED SIGNAL / LATENT SPACE',20,h-12);}
else{for(let i=0;i<90;i++){const side=i%2,a=i*2.39996,r=Math.sqrt(i/90)*50;dot(w*(side?.68:.3)+Math.cos(a+t*.05)*r,h*.48+Math.sin(a)*r,2,side?'#72dce7bb':'#c3f86aaa');}rc.strokeStyle='#c3f86a55';rc.setLineDash([4,5]);rc.beginPath();rc.arc(w*.3,h*.48,68,0,Math.PI*2);rc.stroke();rc.setLineDash([]);rc.fillStyle='#a6b9cb';rc.font='8px monospace';rc.fillText('MULTIMODAL EMBEDDING DISTRIBUTIONS',20,h-12);}}
let lastFrame=0;function animate(time){if(paused||document.hidden)return;if(time-lastFrame>32){if(heroVisible)drawHero(time);if(researchVisible)drawResearch(time);lastFrame=time;}frame=requestAnimationFrame(animate);}
const visibility=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===heroCanvas)heroVisible=entry.isIntersecting;if(entry.target===researchCanvas)researchVisible=entry.isIntersecting;}},{rootMargin:'50px'});visibility.observe(heroCanvas);visibility.observe(researchCanvas);
new ResizeObserver(()=>{drawHero(paused?0:performance.now());drawResearch(paused?0:performance.now());}).observe(document.body);
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden&&!paused)frame=requestAnimationFrame(animate);});
drawHero(0);drawResearch(0);if(!paused)frame=requestAnimationFrame(animate);
const navObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){document.querySelectorAll('.nav-links a').forEach(a=>{const current=a.hash===`#${entry.target.id}`;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}}},{rootMargin:'-20% 0px -65% 0px'});document.querySelectorAll('main section[id]').forEach(s=>navObserver.observe(s));
