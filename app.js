import{loadGpuColour}from'./gpu-texture.js';
import{createFormation,IMPACT_START,IMPACT_AGE,IMPACT_END,impactHours}from'./formation-system.js';
import * as T from 'three';
import{OrbitControls}from'three/addons/controls/OrbitControls.js';
import{ASSETS}from'./assets.js';
import{EARTH_A,EARTH_B,geographicPosition,patchGeometry,sunAt}from'./geometry.js';
import{surfaceVertex,surfaceFragment,historyVertex,historyFragment,cloudVertex,cloudFragment,atmosphereVertex,atmosphereFragment}from'./shaders.js';
import{sliderToAge,sliderToImpactHours,ageToSlider,impactHoursToSlider,ageLabel,eraFor}from'./timeline.js';
import{STORY_CHAPTERS,storyAt,storyPosition,storySecondsAt}from'./story.js';

const domCache=new Map(),$=s=>{if(!domCache.has(s))domCache.set(s,document.querySelector(s));return domCache.get(s);},asset=name=>ASSETS[name]||new URL('../assets/processed/'+name,import.meta.url).href;
let renderer,scene,camera,controls,target,earth,clouds,modern,history,postMaterial,modernMaterials=[],historyMaterial,cloudMaterial,formation,captionTimer=0,pendingCaption=null,shownCaption='';
let age=4540,targetAge=4540,elapsed=0,spin=0,playing=false,manual=false,last=0,cloudOn=true,pending=0,historyFrames=[],iceFrames=[],frameCache=new Map(),frameGeneration=0,viewUntil=0,lightingMode="overview",playbackDuration=210,playbackPosition=1,playbackElapsed=0,minuteSequence=false,cinematic=false,cinematicView=null,modernReady=false,modernLoad=null,localImpactHours=null,ancientDetailReady=false,ancientDetailLoad=null;
const sunWorld=sunAt(T,new Date('2004-08-15T08:00:00Z')).direction,sun={value:sunWorld.clone()},eye={value:new T.Vector3()},ageUniform={value:0},timeUniform={value:0},cloudState={value:1},fillLight={value:.025},blank=new T.DataTexture(new Uint8Array([0,0,255,0]),1,1);blank.needsUpdate=true;
function fail(e){console.error(e);$('#failure').hidden=false;$('#failure').textContent='Unable to load Earth: '+e.message;}
async function json(name){if(ASSETS[name])return JSON.parse(ASSETS[name]);const r=await fetch(asset(name));if(!r.ok)throw Error('Asset unavailable: '+name);return r.json();}
async function texture(name){if(name.startsWith('color-')&&name.endsWith('.webp')){const compressed=await loadGpuColour(T,asset(name.replace('.webp','.dds.gz')),renderer);if(compressed)return compressed;}const tex=await new T.TextureLoader().loadAsync(asset(name));tex.colorSpace=T.NoColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;
// Cloud opacity has one channel: do not allocate a full RGBA 16K texture.
if(name==='clouds-display.webp'||name==='ancient-clouds.webp')tex.format=T.RedFormat;
// Packed height and coastline grids are data, not colour mipmaps. This also
// saves hundreds of MB when the user has an older Earth tab open alongside.
if(name.includes('data-')){tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;}
return tex;}
function getFrame(frame,type){const key=type+'/'+frame.file;if(!frameCache.has(key)){const item={last:elapsed,tex:null,ice:null,promise:null};item.promise=Promise.all([texture(key),frame.iceFile?texture(type+'/'+frame.iceFile):Promise.resolve(blank)]).then(([t,ice])=>{item.tex=t;item.ice=ice;return item;}).catch(e=>{frameCache.delete(key);throw e;});frameCache.set(key,item);}const item=frameCache.get(key);item.last=elapsed;return item.promise;}
function neighbours(frames,value){if(value>=frames.at(-1).age)return{a:frames.at(-1),b:frames.at(-1),mix:0};let i=frames.findIndex(f=>f.age>=value);if(i===0)return{a:frames[0],b:frames[0],mix:0};const a=frames[i-1],b=frames[i];return{a,b,mix:(value-a.age)/(b.age-a.age)};}
function trimCache(keep){const unused=[...frameCache].filter(([k,v])=>v.tex&&!keep.includes(k)).sort((a,b)=>a[1].last-b[1].last);while(frameCache.size>8&&unused.length){const[k,item]=unused.shift();item.tex?.dispose();if(item.ice!==blank)item.ice?.dispose();frameCache.delete(k);}}
async function setAge(value,eventHours=null){if(!Number.isFinite(Number(value)))return;localImpactHours=eventHours;value=Math.max(0,Math.min(4540,Number(value)));targetAge=value;const generation=++frameGeneration;
 if(value<.0001){age=value;modern.visible=true;history.visible=false;pending=0;if(!playing)updateUI();if(!modernReady&&!new URLSearchParams(location.search).has("earlyPreview"))await loadModern();return;}
 if(value>2100){age=value;modern.visible=false;history.visible=true;historyMaterial.uniforms.early.value=1;historyMaterial.depthTest=true;pending=0;if(!playing)updateUI();return;}
 if(!ancientDetailReady){await loadAncientDetail();if(generation!==frameGeneration)return;}const type=value<=.08?'ice':'history',frames=type==='ice'?iceFrames:historyFrames,pair=neighbours(frames,value);pending++;
 try{const[a,b]=await Promise.all([getFrame(pair.a,type),getFrame(pair.b,type)]);if(generation!==frameGeneration)return;historyMaterial.uniforms.pastMap.value=a.tex;historyMaterial.uniforms.nextMap.value=b.tex;historyMaterial.uniforms.icePast.value=a.ice;historyMaterial.uniforms.iceNext.value=b.ice;historyMaterial.uniforms.blend.value=pair.mix;historyMaterial.uniforms.mapSize.value.set(pair.a.size[0],pair.a.size[1]);historyMaterial.uniforms.early.value=T.MathUtils.smoothstep(value,1800,2100);age=value;modern.visible=value<.0025;history.visible=true;historyMaterial.depthTest=!modern.visible;trimCache([type+'/'+pair.a.file,type+'/'+pair.b.file]);}catch(e){fail(e);}finally{pending=Math.max(0,pending-1);if(!playing)updateUI();}
}
const ageNumberFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
function updateLiveAge(){
 const number=$('#live-age-number'),unit=$('#live-age-unit');
 let value,label;
 if(localImpactHours!==null){
  const seconds=Math.floor(Math.abs(localImpactHours)*3600),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60;
  value=[hours,minutes,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  label=localImpactHours<0?'TO CONTACT':'AFTER IMPACT';
 }else{value=ageNumberFormat.format(Math.max(0,targetAge)*1000000);label='YEARS AGO';}
 if(number.textContent!==value)number.textContent=value;
 if(unit.textContent!==label)unit.textContent=label;
}
function updateUI(){updateLiveAge();const chapter=minuteSequence?storyAt(playbackElapsed):null;let era=chapter?{...eraFor(chapter.anchor),title:chapter.title,text:chapter.text}:eraFor(age,localImpactHours);const minor=formation?.smallImpact;if(minor&&!chapter)era={title:'Late accretion',text:'Impactor diameter: about '+minor.diameterKm+' km. Larger impacts leave larger scars.',source:'Late accretion · representative impacts',confidence:'Illustrative episodes, not a catalogue of dated impacts.'};$('#age').textContent=ageLabel(age);if(era.title!==shownCaption){pendingCaption=era;document.body.classList.add('caption-changing');if(!captionTimer)captionTimer=setTimeout(()=>{const next=pendingCaption;$('#epoch-name').textContent=next.title;$('#epoch-description').textContent=next.text;$('#source-label').textContent=next.source;$('#certainty').textContent=next.confidence;shownCaption=next.title;captionTimer=0;document.body.classList.remove('caption-changing');},150);}else{if(captionTimer){clearTimeout(captionTimer);captionTimer=0;pendingCaption=null;document.body.classList.remove('caption-changing');}$('#epoch-description').textContent=era.text;$('#source-label').textContent=era.source;$('#certainty').textContent=era.confidence;}const uiPosition=playing?playbackPosition:localImpactHours===null?ageToSlider(targetAge):impactHoursToSlider(localImpactHours);$('#timeline').value=String(uiPosition*1000);$('#timeline').setAttribute('aria-valuetext',ageLabel(targetAge));$('#speed').textContent=playbackDuration===60?'3.5× · 1:00':'1× · 3:30';$('#speed').setAttribute('aria-pressed',String(playbackDuration===60));$('#minute').setAttribute('aria-pressed',String(minuteSequence));$('#timeline').style.setProperty('--progress',(uiPosition*100)+'%');for(const b of document.querySelectorAll('.chapters button')){const active=b.id==='impact'?localImpactHours!==null:Number(b.dataset.age)===targetAge;b.setAttribute('aria-current',String(active));}$('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Pause':'Play history');$('#loading-era').hidden=pending===0;$('#time-panel small').textContent=chapter?'Chapter '+(STORY_CHAPTERS.indexOf(chapter)+1)+' / 10 · '+Math.max(0,Math.ceil(60-playbackElapsed))+' s':'Drag to explore';}
function resize(){
 const w=innerWidth,h=innerHeight;
 renderer.setSize(w,h);camera.aspect=w/h;camera.clearViewOffset();
 if(w>700&&w/h>1.2)camera.setViewOffset(w,h,-w*.105,h*.04,w,h);
 camera.updateProjectionMatrix();
 const halfFov=T.MathUtils.degToRad(camera.fov/2),limitingFov=Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect));
 const fitDistance=1.05/Math.sin(limitingFov)/(w>700?.73:.82);
 camera.position.setLength(fitDistance);if(cinematicView)cinematicView.distance=fitDistance;
 controls.maxDistance=Math.max(8,fitDistance*2);controls.update();camera.updateMatrixWorld(true);
 target.setSize(renderer.domElement.width,renderer.domElement.height);postMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);draw();
}

