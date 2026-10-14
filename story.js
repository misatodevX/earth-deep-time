import {ageToSlider} from './timeline.js';

// Screen time is editorial; geological ages still come from the existing timeline.
export const STORY_CHAPTERS = [
  {start:0,end:3,from:0,to:.025,anchor:4540,title:'Earth forms',text:'A hot, young planet. Its fragile crust lies above circulating melt.'},
  {start:3,end:14,from:.025,to:.27,anchor:4500,title:'Theia. A Moon is born',text:'A glancing collision disrupts the impactor and sends hot material into orbit. A young Moon forms from the debris.'},
  {start:14,end:24,from:.27,to:.55,anchor:4470,title:'From melt to oceans',text:'The surface cools. Further impacts leave scars, the crust solidifies and liquid water appears.'},
  {start:24,end:29,from:.55,to:.595,anchor:2500,title:'Oceans and early continents',text:'Continental crust grows. Life develops in the oceans and gradually transforms the atmosphere.'},
  {start:29,end:34,from:.595,to:.627586207,anchor:1000,title:'Rodinia',text:'Continental blocks gather into a supercontinent, then begin to separate again.'},
  {start:34,end:41,from:.627586207,to:.743965517,anchor:690,title:'Snowball Earth',text:'Two major glacial episodes. Ice advances, retreats, then returns.'},
  {start:41,end:47,from:.743965517,to:ageToSlider(250),anchor:250,title:'Pangaea assembles',text:'Oceans and seas shift. Most of the land gradually gathers into one supercontinent.'},
  {start:47,end:53,from:ageToSlider(250),to:ageToSlider(2.58),anchor:100,title:'Continents drift apart',text:'The Atlantic opens. India moves north as Earth takes on familiar outlines.'},
  {start:53,end:57,from:ageToSlider(2.58),to:ageToSlider(.026),anchor:.026,title:'Glacial cycles',text:'Ice sheets expand and melt. Sea level and coastlines change.'},
  {start:57,end:60,from:ageToSlider(.026),to:1,anchor:0,title:'Earth today',text:'The great ice sheets retreat. This is our planet after 4.54 billion years of change.'}
];
export function storyAt(seconds){return STORY_CHAPTERS.find(c=>seconds<c.end)||STORY_CHAPTERS.at(-1);}
export function storyPosition(seconds){const c=storyAt(seconds),duration=c.end-c.start,finish=c.end===60?1:.3;let u=Math.max(0,Math.min(1,(seconds-c.start-.15)/(duration-.15-finish)));u=u*u*(3-2*u);return c.from+(c.to-c.from)*u;}

export function storySecondsAt(position){let lo=0,hi=60;for(let i=0;i<32;i++){const mid=(lo+hi)*.5;if(storyPosition(mid)<position)lo=mid;else hi=mid;}return (lo+hi)*.5;}
