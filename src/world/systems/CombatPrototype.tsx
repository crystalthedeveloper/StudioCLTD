import { Text } from "@react-three/drei";
import { CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, Group, InstancedMesh, MeshBasicMaterial, Object3D, PointLight, SphereGeometry, Vector3 } from "three";
import {
  hasVillainVoice,
  playVillainDefeatSound,
  playVillainVoice,
  preloadVillainAudio,
  stopAllVillainAudio,
  stopVillainVoice,
} from "../../audio/villainAudio";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { DialogueMessage } from "../../ui/DialogueBubble";
import { triggerFixHaptic } from "../../ui/haptics";
import { gameTextFont } from "../../ui/textFont";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { destinationPlatformRadius, hubSections } from "../hubSections";
import { isPlayerObject } from "../playerCollision";
import { playerWorldState } from "../playerWorldState";
import { padVisualStyle } from "../padVisualStyle";
import { triggerPopupLayout } from "../triggerPopupLayout";
import { fixPulseGeometry, fixRingGeometry, useTriggerPadVisuals } from "../useTriggerPadVisuals";

const cooldownMs = 1800;
const triggerPadRadius = 1.33;
const padActivationCooldownMs = 900;
const dialoguePadRadius = 6.5;
const dialogueVillainRadius = 9;
const dialoguePadRadiusSq = dialoguePadRadius * dialoguePadRadius;
const dialogueVillainRadiusSq = dialogueVillainRadius * dialogueVillainRadius;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const infoPanelDurationMs = 10000;
const smokeDurationMs = 1700;
const villainFrontOffset = 2.8;
const villainSideOffset = 5.1;
const triggerPadFrontOffset = 5.8;
const triggerPadSideOffset = 3.6;

const serviceInfoText: Record<string, string> = {
  "quick-fix":
    "A button that doesn't work can cost you real customers.\n\nEvery click should lead somewhere-not to frustration.\n\nI help businesses fix website issues so every button, form, and interaction works as expected.",
  "urgent-fix":
    "A website that's down can cost you customers fast.\n\nWhen your website isn't available, visitors leave and opportunities are lost.\n\nI fix urgent website issues quickly to get your site back online.",
  performance:
    "A slow website can cost you visitors before they even contact you.\n\nImproving performance helps pages load faster, feel smoother, and support better SEO.\n\nI help optimize websites so users get a faster, cleaner experience.",
  "site-improvement": "Contact forms should just work.\n\nFailed submissions and missing emails can cost you customers.\n\nI fix forms so every message gets delivered.",
};

const villainDialogueText: Record<string, string> = {
  "quick-fix": "😈 Broken Button!",
  "urgent-fix": "👿 Not secure!",
  performance: "😈 Poor PageSpeed",
  "site-improvement": "😈 Form Broken",
};

const smokeGeometry = new SphereGeometry(1, 8, 8);
const fireGeometry = new SphereGeometry(1, 8, 6);
const fireDurationSeconds = 0.8;
const fireExpansionSeconds = 0.4;
const fixPadVisualConfig = {
  pulseBaseScale: 1.05,
  pulseScaleAmount: 0.2,
  ringColor: padVisualStyle.color,
  ringOpacity: (_active: boolean, activationGlow: number) => 0.54 + activationGlow * 0.32,
  pulseOpacity: (_active: boolean, activationGlow: number) => activationGlow * 0.17,
};

type SectionEncounterConfig = {
  id: string;
  infoPadPosition: Vector3;
  name: string;
  padPosition: Vector3;
  platformPosition: Vector3;
  villainPosition: Vector3;
};

function createSectionEncounters(): SectionEncounterConfig[] {
  return hubSections
    .filter((section) => encounterSectionIds.includes(section.id))
    .map((section) => {
      const sectionPosition = new Vector3(...section.position);
      const towardEntrance = new Vector3(section.entrance[0], 0, section.entrance[1]);
      const tangent = new Vector3(-towardEntrance.z, 0, towardEntrance.x);
      const villainPosition = sectionPosition.clone().add(towardEntrance.clone().multiplyScalar(villainFrontOffset)).add(tangent.clone().multiplyScalar(villainSideOffset));
      const padPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(triggerPadSideOffset));
      const infoPadPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(-triggerPadSideOffset));

      villainPosition.y = section.position[1];
      padPosition.y = section.position[1] + 0.07;
      infoPadPosition.y = section.position[1] + 0.07;

      return {
        id: section.id,
        infoPadPosition,
        name: section.name,
        padPosition,
        platformPosition: sectionPosition,
        villainPosition,
      };
    });
}