function togglePlay(){
 manual=false;last=0;
 if(playing){playing=false;updateUI();return;}
 if(targetAge<.0001){playbackPosition=0;playbackElapsed=0;minuteSequence=playbackDuration===60;cinematic=true;cinematicView=null;setAge(4540);}
 else if(!minuteSequence)playbackPosition=ageToSlider(targetAge);
 playing=true;updateUI();
}
function minuteHistory(){playbackDuration=60;playbackElapsed=0;minuteSequence=true;playbackPosition=0;spin=0;cinematic=true;cinematicView=null;manual=false;last=0;playing=true;setAge(4540);updateUI();}
function toggleSpeed(){playbackPosition=ageToSlider(targetAge);playbackDuration=playbackDuration===60?210:60;minuteSequence=playbackDuration===60;if(minuteSequence)playbackElapsed=storySecondsAt(playbackPosition);last=0;updateUI();}

function updateCinematic(){
 if(!cinematic)return;
 if(!cinematicView)cinematicView={direction:camera.position.clone().normalize(),distance:camera.position.length(),current:camera.position.length(),stamp:performance.now()};
 const t=localImpactHours??impactHours(age),v=cinematicView,clock=performance.now(),delta=Math.min(.06,(clock-v.stamp)/1000);v.stamp=clock;
 const inEvent=localImpactHours!==null||(age<=IMPACT_START&&age>=IMPACT_END);
 let desired=v.distance;
 if(inEvent){const enter=T.MathUtils.smoothstep(t,-.35,-.15),exit=1-T.MathUtils.smoothstep(t,17,24),wide=T.MathUtils.smoothstep(t,.5,5);desired=T.MathUtils.lerp(v.distance,v.distance*(1.30+wide*.40),enter*exit);}
 v.current=T.MathUtils.lerp(v.current,desired,1-Math.exp(-delta*4));
 camera.position.copy(v.direction).multiplyScalar(v.current);controls.target.set(0,0,0);controls.maxDistance=Math.max(12,v.distance*2);
 if(!inEvent&&age<IMPACT_END&&Math.abs(v.current-v.distance)<.004){cinematic=false;cinematicView=null;}
}
const inverseEarthScratch=new T.Matrix4(),illuminationScratch=new T.Vector3(),studioBias=new T.Vector3(-.45,.30,.03),labelScratch=new T.Vector3();

