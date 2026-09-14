import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DynamicDrawUsage, InstancedMesh, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type BufferGeometry, type Material } from 'three';
import { useGameFrame } from '../../player/useGameFrame';
import { isCompactVisualBudget } from '../visualQuality';
import { createPineModel, createRockModel } from '../scenery/sceneryModels';
import { createSceneryLayout, selectSceneryItems, scenerySettings } from '../scenery/sceneryLayout';
import { createSceneryMaterials } from '../scenery/sceneryMaterials';

const texturePaths=['/images/scenery/pine-needles.webp','/images/scenery/pine-alpha.webp','/images/scenery/pine-bark.webp','/images/scenery/rock.webp','/images/scenery/rock-normal.webp'];
export function WinterScenery() {
  const [mobile]=useState(isCompactVisualBudget);
  const budget=mobile?scenerySettings.mobile:scenerySettings.desktop;
  const textures=useTexture(texturePaths);
  const camera=useThree(s=>s.camera);
  const resources=useMemo(()=>{
    textures.forEach((texture,i)=>{
      if(i===0||i===2||i===3)texture.colorSpace=SRGBColorSpace;
      if(i>=2)texture.wrapS=texture.wrapT=RepeatWrapping;
      texture.anisotropy=mobile?1:2; texture.needsUpdate=true;
    });
    const materials=createSceneryMaterials(textures);
    const variants=Array.from({length:3},(_,i)=>({near:createPineModel(i),far:createPineModel(i,true),rock:createRockModel(i),rockFar:createRockModel(i,true)}));
    const bank=createRockModel(0,false,true);
    return {materials,variants,bank};
  },[textures,mobile]);
  const items=useMemo(()=>selectSceneryItems(createSceneryLayout(), budget.density),[budget]);
  const batches=useMemo(()=>{
    const result:{key:string;geometry:BufferGeometry;material:Material;shadow:boolean;foliage:boolean;variant:number;kind:string;tier:string}[]=[];
    resources.variants.forEach((model,variant)=>{
      for(const tier of ['shadow','near','far']) {
        const tree=tier==='far'?model.far:model.near;
        result.push({key:`pine-${variant}-${tier}-wood`,kind:'pine',variant,tier,geometry:tree.wood,material:resources.materials.wood,shadow:tier==='shadow',foliage:false});
        result.push({key:`pine-${variant}-${tier}-needles`,kind:'pine',variant,tier,geometry:tree.needles,material:resources.materials.foliage,shadow:tier==='shadow',foliage:true});
      }
      for(const tier of ['near','far']) result.push({key:`rock-${variant}-${tier}`,kind:'rock',variant,tier,geometry:tier==='far'?model.rockFar:model.rock,material:resources.materials.stone,shadow:false,foliage:false});
    });
    result.push({key:'snowbanks',kind:'snowbank',variant:-1,tier:'near',geometry:resources.bank,material:resources.materials.bank,shadow:false,foliage:false});
    return result;
  },[resources]);
  const meshes=useRef<(InstancedMesh|null)[]>([]);
  const previous=useRef(-Infinity);
  const scratch=useMemo(()=>({matrix:new Matrix4(),position:new Vector3(),scale:new Vector3(),rotation:new Quaternion(),up:new Vector3(0,1,0)}),[]);
  const update=()=>{
    const counts=batches.map(()=>0);
    for(const item of items) {
      const distance=Math.hypot(camera.position.x-item.x,camera.position.z-item.z);
      if(distance>budget.distance)continue;
      const tier=item.kind==='snowbank'?'near':item.kind==='pine'&&distance<budget.shadowDistance?'shadow':distance<budget.lodDistance?'near':'far';
      scratch.position.set(item.x,0,item.z);scratch.scale.setScalar(item.scale);scratch.rotation.setFromAxisAngle(scratch.up,item.yaw);
      scratch.matrix.compose(scratch.position,scratch.rotation,scratch.scale);
      batches.forEach((batch,i)=>{
        if(batch.kind!==item.kind||batch.tier!==tier||(batch.variant>=0&&batch.variant!==item.variant))return;
        meshes.current[i]?.setMatrixAt(counts[i]++,scratch.matrix);
      });
    }
    meshes.current.forEach((mesh,i)=>{if(mesh){mesh.count=counts[i];mesh.visible=counts[i]>0;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}});
  };
  useLayoutEffect(()=>{meshes.current.forEach(mesh=>mesh?.instanceMatrix.setUsage(DynamicDrawUsage));update();},[batches,items,camera]);
  useGameFrame(({clock})=>{if(clock.elapsedTime-previous.current<.25)return;previous.current=clock.elapsedTime;update();});
  useEffect(()=>()=>{
    resources.variants.forEach(v=>{v.near.wood.dispose();v.near.needles.dispose();v.far.wood.dispose();v.far.needles.dispose();v.rock.dispose();v.rockFar.dispose();});
    resources.bank.dispose();Object.values(resources.materials).forEach(m=>m.dispose());
  },[resources]);
  return <group name="OptionalWinterScenery" dispose={null}>{batches.map((batch,i)=><instancedMesh key={batch.key}
    ref={mesh=>{meshes.current[i]=mesh;}} args={[batch.geometry,batch.material,items.length]}
    castShadow={batch.shadow} receiveShadow customDepthMaterial={batch.foliage?resources.materials.depth:undefined}
    raycast={()=>{}} />)}</group>;
}
