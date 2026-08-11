import { CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, Object3D, RingGeometry, Vector3 } from "three";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { hubSections } from "../hubSections";
import { InteractiveMeshOutline } from "../InteractiveOutline";
import { padVisualStyle } from "../padVisualStyle";
import { triggerPopupLayout } from "../triggerPopupLayout";

const transportCooldownMs = 1200;
const arrivalDistanceFromSection = 16;
const transportSectionIds = [
  "tips",
  "offers",
  "value",
  "quick-fix",
  "performance",
  "site-improvement",
  "urgent-fix",
  "showcase",
] as const;
const transportSections = transportSectionIds.map((sectionId) => {
  const section = hubSections.find(({ id }) => id === sectionId);
  if (!section) throw new Error(`Missing transport section: ${sectionId}`);
  return section;
});
export const transportPadPositions = [
  [-3, -8],
  [0, -4],
  [3, -8],
  [-3, 0],
  [3, 0],
  [0, 4],
  [-3, 8],
  [3, 8],
] as const;

export type TransportDestination = {
  id: number;
  position: [number, number, number];
  yaw: number;
};

type TransportPadsProps = {
  onTransport: (destination: TransportDestination) => void;
  restartKey: number;
};

function isPlayerObject(object?: Object3D) {
  let current: Object3D | null | undefined = object;
  while (current) {
    if (current.name === "StudioCLTDPlayer") return true;
    current = current.parent;
  }
  return false;
}

export function TransportPads({ onTransport, restartKey }: TransportPadsProps) {
  const lastTransportAtRef = useRef(-Infinity);
  const transportIdRef = useRef(0);
  const resources = useMemo(() => {
    const geometry = new RingGeometry(0.65, 0.8, 40);
    const material = new MeshStandardMaterial({
      color: padVisualStyle.color,
      emissive: padVisualStyle.color,
      emissiveIntensity: padVisualStyle.emissiveIntensity,
      metalness: 0.05,
      roughness: 0.42,
      toneMapped: false,
    });
    return { geometry, material };
  }, []);

  useEffect(() => {
    lastTransportAtRef.current = -Infinity;
  }, [restartKey]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  const transport = (section: (typeof hubSections)[number], event: IntersectionEnterPayload) => {
    if (!isPlayerObject(event.other.rigidBodyObject) && !isPlayerObject(event.other.colliderObject)) return;

    const now = performance.now();
    if (now - lastTransportAtRef.current < transportCooldownMs) return;
    lastTransportAtRef.current = now;

    const sectionPosition = new Vector3(...section.position);
    const towardEntrance = new Vector3(section.entrance[0], 0, section.entrance[1]);
    const arrival = sectionPosition.clone().addScaledVector(towardEntrance, arrivalDistanceFromSection);
    const towardSection = sectionPosition.clone().sub(arrival).normalize();
    transportIdRef.current += 1;

    onTransport({
      id: transportIdRef.current,
      position: [arrival.x, section.position[1] + 2.2, arrival.z],
      yaw: Math.atan2(-towardSection.x, -towardSection.z),
    });
  };

  return (
    <group name="PlazaTransportHub">
      {transportSections.map((section, index) => (
        <TransportPad
          key={section.id}
          geometry={resources.geometry}
          label={section.name}
          material={resources.material}
          onEnter={(event) => transport(section, event)}
          position={transportPadPositions[index]}
        />
      ))}
    </group>
  );
}

function TransportPad({
  geometry,
  label,
  material,
  onEnter,
  position,
}: {
  geometry: RingGeometry;
  label: string;
  material: MeshStandardMaterial;
  onEnter: (event: IntersectionEnterPayload) => void;
  position: readonly [number, number];
}) {
  const playerInsideRef = useRef(false);

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (playerInsideRef.current) return;
    if (!isPlayerObject(event.other.rigidBodyObject) && !isPlayerObject(event.other.colliderObject)) return;
    playerInsideRef.current = true;
    onEnter(event);
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerObject(event.other.rigidBodyObject) && !isPlayerObject(event.other.colliderObject)) return;
    playerInsideRef.current = false;
  };

  return (
    <RigidBody type="fixed" colliders={false} position={[position[0], 0.04, position[1]]} name={`TransportPad:${label}`}>
      <CylinderCollider
        sensor
        args={[0.28, 0.82]}
        position={[0, 0.32, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh geometry={geometry} material={material} rotation-x={-Math.PI / 2}>
        <InteractiveMeshOutline />
      </mesh>
      <BillboardLabel
        color={padVisualStyle.color}
        fontSize={label === "Site Improvement" ? 0.2 : 0.24}
        position={[0, triggerPopupLayout.labelHeight, 0]}
        maxWidth={3}
      >
        {label}
      </BillboardLabel>
    </RigidBody>
  );
}
