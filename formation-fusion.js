// A continuous implicit surface replaces overlapping planet meshes during contact.
// This is a directed reconstruction of mantle flow, not an SPH calculation.

export function createMantleFusion(T,maps,shared){
 const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:true,transparent:false,uniforms:{
  phase:shared.impactPhase,impactPhase:shared.impactPhase,impactAxis:shared.impactAxis,impactTangent:shared.impactTangent,
  age:shared.age,time:shared.time,sun:shared.sun,fillLight:shared.fillLight,
  impacts:shared.impacts,impactStates:shared.impactStates,
  rockColor:{value:maps.color},noiseMap:{value:shared.noiseMap},
  cloudOn:{value:0},localEye:{value:new T.Vector3()},worldMatrix:{value:new T.Matrix4()},
 },vertexShader:`varying vec3 boundsPoint;void main(){boundsPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`precision highp float;varying vec3 boundsPoint;uniform vec3 localEye,sun,impactAxis,impactTangent;uniform float phase,impactPhase,age,time,fillLight,cloudOn;uniform sampler2D rockColor;uniform highp sampler3D noiseMap;uniform mat4 worldMatrix,projectionMatrix;vec3 p;
 float noise(vec3 q){return texture(noiseMap,q*.03125).r;}
 float fbm(vec3 q){return noise(q)*.56+noise(q*2.03+13.)*.28+noise(q*4.09+7.)*.16;}
 vec3 thermal(float heat){return vec3(1.6,.19,.006)*pow(max(heat,0.),1.9)+vec3(2.4,.90,.13)*pow(max(heat,0.),6.);}
 vec3 rockSample(vec3 d){vec3 w=pow(abs(normalize(d)),vec3(5.));w/=w.x+w.y+w.z;return texture2D(rockColor,d.yz*4.).rgb*w.x+texture2D(rockColor,d.xz*4.).rgb*w.y+texture2D(rockColor,d.xy*4.).rgb*w.z;}
 float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
 float ellipsoid(vec3 q,vec3 r){float k0=length(q/r),k1=length(q/(r*r));return k0*(k0-1.)/max(.001,k1);}
 vec3 contactSpace(vec3 q){return vec3(dot(q,impactTangent),dot(q,cross(impactAxis,impactTangent)),dot(q,impactAxis));}
 vec2 distances(vec3 q){
  float t=max(0.,phase),pressure=smoothstep(0.,.45,t),relax=1.-smoothstep(1.4,4.,t);
  vec3 c=contactSpace(q);float r=length(q),facing=c.z/max(.001,r),flank=c.x/max(.001,r);
  float indentation=pressure*(-.18*exp(-t*.32)+.028*sin(t*2.5)*exp(-t*.48))*exp((facing-1.)*14.);
  float bulge=.074*pressure*relax*exp(-pow((facing-.58)/.25,2.))*(.55+.45*flank);
  float radius=1.+indentation+bulge;
  // Rounded, irregular mantle folds move across the contact region.
  float folds=sin(c.x*11.-t*3.+sin(c.y*8.))*sin(c.y*13.+t*2.);
  radius+=folds*.009*pressure*relax*smoothstep(.35,.9,facing);
  float earth=r-radius;
  float travel=clamp(t,0.,.20),loss=1.-smoothstep(.035,.21,t);
  vec3 center=vec3(travel*.86,0.,1.53-travel*1.05);
  // The contact face compresses; the far mantle stretches along the grazing path.
  vec3 offset=c-center;float a=pressure*.36;
  offset.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*offset.xz;
  vec3 axes=vec3(.53*(1.+pressure*.55),.53*(1.-pressure*.23),.53*(1.-pressure*.59))*max(.025,loss);
  float theia=ellipsoid(offset,axes);
  // The compressed body gives way to individually detached fragments.
  if(phase<0.||t>.21)theia=10.;
  return vec2(earth,theia);
 }
 float field(vec3 q){vec2 d=distances(q);return smin(d.x,d.y,.035+.21*smoothstep(0.,.6,max(0.,phase)));}
 vec3 fieldNormal(vec3 q){const float e=.0008;vec2 h=vec2(e,-e);return normalize(h.xyy*field(q+h.xyy)+h.yyx*field(q+h.yyx)+h.yxy*field(q+h.yxy)+h.xxx*field(q+h.xxx));}
 void main(){
  vec3 ray=normalize(boundsPoint-localEye),inv=1./ray;
  vec3 lo=(-vec3(2.6)-localEye)*inv,hi=(vec3(2.6)-localEye)*inv,mn=min(lo,hi),mx=max(lo,hi);
  float start=max(0.,max(mn.x,max(mn.y,mn.z))),end=min(mx.x,min(mx.y,mx.z)),distance=start;bool hit=false;
  if(end<=start)discard;
  for(int i=0;i<64;i++){p=localEye+ray*distance;float d=field(p);if(d<.0008){hit=true;break;}distance+=max(.0005,d*.75);if(distance>end)break;}
  if(!hit)discard;
  vec3 N=fieldNormal(p),V=normalize(localEye-p),L=normalize(sun),D=normalize(p);
  vec3 advected=D+vec3(sin(D.y*4.+time*.055),sin(D.z*5.-time*.035),sin(D.x*4.+time*.04))*.12;
  vec3 warp=vec3(fbm(advected*9.),fbm(advected*9.+19.),fbm(advected*9.+47.));
  float crust=fbm(advected*7.+warp*3.5),rough=fbm(advected*38.+warp*9.);
  float after=exp(-max(0.,phase)*.12)*exp(-pow(acos(clamp(dot(D,impactAxis),-1.,1.)),2.)*.75);
  float cooling=1.-smoothstep(4450.,4540.,age);
  float solid=smoothstep(.45-cooling*.16,.56-cooling*.16,crust+rough*.12-after*.20);
  float fine=fbm(advected*135.+warp*7.),heat=max(smoothstep(4440.,4540.,age)*.92,after*.97)*(.28+.74*fbm(advected*18.+warp*4.));
  vec3 earthColor=rockSample(advected)*(.27+.28*fine)*(fillLight+.94*max(0.,dot(N,L)))+thermal(heat)*(1.-solid)*1.1;
  vec2 d=distances(p);float mantle=1.-smoothstep(-.06,.06,d.y-d.x);
  vec3 c=contactSpace(p);float t=max(0.,phase),heating=smoothstep(0.,.45,t),grain=fbm(p*95.);
  vec3 advect=p+impactTangent*t*.09;float liquid=smoothstep(.43,.65,fbm(advect*11.)+heating*.09);
  vec3 stone=rockSample(advect)*(.065+.65*max(0.,dot(N,L)));
  vec3 incoming=mix(stone,thermal((.15+heating*.65)*(.5+.5*grain))*1.25,liquid);
  vec3 rgb=mix(earthColor,incoming,mantle);
  // Local contact heating follows the pressure front rather than a luminous ring.
  float contact=exp(-pow(length(c-vec3(.32,0.,.94))/.47,3.))*exp(-t*.65)*smoothstep(0.,.12,t);
  rgb+=thermal(contact*(.68+.32*fbm(advect*26.)))*1.1;
  float spec=pow(max(0.,dot(N,normalize(L+V))),65.)*.14*heating;
  gl_FragColor=vec4(rgb+vec3(1.,.55,.22)*spec,1.);
  vec4 clip=projectionMatrix*viewMatrix*worldMatrix*vec4(p,1.);gl_FragDepth=clip.z/clip.w*.5+.5;
 }`});
 const mesh=new T.Mesh(new T.BoxGeometry(5.2,5.2,5.2),material);mesh.frustumCulled=false;mesh.renderOrder=1;mesh.visible=false;
 const inverse=new T.Matrix4();mesh.onBeforeRender=(renderer,scene,camera)=>{inverse.copy(mesh.matrixWorld).invert();material.uniforms.localEye.value.copy(camera.position).applyMatrix4(inverse);material.uniforms.worldMatrix.value.copy(mesh.matrixWorld);};
 return {mesh,update(phase,active){mesh.visible=active&&phase>=0&&phase<4;},get active(){return mesh.visible;}};
}
