import { useGLTF } from "@react-three/drei";
import { MutableRefObject, useMemo, useRef, useSyncExternalStore } from "react";
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { PlayerRollingEffects } from "./PlayerRollingEffects";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { playerSphereRadius as sphereRadius } from "./playerDimensions";
import { CharacterAnimationState } from "./playerTypes";
import { getActivePower, getActivePowers, powerModes, subscribePowers } from "./temporaryPowers";
import { useGameFrame } from "./useGameFrame";
import { playerWorldState } from "../world/playerWorldState";
import { useKeyboardControls } from "./useKeyboardControls";

type PlayerCharacterProps = { animationStateRef: MutableRefObject<CharacterAnimationState>; damageFlashUntil: number; dialogue: DialogueMessage | null; yawRef: MutableRefObject<number> };

export function PlayerCharacter({ dialogue, yawRef }: PlayerCharacterProps) {
  const groundAnchor = useRef<Group>(null);
  const carRef = useRef<Group>(null);
  const wheelRefs = useRef<Mesh[]>([]);
  const controls = useKeyboardControls();
  const model = useGLTF("/characters/sports-car.glb");
  useSyncExternalStore(subscribePowers, () => getActivePowers().join(","), () => "");
  const active = getActivePowers();
  const primary = getActivePower();
  const body = useMemo(() => {
    const clone = model.scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      if (object.material instanceof MeshStandardMaterial) object.material = object.material.clone();
    });
    const raw = new Box3().setFromObject(clone);
    const size = raw.getSize(new Vector3());
    clone.scale.setScalar(2.55 / Math.max(size.x, size.z));
    const scaled = new Box3().setFromObject(clone);
    // Keep the measured tire contact just above the road surface; the Rapier
    // body remains the handling reference and is not moved.
    clone.position.y = -sphereRadius - scaled.min.y + 0.12;
    clone.rotation.y = Math.PI;
    const namedWheels: Mesh[] = [];
    const meshes: Mesh[] = [];
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes.push(object);
      if (/wheel|tire|tyre/i.test(object.name)) namedWheels.push(object);
    });
    if (namedWheels.length >= 4) {
      wheelRefs.current = namedWheels.slice(0, 4);
    } else {
      const candidates = meshes.map((mesh) => {
        const bounds = new Box3().setFromObject(mesh);
        const center = bounds.getCenter(new Vector3());
        const size = bounds.getSize(new Vector3());
        return { mesh, center, size };
      }).filter(({ center, size }) => Math.abs(center.x) > 0.18 && size.y < Math.max(size.x, size.z) * 0.9)
        .sort((a, b) => a.center.z - b.center.z || a.center.x - b.center.x);
      wheelRefs.current = candidates.slice(0, 4).map(({ mesh }) => mesh);
    }
    return clone;
  }, [model.scene]);
  const previousPosition = useRef(new Vector3());
  useGameFrame((_, delta) => {
    if (!carRef.current) return;
    carRef.current.rotation.y = yawRef.current;
    carRef.current.rotation.z *= Math.exp(-delta * 8);
    const distance = playerWorldState.position.distanceTo(previousPosition.current);
    const direction = controls.backward ? -1 : 1;
    const wheelTurn = (Number(controls.left) - Number(controls.right)) * 0.42;
    wheelRefs.current.forEach((wheel, index) => {
      wheel.rotation.x -= direction * distance / 0.22;
      if (index < 2) wheel.rotation.y += (wheelTurn - wheel.rotation.y) * Math.min(1, delta * 10);
    });
    previousPosition.current.copy(playerWorldState.position);
  });
  body.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    const protectedPart = /wheel|tire|tyre|rim|window|glass|head|light|interior/i.test(object.name);
    if (protectedPart) return;
    object.material.color.set(primary ? powerModes[primary].color : "#101318");
    object.material.emissive.set(primary ? powerModes[primary].color : "#000000");
    object.material.emissiveIntensity = primary ? 0.16 : 0;
  });
  return <group>
    <group ref={groundAnchor} name="Player ground-effect anchor" />
    <PlayerRollingEffects sphere={groundAnchor} />
    <group ref={carRef} name="Player old BMW i8 visual"><primitive object={body} />
      {([-0.68, 0.68] as const).flatMap((x) => [-1.02, 1.02].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, -sphereRadius + 0.012, z]} rotation-x={-Math.PI / 2} scale={[0.32, 0.58, 1]} renderOrder={-1}>
          <planeGeometry args={[1, 1]} /><meshBasicMaterial color="#101722" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )))}
      {active.filter((mode) => mode !== primary).map((mode) => <mesh key={mode} position={[0, -sphereRadius + 0.025, 0]} rotation-x={-Math.PI / 2} scale={[1.15, 1.9, 1]} renderOrder={-1}><planeGeometry args={[1, 1]} /><meshBasicMaterial color={powerModes[mode].color} transparent opacity={0.16} depthWrite={false} /></mesh>)}
    </group>
    <DialogueBubble message={dialogue} position={[0, 2.65 - sphereRadius, 0]} />
  </group>;
}

useGLTF.preload("/characters/sports-car.glb");
