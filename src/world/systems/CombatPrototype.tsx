import { Text } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { DialogueMessage } from "../../ui/DialogueBubble";
import { gameTextFont } from "../../ui/textFont";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { hubSections } from "../hubSections";
import { playerWorldState } from "../playerWorldState";

const cooldownMs = 1800;
const triggerPadHalfExtent = 2.1;
const dialoguePadRadius = 6.5;
const dialogueVillainRadius = 9;
const dialoguePadRadiusSq = dialoguePadRadius * dialoguePadRadius;
const dialogueVillainRadiusSq = dialogueVillainRadius * dialogueVillainRadius;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const infoPanelDurationMs = 10000;
const smokeDurationMs = 1700;
const villainFrontOffset = 6.5;
const villainSideOffset = 5;
const fixPadFrontOffset = 11;
const infoPadFrontOffset = 8.5;
const infoPadSideOffset = -5;

const serviceInfoText: Record<string, string> = {
  "quick-fix":
    "A button that doesn't work can cost you real customers.\n\nEvery click should lead somewhere-not to frustration.\n\nI help businesses fix website issues so every button, form, and interaction works as expected.",
  "urgent-fix":
    "Broken images can make your website look untrustworthy fast.\n\nWhen key visuals do not load, visitors may leave before they understand your business.\n\nI help fix urgent website issues quickly so your site looks reliable again.",
  performance:
    "A slow website can cost you visitors before they even contact you.\n\nImproving performance helps pages load faster, feel smoother, and support better SEO.\n\nI help optimize websites so users get a faster, cleaner experience.",
  "site-improvement":
    "A broken slider can make your website feel unfinished.\n\nVisitors should be able to browse your content without glitches or frustration.\n\nI help improve website layouts, interactions, and user experience so your site feels polished and professional.",
};

const villainDialogueText: Record<string, string> = {
  "quick-fix": "😈 Broken Button!",
  "urgent-fix": "😈 Broken Images!",
  performance: "😈 Poor PageSpeed",
  "site-improvement": "😈 Broken Slider",
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
      const villainPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(villainFrontOffset)).add(tangent.clone().multiplyScalar(villainSideOffset));
      const padPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(fixPadFrontOffset));
      const infoPadPosition = sectionPosition.clone().add(towardCenter.clone().multiplyScalar(infoPadFrontOffset)).add(tangent.clone().multiplyScalar(infoPadSideOffset));

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
  onPlayerFixedAnimation: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onVillainDialogue: (sectionName: string, text: string) => void;
  restartKey: number;
  villainDialogue: (DialogueMessage & { sectionName: string }) | null;
};

