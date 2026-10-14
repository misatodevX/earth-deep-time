import{createSmallImpacts}from'./small-impacts.js';
import{createMantleFusion}from'./formation-fusion.js';
// Visual reconstruction of a giant impact, not a fluid-dynamics solution.
export const HOURS_PER_MA=365.25*24*1e6;
export const IMPACT_AGE=4500,IMPACT_START=IMPACT_AGE+.35/HOURS_PER_MA,IMPACT_END=IMPACT_AGE-24/HOURS_PER_MA;
export function impactHours(age){return (IMPACT_AGE-age)*HOURS_PER_MA;}
export function createFormation(T,maps,cells,clocks){
 const group=new T.Group(),giant=new T.Group();group.add(giant);
 const impactAxis={value:new T.Vector3()},impactTangent={value:new T.Vector3()},impactPhase={value:-100};
 const axis=new T.Vector3(),east=new T.Vector3(),north=new T.Vector3(),basis=new T.Matrix4();let armed=false,lastAge=0,lastPhase=-100;
 let seed=85379;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const size=64,raw=new Float32Array(size**3);for(let i=0;i<raw.length;i++)raw[i]=random();
 let smooth=raw;for(let pass=0;pass<3;pass++){const next=new Float32Array(raw.length);for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(a,b,c)=>smooth[((c+size)%size)*size*size+((b+size)%size)*size+(a+size)%size];next[z*size*size+y*size+x]=(at(x,y,z)*2+at(x+1,y,z)+at(x-1,y,z)+at(x,y+1,z)+at(x,y-1,z)+at(x,y,z+1)+at(x,y,z-1))/8;}smooth=next;}
 const data=new Uint8Array(raw.length);for(let i=0;i<data.length;i++)data[i]=T.MathUtils.clamp((smooth[i]-.5)*5+.5,0,1)*255;
 const noiseMap=new T.Data3DTexture(data,size,size,size);noiseMap.format=T.RedFormat;noiseMap.minFilter=noiseMap.magFilter=T.LinearFilter;noiseMap.wrapS=noiseMap.wrapT=noiseMap.wrapR=T.RepeatWrapping;noiseMap.unpackAlignment=1;noiseMap.needsUpdate=true;
 const noise=`uniform highp sampler3D noiseMap;float noise(vec3 p){return texture(noiseMap,p*.03125).r;}float fbm(vec3 p){return noise(p)*.56+noise(p*2.03+13.)*.28+noise(p*4.09+7.)*.16;}`;
 const stoneVertex=`varying vec3 p,n;void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const smallSystem=createSmallImpacts(T,maps,noiseMap);group.add(smallSystem.group);
 const impacts=smallSystem.impacts,impactStates=smallSystem.impactStates,bodyCenter={value:new T.Vector3()};
 // Continuous differentiating body: pressure flattens the contact face and shears
 // the mantle into the target. No polygon shell or luminous cell borders.
 const bodyVertex=`varying vec3 p,n;uniform float phase,radius,kind;uniform vec3 centerInBody;void main(){vec3 d=normalize(position);float t=max(0.,phase),pressure=smoothstep(0.,1.2,t)*(1.-kind);float rugged=(sin(d.x*31.+sin(d.z*15.))+sin(d.y*37.-d.z*13.))*.0015;p=d*radius;p.z*=1.-pressure*.35;p.x*=1.+pressure*.46;p.x+=pressure*.15*(1.-d.z*d.z);p+=d*rugged;n=d;vec3 worldPoint=p+centerInBody;float capture=smoothstep(.45,1.7,t)*(1.-kind),r=length(worldPoint);worldPoint*=mix(1.,min(1.,.992/max(.01,r)),capture);gl_Position=projectionMatrix*modelViewMatrix*vec4(worldPoint-centerInBody,1.);}`;
 function material(kind=0){return new T.ShaderMaterial({transparent:false,depthWrite:true,uniforms:{noiseMap:{value:noiseMap},rockColor:{value:maps.color},roughMap:{value:maps.rough},phase:impactPhase,radius:{value:kind?.2724:.53},kind:{value:kind},centerInBody:{value:new T.Vector3()},localEye:{value:new T.Vector3()},localSun:{value:new T.Vector3(-.4,.7,1).normalize()}},vertexShader:bodyVertex,fragmentShader:`precision highp float;varying vec3 p,n;uniform sampler2D rockColor,roughMap;uniform float phase,kind;uniform vec3 localEye,localSun;${noise}
 vec3 rock(vec3 d){vec3 w=pow(abs(d),vec3(5.));w/=w.x+w.y+w.z;return texture2D(rockColor,d.yz*3.).rgb*w.x+texture2D(rockColor,d.xz*3.).rgb*w.y+texture2D(rockColor,d.xy*3.).rgb*w.z;}
 void main(){vec3 D=normalize(p),N=normalize(cross(dFdx(p),dFdy(p)));if(dot(N,n)<0.)N=-N;vec3 V=normalize(localEye-p),L=normalize(localSun),H=normalize(L+V);float t=max(0.,phase),field=fbm(D*15.+vec3(t*.12,0.,-t*.08)),grain=fbm(D*280.);float rough=fbm(D*83.);vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);float relief=rough*.0012;N=normalize(abs(det)*N-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));float breakage=smoothstep(0.,.9,t)*(1.-kind),exposed=smoothstep(.42,.64,field+breakage*.25);float cooling=exp(-t*.09);float heat=mix(.12,1.,breakage)*cooling;heat=mix(heat,.78*exp(-max(0.,t-3.)*.035),kind);vec3 stone=rock(D)*(.12+.70*max(0.,dot(N,L)));vec3 molten=vec3(2.1,.24,.007)*pow(heat,2.)+vec3(1.7,.74,.12)*pow(heat,8.);float facing=1.-smoothstep(-.9,.45,D.z);float melt=exposed*mix(.025+.975*facing,1.,kind);float spec=pow(max(0.,dot(N,H)),18.)*.014*(1.-melt);float loss=smoothstep(.18,1.12,t)*(1.-kind);gl_FragColor=vec4(mix(stone,molten,melt)+spec,(1.-loss)*(1.-loss));}`});}
 const planetMaterial=material(),planet=new T.Mesh(new T.SphereGeometry(1,160,112),planetMaterial);planet.frustumCulled=false;planet.renderOrder=2.4;giant.add(planet);
 const fusion=createMantleFusion(T,maps,{...clocks,impactAxis,impactTangent,impactPhase,impacts,impactStates,noiseMap});giant.add(fusion.mesh);
 const moonMaterial=material(1),moon=new T.Mesh(new T.SphereGeometry(1,96,64),moonMaterial);moon.frustumCulled=false;giant.add(moon);
 for(const [mesh,mat]of[[planet,planetMaterial],[moon,moonMaterial]])mesh.onBeforeRender=(r,s,c)=>{const inv=new T.Matrix4().copy(mesh.matrixWorld).invert();mat.uniforms.localEye.value.copy(c.position).applyMatrix4(inv);mat.uniforms.localSun.value.copy(c.position).transformDirection(inv);};
 // Gravity-integrated relative trajectory, interpolated by the independent clock.
 const R=6378137,mu=6.67430e-11*5.9722e24*1.020*3600**2/R**3,contact=1.53,vContact=Math.sqrt(2*mu/contact),approach=[];
 let state=[contact,0,0,-vContact/Math.sqrt(2),vContact/Math.sqrt(2),0];
 const derivative=s=>{const r=Math.hypot(...s.slice(0,3));return[s[3],s[4],s[5],-mu*s[0]/r**3,-mu*s[1]/r**3,-mu*s[2]/r**3];};
 for(let i=0;i<=350;i++){approach.push(state.slice(0,3));const h=-.001,k1=derivative(state),k2=derivative(state.map((v,j)=>v+h*k1[j]/2)),k3=derivative(state.map((v,j)=>v+h*k2[j]/2)),k4=derivative(state.map((v,j)=>v+h*k3[j]));state=state.map((v,j)=>v+h*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6);}
 const dummy=new T.Object3D(),debrisCount=2400;
 const chunkGeometry=new T.IcosahedronGeometry(1,1);const cp=chunkGeometry.attributes.position,v=new T.Vector3();for(let i=0;i<cp.count;i++){v.fromBufferAttribute(cp,i);v.multiplyScalar(1+.22*Math.sin(v.x*7.+v.z*4.)+.13*Math.sin(v.y*13.-v.z*5.));cp.setXYZ(i,v.x,v.y,v.z);}chunkGeometry.computeVertexNormals();
 const chunkMaterial=new T.ShaderMaterial({uniforms:{noiseMap:{value:noiseMap},rockColor:{value:maps.color},phase:impactPhase,sun:clocks.sun,localEye:{value:new T.Vector3()}},vertexShader:`varying vec3 p,n,place;void main(){p=position;n=normalize(mat3(instanceMatrix)*normal);vec4 q=instanceMatrix*vec4(position,1.);place=q.xyz;gl_Position=projectionMatrix*modelViewMatrix*q;}`,fragmentShader:`precision highp float;varying vec3 p,n,place;uniform sampler2D rockColor;uniform vec3 sun,localEye;uniform float phase;${noise}void main(){vec3 N=normalize(n),L=normalize(sun),V=normalize(localEye-place),d=normalize(p);vec3 w=pow(abs(d),vec3(4.));w/=w.x+w.y+w.z;vec3 stone=texture2D(rockColor,p.yz*.75).rgb*w.x+texture2D(rockColor,p.xz*.75).rgb*w.y+texture2D(rockColor,p.xy*.75).rgb*w.z;float textureNoise=fbm(p*5.),liquid=1.-smoothstep(.03,.18,abs(sin(p.x*2.4+p.y*1.7+p.z*.8))),heat=exp(-max(0.,phase-.25)*.21)*(.60+.36*fbm(p*11.));vec3 molten=vec3(2.0,.27,.009)*pow(heat,2.)+vec3(1.5,.70,.10)*pow(heat,7.);vec3 rgb=stone*(.10+.95*max(0.,dot(N,L)))*(1.-liquid*.75)+molten*liquid;float spec=pow(max(0.,dot(N,normalize(L+V))),35.)*.12;gl_FragColor=vec4(rgb+spec,1.);}`});
 const fragments=new T.InstancedMesh(chunkGeometry,chunkMaterial,debrisCount);fragments.frustumCulled=false;giant.add(fragments);const lamp=new T.DirectionalLight(0xffe0c5,3);lamp.position.set(2,3,3);giant.add(lamp);
 const fragmentInverse=new T.Matrix4();fragments.onBeforeRender=(renderer,scene,camera)=>{fragmentInverse.copy(fragments.matrixWorld).invert();chunkMaterial.uniforms.localEye.value.copy(camera.position).applyMatrix4(fragmentInverse);};
 // Every fragment starts inside the disrupted impactor. Different launch speeds
 // produce returning, orbiting and escaping material, rather than a uniform ring.
 const sampleStep=.1,sampleCount=241,debris=Array.from({length:debrisCount},()=>{
  let x,y,z;do{x=random()*2-1;y=random()*2-1;z=random()*2-1;}while(x*x+y*y+z*z>1);
  const source=[.12+x*.45,y*.37,1.40+z*.30],release=.055+(z+1)*.085+random()*.025;
  const size=random(),radius=size<.76?.002+random()*.006:size<.985?.009+random()*.014:.024+random()*.018;
  const trail=new Float32Array(sampleCount*3),category=random(),speed=category<.22?3.6:category<.70?5.0:6.25;
  let px=source[0],py=source[1],pz=source[2],vx=speed+(random()-.5)*2.9,vy=(random()-.5)*3.7,vz=.25+random()*3.25,death=99;
  for(let step=0;step<sampleCount;step++){
   trail[step*3]=px;trail[step*3+1]=py;trail[step*3+2]=pz;
   if(death!==99)continue;
   for(let sub=0;sub<4;sub++){
    const dt=sampleStep*.22/4,r=Math.hypot(px,py,pz),a=-mu/(r*r*r);
    vx+=px*a*dt*.5;vy+=py*a*dt*.5;vz+=pz*a*dt*.5;px+=vx*dt;py+=vy*dt;pz+=vz*dt;
    const r2=Math.hypot(px,py,pz),a2=-mu/(r2*r2*r2);vx+=px*a2*dt*.5;vy+=py*a2*dt*.5;vz+=pz*a2*dt*.5;
    if(r2<1.008||r2>22){death=step*sampleStep;break;}
   }
  }
  return {trail,release,death,radius,spin:random()*6.28,stretch:.7+random()*.5};
 });
 // Silicate vapour: density/lighting, with only a short thermal flash at contact.
 const volumeMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.BackSide,uniforms:{noiseMap:{value:noiseMap},phase:impactPhase,scale:{value:1},localEye:{value:new T.Vector3()},objectToPlanet:{value:new T.Matrix4()}},vertexShader:stoneVertex,fragmentShader:`precision highp float;varying vec3 p,n;uniform vec3 localEye;uniform float phase,scale;uniform mat4 objectToPlanet;${noise}void main(){vec3 ray=normalize(p-localEye),inv=1./ray,lo=(-vec3(1.)-localEye)*inv,hi=(vec3(1.)-localEye)*inv,mn=min(lo,hi),mx=max(lo,hi);float begin=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z));vec3 origin=(objectToPlanet*vec4(localEye,1.)).xyz,dir=normalize((objectToPlanet*vec4(ray,0.)).xyz);float c=dot(origin,origin)-1.,bb=dot(origin,dir),disc=bb*bb-c;if(disc>0.){float ground=-bb-sqrt(disc);if(ground>0.)end=min(end,ground/scale);}if(end<=begin)discard;float ds=(end-begin)/40.,t=max(0.,phase);vec3 rgb=vec3(0.);float trans=1.;for(int i=0;i<40;i++){vec3 q=localEye+ray*(begin+(float(i)+.4)*ds),w=q-vec3(t*.08,0.,-.24);float densityNoise=fbm(w*24.+vec3(t*.6,0.,-t*.5));float head=exp(-dot(w/vec3(.85,.51,.67),w/vec3(.85,.51,.67))*3.);float density=head*smoothstep(.30,.62,densityNoise)*(1.-smoothstep(.68,.98,max(abs(q.x),max(abs(q.y),abs(q.z)))))*(1.-smoothstep(1.2,4.,t))*3.;density*=smoothstep(1.,1.008,length((objectToPlanet*vec4(q,1.)).xyz));float alpha=1.-exp(-density*ds*scale*5.);float heat=exp(-t*7.)*(.4+densityNoise*.6);vec3 litDust=vec3(.16,.12,.085)*(.35+densityNoise*.8),glow=vec3(8.,3.8,1.)*heat;rgb+=trans*alpha*(litDust+glow);trans*=1.-alpha;}float alpha=1.-trans;gl_FragColor=vec4(rgb/max(.00001,alpha),alpha);}`});
 const vapour=new T.Mesh(new T.BoxGeometry(2,2,2),volumeMaterial);vapour.renderOrder=3;giant.add(vapour);vapour.onBeforeRender=(r,s,c)=>{volumeMaterial.uniforms.localEye.value.copy(c.position).applyMatrix4(new T.Matrix4().copy(vapour.matrixWorld).invert());volumeMaterial.uniforms.objectToPlanet.value.copy(vapour.matrix);};
 function orient(eye){axis.copy(eye).normalize().applyAxisAngle(new T.Vector3(0,1,0),-.98);east.crossVectors(new T.Vector3(0,1,0),axis).normalize();north.crossVectors(axis,east).normalize();east.applyAxisAngle(axis,.65);north.crossVectors(axis,east).normalize();impactAxis.value.copy(axis);impactTangent.value.copy(east);basis.makeBasis(east,north,axis);vapour.quaternion.setFromRotationMatrix(basis);planet.quaternion.setFromRotationMatrix(basis);}
 orient(new T.Vector3(.91,.32,-.28));
 function update(age,eye,eventHours=null,compact=false){lastAge=age;const t=eventHours??impactHours(age);lastPhase=t;const collision=eventHours!==null||(age<=IMPACT_START&&age>=IMPACT_END);
  if(!collision)armed=false;if(collision&&!armed){orient(eye);armed=true;}giant.visible=collision;impactPhase.value=collision?t:age>IMPACT_START?-100:Math.min(200,24+(IMPACT_END-age)*2);fusion.update(t,collision);smallSystem.update(age,eye,compact);if(!collision)return;
  // Radius .53 is already applied in bodyVertex. Disintegrate the shell rather than shrink it.
  planet.visible=t<0;planet.scale.setScalar(1);
  if(t<0){const f=T.MathUtils.clamp(-t*1000,0,350),i=Math.floor(f),j=Math.min(350,i+1),v=approach[i].map((value,k)=>T.MathUtils.lerp(value,approach[j][k],f-i));bodyCenter.value.copy(axis).multiplyScalar(v[0]).addScaledVector(east,v[1]);}
  else bodyCenter.value.copy(axis).multiplyScalar(1.53-Math.min(t,.85)*1.05).addScaledVector(east,Math.min(t,.85)*.86);
  planet.position.copy(bodyCenter.value);planetMaterial.uniforms.centerInBody.value.set(bodyCenter.value.dot(east),bodyCenter.value.dot(north),bodyCenter.value.dot(axis));
  // The old continuous ejecta sheet read as a rigid triangular blade. The expanding
  // fragment field and vapor plume carry the event without that false silhouette.
  fragments.visible=t>.05;
  if(fragments.visible){for(let i=0;i<debrisCount;i++){
   const d=debris[i],flight=Math.max(0,t-d.release),at=Math.min(sampleCount-1,flight/sampleStep),a=Math.floor(at),b=Math.min(sampleCount-1,a+1),u=at-a;
   const x=T.MathUtils.lerp(d.trail[a*3],d.trail[b*3],u),y=T.MathUtils.lerp(d.trail[a*3+1],d.trail[b*3+1],u),z=T.MathUtils.lerp(d.trail[a*3+2],d.trail[b*3+2],u);
   dummy.position.copy(east).multiplyScalar(x).addScaledVector(north,y).addScaledVector(axis,z);
   dummy.rotation.set(d.spin+flight*2.7,d.spin*.7+flight*1.1,flight*1.8);
   const birth=T.MathUtils.smoothstep(t,d.release,d.release+.065),returning=1-T.MathUtils.smoothstep(flight,d.death-.08,d.death),remain=1-T.MathUtils.smoothstep(t,12,24),s=d.radius*birth*returning*remain;
   dummy.scale.set(s,s*d.stretch,s*.82);dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);
  }fragments.instanceMatrix.needsUpdate=true;}
  moon.visible=t>3;const growth=T.MathUtils.smoothstep(t,3,9),orbitalRadius=2.7+T.MathUtils.smoothstep(t,3,24)*1.1,angle=1.8+(t-3)*Math.sqrt(mu/orbitalRadius**3)*.6;moon.position.copy(axis).multiplyScalar(Math.cos(angle)*orbitalRadius).addScaledVector(east,Math.sin(angle)*orbitalRadius).addScaledVector(north,.16);moon.scale.setScalar(.15+.85*growth);moon.rotation.y=t*.24;
  vapour.visible=t>=0&&t<4;if(vapour.visible){const scale=.17+.55*Math.min(t,2.);vapour.position.copy(axis).multiplyScalar(1.12+.30*T.MathUtils.smoothstep(t,0,.8)).addScaledVector(east,t*.32);vapour.scale.setScalar(scale);volumeMaterial.uniforms.scale.value=scale;}
 }
 function inspect(){const small=smallSystem.inspect();return{age:lastAge,phase:lastPhase,kind:'continuous mantle shear',projectile:giant.visible&&planet.visible&&lastPhase<.30,explosion:giant.visible&&vapour.visible,ejecta:giant.visible&&fragments.visible,moon:giant.visible&&moon.visible,earlyImpactors:small.bodies,earlyExplosions:small.explosions,smallImpact:small.active,impactAxis:axis.toArray(),projectilePosition:bodyCenter.value.toArray(),limits:'A visual giant-impact reconstruction.'};}
 function labels(){return{earth:{visible:lastAge>4300,position:new T.Vector3(),radius:1,name:'PROTO-EARTH'},theia:{visible:giant.visible&&lastPhase<.3,position:bodyCenter.value.clone(),radius:.53,name:'THEIA'},moon:{visible:giant.visible&&moon.visible&&lastPhase>6,position:moon.position.clone(),radius:.2724,name:'YOUNG MOON'}};}
 return{group,update,impactAxis,impactTangent,impactPhase,impacts,impactStates,inspect,labels,noiseMap,get fusionActive(){return fusion.active;},get smallImpact(){return smallSystem.active}};
}
