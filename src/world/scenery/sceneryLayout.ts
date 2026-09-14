import { hubSections, destinationPlatformRadius, sectionRampApproachLength } from '../hubSections';
import { groundSize, groundCenter, walkingRoutes, walkingPathWidth, routePickupPositions, routePowerPositions, plazaRadius } from '../worldLayout';
import { seededRandom } from './sceneryModels';

export const scenerySettings = {
  enabled: true,
  desktop: { density: 1, distance: 155, lodDistance: 58, shadowDistance: 30 },
  mobile: { density: .55, distance: 100, lodDistance: 32, shadowDistance: 18 },
};
export type SceneryItem = { x: number; z: number; scale: number; yaw: number; variant: number; kind: 'pine' | 'rock' | 'snowbank'; radius: number; featured?: boolean };
export function segmentDistance(x:number,z:number,a:readonly number[],b:readonly number[]) {
  const dx=b[0]-a[0], dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
export function sceneryClearance(x:number,z:number,radius:number,tall:boolean,featured = false) {
  if (Math.abs(x-groundCenter[0])+radius>groundSize[0]/2-1 || Math.abs(z-groundCenter[1])+radius>groundSize[1]/2-1) return false;
  if (Math.hypot(x,z)<plazaRadius+radius+(featured?4:6)) return false;
  for (const route of walkingRoutes) for (let i=1;i<route.length;i++) {
    if (segmentDistance(x,z,route[i-1],route[i])<walkingPathWidth/2+radius+(tall?(featured?2:4):1.5)) return false;
  }
  for (const s of hubSections) {
    if (Math.abs(x-s.position[0])<destinationPlatformRadius+radius+(tall?4:2)
      && Math.abs(z-s.position[2])<destinationPlatformRadius+radius+(tall?4:2)) return false;
    const a=[s.position[0]+s.entrance[0]*14,s.position[2]+s.entrance[1]*14];
    const b=[a[0]+s.entrance[0]*sectionRampApproachLength,a[1]+s.entrance[1]*sectionRampApproachLength];
    if (segmentDistance(x,z,a,b)<radius+6) return false;
    // Preserve broad plaza-to-screen sight lines, not only collision clearances.
    if (tall && segmentDistance(x,z,[0,0],[s.position[0],s.position[2]])<radius+(featured?4:9)) return false;
  }
  for (const p of Object.values(routePickupPositions)) if(Math.hypot(x-p[0],z-p[1])<radius+(featured?2.5:8)) return false;
  for (const p of routePowerPositions) if(Math.hypot(x-p[0],z-p[2])<radius+5) return false;
  return true;
}
const clusters = [[-77,-85],[-76,-62],[-78,-15],[-75,20],[-64,58],[-13,58],[19,59],[73,48],[79,22],[78,-80],[53,-103],[-9,-108],[-52,-105],[-56,-65],[35,-77]];
export function createSceneryLayout(): SceneryItem[] {
  const random=seededRandom(91017), items:SceneryItem[]=[];
  const add=(kind:SceneryItem['kind'],x:number,z:number,scale:number)=>{
    const radius=scale*(kind==='pine'?2.8:kind==='rock'?1.55:2);
    if(!sceneryClearance(x,z,radius,kind==='pine')) return;
    if(items.some(item=>Math.hypot(x-item.x,z-item.z)<radius+item.radius+.4)) return;
    items.push({kind,x,z,scale,radius,yaw:random()*Math.PI*2,variant:Math.floor(random()*3)});
  };
  for(const [cx,cz] of clusters) {
    for(let i=0;i<5;i++) add('pine',cx+(random()-.5)*13,cz+(random()-.5)*13,.72+random()*.4);
    for(let i=0;i<4;i++) add('rock',cx+(random()-.5)*16,cz+(random()-.5)*16,.6+random()*1.1);
  }
  // Low rock groups beside platform margins; never on the playable surfaces.
  for(const s of hubSections) for(const side of [-1,1]) {
    const x=s.position[0]-s.entrance[1]*side*20, z=s.position[2]+s.entrance[0]*side*20;
    add('rock',x,z,.65); add('rock',x+2,z+2,.4);
  }
  for(const route of walkingRoutes) for(let i=1;i<route.length;i++) {
    const a=route[i-1], b=route[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<12)continue;
    for(const side of [-1,1]) add('snowbank',(a[0]+b[0])/2-(b[1]-a[1])/len*side*7.5,(a[1]+b[1])/2+(b[0]-a[0])/len*side*7.5,.65);
  }
  // Relocate existing instances into readable foreground groups; do not add objects.
  const foreground: { kind: SceneryItem['kind']; x: number; z: number; scale: number }[] = [
    {kind:'pine',x:12,z:-24,scale:.86}, {kind:'pine',x:12,z:-32,scale:.9},
    {kind:'pine',x:16,z:-40,scale:.86}, {kind:'pine',x:-16,z:-20,scale:.86},
    {kind:'pine',x:-8,z:-40,scale:.86}, {kind:'pine',x:28,z:-56,scale:.86},
    {kind:'rock',x:-9,z:-24,scale:1.05}, {kind:'rock',x:-12,z:-27,scale:.7},
    {kind:'rock',x:22,z:-18,scale:1}, {kind:'rock',x:24,z:-23,scale:.75},
    {kind:'rock',x:8,z:-34,scale:.85}, {kind:'rock',x:-19,z:-33,scale:.7},
    {kind:'snowbank',x:9,z:-46,scale:.95}, {kind:'snowbank',x:-8,z:-32,scale:.95},
  ];
  for(const target of foreground) {
    const radius=target.scale*(target.kind==='pine'?2.8:target.kind==='snowbank'?2:1.55);
    if(!sceneryClearance(target.x,target.z,radius,target.kind==='pine',true)) continue;
    if(items.some(item=>Math.hypot(target.x-item.x,target.z-item.z)<radius+item.radius+.4)) continue;
    const item=items.filter(item=>item.kind===target.kind&&!item.featured)
      .sort((a,b)=>Math.hypot(b.x,b.z)-Math.hypot(a.x,a.z))[0];
    if(item) Object.assign(item,target,{radius,featured:true});
  }
  return items;
}

/** Keep the foreground legible on mobile without increasing its total budget. */
export function selectSceneryItems(items: SceneryItem[], density: number) {
  const count=Math.floor(items.length*density);
  const featured=items.filter(item=>item.featured);
  const background=items.filter(item=>!item.featured);
  return [...featured,...background.filter((_,i)=>Math.floor((i+1)*density)>Math.floor(i*density)),...background]
    .filter((item,index,array)=>array.indexOf(item)===index).slice(0,count);
}