export function CombatPrototype({
  onPlayerFixedAnimation,
  onPlayerDialogue,
  onSectionResolved,
  onVillainDialogue,
  restartKey,
  villainDialogue,
}: CombatPrototypeProps) {
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [visibleEncounterCount, setVisibleEncounterCount] = useState(1);

  useEffect(() => {
    if (!activeInfoId) return undefined;

    const timeout = window.setTimeout(() => {
      setActiveInfoId(null);
    }, infoPanelDurationMs);

    return () => window.clearTimeout(timeout);
  }, [activeInfoId]);

  useEffect(() => {
    setActiveInfoId(null);
    setVisibleEncounterCount(1);
  }, [restartKey]);

  useEffect(() => {
    if (visibleEncounterCount >= sectionEncounters.length) return undefined;

    const timeout = window.setTimeout(() => {
      setVisibleEncounterCount((current) => Math.min(sectionEncounters.length, current + 1));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [visibleEncounterCount]);

  return (
    <group name="SectionPortalEncounters">
      {sectionEncounters.slice(0, visibleEncounterCount).map((encounter) => (
        <SectionPortalEncounter
          key={`${encounter.id}:${restartKey}`}
          activeInfoId={activeInfoId}
          encounter={encounter}
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
  activeInfoId,
  encounter,
  onInfoOpen,
  onPlayerFixedAnimation,
  onPlayerDialogue,
  onSectionResolved,
  onVillainDialogue,
  villainDialogue,
}: {
  activeInfoId: string | null;
  encounter: SectionEncounterConfig;
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
  const [smokeActive, setSmokeActive] = useState(false);
  const [villainVisible, setVillainVisible] = useState(true);
  const [villainBubbleVisible, setVillainBubbleVisible] = useState(false);
  const lastActivatedRef = useRef(0);
  const lastInfoActivatedRef = useRef(0);
  const wasNearDialogueRef = useRef(false);
  const wasNearVillainRef = useRef(false);
  const villainBubbleVisibleRef = useRef(false);
  const villainBubbleUpdateTimerRef = useRef(0);
  const villainDialogueTimerRef = useRef(0);
  const sectionResolvedTimerRef = useRef(0);
  const defeatedRef = useRef(false);

  const setVillainBubbleVisibilitySoon = (visible: boolean) => {
    window.clearTimeout(villainBubbleUpdateTimerRef.current);
    villainBubbleUpdateTimerRef.current = window.setTimeout(() => {
      villainBubbleVisibleRef.current = visible;
      setVillainBubbleVisible(visible);
    }, 0);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(villainBubbleUpdateTimerRef.current);
      window.clearTimeout(villainDialogueTimerRef.current);
      window.clearTimeout(sectionResolvedTimerRef.current);
    };
  }, []);

  const activatePad = () => {
    const now = performance.now();
    if (defeatedRef.current) return;
    if (now - lastActivatedRef.current < cooldownMs) return;

    defeatedRef.current = true;
    lastActivatedRef.current = now;
    window.clearTimeout(villainBubbleUpdateTimerRef.current);
    window.clearTimeout(villainDialogueTimerRef.current);
    setPortalActive(true);
    setSmokeActive(true);
    setVillainBubbleVisible(false);
    setVillainStatus("dead");
    onPlayerFixedAnimation();
    onPlayerDialogue("FIXED!");
    sectionResolvedTimerRef.current = window.setTimeout(() => {
      onSectionResolved(encounter.id);
    }, 240);
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
    if (!smokeActive) return;

    const timeout = window.setTimeout(() => {
      setSmokeActive(false);
      setVillainVisible(false);
    }, smokeDurationMs);

    return () => window.clearTimeout(timeout);
  }, [smokeActive]);

  useEffect(() => {
    if (!infoPortalActive) return;

    const timeout = window.setTimeout(() => {
      setInfoPortalActive(false);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [infoPortalActive]);

  useFrame(() => {
    const padDeltaX = playerWorldState.position.x - encounter.padPosition.x;
    const padDeltaZ = playerWorldState.position.z - encounter.padPosition.z;
    const padDistanceSq = padDeltaX * padDeltaX + padDeltaZ * padDeltaZ;
    const infoPadDeltaX = playerWorldState.position.x - encounter.infoPadPosition.x;
    const infoPadDeltaZ = playerWorldState.position.z - encounter.infoPadPosition.z;
    const infoPadDistanceSq = infoPadDeltaX * infoPadDeltaX + infoPadDeltaZ * infoPadDeltaZ;
    const villainDeltaX = playerWorldState.position.x - encounter.villainPosition.x;
    const villainDeltaZ = playerWorldState.position.z - encounter.villainPosition.z;
    const villainDistanceSq = villainDeltaX * villainDeltaX + villainDeltaZ * villainDeltaZ;
    const nearDialogueArea =
      padDistanceSq <= dialoguePadRadiusSq ||
      infoPadDistanceSq <= dialoguePadRadiusSq ||
      villainDistanceSq <= dialogueVillainRadiusSq;
    const nearVillain = !defeatedRef.current && villainDistanceSq <= dialogueVillainRadiusSq;

    if (nearVillain !== wasNearVillainRef.current) {
      setVillainBubbleVisibilitySoon(nearVillain);
    }

    if (!defeatedRef.current && encounter.id !== "quick-fix" && nearDialogueArea && !wasNearDialogueRef.current) {
      window.clearTimeout(villainDialogueTimerRef.current);
      villainDialogueTimerRef.current = window.setTimeout(() => {
        onVillainDialogue(encounter.name, villainDialogueText[encounter.id]);
      }, 0);
    }

    wasNearDialogueRef.current = nearDialogueArea;
    wasNearVillainRef.current = nearVillain;
  });

  const villainCharacterDialogue =
    villainStatus === "dead"
      ? null
      : villainBubbleVisible
        ? { id: 1, text: villainDialogueText[encounter.id] }
        : villainDialogue?.sectionName === encounter.name
          ? villainDialogue
          : null;

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
      {smokeActive && <SmokeDeathEffect position={encounter.villainPosition} />}
      {villainVisible && (
        <VillainCharacter
          basePosition={encounter.villainPosition}
          dialogue={villainCharacterDialogue}
          villainStatus={villainStatus}
        />
      )}
    </group>
  );
}

function SmokeDeathEffect({ position }: { position: Vector3 }) {
  const groupRef = useRef<Group>(null);
  const startedAtRef = useRef(0);
  const lastSmokeFrameRef = useRef(-1);
  const smokeGeometry = useMemo(() => new SphereGeometry(1, 8, 8), []);
  const smokeMaterials = useMemo(
    () =>
      Array.from(
        { length: 8 },
        (_, index) =>
          new MeshBasicMaterial({
            color: index % 3 === 0 ? "#5a0710" : "#070406",
            depthWrite: false,
            opacity: 0.28,
            toneMapped: false,
            transparent: true,
          })
      ),
    []
  );
  const particles = useRef(
    Array.from({ length: 8 }, (_, index) => ({
      angle: (index / 8) * Math.PI * 2,
      delay: (index % 5) * 0.08,
      radius: 0.22 + (index % 4) * 0.13,
      rise: 1.15 + (index % 5) * 0.18,
      scale: 0.34 + (index % 4) * 0.08,
      speed: 0.65 + (index % 3) * 0.12,
    }))
  );

  useFrame(({ clock }) => {
    const frameSlot = Math.floor(clock.elapsedTime * 20);
    if (frameSlot === lastSmokeFrameRef.current) return;
    lastSmokeFrameRef.current = frameSlot;

    const group = groupRef.current;
    if (!group) return;

    if (startedAtRef.current === 0) startedAtRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const progress = Math.min(elapsed / (smokeDurationMs / 1000), 1);
    const fade = 1 - progress;

    group.children.forEach((child, index) => {
      const particle = particles.current[index];
      if (!particle) return;

      const localProgress = Math.max(0, Math.min((elapsed - particle.delay) / 1.35, 1));
      const driftAngle = particle.angle + elapsed * particle.speed;
      child.position.set(
        Math.cos(driftAngle) * particle.radius * (1 + localProgress * 0.85),
        0.55 + localProgress * particle.rise,
        Math.sin(driftAngle) * particle.radius * (1 + localProgress * 0.85)
      );
      child.scale.setScalar(particle.scale * (1 + localProgress * 1.4));

      const material = smokeMaterials[index];
      if (material) material.opacity = Math.max(0, fade * (0.34 - localProgress * 0.12));
    });
  });

  return (
    <group ref={groupRef} name="VillainSmokeDeathEffect" position={[position.x, position.y, position.z]}>
      {particles.current.map((particle, index) => (
        <mesh
          key={index}
          geometry={smokeGeometry}
          material={smokeMaterials[index]}
          position={[0, 0.6, 0]}
          scale={particle.scale}
        />
      ))}
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
    if (!active && !wasActiveRef.current) return;

    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const pulse = 1 + activationGlow * 0.05;
    const glow = 0.54 + activationGlow * 0.32;
    wasActiveRef.current = active;

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
        args={[triggerPadHalfExtent, 0.28, triggerPadHalfExtent]}
        position={[0, 0.45, 0]}
        onIntersectionEnter={onActivate}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
        <torusGeometry args={[1.3, 0.03, 8, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.54} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[0.86, 1.32, 64]} />
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
      <Text color="#ffffff" font={gameTextFont} fontSize={0.3} anchorX="center" anchorY="middle" position={[0, 1.45, 0]} maxWidth={5.75}>
        {title}
      </Text>
      <Text color="#ffffff" font={gameTextFont} fontSize={0.17} anchorX="center" anchorY="middle" position={[0, -0.25, 0]} maxWidth={5.55} lineHeight={1.35}>
        {text}
      </Text>
    </group>
  );
}
