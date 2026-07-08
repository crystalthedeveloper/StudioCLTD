import { Text } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Mesh, MeshBasicMaterial, Vector3 } from "three";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { DialogueMessage } from "../../ui/DialogueBubble";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { hubSections } from "../hubSections";
import { playerWorldState } from "../playerWorldState";

const padRadius = 1.35;
const cooldownMs = 1800;
const dialoguePadRadius = 6.5;
const dialogueVillainRadius = 9;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const infoPanelDurationMs = 10000;

const serviceInfoText: Record<string, string> = {
  "quick-fix":
    "A button that doesn't work can cost you real customers.\n\nEvery click should lead somewhere-not to frustration.\n\nI help businesses fix website issues so every button, form, and interaction works as expected.",
  "urgent-fix":
    "Website issues can happen at any time.\n\nFast fixes help prevent lost sales, frustrated visitors, and downtime.\n\nNeed it fixed quickly? I can resolve critical website issues fast.",
  performance:
    "A slow website loses visitors before they even become customers.\n\nImproving speed creates a faster, smoother experience while helping SEO and conversions.\n\nSmall performance improvements can make a big difference.",
  "site-improvement":
    "Your website should keep improving over time.\n\nRefreshing content, layout, accessibility, and user experience helps visitors trust your business and take action.\n\nSmall improvements add up.",
};

type SectionEncounterConfig = {
  id: string;
  infoPadPosition: Vector3;
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
      const infoPadPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(7)).add(tangent.clone().multiplyScalar(-3.2));

      villainPosition.y = 0;
      padPosition.y = 0.07;
      infoPadPosition.y = 0.07;

      return {
        id: section.id,
        infoPadPosition,
        name: section.name,
        padPosition,
        villainPosition,
      };
    });
}

const sectionEncounters = createSectionEncounters();

type CombatPrototypeProps = {
  activeSectionName: string | null;
  onPlayerFixedAnimation: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onVillainDialogue: (sectionName: string, text: string) => void;
  villainDialogue: (DialogueMessage & { sectionName: string }) | null;
};

export function CombatPrototype({
  activeSectionName,
  onPlayerFixedAnimation,
  onPlayerDialogue,
  onSectionResolved,
  onVillainDialogue,
  villainDialogue,
}: CombatPrototypeProps) {
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeInfoId) return undefined;

    const timeout = window.setTimeout(() => {
      setActiveInfoId(null);
    }, infoPanelDurationMs);

    return () => window.clearTimeout(timeout);
  }, [activeInfoId]);

  return (
    <group name="SectionPortalEncounters">
      {sectionEncounters.map((encounter) => (
        <SectionPortalEncounter
          key={encounter.id}
          activeSectionName={activeSectionName}
          activeInfoId={activeInfoId}
          encounter={encounter}
          onInfoClose={() => setActiveInfoId(null)}
          onInfoOpen={() => setActiveInfoId(encounter.id)}
          onPlayerFixedAnimation={onPlayerFixedAnimation}
          onPlayerDialogue={onPlayerDialogue}
          onSectionResolved={onSectionResolved}
          onVillainDialogue={onVillainDialogue}
          villainDialogue={villainDialogue}
        />
      ))}
    </group>
  );
}

