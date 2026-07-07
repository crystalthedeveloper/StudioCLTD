import { CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Mesh, MeshBasicMaterial, Vector3 } from "three";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { hubSections } from "../hubSections";
import { playerWorldState } from "../playerWorldState";

const padRadius = 1.35;
const cooldownMs = 1800;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];

type SectionEncounterConfig = {
  id: string;
  name: string;
  padPosition: Vector3;
  villainPosition: Vector3;
};

function createSectionEncounters(): SectionEncounterConfig[] {
  return hubSections
    .filter((section) => encounterSectionIds.includes(section.id))
    .map((section) => {
      const sectionPosition = new Vector3(...section.position);
      const towardCenter = new Vector3(-sectionPosition.x, 0, -sectionPosition.z).normalize();
      const tangent = new Vector3(-towardCenter.z, 0, towardCenter.x);
      const sideOffset = section.id === "urgent-fix" ? -4 : 4;
      const villainPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(9)).add(tangent.clone().multiplyScalar(sideOffset));
      const padPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(14)).add(tangent.clone().multiplyScalar(sideOffset));

      villainPosition.y = 0;
      padPosition.y = 0.07;

      return {
        id: section.id,
        name: section.name,
        padPosition,
        villainPosition,
      };
    });
}

const sectionEncounters = createSectionEncounters();

export function CombatPrototype() {
  return (
    <group name="SectionPortalEncounters">
      {sectionEncounters.map((encounter) => (
        <SectionPortalEncounter key={encounter.id} encounter={encounter} />
      ))}
    </group>
  );
}

function SectionPortalEncounter({ encounter }: { encounter: SectionEncounterConfig }) {
  const [villainStatus, setVillainStatus] = useState<VillainStatus>("idle");
  const [portalActive, setPortalActive] = useState(false);
  const lastActivatedRef = useRef(0);
  const wasOnPadRef = useRef(false);

  const activatePad = () => {
    const now = performance.now();
    if (now - lastActivatedRef.current < cooldownMs) return;

    lastActivatedRef.current = now;
    setPortalActive(true);
    setVillainStatus("dead");
    console.log("[StudioCLTD portal] Trigger pad activated", {
      section: encounter.name,
      pad: encounter.padPosition.toArray(),
      villainStatus: "dead",
    });
  };

  useEffect(() => {
    if (!portalActive) return;

    const timeout = window.setTimeout(() => {
      setPortalActive(false);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [portalActive]);

  useFrame(() => {
    const distance = Math.hypot(
      playerWorldState.position.x - encounter.padPosition.x,
      playerWorldState.position.z - encounter.padPosition.z
    );
    const onPad = distance <= padRadius && playerWorldState.position.y < 2.3;

    if (onPad && !wasOnPadRef.current) {
      activatePad();
    }

    wasOnPadRef.current = onPad;
  });

  return (
    <group name={`PortalEncounter:${encounter.id}`}>
      <TriggerPad position={encounter.padPosition} active={portalActive} onActivate={activatePad} />
      <VillainCharacter
        basePosition={encounter.villainPosition}
        villainStatus={villainStatus}
      />
    </group>
  );
}

type TriggerPadProps = {
  active: boolean;
  onActivate: () => void;
  position: Vector3;
};

export function TriggerPad({ active, onActivate, position }: TriggerPadProps) {
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const activeStartedAtRef = useRef(0);
  const wasActiveRef = useRef(active);

  useFrame(({ clock }) => {
    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }
    wasActiveRef.current = active;

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const pulse = 1 + activationGlow * 0.05;
    const glow = 0.54 + activationGlow * 0.32;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      const material = ringRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.color.set("#ffffff");
        material.opacity = glow;
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active || activationGlow > 0;
      pulseRef.current.scale.setScalar(1.05 + activationGlow * 0.2);
      const material = pulseRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.color.set("#ffffff");
        material.opacity = activationGlow * 0.17;
      }
    }
  });

  return (
    <group position={position}>
      <CuboidCollider
        sensor
        args={[1.25, 0.28, 1.25]}
        position={[0, 0.45, 0]}
        onIntersectionEnter={onActivate}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
        <torusGeometry args={[1.08, 0.028, 10, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.54} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[0.72, 1.1, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight color="#ffffff" intensity={active ? 3.2 : 0.8} distance={active ? 6 : 3.5} position={[0, 0.8, 0]} />
    </group>
  );
}