function draw(){
 renderer.info.reset();earth.rotation.y=spin;earth.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 inverseEarthScratch.copy(earth.matrixWorld).invert();
 if(lightingMode==='overview')illuminationScratch.copy(camera.position).normalize().multiplyScalar(.82).add(studioBias).normalize();else illuminationScratch.copy(sunWorld);
 sun.value.copy(illuminationScratch).transformDirection(inverseEarthScratch);eye.value.copy(camera.position).applyMatrix4(inverseEarthScratch);ageUniform.value=age;timeUniform.value=elapsed;
 formation?.update(age,eye.value,localImpactHours,minuteSequence);postMaterial.uniforms.inverseEarth.value.copy(inverseEarthScratch);postMaterial.uniforms.cameraWorld.value.copy(camera.matrixWorld);
 if(age>2100)history.visible=!formation.fusionActive;
 clouds.visible=cloudOn&&!formation.fusionActive;
 renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);updateBodyLabels();
}
function updateBodyLabels(){if(!formation)return;for(const[id,body]of Object.entries(formation.labels())){const node=$('#label-'+id);if(!node)continue;const p=labelScratch.copy(body.position).applyMatrix4(earth.matrixWorld).project(camera);node.hidden=!body.visible||p.z>1||p.z< -1||Math.abs(p.x)>1.05||Math.abs(p.y)>1.05;if(node.hidden)continue;if(node.textContent!==body.name)node.textContent=body.name;node.style.left=((p.x*.5+.5)*innerWidth)+'px';node.style.top=((-p.y*.5+.5)*innerHeight+Math.max(16,body.radius*innerHeight/camera.position.length()*.65))+'px';}}