function SectionPortalEncounter({
  activeSectionName,
  activeInfoId,
  encounter,
  onInfoClose,
  onInfoOpen,
  onPlayerFixedAnimation,
  onPlayerDialogue,
  onSectionResolved,
  onVillainDialogue,
  villainDialogue,
}: {
  activeSectionName: string | null;
  activeInfoId: string | null;
  encounter: SectionEncounterConfig;
  onInfoClose: () => void;
  onInfoOpen: () => void;
  onPlayerFixedAnimation: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onVillainDialogue: (sectionName: string, text: string) => void;
  villainDialogue: (DialogueMessage & { sectionName: string }) | null;
}) {
  const [villainStatus, setVillainStatus] = useState<VillainStatus>("idle");
  const [portalActive, setPortalActive] = useState(false);
  const [infoPortalActive, setInfoPortalActive] = useState(false);
  const [quickFixDialogueVisible, setQuickFixDialogueVisible] = useState(false);
  const lastActivatedRef = useRef(0);
  const lastInfoActivatedRef = useRef(0);
  const wasNearDialogueRef = useRef(false);
  const wasNearQuickFixVillainRef = useRef(false);
  const wasOnPadRef = useRef(false);
  const wasOnInfoPadRef = useRef(false);
  const defeatedRef = useRef(false);

  const activatePad = () => {
    const now = performance.now();
    if (defeatedRef.current) return;
    if (now - lastActivatedRef.current < cooldownMs) return;

    defeatedRef.current = true;
    lastActivatedRef.current = now;
    setPortalActive(true);
    setVillainStatus("dead");
    onPlayerFixedAnimation();
    onPlayerDialogue("FIXED!");
    onSectionResolved(encounter.id);

  };

  const activateInfoPad = () => {
    const now = performance.now();
    if (now - lastInfoActivatedRef.current < 350) return;

    lastInfoActivatedRef.current = now;
    setInfoPortalActive(true);
    onInfoOpen();
  };

  useEffect(() => {
    if (!portalActive) return;

    const timeout = window.setTimeout(() => {
      setPortalActive(false);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [portalActive]);

  useEffect(() => {
    if (!infoPortalActive) return;

    const timeout = window.setTimeout(() => {
      setInfoPortalActive(false);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [infoPortalActive]);

  useFrame(() => {
    const padDistance = Math.hypot(
      playerWorldState.position.x - encounter.padPosition.x,
      playerWorldState.position.z - encounter.padPosition.z
    );
    const infoPadDistance = Math.hypot(
      playerWorldState.position.x - encounter.infoPadPosition.x,
      playerWorldState.position.z - encounter.infoPadPosition.z
    );
    const villainDistance = Math.hypot(
      playerWorldState.position.x - encounter.villainPosition.x,
      playerWorldState.position.z - encounter.villainPosition.z
    );
    const onPad = padDistance <= padRadius && playerWorldState.position.y < 2.3;
    const onInfoPad = infoPadDistance <= padRadius && playerWorldState.position.y < 2.3;
    const nearDialogueArea =
      activeSectionName === encounter.name ||
      padDistance <= dialoguePadRadius ||
      infoPadDistance <= dialoguePadRadius ||
      villainDistance <= dialogueVillainRadius;
    const nearQuickFixVillain =
      encounter.id === "quick-fix" &&
      !defeatedRef.current &&
      villainDistance <= dialogueVillainRadius;

    if (onPad && !wasOnPadRef.current) {
      activatePad();
    }

    if (onInfoPad && !wasOnInfoPadRef.current) {
      activateInfoPad();
    }

    if (!onInfoPad && wasOnInfoPadRef.current && activeInfoId === encounter.id) {
      onInfoClose();
    }

    if (encounter.id === "quick-fix" && nearQuickFixVillain !== wasNearQuickFixVillainRef.current) {
      setQuickFixDialogueVisible(nearQuickFixVillain);
    }

    if (encounter.id !== "quick-fix" && !defeatedRef.current && nearDialogueArea && !wasNearDialogueRef.current) {
      onVillainDialogue(
        encounter.name,
        "No leads today."
      );
    }

    wasNearDialogueRef.current = nearDialogueArea;
    wasNearQuickFixVillainRef.current = nearQuickFixVillain;
    wasOnPadRef.current = onPad;
    wasOnInfoPadRef.current = onInfoPad;
  });

  return (
    <group name={`PortalEncounter:${encounter.id}`}>
      <TriggerPad label="Fix" position={encounter.padPosition} active={portalActive} onActivate={activatePad} />
      <TriggerPad label="More Info" position={encounter.infoPadPosition} active={infoPortalActive || activeInfoId === encounter.id} onActivate={activateInfoPad} />
      {activeInfoId === encounter.id && (
        <ServiceInfoPanel
          text={serviceInfoText[encounter.id]}
          title={encounter.name}
          position={encounter.infoPadPosition}
        />
      )}
      <VillainCharacter
        basePosition={encounter.villainPosition}
        dialogue={
          villainStatus === "dead"
            ? null
            : encounter.id === "quick-fix" && quickFixDialogueVisible
              ? { id: 1, text: "😈 Broken Button!" }
              : villainDialogue?.sectionName === encounter.name
                ? villainDialogue
                : null
        }
        villainStatus={villainStatus}
      />
    </group>
  );
}

type TriggerPadProps = {
  active: boolean;
  label?: string;
  onActivate: () => void;
  position: Vector3;
};

export function TriggerPad({ active, label, onActivate, position }: TriggerPadProps) {
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
      {label && (
        <BillboardLabel
          color="#ffffff"
          fontSize={label === "More Info" ? 0.24 : 0.28}
          position={[0, 1.02, 0]}
          maxWidth={2.5}
        >
          {label}
        </BillboardLabel>
      )}
      <pointLight color="#ffffff" intensity={active ? 3.2 : 0.8} distance={active ? 6 : 3.5} position={[0, 0.8, 0]} />
    </group>
  );
}

function ServiceInfoPanel({
  position,
  text,
  title,
}: {
  position: Vector3;
  text: string;
  title: string;
}) {
  return (
    <group position={[position.x, 3.1, position.z]} rotation-y={Math.atan2(position.x, position.z) + Math.PI}>
      <mesh position={[0, 0, -0.07]}>
        <planeGeometry args={[7.05, 4.25]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.94} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.08, -0.06]}>
        <planeGeometry args={[6.35, 3.25]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.72} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.55, -0.05]}>
        <planeGeometry args={[6.8, 0.95]} />
        <meshBasicMaterial color="#05070b" transparent opacity={0.54} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.45, -0.05]}>
        <planeGeometry args={[6.8, 0.95]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.16, -0.04]}>
        <boxGeometry args={[7.08, 0.035, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} toneMapped={false} />
      </mesh>
      <mesh position={[0, -2.16, -0.04]}>
        <boxGeometry args={[7.08, 0.035, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} toneMapped={false} />
      </mesh>
      <mesh position={[-3.54, 0, -0.04]}>
        <boxGeometry args={[0.035, 4.25, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <mesh position={[3.54, 0, -0.04]}>
        <boxGeometry args={[0.035, 4.25, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <Text color="#ffffff" fontSize={0.3} anchorX="center" anchorY="middle" position={[0, 1.45, 0]} maxWidth={5.75}>
        {title}
      </Text>
      <Text color="#ffffff" fontSize={0.17} anchorX="center" anchorY="middle" position={[0, -0.25, 0]} maxWidth={5.55} lineHeight={1.35}>
        {text}
      </Text>
    </group>
  );
}
