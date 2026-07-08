import { Text } from "@react-three/drei";
import { CuboidCollider, IntersectionEnterPayload, IntersectionExitPayload, RigidBody } from "@react-three/rapier";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  VideoTexture,
} from "three";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { hubSections, HubSection } from "../hubSections";
import { playerWorldState } from "../playerWorldState";

type HubSectionsProps = {
  onActiveSectionChange: (sectionName: string | null) => void;
  restartKey: number;
  serviceResolutions: Record<string, boolean>;
};

const center = new Vector3(0, 0, 0);
const sectionPosition = new Vector3();
const triggerRadius = 9;
const triggerRadiusSq = triggerRadius * triggerRadius;
const offerCountdownMs = 3000;
const offerDisplayMs = 10000;
const simpleDisplayMs = 10000;
const offersPageUrl = "https://www.crystalthedeveloper.ca/offers";
const white = "#f5f7fb";
const softWhite = "#d8dde8";
const screenImageTint = "#c7c7c7";
const screenIdleColor = "#0b1018";
const serviceSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const serviceScreenImages: Record<string, { bad: string; good: string }> = {
  "quick-fix": {
    bad: "/images/quickFix/quick-fix-bad.png",
    good: "/images/quickFix/quick-fix-good.png",
  },
  "urgent-fix": {
    bad: "/images/urgentFix/urgent-fix-bad.png",
    good: "/images/urgentFix/urgent-fix-good.png",
  },
  performance: {
    bad: "/images/performance/performance-bad.png",
    good: "/images/performance/performance-good.png",
  },
  "site-improvement": {
    bad: "/images/siteImprovement/site-improvement-bad.png",
    good: "/images/siteImprovement/site-improvement-good.png",
  },
};
const simpleDisplaySections: Record<string, { imagePath: string; label: string }> = {
  tips: {
    imagePath: "/images/tips/tip.png",
    label: "Show Tip",
  },
  value: {
    imagePath: "/images/values/value.png",
    label: "Show Value",
  },
};
const offerOptions = [
  {
    id: "quick-fix",
    imagePath: "/images/offers/quick-fix.png",
    name: "Quick Fix",
    position: [-5.4, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "urgent-fix",
    imagePath: "/images/offers/urgent-fix.png",
    name: "Urgent Fix",
    position: [-1.8, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "performance",
    imagePath: "/images/offers/performance.png",
    name: "Performance",
    position: [1.8, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "site-improvement",
    imagePath: "/images/offers/site-improvement.png",
    name: "Site Improvement",
    position: [5.4, 0.18, 9.2] as [number, number, number],
  },
];

type OfferOption = (typeof offerOptions)[number];
type ShowcaseVideoState = {
  playing: boolean;
};

let showcaseVideoElement: HTMLVideoElement | null = null;
let showcaseVideoTexture: VideoTexture | null = null;

function getShowcaseVideoResource() {
  if (!showcaseVideoElement) {
    const video = document.createElement("video");
    video.src = "/videos/showcase.mp4";
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.load();

    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    showcaseVideoElement = video;
    showcaseVideoTexture = texture;
  }

  return {
    texture: showcaseVideoTexture,
    video: showcaseVideoElement,
  };
}

export function HubSections({ onActiveSectionChange, restartKey, serviceResolutions }: HubSectionsProps) {
  const activeSectionRef = useRef<string | null>(null);
  const activeSectionCheckElapsedRef = useRef(0);
  const displayTimersRef = useRef<Record<string, number>>({});
  const [activeSimpleDisplays, setActiveSimpleDisplays] = useState<Record<string, boolean>>({});
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [showcaseVideoState, setShowcaseVideoState] = useState<ShowcaseVideoState>({
    playing: false,
  });

  useEffect(() => {
    offerOptions.forEach((offer) => {
      const image = new Image();
      image.src = offer.imagePath;
    });

    Object.values(simpleDisplaySections).forEach((display) => {
      const image = new Image();
      image.src = display.imagePath;
    });
  }, []);

  useEffect(() => {
    return () => {
      Object.values(displayTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!selectedOfferId) return undefined;

    const clearOfferTimer = window.setTimeout(() => {
      setSelectedOfferId(null);
    }, offerDisplayMs);

    return () => {
      window.clearTimeout(clearOfferTimer);
    };
  }, [selectedOfferId]);

  useEffect(() => {
    Object.values(displayTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    displayTimersRef.current = {};
    activeSectionRef.current = null;
    setActiveSimpleDisplays({});
    setSelectedOfferId(null);
    setShowcaseVideoState({ playing: false });

    const resource = getShowcaseVideoResource();
    if (resource.video) {
      resource.video.pause();
      resource.video.currentTime = 0;
    }
  }, [restartKey]);

  useFrame((_, delta) => {
    activeSectionCheckElapsedRef.current += delta;
    if (activeSectionCheckElapsedRef.current < 0.12) return;
    activeSectionCheckElapsedRef.current = 0;

    const active = hubSections.find((section) => {
      sectionPosition.set(...section.position);
      return playerWorldState.position.distanceToSquared(sectionPosition) <= triggerRadiusSq;
    });
    const nextName = active?.name ?? null;

    if (activeSectionRef.current !== nextName) {
      activeSectionRef.current = nextName;
      onActiveSectionChange(nextName);
    }
  });

  const showSimpleDisplay = (sectionId: string) => {
    const existingTimer = displayTimersRef.current[sectionId];
    if (existingTimer) window.clearTimeout(existingTimer);

    setActiveSimpleDisplays((current) => ({
      ...current,
      [sectionId]: true,
    }));

    displayTimersRef.current[sectionId] = window.setTimeout(() => {
      setActiveSimpleDisplays((current) => ({
        ...current,
        [sectionId]: false,
      }));
      delete displayTimersRef.current[sectionId];
    }, simpleDisplayMs);
  };

  return (
    <group name="HubSections">
      <HubPaths />
      {hubSections.map((section) => (
        <HubSectionDistrict
          key={`${section.id}:${restartKey}`}
          section={section}
          serviceResolutions={serviceResolutions}
          activeSimpleDisplays={activeSimpleDisplays}
          selectedOffer={offerOptions.find((offer) => offer.id === selectedOfferId) ?? null}
          showcaseVideoState={showcaseVideoState}
          onOfferSelect={setSelectedOfferId}
          onSimpleDisplayTrigger={showSimpleDisplay}
          onShowcasePause={() => {
            setShowcaseVideoState((current) => (current.playing ? { ...current, playing: false } : current));
          }}
          onShowcasePlay={() => {
            setShowcaseVideoState({ playing: true });
          }}
        />
      ))}
    </group>
  );
}

function HubPaths() {
  return (
    <group name="HubPaths">
      {hubSections.map((section) => {
        const [x, , z] = section.position;
        const distance = Math.hypot(x, z);
        const angle = Math.atan2(x, z);

        return (
          <group key={section.id} rotation-y={angle}>
            <mesh position={[0, 0.14, distance / 2]} rotation-x={-Math.PI / 2}>
              <boxGeometry args={[0.04, distance, 0.018]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.3} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.15, distance - 7]} rotation-x={-Math.PI / 2}>
              <coneGeometry args={[0.42, 1.05, 3]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.4} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function HubSectionDistrict({
  activeSimpleDisplays,
  onOfferSelect,
  onShowcasePause,
  onShowcasePlay,
  onSimpleDisplayTrigger,
  serviceResolutions,
  section,
  selectedOffer,
  showcaseVideoState,
}: {
  activeSimpleDisplays: Record<string, boolean>;
  onOfferSelect: (offerId: string | null) => void;
  onShowcasePause: () => void;
  onShowcasePlay: () => void;
  onSimpleDisplayTrigger: (sectionId: string) => void;
  serviceResolutions: Record<string, boolean>;
  section: HubSection;
  selectedOffer: OfferOption | null;
  showcaseVideoState: ShowcaseVideoState;
}) {
  const rotation = useMemo(() => {
    sectionPosition.set(...section.position);
    return Math.atan2(sectionPosition.x - center.x, sectionPosition.z - center.z) + Math.PI;
  }, [section.position]);

  return (
    <group name={`HubSection:${section.id}`} position={section.position} rotation-y={rotation}>
      <SectionBillboard
        activeSimpleDisplays={activeSimpleDisplays}
        section={section}
        serviceResolutions={serviceResolutions}
        selectedOffer={selectedOffer}
        showcaseVideoState={showcaseVideoState}
      />
      {section.id === "offers" && <OffersSelector selectedOfferId={selectedOffer?.id ?? null} onOfferSelect={onOfferSelect} />}
      {simpleDisplaySections[section.id] && (
        <SimpleDisplaySelector
          active={Boolean(activeSimpleDisplays[section.id])}
          label={simpleDisplaySections[section.id].label}
          name={`SimpleDisplayPortal:${section.id}`}
          onPlayerEnter={() => onSimpleDisplayTrigger(section.id)}
        />
      )}
      {section.id === "showcase" && (
        <ShowcaseSelector
          isPlaying={showcaseVideoState.playing}
          onPlayerEnter={onShowcasePlay}
          onPlayerExit={onShowcasePause}
        />
      )}
      <TriggerZone section={section} />
    </group>
  );
}

function SectionBillboard({
  activeSimpleDisplays,
  section,
  serviceResolutions,
  selectedOffer,
  showcaseVideoState,
}: {
  activeSimpleDisplays: Record<string, boolean>;
  section: HubSection;
  serviceResolutions: Record<string, boolean>;
  selectedOffer: OfferOption | null;
  showcaseVideoState: ShowcaseVideoState;
}) {
  const isOffers = section.id === "offers";
  const simpleDisplay = simpleDisplaySections[section.id];
  const isServiceSection = serviceSectionIds.includes(section.id);
  const isShowcase = section.id === "showcase";

  return (
    <group name={`Billboard:${section.id}`} position={[0, 4.8, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[5.35, 3.05, 0.24]} position={[0, 0.12, -0.1]} />
        <mesh castShadow receiveShadow position={[0, 0, -0.08]}>
          <boxGeometry args={[10.4, 5.8, 0.32]} />
          <meshStandardMaterial color="#101621" metalness={0.72} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.1, -0.26]}>
          <planeGeometry args={[9.25, 4.85]} />
          <meshStandardMaterial
            color="#111827"
            emissive="#ffffff"
            emissiveIntensity={isOffers ? 0.035 : 0.018}
            metalness={0.2}
            roughness={0.48}
          />
        </mesh>
        <mesh position={[0, 2.85, -0.14]}>
          <boxGeometry args={[10.8, 0.15, 0.18]} />
          <meshBasicMaterial color={softWhite} transparent opacity={0.64} />
        </mesh>
      </RigidBody>
      <Text
        color={white}
        fontSize={0.86}
        anchorX="center"
        anchorY="middle"
        position={[0, 3.55, -0.34]}
        maxWidth={9}
      >
        {section.name}
      </Text>
      {isOffers ? (
        <OffersScreenContent selectedOffer={selectedOffer} />
      ) : simpleDisplay ? (
        <SimpleDisplayScreen active={Boolean(activeSimpleDisplays[section.id])} imagePath={simpleDisplay.imagePath} />
      ) : isServiceSection ? (
        <ServiceScreenContent resolved={Boolean(serviceResolutions[section.id])} section={section} />
      ) : isShowcase ? (
        <ShowcaseScreenContent isPlaying={showcaseVideoState.playing} />
      ) : (
        <Text
          color="#9fb5cc"
          fontSize={0.26}
          anchorX="center"
          anchorY="middle"
          position={[0, -2.25, -0.34]}
          maxWidth={8.5}
        >
          Future screenshot / video surface
        </Text>
      )}
      {isOffers && (
        <>
          <Text
            color={white}
            fontSize={0.3}
            anchorX="center"
            anchorY="middle"
            position={[0, -2.62, -0.38]}
            maxWidth={8}
          >
            {selectedOffer?.name ?? "Select an offer"}
          </Text>
        </>
      )}
    </group>
  );
}

function OffersScreenContent({ selectedOffer }: { selectedOffer: OfferOption | null }) {
  const loadedTextures = useLoader(TextureLoader, offerOptions.map((offer) => offer.imagePath));

  useEffect(() => {
    loadedTextures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
    });
  }, [loadedTextures]);

  const selectedIndex = selectedOffer ? offerOptions.findIndex((offer) => offer.id === selectedOffer.id) : -1;
  const texture = selectedIndex >= 0 ? loadedTextures[selectedIndex] : null;

  return (
    <mesh key={selectedOffer?.id ?? "offers-empty-screen"} position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={[8.4, 4.15]} />
      {texture ? (
        <meshBasicMaterial
          key={`offer-image-${selectedOffer?.id}`}
          color={screenImageTint}
          depthTest={false}
          map={texture}
          side={DoubleSide}
          toneMapped
        />
      ) : (
        <meshBasicMaterial key="offer-empty-screen" color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
      )}
    </mesh>
  );
}

function SimpleDisplayScreen({ active, imagePath }: { active: boolean; imagePath: string }) {
  const texture = useLoader(TextureLoader, imagePath);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh key={active ? imagePath : "simple-display-empty"} position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={[8.4, 4.15]} />
      {active ? (
        <meshBasicMaterial color={screenImageTint} depthTest={false} map={texture} side={DoubleSide} toneMapped />
      ) : (
        <meshBasicMaterial color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
      )}
    </mesh>
  );
}

function ServiceScreenContent({ resolved, section }: { resolved: boolean; section: HubSection }) {
  const images = serviceScreenImages[section.id];
  if (!images) return null;

  return <ServiceImageScreen badImage={images.bad} goodImage={images.good} resolved={resolved} />;
}

function ServiceImageScreen({
  badImage,
  goodImage,
  resolved,
}: {
  badImage: string;
  goodImage: string;
  resolved: boolean;
}) {
  const [badTexture, goodTexture] = useLoader(TextureLoader, [badImage, goodImage]);
  const texture = resolved ? goodTexture : badTexture;

  useEffect(() => {
    [badTexture, goodTexture].forEach((loadedTexture) => {
      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.generateMipmaps = false;
      loadedTexture.minFilter = LinearFilter;
      loadedTexture.magFilter = LinearFilter;
      loadedTexture.needsUpdate = true;
    });
  }, [badTexture, goodTexture]);

  return (
    <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={[8.4, 4.15]} />
      <meshBasicMaterial
        color={screenImageTint}
        depthTest={false}
        map={texture}
        side={DoubleSide}
        toneMapped
      />
    </mesh>
  );
}

function ShowcaseScreenContent({ isPlaying }: { isPlaying: boolean }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const screenOpacityRef = useRef(0);
  const resource = useMemo(() => getShowcaseVideoResource(), []);

  useEffect(() => {
    const video = resource.video;
    if (!video) return;

    if (isPlaying) {
      video
        .play()
        .catch(() => undefined);
      return;
    }

    if (video.paused) return;
    video.pause();
  }, [isPlaying, resource.video]);

  useEffect(() => {
    return () => {
      resource.video?.pause();
    };
  }, [resource.video]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;

    const targetOpacity = isPlaying ? 1 : 0;
    screenOpacityRef.current = MathUtils.damp(screenOpacityRef.current, targetOpacity, isPlaying ? 8 : 18, Math.min(delta, 1 / 30));
    material.opacity = screenOpacityRef.current;
  });

  return (
    <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={[8.4, 4.15]} />
      {resource.texture ? (
        <meshBasicMaterial
          ref={materialRef}
          color={screenImageTint}
          depthTest={false}
          map={resource.texture}
          opacity={0}
          side={DoubleSide}
          toneMapped
          transparent
        />
      ) : (
        <meshBasicMaterial color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
      )}
    </mesh>
  );
}

function OffersSelector({
  onOfferSelect,
  selectedOfferId,
}: {
  onOfferSelect: (offerId: string | null) => void;
  selectedOfferId: string | null;
}) {
  const [countdownOfferId, setCountdownOfferId] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const countdownStartedAtRef = useRef(0);
  const countdownSecondsRef = useRef(0);
  const pageOpenedRef = useRef(false);

  const startCountdown = (offer: OfferOption) => {
    onOfferSelect(offer.id);
    setCountdownOfferId(offer.id);
    countdownSecondsRef.current = 3;
    setCountdownSeconds(3);
    countdownStartedAtRef.current = performance.now();
    pageOpenedRef.current = false;
  };

  const cancelCountdown = (offer: OfferOption) => {
    if (countdownOfferId !== offer.id || pageOpenedRef.current) return;

    setCountdownOfferId(null);
    countdownSecondsRef.current = 0;
    setCountdownSeconds(0);
  };

  useFrame(() => {
    if (!countdownOfferId) return;

    const elapsed = performance.now() - countdownStartedAtRef.current;
    const remaining = Math.max(0, Math.ceil((offerCountdownMs - elapsed) / 1000));
    if (countdownSecondsRef.current !== remaining) {
      countdownSecondsRef.current = remaining;
      setCountdownSeconds(remaining);
    }

    if (elapsed < offerCountdownMs || pageOpenedRef.current) return;

    pageOpenedRef.current = true;
    setCountdownOfferId(null);
    countdownSecondsRef.current = 0;
    setCountdownSeconds(0);
    window.open(offersPageUrl, "_blank", "noopener,noreferrer");
  });

  return (
    <group name="OffersSelector">
      {offerOptions.map((offer) => (
        <OfferPortalPad
          key={offer.id}
          active={selectedOfferId === offer.id}
          countdownSeconds={countdownOfferId === offer.id ? countdownSeconds : 0}
          offer={offer}
          onPlayerEnter={() => startCountdown(offer)}
          onPlayerExit={() => cancelCountdown(offer)}
        />
      ))}
    </group>
  );
}

function ShowcaseSelector({
  isPlaying,
  onPlayerEnter,
  onPlayerExit,
}: {
  isPlaying: boolean;
  onPlayerEnter: () => void;
  onPlayerExit: () => void;
}) {
  return (
    <group name="ShowcaseSelector">
      <ShowcasePortalPad
        active={isPlaying}
        label="Play Showcase"
        name="ShowcasePortal:play"
        onPlayerEnter={onPlayerEnter}
        onPlayerExit={onPlayerExit}
      />
    </group>
  );
}

function SimpleDisplaySelector({
  active,
  label,
  name,
  onPlayerEnter,
}: {
  active: boolean;
  label: string;
  name: string;
  onPlayerEnter: () => void;
}) {
  return (
    <group name={`${name}:selector`}>
      <ShowcasePortalPad
        active={active}
        label={label}
        name={name}
        onPlayerEnter={onPlayerEnter}
        onPlayerExit={() => undefined}
      />
    </group>
  );
}

function OfferPortalPad({
  active,
  countdownSeconds,
  offer,
  onPlayerEnter,
  onPlayerExit,
}: {
  active: boolean;
  countdownSeconds: number;
  offer: OfferOption;
  onPlayerEnter: () => void;
  onPlayerExit: () => void;
}) {
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const playerInsideRef = useRef(false);
  const activeStartedAtRef = useRef(0);
  const wasActiveRef = useRef(active);

  const isPlayerIntersection = (object?: Object3D) => {
    let current: Object3D | null | undefined = object;
    while (current) {
      if (current.name === "StudioCLTDPlayer") return true;
      current = current.parent;
    }
    return false;
  };

  const isPlayerEvent = (event: IntersectionEnterPayload | IntersectionExitPayload) => {
    const hitPlayer =
      isPlayerIntersection(event.other.rigidBodyObject) ||
      isPlayerIntersection(event.other.colliderObject);

    return hitPlayer;
  };

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (!isPlayerEvent(event) || playerInsideRef.current) return;
    playerInsideRef.current = true;
    onPlayerEnter();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event) || !playerInsideRef.current) return;
    playerInsideRef.current = false;
    onPlayerExit();
  };

  useFrame(({ clock }) => {
    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }
    wasActiveRef.current = active;

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const pulse = 1 + activationGlow * 0.05;
    const opacity = 0.56 + activationGlow * 0.28;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      const material = ringRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = opacity;
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active || activationGlow > 0;
      pulseRef.current.scale.setScalar(1.03 + activationGlow * 0.18);
      const material = pulseRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = activationGlow * 0.16;
      }
    }
  });

  return (
    <group name={`OfferPortal:${offer.id}`} position={offer.position}>
      <CuboidCollider
        sensor
        args={[1.15, 0.28, 1.15]}
        position={[0, 0.45, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <torusGeometry args={[1, 0.026, 10, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.56} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.68, 1.05, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <BillboardLabel
        color={white}
        fontSize={offer.id === "site-improvement" ? 0.22 : 0.28}
        position={[0, 1.05, 0]}
        maxWidth={2.8}
      >
        {offer.name}
      </BillboardLabel>
      {countdownSeconds > 0 && (
        <BillboardLabel
          color="#ffd76b"
          fontSize={0.2}
          position={[0, 1.48, 0]}
          maxWidth={3.2}
        >
          {`Opening offers page in ${countdownSeconds}...`}
        </BillboardLabel>
      )}
      <pointLight color="#ffffff" intensity={active ? 2.4 : 0.7} distance={active ? 5.5 : 3} position={[0, 0.72, 0]} />
    </group>
  );
}

function ShowcasePortalPad({
  active,
  label,
  name,
  onPlayerEnter,
  onPlayerExit,
}: {
  active: boolean;
  label: string;
  name: string;
  onPlayerEnter: () => void;
  onPlayerExit: () => void;
}) {
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const playerInsideRef = useRef(false);
  const activeStartedAtRef = useRef(0);
  const wasActiveRef = useRef(active);

  const isPlayerIntersection = (object?: Object3D) => {
    let current: Object3D | null | undefined = object;
    while (current) {
      if (current.name === "StudioCLTDPlayer") return true;
      current = current.parent;
    }
    return false;
  };

  const isPlayerEvent = (event: IntersectionEnterPayload | IntersectionExitPayload) =>
    isPlayerIntersection(event.other.rigidBodyObject) || isPlayerIntersection(event.other.colliderObject);

  const activate = () => {
    if (playerInsideRef.current) return;
    playerInsideRef.current = true;
    onPlayerEnter();
  };

  const deactivate = () => {
    if (!playerInsideRef.current) return;
    playerInsideRef.current = false;
    onPlayerExit();
  };

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (!isPlayerEvent(event)) return;
    activate();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event)) return;
    deactivate();
  };

  useFrame(({ clock }) => {
    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }
    wasActiveRef.current = active;

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const steadyGlow = active ? 0.2 : 0;
    const pulse = 1 + activationGlow * 0.05;
    const opacity = 0.58 + steadyGlow + activationGlow * 0.16;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      const material = ringRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = opacity;
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active || activationGlow > 0;
      pulseRef.current.scale.setScalar(1.04 + activationGlow * 0.16);
      const material = pulseRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = active ? 0.1 + activationGlow * 0.1 : activationGlow * 0.12;
      }
    }
  });

  return (
    <group name={name} position={[0, 0.18, 9.2]}>
      <CuboidCollider
        sensor
        args={[1.15, 0.28, 1.15]}
        position={[0, 0.45, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <torusGeometry args={[1, 0.026, 10, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.58} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.68, 1.05, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <BillboardLabel color={white} fontSize={0.28} position={[0, 1.05, 0]} maxWidth={3}>
        {label}
      </BillboardLabel>
      <pointLight color="#ffffff" intensity={active ? 2.2 : 0.6} distance={active ? 5.2 : 3} position={[0, 0.72, 0]} />
    </group>
  );
}

function TriggerZone({ section }: { section: HubSection }) {
  return (
    <group name={`TriggerZone:${section.id}`} position={[0, 1.8, 6.2]}>
      <CuboidCollider sensor args={[4.5, 1.8, 4.5]} />
    </group>
  );
}