let postScene,postCamera;
async function loadAncientDetail(){if(ancientDetailLoad)return ancientDetailLoad;ancientDetailLoad=(async()=>{const tex=await texture('ancient-detail.webp');tex.wrapS=T.RepeatWrapping;historyMaterial.uniforms.detailMap.value=tex;ancientDetailReady=true;})();return ancientDetailLoad;}
async function loadModern(){if(modernLoad)return modernLoad;modernLoad=(async()=>{const night=await texture('night-display.webp');for(const{material}of modernMaterials)material.uniforms.nightMap.value=night;const cloud=await texture('clouds-display.webp');cloud.wrapS=T.RepeatWrapping;cloudMaterial.uniforms.cloudMap.value=cloud;for(const{material}of modernMaterials)material.uniforms.cloudMap.value=cloud;historyMaterial.uniforms.cloudMap.value=cloud;let loaded=0;for(const entry of modernMaterials){const[color,data]=await Promise.all([texture(`color-${entry.row}-${entry.col}.webp`),texture(`display-data-${entry.row}-${entry.col}.png`)]);entry.material.uniforms.colorMap.value=color;entry.material.uniforms.dataMap.value=data;entry.material.uniforms.gutter.value.set(5400/5408,4/5408);entry.material.uniforms.dataGutter.value.set(2048/2056,4/2056);entry.material.uniforms.displacement.value=1;entry.material.vertexShader=surfaceVertex;entry.material.needsUpdate=true;loaded++;$('#detail-status').textContent=loaded<8?'Surface detail '+Math.round(loaded/8*100)+'%':'';draw();}modernReady=true;$('#detail-status').textContent='';})();return modernLoad;}
async function start(){
 renderer=new T.WebGLRenderer({canvas:$('#earth'),antialias:false,powerPreference:'high-performance'});renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.5:2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.setClearColor(0x000000,1);
 scene=new T.Scene();camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.02,40);camera.position.copy(geographicPosition(T,17,19)).setLength(3.20);camera.lookAt(0,0,0);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=1.12;controls.maxDistance=6.0;controls.rotateSpeed=.35;controls.zoomSpeed=.65;controls.addEventListener('start',()=>{viewUntil=elapsed+3;cinematic=false;controls.minDistance=1.12;});controls.addEventListener('end',()=>viewUntil=elapsed+3);
 target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2});target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);earth=new T.Group();scene.add(earth);modern=new T.Group();modern.visible=false;earth.add(modern);historyFrames=await json('history/manifest.json');iceFrames=await json('ice/manifest.json');
 const[preview,cloudMap,nightMap,detailMap,magmaMap,historicCloudMap,initialFrame,rockColor,rockNormal,rockRough]=await Promise.all([texture('preview.webp'),Promise.resolve(blank),Promise.resolve(blank),Promise.resolve(blank),Promise.resolve(blank),texture('ancient-clouds.webp'),getFrame(historyFrames[0],'history'),texture('rock-color.webp'),texture('rock-normal.webp'),texture('rock-rough.webp')]);historicCloudMap.wrapS=detailMap.wrapS=magmaMap.wrapS=T.RepeatWrapping;cloudMap.wrapS=T.RepeatWrapping;nightMap.wrapS=T.RepeatWrapping;
 rockColor.colorSpace=T.SRGBColorSpace;for(const map of[rockColor,rockNormal,rockRough])map.wrapS=map.wrapT=T.RepeatWrapping;const rockMaps={color:rockColor,normal:rockNormal,rough:rockRough};formation=createFormation(T,rockMaps,null,{age:ageUniform,time:timeUniform,sun,fillLight});earth.add(formation.group);
 for(let row=0;row<2;row++)for(let col=0;col<4;col++){const geometry=patchGeometry(T,-180+col*90,-90+col*90,90-row*90,0-row*90,160),material=new T.ShaderMaterial({vertexShader:surfaceVertex,fragmentShader:surfaceFragment,uniforms:{colorMap:{value:preview},dataMap:{value:blank},cloudMap:{value:cloudMap},nightMap:{value:nightMap},iceMap:{value:blank},sun,eye,fillLight,gutter:{value:new T.Vector2(1,0)},dataGutter:{value:new T.Vector2(1,0)},dataStep:{value:1/2048},displacement:{value:0},cloudOn:cloudState,iceOn:{value:0}}});material.uniforms.colorMap.value=preview;const mesh=new T.Mesh(geometry,material);mesh.name=`Earth / geographic tile ${row}-${col}`;modern.add(mesh);modernMaterials.push({material,row,col});}
 // Until the fine tiles load, all eight patches sample their correct global part.
 for(const{material,row,col}of modernMaterials){material.vertexShader=surfaceVertex.replace('q=uv;gq=globalUV;','q=globalUV;gq=globalUV;');material.needsUpdate=true;}
 historyMaterial=new T.ShaderMaterial({transparent:true,depthTest:false,vertexShader:historyVertex,fragmentShader:historyFragment,uniforms:{pastMap:{value:initialFrame.tex},nextMap:{value:initialFrame.tex},icePast:{value:blank},iceNext:{value:blank},presentColor:{value:preview},detailMap:{value:detailMap},magmaMap:{value:magmaMap},rockColor:{value:rockColor},rockRough:{value:rockRough},lavaNoise:{value:formation.noiseMap},mapSize:{value:new T.Vector2(1800,900)},blend:{value:0},cloudMap:{value:cloudMap},sun,eye,fillLight,age:ageUniform,time:timeUniform,cloudOn:cloudState,early:{value:1},impactAxis:formation.impactAxis,impactPhase:formation.impactPhase,impactTangent:formation.impactTangent,impacts:formation.impacts,impactStates:formation.impactStates,historicCloudMap:{value:historicCloudMap}}});history=new T.Mesh(patchGeometry(T,-180,180,90,-90,256),historyMaterial);history.visible=true;historyMaterial.depthTest=true;history.renderOrder=1;earth.add(history);
 cloudMaterial=new T.ShaderMaterial({vertexShader:cloudVertex,fragmentShader:cloudFragment,transparent:true,depthWrite:false,uniforms:{cloudMap:{value:cloudMap},detailMap:{value:detailMap},historicCloudMap:{value:historicCloudMap},sun,eye,fillLight,age:ageUniform,time:timeUniform,impacts:formation.impacts,impactStates:formation.impactStates}});clouds=new T.Mesh(patchGeometry(T,-180,180,90,-90,256,8000),cloudMaterial);clouds.renderOrder=2;earth.add(clouds);
 postMaterial=new T.ShaderMaterial({vertexShader:atmosphereVertex,fragmentShader:atmosphereFragment,depthTest:false,depthWrite:false,uniforms:{image:{value:target.texture},sceneDepth:{value:target.depthTexture},inverseProjection:{value:camera.projectionMatrixInverse.clone()},cameraWorld:{value:camera.matrixWorld},inverseEarth:{value:new T.Matrix4()},sun,age:ageUniform}});postScene=new T.Scene();postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),postMaterial));resize();
 $('#loading').classList.add('done');setTimeout(()=>$('#loading').hidden=true,900);updateUI();
 $('#detail-status').textContent='';await setAge(4540);draw();window.earthModel.ready=true;
}
function cleanView(on=!document.body.classList.contains('clean')){document.body.classList.toggle('clean',on);$('#hide').setAttribute('aria-pressed',String(on));}
function information(on=$('#information').hidden){$('#information').hidden=!on;$('#info').setAttribute('aria-expanded',String(on));if(on)$('#close-info').focus();else $('#info').focus();}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}}
window.addEventListener('resize',()=>{if(postMaterial)resize();});
window.addEventListener('keydown',e=>{if(e.repeat||(e.target instanceof HTMLInputElement&&e.code!=='Space'))return;if(e.code==='Space'){e.preventDefault();togglePlay();}if(e.code==='KeyH')cleanView();if(e.code==='KeyL')setLighting(lightingMode==='overview'?'solar':'overview');if(e.code==='KeyC'){cloudOn=!cloudOn;if(clouds)clouds.visible=cloudOn;cloudState.value=Number(cloudOn);}if(e.code==='KeyR'){cinematic=false;cinematicView=null;spin=0;controls?.reset();if(postMaterial)resize();}if(e.code==='KeyF')fullscreen();if(e.code==='Escape'&&!$('#information').hidden)information(false);});
document.addEventListener('visibilitychange',()=>{last=0;});
$('#earth').addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;$('#failure').hidden=false;$('#failure').textContent='The graphics session was interrupted. Reload this file to restore the globe.';});

