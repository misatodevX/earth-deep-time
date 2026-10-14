export const surfaceVertex=`
attribute vec2 globalUV;varying vec2 q,gq;varying vec3 p,n;
uniform sampler2D dataMap;uniform vec2 gutter,dataGutter;uniform float displacement;
float altitude(vec2 uv){vec4 d=texture2D(dataMap,uv*dataGutter.x+dataGutter.y);return(d.r*65280.+d.g*255.)/6378137.;}
void main(){q=uv;gq=globalUV;n=normal;p=position+normal*altitude(uv)*displacement;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export const lightFunctions=`
const float PI=3.14159265359;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
float cloudDensity(vec2 uv){return texture2D(cloudMap,vec2(fract(uv.x),clamp(uv.y,.0001,.9999))).r;}
float oceanSpecular(vec3 N,vec3 L,vec3 V){vec3 H=normalize(L+V);float NoH=max(0.,dot(N,H)),NoL=max(0.,dot(N,L)),NoV=max(.001,dot(N,V)),VoH=max(0.,dot(V,H));float a=.085,a2=a*a,d=a2/(PI*pow(NoH*NoH*(a2-1.)+1.,2.)),k=.13,g=(NoL/(NoL*(1.-k)+k))*(NoV/(NoV*(1.-k)+k)),f=.0204+.9796*pow(1.-VoH,5.);return min(12.,d*g*f/(4.*max(.001,NoL*NoV)))*NoL;}
vec3 shade(vec3 albedo,vec3 N,vec3 L,vec3 V,float land,float ice,float shadow){float light=max(0.,dot(N,L));vec3 diffuse=albedo*(light*.94+fillLight);float glint=oceanSpecular(N,L,V)*(1.-land)*(1.-ice);return (diffuse+vec3(1.,.97,.92)*glint)*shadow;}
`;
export const surfaceFragment=`
precision highp float;uniform sampler2D colorMap,dataMap,cloudMap,iceMap,nightMap;uniform vec3 sun,eye;uniform vec2 gutter,dataGutter;uniform float cloudOn,iceOn,fillLight,dataStep;
varying vec2 q,gq;varying vec3 p,n;
${lightFunctions}
float height(vec2 uv){vec4 d=texture2D(dataMap,clamp(uv*dataGutter.x+dataGutter.y,vec2(0.),vec2(1.)));return d.r*65280.+d.g*255.;}
void main(){vec2 uv=q*gutter.x+gutter.y;vec4 data=texture2D(dataMap,q*dataGutter.x+dataGutter.y);float land=data.b;float lat=(gq.y-.5)*PI,lon=(gq.x-.5)*2.*PI;vec3 E=vec3(-sin(lon),0.,-cos(lon)),B=vec3(-sin(lat)*cos(lon),cos(lat),sin(lat)*sin(lon));
float stepUV=max(dataStep,max(length(dFdx(q)),length(dFdy(q)))),east=(height(q+vec2(stepUV,0.))-height(q-vec2(stepUV,0.)))/(2.*(40075016.7*.25*stepUV)*max(.025,cos(lat))),north=(height(q+vec2(0.,stepUV))-height(q-vec2(0.,stepUV)))/(2.*(40075016.7*.25*stepUV));
vec3 N=normalize(n-E*east*land-B*north*land),V=normalize(eye-p),L=normalize(sun);vec3 rgb=texture2D(colorMap,uv).rgb;
vec2 texel=vec2(1./5408.);vec3 soft=(texture2D(colorMap,uv+vec2(texel.x,0.)).rgb+texture2D(colorMap,uv-vec2(texel.x,0.)).rgb+texture2D(colorMap,uv+vec2(0.,texel.y)).rgb+texture2D(colorMap,uv-vec2(0.,texel.y)).rgb)*.25;
// Small reconstruction filter restores texture contrast, without invented terrain.
vec3 albedo=linearColor(clamp(rgb+(rgb-soft)*.18,0.,1.));
// A measured land mask controls surface response; colour remains the NASA composite.
float ice=texture2D(iceMap,gq).a*iceOn;albedo=mix(albedo,vec3(.73,.80,.85),ice);land=max(land,ice);
vec2 shifted=gq+vec2(dot(E,L)/max(.14,dot(N,L))*.00020/max(.05,cos(lat)),dot(B,L)/max(.14,dot(N,L))*.00040);
float shadow=1.-cloudDensity(shifted)*.46*cloudOn*smoothstep(.02,.18,dot(N,L));
vec3 night=texture2D(nightMap,gq).rgb;float luminosity=max(night.r,max(night.g,night.b));vec3 emission=linearColor(night)*smoothstep(.04,.13,luminosity)*1.35;
float dark=1.-smoothstep(-.16,.03,dot(normalize(n),L));emission*=dark*(1.-cloudDensity(gq)*.80*cloudOn);
gl_FragColor=vec4(shade(albedo,N,L,V,land,ice,shadow)+emission,1.);
}`;
export const historyVertex=`
attribute vec2 globalUV;varying vec2 gq;varying vec3 p,n;uniform sampler2D pastMap,nextMap;uniform float blend,early,impactPhase,time,age;uniform vec3 impactAxis,impactTangent;uniform vec4 impacts[4],impactStates[4];
float dem(vec4 c){return(c.r*65280.+c.g*255.-32768.);}
void main(){gq=globalUV;n=normal;float h=mix(dem(texture2D(pastMap,gq)),dem(texture2D(nextMap,gq)),blend);vec3 dir=normalize(normal);float angle=acos(clamp(dot(dir,impactAxis),-1.,1.)),t=max(0.,impactPhase),episode=step(-.35,impactPhase)*(1.-smoothstep(24.,80.,t));float tide=exp(-angle*angle*3.)*.023*(1.-smoothstep(0.,.5,t))*episode;float collapse=exp(-angle*angle*7.)*(-.18*exp(-t*.32)+.028*sin(t*2.5)*exp(-t*.48))*step(0.,impactPhase)*episode;
 float molten=smoothstep(4440.,4540.,age),waves=(sin(dir.x*18.+time*.50+sin(dir.y*12.-time*.23))+sin(dir.z*17.-time*.32+dir.x*7.))*.0016*molten;
 float crater=0.;for(int i=0;i<4;i++){float hit=step(0.,impactStates[i].x),r=acos(clamp(dot(dir,impacts[i].xyz),-1.,1.)),size=impacts[i].w*4.1;float irregular=1.+.13*sin(dir.x*71.+dir.z*43.+float(i)*2.)+.06*sin(dir.y*113.-dir.z*67.);r*=irregular;float basin=exp(-pow(r/max(.006,size),3.)),rim=exp(-pow((r-size)/max(.008,size*.30),2.));crater+=hit*(-size*.20*basin+size*.022*rim)*exp(-max(0.,impactStates[i].x)*.035);}
 p=position+normal*(max(0.,h)/6378137.*(1.-early)+(tide+collapse+waves+crater)*early)+impactTangent*exp(-angle*angle*5.)*.065*t*exp(-t*.5)*step(0.,impactPhase)*episode*early;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export const historyFragment=`
precision highp float;
uniform highp sampler3D lavaNoise;
uniform sampler2D pastMap,nextMap,cloudMap,icePast,iceNext,presentColor,detailMap,magmaMap,historicCloudMap,rockColor,rockRough;
uniform vec4 impacts[4],impactStates[4];uniform vec2 mapSize;uniform vec3 sun,eye,impactAxis,impactTangent;uniform float blend,age,time,cloudOn,early,fillLight,impactPhase;
varying vec2 gq;varying vec3 p,n;
${lightFunctions}
float hash(vec3 x){return fract(sin(dot(x,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.09)*.13+noise(p*8.17)*.07;}
float lavaFbm(vec3 p){return texture(lavaNoise,p*.03125).r*.56+texture(lavaNoise,(p*2.03+13.)*.03125).r*.28+texture(lavaNoise,(p*4.09+7.)*.03125).r*.16;}
float dem(vec4 c){return c.r*65280.+c.g*255.-32768.;}
vec2 wrap(vec2 uv){return vec2(fract(uv.x),clamp(uv.y,.0001,.9999));}
vec4 terrain(vec2 uv){return mix(texture2D(pastMap,wrap(uv)),texture2D(nextMap,wrap(uv)),blend);}
// Cubic B-spline reconstruction of the shoreline SDF. It removes grid-shaped
// corners without manufacturing fine-scale ancient coastline information.
float shoreSample(vec2 uv){return terrain(uv).b;}
float coast(vec2 uv){
 vec2 pixel=uv*mapSize-.5,i=floor(pixel),f=fract(pixel),f2=f*f,f3=f2*f;
 vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.;
 vec2 w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.;
 vec2 g0=w0+w1,g1=w2+w3,h0=(i-.5+w1/g0)/mapSize,h1=(i+1.5+w3/g1)/mapSize;
 return shoreSample(h0)*g0.x*g0.y+shoreSample(vec2(h1.x,h0.y))*g1.x*g0.y+shoreSample(vec2(h0.x,h1.y))*g0.x*g1.y+shoreSample(h1)*g1.x*g1.y;
}
vec3 bump(vec3 N,float height){vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);return normalize(abs(det)*N-sign(det)*(dFdx(height)*r1+dFdy(height)*r2));}
vec2 fractureCells(vec2 p){vec2 cell=floor(p),f=fract(p);float first=10.,second=10.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j)),c=cell+g;vec2 o=vec2(hash(vec3(c,1.)),hash(vec3(c,19.)));float d=length(g+o-f);if(d<first){second=first;first=d;}else second=min(second,d);}return vec2(first,second-first);}
vec3 thermal(float heat){return vec3(1.6,.19,.006)*pow(max(heat,0.),1.9)+vec3(2.4,.90,.13)*pow(max(heat,0.),6.);}
vec3 rockSample(vec3 d){vec3 w=pow(abs(d),vec3(5.));w/=w.x+w.y+w.z;return texture2D(rockColor,d.yz*4.).rgb*w.x+texture2D(rockColor,d.xz*4.).rgb*w.y+texture2D(rockColor,d.xy*4.).rgb*w.z;}
vec3 earlySurface(vec3 N,vec3 L,vec3 V,vec3 dir){
 float t=max(0.,impactPhase),after=step(0.,impactPhase)*(1.-smoothstep(30.,100.,t)),angle=acos(clamp(dot(dir,impactAxis),-1.,1.));
 float wet=1.-smoothstep(4390.,4440.,age),molten=smoothstep(4440.,4540.,age),cooling=1.-smoothstep(4450.,4540.,age);
 vec3 advect=dir+vec3(sin(dir.y*4.+time*.055),sin(dir.z*5.-time*.035),sin(dir.x*4.+time*.040))*.12;
 vec3 warp=vec3(lavaFbm(advect*9.),lavaFbm(advect*9.+19.),lavaFbm(advect*9.+47.));
 float cellular=lavaFbm(advect*7.+warp*3.5),fine=lavaFbm(advect*135.+warp*7.),shreds=lavaFbm(advect*38.+warp*9.);
 float reheating=after*exp(-t*.12)*exp(-angle*angle*.75);
 // Irregular, continuous crust islands over wide circulating pools of liquid.
 float solid=smoothstep(.45-cooling*.16,.56-cooling*.16,cellular+shreds*.12-reheating*.20);
 float heat=max(molten*.92,reheating*.97)*(.28+.74*lavaFbm(advect*18.+warp*4.));
 float skinRelief=(solid*shreds*.0035+fine*.00022)*(1.-wet);
 float radialRelief=0.;vec3 charRock=rockSample(advect)*(.27+.28*fine);
 vec3 albedo=charRock,emission=thermal(heat)*(1.-solid)*1.1;
 float continent=fbm(dir*3.5),land=smoothstep(.58,.66,continent);
 vec3 water=mix(vec3(.001,.008,.019),vec3(.003,.033,.044),continent);
 albedo=mix(albedo,mix(water,charRock*.8,land),wet);emission*=1.-wet;
 for(int i=0;i<4;i++){
  float phase=impactStates[i].x,r=acos(clamp(dot(dir,impacts[i].xyz),-1.,1.)),size=impacts[i].w*4.1;
  float irregular=1.+.13*sin(dir.x*71.+dir.z*43.+float(i)*2.)+.06*sin(dir.y*113.-dir.z*67.);
  float rr=r*irregular,mask=exp(-pow(rr/max(.008,size),3.))*step(0.,phase),scar=mask*exp(-max(0.,phase)*.035);float basin=exp(-pow(rr/max(.006,size),3.)),rim=exp(-pow((rr-size)/max(.008,size*.30),2.));radialRelief+=step(0.,phase)*(-size*.20*basin+size*.022*rim)*exp(-max(0.,phase)*.035);
  float moltenPool=smoothstep(.33,.67,fbm(dir*80.+float(i)*7.)),localHeat=exp(-max(0.,phase)*.55);
  emission+=thermal(localHeat*(.42+.53*moltenPool))*mask*1.7;
  vec3 impactRock=mix(vec3(.15,.10,.066),rockSample(dir)*1.45,.45)*(.72+.28*moltenPool);albedo=mix(albedo,impactRock,scar*.96);land=max(land,smoothstep(.015,.22,scar));
 }
 N=bump(normalize(dir),skinRelief+radialRelief);float glossy=pow(max(0.,dot(N,normalize(L+V))),80.)*.23*(1.-solid)*(1.-wet);
 return shade(albedo,N,L,V,mix(1.,land,wet),0.,1.)+emission+vec3(1.,.68,.40)*glossy;
}

void main(){if(early>.999){vec3 gn=normalize(cross(dFdx(p),dFdy(p)));if(dot(gn,n)<0.)gn=-gn;gl_FragColor=vec4(earlySurface(gn,normalize(sun),normalize(eye-p),normalize(p)),1.);return;}vec4 d=terrain(gq);float h=dem(d),sdf=coast(gq);
 float aa=max(.002,fwidth(sdf)*.7),land=smoothstep(.5-aa,.5+aa,sdf);
 float lat=(gq.y-.5)*PI,lon=(gq.x-.5)*2.*PI;vec3 E=vec3(-sin(lon),0.,-cos(lon)),B=vec3(-sin(lat)*cos(lon),cos(lat),sin(lat)*sin(lon)),L=normalize(sun),V=normalize(eye-p);
 vec2 delta=1./mapSize;
 float east=(dem(terrain(gq+vec2(delta.x,0.)))-dem(terrain(gq-vec2(delta.x,0.))))/(2.*40075016.7*delta.x*max(.08,cos(lat)));
 float north=(dem(terrain(gq+vec2(0.,delta.y)))-dem(terrain(gq-vec2(0.,delta.y))))/(2.*20037508.3*delta.y);
 vec3 N=normalize(n-land*(E*east+B*north)*(1.-early));
 vec3 detail=texture2D(detailMap,wrap(gq)).rgb;
 float mineral=detail.r,ridges=detail.g,moisture=detail.b;
 float continentality=smoothstep(.53,.92,sdf),tropical=1.-smoothstep(.25,1.20,abs(lat));
 float desert=exp(-pow((abs(lat)-.47)/.22,2.))*(.4+.6*continentality)*(1.-moisture*.55);
 float plants=1.-smoothstep(390.,470.,age);
 vec3 sediment=mix(vec3(.105,.061,.029),vec3(.32,.205,.095),mineral);
 vec3 bedrock=mix(vec3(.09,.081,.062),vec3(.245,.211,.16),ridges);
 vec3 rock=mix(sediment,bedrock,smoothstep(400.,2400.,h)*(.3+.7*ridges));
 vec3 green=mix(vec3(.011,.038,.016),vec3(.041,.094,.029),mineral);
 float vegetation=plants*tropical*moisture*(1.-desert)*(.55+.45*continentality);
 rock=mix(rock,green,clamp(vegetation*1.7,0.,.9));
 rock=mix(rock,vec3(.33,.23,.125)*(.65+.55*mineral),desert*.65);rock*=.72+.48*mineral;rock=mix(rock,bedrock,smoothstep(.68,.88,ridges)*.4);
 float shelf=(1.-smoothstep(.025,.16,.5-sdf))*(1.-land);
 vec3 ocean=mix(vec3(.002,.014,.030),vec3(.008,.065,.077),shelf*.7);
 vec3 color=mix(ocean,rock,land);
 if(age<=.08){vec3 satellite=linearColor(texture2D(presentColor,gq).rgb);color=mix(ocean,satellite,land);}
 float ice=mix(texture2D(icePast,gq).r,texture2D(iceNext,gq).r,blend);
 float sturtian=(1.-smoothstep(700.,717.,age))*smoothstep(659.,665.,age);
 float marinoan=(1.-smoothstep(640.,645.,age))*smoothstep(635.,637.,age);
 float advance=max(sturtian,marinoan);
 float front=1.5708-advance*1.70;
 float irregular=(mineral-.5)*.075+(ridges-.5)*.035;
 float cryo=smoothstep(front-.045,front+.045,abs(lat)+irregular)*smoothstep(0.,.04,advance);
 ice=max(ice,cryo);
 float polar=smoothstep(1.02,1.33,abs(lat));ice=max(ice,polar*land*.75*(1.-smoothstep(30.,38.,age)));
 float alpine=plants*land*smoothstep(2600.,4400.,h)*(1.-smoothstep(.20,1.30,abs(lat)));
 ice=max(ice,alpine*.6);
 vec3 snow=mix(vec3(.48,.59,.67),vec3(.77,.85,.88),mineral);
 color=mix(color,snow,ice);land=max(land,ice);
 float microHeight=land*(1.-early)*(.00022*pow(ridges,2.4)+.000018*mineral)*(.35+.65*smoothstep(150.,1800.,h));
 N=bump(N,microHeight);
 // Detailed illustrative cloud density with a moving cast shadow.
 float shadow=1.-texture2D(historicCloudMap,wrap(gq+vec2(time*.000018+dot(E,L)*.0004,dot(B,L)*.0006))).r*.20*cloudOn;
 vec3 result=shade(color,N,L,V,land,ice,shadow);
 if(early>0.){vec3 geometricNormal=normalize(cross(dFdx(p),dFdy(p)));if(dot(geometricNormal,n)<0.)geometricNormal=-geometricNormal;result=mix(result,earlySurface(geometricNormal,L,V,normalize(p)),early);}
 gl_FragColor=vec4(result,smoothstep(0.,.0025,age));
}`;
export const cloudVertex=`attribute vec2 globalUV;varying vec2 gq;varying vec3 p,n;void main(){gq=globalUV;p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const cloudFragment=`
precision highp float;uniform sampler2D cloudMap,detailMap,historicCloudMap;uniform vec3 sun,eye;uniform float age,time;uniform vec4 impacts[4],impactStates[4];varying vec2 gq;varying vec3 p,n;
float hash(vec3 x){return fract(sin(dot(x,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float cloud(vec2 uv){uv=vec2(fract(uv.x),clamp(uv.y,.0001,.9999));float modern=texture2D(cloudMap,uv).r;
float past=texture2D(historicCloudMap,vec2(fract(uv.x+time*.000018),uv.y)).r;
return mix(modern,past*.76,smoothstep(.08,.16,age));}
void main(){vec3 N=normalize(n),L=normalize(sun),V=normalize(eye-p);float c=cloud(gq);
float steam=smoothstep(4370.,4440.,age)*(1.-smoothstep(4470.,4510.,age));
float steamPattern=noise(N*23.)*.55+noise(N*49.)*.30+noise(N*97.)*.15;
c=mix(c,smoothstep(.30,.76,steamPattern)*.22,steam);
float lat=(gq.y-.5)*3.14159265,lon=(gq.x-.5)*6.2831853;vec3 E=vec3(-sin(lon),0.,-cos(lon)),B=vec3(-sin(lat)*cos(lon),cos(lat),sin(lat)*sin(lon));
vec2 texel=vec2(4./16384.,4./8192.);
float dx=cloud(gq+vec2(texel.x,0.))-cloud(gq-vec2(texel.x,0.)),dy=cloud(gq+vec2(0.,texel.y))-cloud(gq-vec2(0.,texel.y));
vec3 cloudNormal=normalize(N-(E*dx/max(.15,cos(lat))+B*dy)*.32*(1.-steam));
float daylight=max(0.,dot(cloudNormal,L));
float forward=pow(max(0.,dot(L,-V)),5.);
float silver=pow(1.-max(0.,dot(N,V)),4.)*smoothstep(-.05,.12,dot(N,L));
float extinction=exp(-c*1.45);
float lighting=daylight*(.78+.22*extinction)+forward*c*.20+silver*.15;
vec3 color=mix(vec3(.98,.99,1.),vec3(.74,.67,.57),steam*.40)*lighting;
float alpha=1.-exp(-pow(c,1.3)*2.8);alpha*=1.-smoothstep(4470.,4535.,age);alpha*=mix(1.,.38,smoothstep(.08,.16,age));
alpha*=.06+.94*(1.-smoothstep(4430.,4490.,age));
float frozen=max((1.-smoothstep(700.,717.,age))*smoothstep(659.,665.,age),(1.-smoothstep(640.,645.,age))*smoothstep(635.,637.,age));alpha*=1.-frozen*.65;
for(int i=0;i<4;i++){float r=acos(clamp(dot(N,impacts[i].xyz),-1.,1.)),clear=(1.-smoothstep(.8,1.5,r/max(.012,impacts[i].w*6.)))*step(0.,impactStates[i].x)*exp(-max(0.,impactStates[i].x)*.022);alpha*=1.-clear*.995;}gl_FragColor=vec4(color,alpha);
}`;
export const atmosphereVertex=`varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const atmosphereFragment=`
precision highp float;uniform sampler2D image,sceneDepth;uniform mat4 inverseProjection,cameraWorld,inverseEarth;uniform vec3 sun;uniform float age;varying vec2 q;
const float R=6378.137,OUTER=6478.137,FLAT=.996647189335;
vec2 intersectEllipsoid(vec3 o,vec3 d,float r){vec3 k=vec3(1.,1./FLAT,1.),a=o*k,b=d*k;float B=dot(a,b),A=dot(b,b),C=dot(a,a)-r*r,disc=B*B-A*C;if(disc<0.)return vec2(1e8,-1e8);float s=sqrt(disc);return vec2((-B-s)/A,(-B+s)/A);}
vec2 density(vec3 p){float h=max(0.,length(p*vec3(1.,1./FLAT,1.))-R);return exp(-h/vec2(8.,1.2));}
vec2 sunDepth(vec3 p){vec2 hit=intersectEllipsoid(p,sun,OUTER),ground=intersectEllipsoid(p,sun,R);if(ground.x>.002)return vec2(1e4);float len=max(0.,hit.y),ds=len/8.;vec2 sum=vec2(0.);for(int j=0;j<8;j++)sum+=density(p+sun*(float(j)+.5)*ds)*ds;return sum;}
void main(){vec3 original=texture2D(image,q).rgb;vec4 view=inverseProjection*vec4(q*2.-1.,1.,1.);vec3 dir=normalize((inverseEarth*cameraWorld*vec4(normalize(view.xyz/view.w),0.)).xyz);vec3 origin=(inverseEarth*cameraWorld*vec4(0.,0.,0.,1.)).xyz*R;vec2 hit=intersectEllipsoid(origin,dir,OUTER);vec3 result=original;if(hit.y>=0.&&hit.x<=hit.y){float start=max(0.,hit.x),end=hit.y;vec2 ground=intersectEllipsoid(origin,dir,R);if(ground.x>0.)end=min(end,ground.x);vec4 opaque=inverseProjection*vec4(q*2.-1.,texture2D(sceneDepth,q).r*2.-1.,1.);end=min(end,length(opaque.xyz/opaque.w)*R);float ds=max(0.,end-start)/20.;vec2 depth=vec2(0.);vec3 sumR=vec3(0.),sumM=vec3(0.);vec3 betaR=vec3(.005802,.013558,.033100),betaM=vec3(.004);float mu=dot(dir,sun),phaseR=3./(16.*3.14159265)*(1.+mu*mu),g=.76,phaseM=3./(8.*3.14159265)*((1.-g*g)*(1.+mu*mu))/((2.+g*g)*pow(max(.01,1.+g*g-2.*g*mu),1.5));
for(int i=0;i<20;i++){vec3 p=origin+dir*(start+(float(i)+.5)*ds);vec2 rho=density(p);depth+=rho*ds*.5;vec2 optical=depth+sunDepth(p);vec3 trans=exp(-betaR*optical.x-betaM*optical.y);sumR+=rho.x*trans*ds;sumM+=rho.y*trans*ds;depth+=rho*ds*.5;}
vec3 trans=exp(-betaR*depth.x-betaM*depth.y),scatter=(sumR*betaR*phaseR+sumM*betaM*phaseM)*3.14159265;float molten=smoothstep(4420.,4540.,age);scatter=mix(scatter,scatter*vec3(1.6,.48,.13),molten);result=original*trans+scatter;}
float hot=smoothstep(4440.,4535.,age);
if(hot>0.){vec2 pixel=1./vec2(textureSize(image,0));vec3 glow=vec3(0.);
for(int j=0;j<8;j++){float angle=float(j)*.785398;vec2 offset=vec2(cos(angle),sin(angle));vec3 near=textureLod(image,q+offset*pixel*5.,0.).rgb,far=textureLod(image,q+offset*pixel*15.,0.).rgb;glow+=max(near-.45,0.)*.065+max(far-.6,0.)*.025;}
result+=glow*hot*.42;}
gl_FragColor=vec4(result,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