const sectionEncounters = createSectionEncounters();

type CombatPrototypeProps = {
  onPlayerFixedAnimation: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onSectionTrigger: (sectionId: string, triggerId: string) => void;
  onVillainDialogue: (sectionName: string, text: string) => void;
  restartKey: number | string;
  villainDialogue: (DialogueMessage & { sectionName: string }) | null;
};

export function CombatPrototype({
  onPlayerFixedAnimation,
  onPlayerDialogue,
  onSectionResolved,
  onSectionTrigger,
  onVillainDialogue,
  restartKey,
  villainDialogue,
}: CombatPrototypeProps) {
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
  const [visibleEncounterCount, setVisibleEncounterCount] = useState(1);

  useEffect(() => {
    preloadVillainAudio();
    return stopAllVillainAudio;
  }, []);

  useEffect(() => stopAllVillainAudio(), [restartKey]);

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
          onInfoOpen={() => {
            setActiveInfoId(encounter.id);
            onSectionTrigger(encounter.id, "info");
          }}
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
  const voiceEnabled = hasVillainVoice(encounter.id);
  const lastActivatedRef = useRef(0);
  const lastInfoActivatedRef = useRef(0);
  const wasNearDialogueRef = useRef(false);
  const wasNearVillainRef = useRef(false);
  const wasOnVoicePlatformRef = useRef(false);
  const villainBubbleUpdateTimerRef = useRef(0);
  const villainDialogueTimerRef = useRef(0);
  const sectionResolvedTimerRef = useRef(0);
  const defeatedRef = useRef(false);
  useEffect(() => () => stopVillainVoice(encounter.id), [encounter.id]);

  const setVillainBubbleVisibilitySoon = (visible: boolean) => {
    window.clearTimeout(villainBubbleUpdateTimerRef.current);
    villainBubbleUpdateTimerRef.current = window.setTimeout(() => {
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
    triggerFixHaptic();
    lastActivatedRef.current = now;
    window.clearTimeout(villainBubbleUpdateTimerRef.current);
    window.clearTimeout(villainDialogueTimerRef.current);
    stopVillainVoice(encounter.id);
    playVillainDefeatSound();
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
    const onVoicePlatform =
      voiceEnabled &&
      Math.abs(playerWorldState.position.x - encounter.platformPosition.x) <= destinationPlatformRadius &&
      Math.abs(playerWorldState.position.z - encounter.platformPosition.z) <= destinationPlatformRadius;

    if (nearVillain !== wasNearVillainRef.current) {
      setVillainBubbleVisibilitySoon(nearVillain);
    }

    if (onVoicePlatform !== wasOnVoicePlatformRef.current) {
      if (onVoicePlatform && !defeatedRef.current) playVillainVoice(encounter.id);
      else stopVillainVoice(encounter.id);
    }

    if (!defeatedRef.current && encounter.id !== "quick-fix" && nearDialogueArea && !wasNearDialogueRef.current) {
      window.clearTimeout(villainDialogueTimerRef.current);
      villainDialogueTimerRef.current = window.setTimeout(() => {
        onVillainDialogue(encounter.name, villainDialogueText[encounter.id]);
      }, 0);
    }

    wasNearDialogueRef.current = nearDialogueArea;
    wasNearVillainRef.current = nearVillain;
    wasOnVoicePlatformRef.current = onVoicePlatform;
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
      {smokeActive && (
        <>
          <FireBurstEffect position={encounter.villainPosition} />
          <SmokeDeathEffect position={encounter.villainPosition} />
        </>
      )}
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

type FireLayer = "core" | "flame" | "outer";

type FireParticle = {
  angle: number;
  delay: number;
  elevation: number;
  phase: number;
  size: number;
  speed: number;
};

const fireLayerCounts: Record<FireLayer, number> = {
  core: 5,
  flame: 9,
  outer: 11,
};

function createFireParticles(count: number, layerOffset: number): FireParticle[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, index) => ({
    angle: index * goldenAngle + layerOffset,
    delay: (index % 4) * 0.018,
    elevation: -0.28 + ((index * 7) % 13) / 12,
    phase: index * 1.73 + layerOffset,
    size: 0.72 + ((index * 5) % 7) * 0.07,
    speed: 0.82 + ((index * 3) % 8) * 0.055,
  }));
}

function FireBurstEffect({ position }: { position: Vector3 }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<InstancedMesh>(null);
  const flameRef = useRef<InstancedMesh>(null);
  const outerRef = useRef<InstancedMesh>(null);
  const lightRef = useRef<PointLight>(null);
  const startedAtRef = useRef(0);
  const transform = useMemo(() => new Object3D(), []);
  const particles = useRef<Record<FireLayer, FireParticle[]>>({
    core: createFireParticles(fireLayerCounts.core, 0.35),
    flame: createFireParticles(fireLayerCounts.flame, 1.7),
    outer: createFireParticles(fireLayerCounts.outer, 3.1),
  });
  const materials = useMemo(
    () => ({
      core: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#fffbd1",
        depthWrite: false,
        opacity: 1,
        toneMapped: false,
        transparent: true,
      }),
      flame: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#ff8a0a",
        depthWrite: false,
        opacity: 0.92,
        toneMapped: false,
        transparent: true,
      }),
      outer: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#b51b08",
        depthWrite: false,
        opacity: 0.78,
        toneMapped: false,
        transparent: true,
      }),
    }),
    []
  );

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useFrame(({ clock }) => {
    if (startedAtRef.current === 0) startedAtRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const group = groupRef.current;
    if (!group) return;

    if (elapsed >= fireDurationSeconds) {
      group.visible = false;
      return;
    }

    const expansionProgress = Math.min(elapsed / fireExpansionSeconds, 1);
    const expansion = 1 - Math.pow(1 - expansionProgress, 3);
    const refs: Record<FireLayer, InstancedMesh | null> = {
      core: coreRef.current,
      flame: flameRef.current,
      outer: outerRef.current,
    };

    (Object.keys(refs) as FireLayer[]).forEach((layer) => {
      const mesh = refs[layer];
      if (!mesh) return;
      const layerRadius = layer === "core" ? 0.62 : layer === "flame" ? 1.35 : 1.85;
      const layerStretch = layer === "core" ? 0.9 : layer === "flame" ? 1.35 : 1.08;

      particles.current[layer].forEach((particle, index) => {
        const localElapsed = Math.max(0, elapsed - particle.delay);
        const localExpansion = Math.min(localElapsed / fireExpansionSeconds, 1);
        const radius = layerRadius * particle.speed * (1 - Math.pow(1 - localExpansion, 3));
        const turbulence = Math.sin(localElapsed * 24 + particle.phase) * 0.13 * expansion;
        const verticalTurbulence = Math.cos(localElapsed * 19 + particle.phase) * 0.1 * expansion;
        const size = particle.size * (0.18 + expansion * 0.82);

        transform.position.set(
          Math.cos(particle.angle) * radius + turbulence,
          particle.elevation * radius + verticalTurbulence,
          Math.sin(particle.angle) * radius - turbulence
        );
        transform.rotation.set(
          particle.elevation * 0.7,
          particle.angle,
          Math.sin(particle.phase) * 0.45
        );
        transform.scale.set(size * 0.72, size * layerStretch, size * 0.72);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });

    materials.core.opacity = Math.max(0, 1 - elapsed / 0.36);
    materials.flame.opacity = Math.max(0, Math.min(1, elapsed / 0.045) * (1 - elapsed / 0.68));
    materials.outer.opacity = Math.max(0, Math.min(0.82, elapsed / 0.09) * (1 - elapsed / fireDurationSeconds));

    if (lightRef.current) {
      const ignition = Math.min(elapsed / 0.035, 1);
      lightRef.current.intensity = 70 * ignition * Math.pow(1 - elapsed / fireDurationSeconds, 2);
    }
  });

  return (
    <group
      ref={groupRef}
      name="VillainFireBurstEffect"
      position={[position.x, position.y + 1.15, position.z]}
    >
      <pointLight ref={lightRef} color="#ff9a22" decay={2} distance={12} intensity={0} />
      <instancedMesh ref={outerRef} args={[fireGeometry, materials.outer, fireLayerCounts.outer]} />
      <instancedMesh ref={flameRef} args={[fireGeometry, materials.flame, fireLayerCounts.flame]} />
      <instancedMesh ref={coreRef} args={[fireGeometry, materials.core, fireLayerCounts.core]} />
    </group>
  );
}

function SmokeDeathEffect({ position }: { position: Vector3 }) {
  const groupRef = useRef<Group>(null);
  const startedAtRef = useRef(0);
  const lastSmokeFrameRef = useRef(-1);
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

  useEffect(() => () => smokeMaterials.forEach((material) => material.dispose()), [smokeMaterials]);

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
  const { pulseRef, ringRef } = useTriggerPadVisuals(active, fixPadVisualConfig);
  const playerInsideRef = useRef(false);
  const lastTriggeredAtRef = useRef(-Infinity);

  const isPlayerEvent = (event: IntersectionEnterPayload | IntersectionExitPayload) => {
    return isPlayerObject(event.other.rigidBodyObject) || isPlayerObject(event.other.colliderObject);
  };

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (!isPlayerEvent(event) || playerInsideRef.current) return;
    playerInsideRef.current = true;

    const now = performance.now();
    if (now - lastTriggeredAtRef.current < padActivationCooldownMs) return;
    lastTriggeredAtRef.current = now;
    onActivate();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event)) return;
    playerInsideRef.current = false;
  };

  return (
    <group position={position}>
      <CylinderCollider
        sensor
        args={[0.28, triggerPadRadius]}
        position={[0, 0.32, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} geometry={fixRingGeometry} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} dispose={null}>
        <meshBasicMaterial color={padVisualStyle.color} transparent opacity={0.66} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} geometry={fixPulseGeometry} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} visible={false} dispose={null}>
        <meshBasicMaterial color={padVisualStyle.color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {label && (
        <BillboardLabel
          color={padVisualStyle.labelColor}
          fontSize={label === "More Info" ? 0.24 : 0.28}
          position={[0, triggerPopupLayout.labelHeight, 0]}
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
  const panelRef = useRef<Group>(null);
  const panelWidth = 6;
  const panelHeight = 3.65;

  useFrame(({ camera }) => {
    if (!panelRef.current) return;
    panelRef.current.rotation.y = Math.atan2(
      camera.position.x - position.x,
      camera.position.z - position.z,
    );
  });

  return (
    <group
      ref={panelRef}
      position={[position.x, position.y + triggerPopupLayout.panelCenterOffset, position.z]}
    >
      <mesh position={[0, 0, -0.07]}>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.94} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.08, -0.06]}>
        <planeGeometry args={[5.55, 2.95]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.72} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.27, -0.05]}>
        <planeGeometry args={[5.75, 0.72]} />
        <meshBasicMaterial color="#05070b" transparent opacity={0.54} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.28, -0.05]}>
        <planeGeometry args={[5.75, 0.72]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, panelHeight / 2 + 0.035, -0.04]}>
        <boxGeometry args={[panelWidth + 0.03, 0.035, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} toneMapped={false} />
      </mesh>
      <mesh position={[0, -panelHeight / 2 - 0.035, -0.04]}>
        <boxGeometry args={[panelWidth + 0.03, 0.035, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} toneMapped={false} />
      </mesh>
      <mesh position={[-panelWidth / 2 - 0.02, 0, -0.04]}>
        <boxGeometry args={[0.035, panelHeight, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <mesh position={[panelWidth / 2 + 0.02, 0, -0.04]}>
        <boxGeometry args={[0.035, panelHeight, 0.035]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <Text color="#ffffff" font={gameTextFont} fontSize={0.3} anchorX="center" anchorY="middle" position={[0, 1.18, 0]} maxWidth={5.1}>
        {title}
      </Text>
      <Text color="#ffffff" font={gameTextFont} fontSize={0.17} anchorX="center" anchorY="middle" position={[0, -0.3, 0]} maxWidth={4.95} lineHeight={1.35}>
        {text}
      </Text>
    </group>
  );
}