function setLighting(mode){lightingMode=mode==='solar'?'solar':'overview';fillLight.value=lightingMode==='overview'?.025:0;$('#lighting').textContent=lightingMode==='overview'?'Studio light':'Sunlight';$('#lighting').setAttribute('aria-pressed',String(lightingMode==='overview'));if(postMaterial)draw();}
function showImpact(){minuteSequence=false;last=0;spin=0;manual=false;cinematic=true;cinematicView=null;playing=true;playbackPosition=ageToSlider(IMPACT_START);setAge(IMPACT_START,-.35);updateUI();}
$('#impact').onclick=showImpact;
$('#minute').onclick=minuteHistory;$('#speed').onclick=toggleSpeed;
$('#lighting').onclick=()=>setLighting(lightingMode==='overview'?'solar':'overview');
$('#timeline').addEventListener('input',e=>{playing=false;manual=false;minuteSequence=false;playbackPosition=Number(e.target.value)/1000;setAge(sliderToAge(playbackPosition),sliderToImpactHours(playbackPosition));updateUI();});
$('#play').onclick=togglePlay;
$('#restart').onclick=()=>{playing=false;manual=false;minuteSequence=false;playbackElapsed=0;playbackPosition=0;spin=0;cinematic=false;cinematicView=null;setAge(4540);updateUI();};
$('#hide').onclick=()=>cleanView();$('#restore-ui').onclick=()=>cleanView(false);$('#info').onclick=()=>information();$('#close-info').onclick=()=>information(false);$('#fullscreen').onclick=fullscreen;
for(const button of document.querySelectorAll('[data-age]'))button.onclick=()=>{playing=false;manual=false;minuteSequence=false;cinematic=false;cinematicView=null;setAge(Number(button.dataset.age));updateUI();};

