export const SMALL_IMPACTS=[
 // Four representative episodes, spread across late accretion so they read as
 // separate events in the compressed one-minute playback.
 {age:4480,size:.009},{age:4450,size:.024},{age:4410,size:.072},{age:4360,size:.018}
];
// Representative late-accretion episodes. Sizes/locations are illustrative.
export function createSmallImpacts(T,maps,noiseMap){
 const group=new T.Group(),impacts={value:SMALL_IMPACTS.map(()=>new T.Vector4(1,0,0,.02))},impactStates={value:SMALL_IMPACTS.map(()=>new T.Vector4(-10,0,0,0))},dummy=new T.Object3D(),v=new T.Vector3(),east=new T.Vector3(),north=new T.Vector3(),basis=new T.Matrix4();
 const rock=new T.SphereGeometry(1,48,32),attr=rock.attributes.position;
 for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i);const r=1+.15*Math.sin(v.x*5+v.z*3)+.08*Math.sin(v.y*11-v.z*8)+.04*Math.sin(v.x*29+v.y*23);attr.setXYZ(i,v.x*r*1.15,v.y*r*.82,v.z*r);}rock.computeVertexNormals();
 const stone=new T.MeshStandardMaterial({map:maps.color,normalMap:maps.normal,normalScale:new T.Vector2(.8,.8),roughnessMap:maps.rough,roughness:.94,color:0x8b8177,toneMapped:false});
 const chunkMaterial=stone.clone();chunkMaterial.emissive.set(0xde4805);
 const cloudVertex=`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const cloudFragment=`precision highp float;varying vec3 p;uniform highp sampler3D noiseMap;uniform vec3 localEye;uniform mat4 objectToPlanet;uniform float scale,phase,strength;
 float noise(vec3 p){return texture(noiseMap,p*.03125).r;}float fbm(vec3 p){return noise(p)*.62+noise(p*2.03+13.)*.25+noise(p*4.03+19.)*.13;}
 void main(){vec3 ray=normalize(p-localEye),inv=1./ray,lo=(-vec3(1.)-localEye)*inv,hi=(vec3(1.)-localEye)*inv,mn=min(lo,hi),mx=max(lo,hi);float begin=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z));vec3 o=(objectToPlanet*vec4(localEye,1.)).xyz,d=normalize((objectToPlanet*vec4(ray,0.)).xyz);float b=dot(o,d),disc=b*b-dot(o,o)+1.;if(disc>0.){float ground=-b-sqrt(disc);if(ground>0.)end=min(end,ground/scale);}if(end<=begin)discard;float ds=(end-begin)/40.,t=phase;vec3 rgb=vec3(0.);float trans=1.;
 for(int i=0;i<40;i++){vec3 q=localEye+ray*(begin+(float(i)+.3)*ds),w=q-vec3(t*.2,0.,-.44);float r=length(w.xy),n=fbm(w*20.+vec3(-t*4.,t*2.,-t*4.));float top=.08+.75*t,head=exp(-pow(r/(.18+.42*t),2.)-pow((w.z-top)/(.13+.28*t),2.));float column=exp(-r*r/.035)*smoothstep(-.03,.04,w.z)*(1.-smoothstep(top*.7,top,w.z));float curtain=exp(-pow((w.z-(.58*t-.35*r))/.08,2.))*exp(-pow(r/(.12+.65*t),4.));float density=(head*2.+column+curtain*1.8)*smoothstep(.30,.62,n)*(1.-smoothstep(.75,.99,max(abs(q.x),max(abs(q.y),abs(q.z)))))*(1.-smoothstep(.55,1.1,t));density*=smoothstep(1.,1.006,length((objectToPlanet*vec4(q,1.)).xyz));float alpha=1.-exp(-density*ds*scale*75.);float heat=exp(-t*9.)*(.5+.5*n)*strength;vec3 dust=vec3(.10,.080,.061)*(.65+n*.45),glow=vec3(10.,3.,.45)*heat;rgb+=trans*alpha*(dust+glow);trans*=1.-alpha;}float alpha=1.-trans;gl_FragColor=vec4(rgb/max(.00001,alpha),alpha);}`;
 const cases=SMALL_IMPACTS.map((event,i)=>{
  const axis=new T.Vector3(Math.cos(i*2.4),.18*Math.sin(i*1.7),Math.sin(i*2.4)).normalize(),body=new T.Mesh(rock,stone);group.add(body);
  const particleCount=200+Math.floor(event.size*6500),chunks=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),chunkMaterial.clone(),particleCount);chunks.frustumCulled=false;group.add(chunks);
  const volume=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.BackSide,uniforms:{noiseMap:{value:noiseMap},localEye:{value:new T.Vector3()},objectToPlanet:{value:new T.Matrix4()},scale:{value:1},phase:{value:0},strength:{value:1}},vertexShader:cloudVertex,fragmentShader:cloudFragment});const plume=new T.Mesh(new T.BoxGeometry(2,2,2),volume);plume.renderOrder=3;group.add(plume);plume.onBeforeRender=(r,s,c)=>{volume.uniforms.localEye.value.copy(c.position).applyMatrix4(new T.Matrix4().copy(plume.matrixWorld).invert());volume.uniforms.objectToPlanet.value.copy(plume.matrix);};
  const flashMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{opacity:{value:0}},vertexShader:`varying vec2 q;void main(){q=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 q;uniform float opacity;void main(){float r=length(q);gl_FragColor=vec4(9.,4.8,1.8,exp(-r*r*8.)*opacity);}`});const flash=new T.Mesh(new T.PlaneGeometry(1,1),flashMat);flash.renderOrder=5;group.add(flash);
  const seeds=Array.from({length:particleCount},(_,j)=>({angle:j*2.39996,speed:.45+((j*37)%101)/100,height:.4+((j*13)%73)/73,scale:.2+((j*17)%97)/97}));
  return{...event,axis,body,chunks,plume,volume,flash,flashMat,seeds,armed:false,phase:-10};
 });
 let active=null;
 function update(age,eye,compact=false){active=null;for(let i=0;i<cases.length;i++){const c=cases[i],t=(c.age-age)/3;c.phase=t;const visible=t> -.45&&t<.75&&(!compact||i===0||i===2);
   if(!visible)c.armed=false;if(visible&&!c.armed){c.axis.copy(eye).normalize().applyAxisAngle(new T.Vector3(0,1,0),(i%2?1:-1)*(.48+(i%3)*.10)).applyAxisAngle(new T.Vector3(1,0,0),Math.sin(i*1.5)*.15);c.armed=true;}
   impacts.value[i].set(c.axis.x,c.axis.y,c.axis.z,c.size);impactStates.value[i].set(compact&&i!==0&&i!==2?-10:t,Math.exp(-Math.max(0,t)*.6),0,0);
   c.body.visible=visible&&t<.12;c.chunks.visible=visible&&t>=0;c.plume.visible=visible&&t>=0&&t<1.1;c.flash.visible=visible&&t>=0&&t<.12;if(visible)active={index:i,phase:t,diameterKm:Math.round(c.size*6378.137*2),position:c.body.position.clone()};if(!visible)continue;
   east.crossVectors(new T.Vector3(0,1,0),c.axis).normalize();north.crossVectors(c.axis,east).normalize();basis.makeBasis(east,north,c.axis);
   if(c.body.visible){c.body.position.copy(c.axis).multiplyScalar(1+c.size-t*(.85+c.size*7)).addScaledVector(east,t*.22);c.body.scale.setScalar(c.size);c.body.rotation.set(t*1.2,i+t*.9,i*.4);}
   if(c.flash.visible){c.flash.position.copy(c.axis).multiplyScalar(1.012);c.flash.lookAt(eye);c.flash.scale.setScalar(c.size*7+.012);c.flashMat.uniforms.opacity.value=Math.exp(-t*40);}
   if(c.plume.visible){const scale=c.size*6+.04+Math.max(0,t)*(.17+Math.sqrt(c.size)*.54);c.plume.position.copy(c.axis).multiplyScalar(1+scale*.43);c.plume.scale.setScalar(scale);c.plume.quaternion.setFromRotationMatrix(basis);c.volume.uniforms.phase.value=t;c.volume.uniforms.scale.value=scale;c.volume.uniforms.strength.value=Math.min(2,.7+Math.sqrt(c.size/.02)*.6);}
   if(c.chunks.visible){const physicalSeconds=t*(100+300*Math.sqrt(c.size)),velocityScale=.00065*Math.sqrt(c.size/.02);c.chunks.material.emissiveIntensity=.8*Math.exp(-t*4);for(let j=0;j<c.seeds.length;j++){const d=c.seeds[j],r=physicalSeconds*velocityScale*d.speed,height=physicalSeconds*velocityScale*d.height-.5*(9.81/6378137)*physicalSeconds**2;dummy.position.copy(c.axis).multiplyScalar(1.008+height).addScaledVector(east,r*(Math.cos(d.angle)+.32)).addScaledVector(north,r*Math.sin(d.angle));const size=c.size*(.035+d.scale*.07);dummy.scale.setScalar(dummy.position.length()>1.004?size:0);dummy.rotation.set(d.angle+t*10,j+t*7,t*12);dummy.updateMatrix();c.chunks.setMatrixAt(j,dummy.matrix);}c.chunks.instanceMatrix.needsUpdate=true;}
  }}
 return{group,impacts,impactStates,update,inspect:()=>({active:active&&{index:active.index,phase:active.phase,diameterKm:active.diameterKm},bodies:cases.filter(c=>c.body.visible).length,explosions:cases.filter(c=>c.plume.visible).length}),get active(){return active}};
}
