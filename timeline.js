import{IMPACT_START,IMPACT_END,impactHours}from'./formation-system.js';
export const TIME_STOPS=[{x:0,age:4540},{x:0.025,age:4500.00000000004},{x:0.1,age:4500},{x:0.16,age:4499.999999999909},{x:0.215,age:4499.999999999315},{x:0.27,age:4499.999999997262},{x:0.28,age:4494.8},{x:0.294,age:4492},{x:0.305,age:4488.7},{x:0.308,age:4482.8},{x:0.322,age:4480},{x:0.333,age:4476.7},{x:0.336,age:4467.8},{x:0.35,age:4465},{x:0.361,age:4461.7},{x:0.364,age:4452.8},{x:0.378,age:4450},{x:0.389,age:4446.7},{x:0.392,age:4432.8},{x:0.406,age:4430},{x:0.417,age:4426.7},{x:0.42,age:4412.8},{x:0.434,age:4410},{x:0.445,age:4406.7},{x:0.448,age:4387.8},{x:0.462,age:4385},{x:0.473,age:4381.7},{x:0.476,age:4362.8},{x:0.49,age:4360},{x:0.501,age:4356.7},{x:0.504,age:4322.8},{x:0.518,age:4320},{x:0.529,age:4316.7},{x:0.55,age:4100},{x:0.569396552,age:2500},{x:0.588793103,age:1800},{x:0.612068966,age:750},{x:0.627586207,age:717},{x:0.650862069,age:700},{x:0.654741379,age:665},{x:0.674137931,age:659},{x:0.689655172,age:645},{x:0.712931034,age:640},{x:0.716034483,age:637},{x:0.734655172,age:635},{x:0.743965517,age:620},{x:0.767241379,age:540},{x:0.868103448,age:2.58},{x:0.914655172,age:0.08},{x:0.945689655,age:0.026},{x:1.0,age:0}];
export function sliderToAge(x){x=Math.max(0,Math.min(1,x));for(let i=1;i<TIME_STOPS.length;i++){const a=TIME_STOPS[i-1],b=TIME_STOPS[i];if(x<=b.x)return a.age+(b.age-a.age)*(x-a.x)/(b.x-a.x);}return 0;}
export function ageToSlider(age){for(let i=1;i<TIME_STOPS.length;i++){const a=TIME_STOPS[i-1],b=TIME_STOPS[i];if(age>=b.age)return a.x+(b.x-a.x)*(a.age-age)/(a.age-b.age);}return 1;}
// Keep the event clock small: subtracting hours from a 4.5 Ga age quantizes motion.
export function sliderToImpactHours(x){const stops=[[.025,-.35],[.10,0],[.16,.8],[.215,6],[.27,24]];if(x<stops[0][0]||x>stops.at(-1)[0])return null;for(let i=1;i<stops.length;i++){const a=stops[i-1],b=stops[i];if(x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return 24;}
export function impactHoursToSlider(hours){const stops=[[-.35,.025],[0,.10],[.8,.16],[6,.215],[24,.27]];for(let i=1;i<stops.length;i++){const a=stops[i-1],b=stops[i];if(hours<=b[0])return a[1]+(b[1]-a[1])*(hours-a[0])/(b[0]-a[0]);}return .27;}
export function ageLabel(age){
 if(age===0)return 'Present day';
 if(age>=1000)return (age/1000).toLocaleString('en-US',{maximumFractionDigits:2})+' billion years ago';
 if(age>=1)return age.toLocaleString('en-US',{maximumFractionDigits:1})+' million years ago';
 return (age*1000000).toLocaleString('en-US',{maximumFractionDigits:0})+' years ago';
}
export function eraFor(age,eventHours=null){
 if(eventHours!==null||(age<=IMPACT_START&&age>=IMPACT_END)){
  const h=eventHours??impactHours(age);
  return {title:h<0?'Theia approaches':h<.5?'The giant impact':h<3?'Mantle ejection':h<12?'A young Moon takes shape':'The young Moon',text:'About 4.5 billion years ago. '+(h<0?'Contact in '+Math.round(-h*60)+' minutes.':h.toFixed(1)+' hours after contact.'),source:'Giant-impact hypothesis · Kegerreis et al., 2022',confidence:'Illustrative reconstruction. Impact geometry, ejecta and lunar assembly are modelled.'};
 }
 const eras=[
  [4500,'Earth forms','Late accretion builds a hot planet. Collisions and a molten surface dominate its early history.','Early Earth · illustrative reconstruction','The earliest geography is unknown.'],
  [4470,'The magma ocean cools','Crust begins to solidify as the melt loses heat. Further impacts can remelt the surface.','Hadean · illustrative reconstruction','Impact dates, cooling rates and surface appearance are illustrative.'],
  [4000,'The first oceans','Earth cools. Ancient zircons preserve evidence of liquid water.','Hadean · illustrative reconstruction','The early surface and pace of cooling are approximate.'],
  [2500,'The Archean','Oceans and early continental crust develop. The oldest crustal blocks do not define a precise world map.','Archean · illustrative reconstruction','Global geography at this age has not been reconstructed.'],
  [1800,'The Great Oxidation','Rising oxygen transforms the oceans and atmosphere. Early glaciations are part of this history.','Early Proterozoic · illustrative reconstruction','Geography before 1.8 billion years ago is schematic here.'],
  [1200,'Ancient continental blocks','Cratons converge and separate through long supercontinent cycles.','CAO2024 · continental reconstruction','Block outlines are modelled; coastlines, relief and colours are illustrative.'],
  [750,'Rodinia','An ancient supercontinent assembles and begins to break apart.','CAO2024 reconstruction','Continental positions are modelled; ancient longitudes are less certain.'],
  [717,'Before Snowball Earth','Rodinia breaks apart, changing continents and oceans. Two major glacial episodes lie ahead.','CAO2024 reconstruction','Continental positions are modelled; surface materials are illustrative.'],
  [659,'Sturtian glaciation','Ice expands from high latitudes. A long glacial interval ends with retreating ice.','CAO2024 · Hoffman et al., 2017','Approximately 717–659 million years ago. Ice-front motion is illustrative.'],
  [645,'Between the glaciations','The Sturtian episode ends. Open oceans return before the next major glaciation.','CAO2024 · Cryogenian interglacial','Relief, climate, colours and clouds are illustrative.'],
  [635,'Marinoan glaciation','A second Cryogenian glaciation spreads, then retreats toward the end of the period.','CAO2024 · Hoffman et al., 2017','Approximately 645–635 million years ago. The onset and ice-front speed are uncertain.'],
  [540,'After the global ice','Earth emerges from the Cryogenian. Continents approach their early Paleozoic configuration.','CAO2024 reconstruction','Relief and surface colours are illustrative.'],
  [320,'Paleozoic oceans','Gondwana and northern continents shift. Shallow seas advance across the land.','PALEOMAP · Scotese & Wright, 2018','Paleogeography and elevations are reconstructed; colours and clouds are illustrative.'],
  [200,'Pangaea','Most continental land gathers into a single supercontinent.','PALEOMAP · Scotese & Wright, 2018','Maps are interpolated; this is not a calculation of plate velocities.'],
  [66,'Pangaea breaks apart','The Atlantic opens. India moves north and the continents separate.','PALEOMAP · Scotese & Wright, 2018','Ancient geography is modelled; historical colours are not satellite imagery.'],
  [2.58,'Toward familiar continents','India meets Asia. Antarctica becomes isolated and its ice sheet grows.','PALEOMAP · Scotese & Wright, 2018','Ice before 80,000 years ago and small landscape details are schematic.'],
  [.08,'The Quaternary','Glacial cycles shape the climate of the last few million years.','PALEOMAP geography · schematic climate','Detailed ice-sheet reconstruction covers the last 80,000 years.']
 ];
 const match=eras.find(e=>age>e[0]);
 if(match){const [,title,text,source,confidence]=match;return {title,text,source,confidence};}
 if(age>.0001)return {title:age>.027?'A glacial Earth':age>.017?'Last Glacial Maximum':age>.0117?'The ice retreats':'The Holocene',text:'Ice sheets, sea level and coastlines change. Each time step uses modelled data.',source:'PaleoMIST 1.0 · Gowan et al., 2021',confidence:'2,500-year data steps on a 0.25° grid. Intermediate states are interpolated.'};
 return {title:'Earth today',text:'Continents, archipelagos, coastlines and relief from geographic data.',source:'NASA Blue Marble · GSHHG · NOAA ETOPO 2022',confidence:'Land composite: August 2004. Clouds: July 2001. This is not live weather.'};
}