let uiElapsed=0;function animate(now){requestAnimationFrame(animate);if(!postMaterial||manual||document.hidden){last=0;return;}const wallDt=last?Math.min(.5,(now-last)/1000):1/60,dt=Math.min(.05,wallDt);last=now;elapsed+=dt;uiElapsed+=dt;if(elapsed>viewUntil&&!(age<=IMPACT_START&&age>=IMPACT_END))spin+=dt*(age>4320?.010:.045);if(playing){if(minuteSequence&&playbackDuration===60){playbackElapsed=Math.min(60,playbackElapsed+wallDt);playbackPosition=storyPosition(playbackElapsed);if(playbackElapsed>35&&!modernLoad)loadModern().catch(fail);}else playbackPosition=Math.min(1,playbackPosition+wallDt/playbackDuration);setAge(sliderToAge(playbackPosition),sliderToImpactHours(playbackPosition));if(minuteSequence?playbackElapsed>=60:playbackPosition===1)playing=false;}updateLiveAge();updateCinematic();controls.update();draw();if(uiElapsed>.12){uiElapsed=0;updateUI();}}
async function profileGPU(count=20){const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return{available:false};const values=[];for(let i=0;i<count;i++){const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);draw();gl.endQuery(ext.TIME_ELAPSED_EXT);const deadline=performance.now()+5000;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(gl.isContextLost()||performance.now()>deadline)throw Error('GPU timing interrupted');await new Promise(r=>requestAnimationFrame(r));}if(gl.getParameter(ext.GPU_DISJOINT_EXT)){gl.deleteQuery(q);return{available:false,disjoint:true};}values.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}values.sort((a,b)=>a-b);return{available:true,samples:count,meanMs:values.reduce((a,b)=>a+b,0)/count,p95Ms:values[Math.floor(values.length*.95)]};}
window.earthModel={ready:false,profileGPU,setAge,setImpactHours(hours){return setAge(IMPACT_AGE-hours/(365.25*24*1e6),hours);},cinematic(on){cinematic=on;cinematicView=null;},impact:showImpact,minute:minuteHistory,speed:toggleSpeed,lighting:setLighting,play:togglePlay,pause(){manual=true;playing=false;},resume(){manual=false;last=0;},render(){updateCinematic();controls.update();draw();},view(lon,lat,distance=3.2){cinematic=false;cinematicView=null;spin=0;camera.position.copy(geographicPosition(T,lon,lat)).setLength(distance);camera.lookAt(0,0,0);controls.target.set(0,0,0);controls.update();draw();},clouds(on){cloudOn=on;cloudState.value=Number(on);clouds.visible=on;draw();},advance(seconds,rotate=true){elapsed+=seconds;if(rotate)spin+=seconds*.045;draw();},inspect(){return{formation:formation.inspect(),surface:"continuous molten/crusted surface",localImpactHours,modernReady,age,targetAge,pending,playing,playbackDuration,playbackPosition,playbackElapsed,minuteSequence,chapter:minuteSequence?storyAt(playbackElapsed).title:null,cloudOn,lightingMode,earlyMix:historyMaterial.uniforms.early.value,cache:frameCache.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,parameters:{semiMajorAxis:EARTH_A,semiMinorAxis:EARTH_B},camera:camera.position.toArray()};}};
start().then(()=>requestAnimationFrame(animate)).catch(fail);
