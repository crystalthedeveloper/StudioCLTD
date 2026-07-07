import { CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Mesh, Vector3 } from "three";
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
  const [portalId, setPortalId] = useState(0);
  const [villainStatus, setVillainStatus] = useState<VillainStatus>("idle");
  const [portalActive, setPortalActive] = useState(false);
  const lastActivatedRef = useRef(0);
  const wasOnPadRef = useRef(false);

  const activatePad = () => {
    const now = performance.now();
    if (now - lastActivatedRef.current < cooldownMs) return;

    lastActivatedRef.current = now;
    setPortalId((current) => current + 1);
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
    }, 760);

    return () => window.clearTimeout(timeout);
  }, [portalActive, portalId]);

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
      <PortalActivationEffect activationId={portalId} position={encounter.padPosition} />
      <VillainCharacter
        allowPatrol={false}
        basePosition={encounter.villainPosition}
        setVillainStatus={setVillainStatus}
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

  useFrame(({ clock }) => {
    const pulse = active ? 1 + Math.sin(clock.elapsedTime * 9) * 0.045 : 1;
    const glow = active ? 0.86 + Math.sin(clock.elapsedTime * 12) * 0.12 : 0.48;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      const material = ringRef.current.material;
      if (material && !Array.isArray(material) && "opacity" in material) {
        material.opacity = glow;
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active;
      pulseRef.current.scale.setScalar(active ? 1.2 + Math.sin(clock.elapsedTime * 10) * 0.08 : 1);
      const material = pulseRef.current.material;
      if (material && !Array.isArray(material) && "opacity" in material) {
        material.opacity = active ? 0.22 : 0;
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
        <meshBasicMaterial color={active ? "#ffe58a" : "#f4f4f4"} transparent opacity={active ? 0.9 : 0.48} depthWrite={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[0.72, 1.1, 128]} />
        <meshBasicMaterial color="#ffd35c" transparent opacity={0} depthWrite={false} />
      </mesh>
      <pointLight color="#ffd35c" intensity={active ? 8 : 1.5} distance={active ? 8 : 3.5} position={[0, 0.8, 0]} />
    </group>
  );
}

type PortalActivationEffectProps = {
  activationId: number;
  position: Vector3;
};

export function PortalActivationEffect({ activationId, position }: PortalActivationEffectProps) {
  const rippleRef = useRef<Mesh>(null);
  const flashRef = useRef<Mesh>(null);
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef(0);
  const lastActivationRef = useRef(0);

  useFrame(() => {
    if (activationId !== lastActivationRef.current) {
      lastActivationRef.current = activationId;
      startedAtRef.current = performance.now();
      setVisible(true);
    }

    if (!visible || !rippleRef.current || !flashRef.current) return;

    const elapsed = performance.now() - startedAtRef.current;
    const progress = MathUtils.clamp(elapsed / 640, 0, 1);
    const fade = 1 - progress;

    rippleRef.current.scale.setScalar(0.55 + progress * 1.95);
    flashRef.current.scale.setScalar(0.7 + Math.sin(progress * Math.PI) * 0.32);

    const rippleMaterial = rippleRef.current.material;
    if (rippleMaterial && !Array.isArray(rippleMaterial) && "opacity" in rippleMaterial) {
      rippleMaterial.opacity = fade * 0.34;
    }

    const flashMaterial = flashRef.current.material;
    if (flashMaterial && !Array.isArray(flashMaterial) && "opacity" in flashMaterial) {
      flashMaterial.opacity = fade * 0.28;
    }

    if (elapsed > 680) {
      setVisible(false);
    }
  });

  if (activationId === 0 || !visible) return null;

  return (
    <group position={position}>
      <mesh ref={rippleRef} position={[0, 0.075, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.5, 1.65, 96]} />
        <meshBasicMaterial color="#ffdc74" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <mesh ref={flashRef} position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.12, 96]} />
        <meshBasicMaterial color="#ffd35c" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}
