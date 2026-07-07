import { Text } from "@react-three/drei";
import { CuboidCollider, IntersectionEnterPayload, IntersectionExitPayload } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, LinearFilter, Mesh, Object3D, SRGBColorSpace, Texture, TextureLoader, Vector3 } from "three";
import { hubSections, HubSection } from "../hubSections";
import { playerWorldState } from "../playerWorldState";

type HubSectionsProps = {
  onActiveSectionChange: (sectionName: string | null) => void;
};

const center = new Vector3(0, 0, 0);
const sectionPosition = new Vector3();
const triggerRadius = 9;
const offerCountdownMs = 3000;
const offersPageUrl = "https://www.crystalthedeveloper.ca/offers";
const white = "#f5f7fb";
const softWhite = "#d8dde8";
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

export function HubSections({ onActiveSectionChange }: HubSectionsProps) {
  const activeSectionRef = useRef<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  useEffect(() => {
    offerOptions.forEach((offer) => {
      const image = new Image();
      image.onerror = () => {
        console.log(`[StudioCLTD offers] Failed to load offer image: ${offer.imagePath}`);
      };
      image.src = offer.imagePath;
    });
  }, []);

  useFrame(() => {
    const active = hubSections.find((section) => {
      sectionPosition.set(...section.position);
      return playerWorldState.position.distanceTo(sectionPosition) <= triggerRadius;
    });
    const nextName = active?.name ?? null;

    if (activeSectionRef.current !== nextName) {
      activeSectionRef.current = nextName;
      onActiveSectionChange(nextName);
      if (nextName) {
        console.log("[StudioCLTD hub] Entered section trigger", nextName);
      }
    }
  });

  return (
    <group name="HubSections">
      <HubPaths />
      {hubSections.map((section) => (
        <HubSectionDistrict
          key={section.id}
          section={section}
          selectedOffer={offerOptions.find((offer) => offer.id === selectedOfferId) ?? null}
          onOfferSelect={setSelectedOfferId}
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
              <boxGeometry args={[0.12, distance, 0.02]} />
              <meshBasicMaterial color={white} transparent opacity={0.34} />
            </mesh>
            <mesh position={[0, 0.15, distance - 7]} rotation-x={-Math.PI / 2}>
              <coneGeometry args={[0.7, 1.75, 3]} />
              <meshBasicMaterial color={white} transparent opacity={0.46} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function HubSectionDistrict({
  onOfferSelect,
  section,
  selectedOffer,
}: {
  onOfferSelect: (offerId: string | null) => void;
  section: HubSection;
  selectedOffer: OfferOption | null;
}) {
  const rotation = useMemo(() => {
    sectionPosition.set(...section.position);
    return Math.atan2(sectionPosition.x - center.x, sectionPosition.z - center.z) + Math.PI;
  }, [section.position]);

  return (
    <group name={`HubSection:${section.id}`} position={section.position} rotation-y={rotation}>
      <SectionBillboard section={section} selectedOffer={selectedOffer} />
      <EntranceMarker section={section} />
      {section.id === "offers" && <OffersSelector selectedOfferId={selectedOffer?.id ?? null} onOfferSelect={onOfferSelect} />}
      <TriggerZone section={section} />
    </group>
  );
}

function SectionBillboard({ section, selectedOffer }: { section: HubSection; selectedOffer: OfferOption | null }) {
  const isOffers = section.id === "offers";

  return (
    <group name={`Billboard:${section.id}`} position={[0, 4.8, 0]}>
      <mesh castShadow receiveShadow position={[0, 0, -0.08]}>
        <boxGeometry args={[10.4, 5.8, 0.32]} />
        <meshStandardMaterial color="#101621" metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.1, -0.26]}>
        <planeGeometry args={[9.25, 4.85]} />
        <meshStandardMaterial
          color="#111827"
          emissive="#ffffff"
          emissiveIntensity={isOffers ? 0.08 : 0.04}
          metalness={0.2}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[0, 2.85, -0.14]}>
        <boxGeometry args={[10.8, 0.15, 0.18]} />
        <meshBasicMaterial color={softWhite} transparent opacity={0.64} />
      </mesh>
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
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const loggedDisplayRef = useRef<string | null>(null);

  useEffect(() => {
    const loader = new TextureLoader();
    let disposed = false;

    offerOptions.forEach((offer) => {
      loader.load(
        offer.imagePath,
        (texture) => {
          if (disposed) return;

          texture.colorSpace = SRGBColorSpace;
          texture.minFilter = LinearFilter;
          texture.magFilter = LinearFilter;
          texture.needsUpdate = true;

          console.log("[StudioCLTD offers] Texture loaded successfully", {
            offer: offer.name,
            path: offer.imagePath,
          });

          setTextures((current) => ({
            ...current,
            [offer.id]: texture,
          }));
        },
        undefined,
        (error) => {
          console.error("[StudioCLTD offers] Texture failed to load", {
            error,
            offer: offer.name,
            path: offer.imagePath,
          });
        }
      );
    });

    return () => {
      disposed = true;
    };
  }, []);

  const texture = selectedOffer ? textures[selectedOffer.id] : null;

  useEffect(() => {
    const displayKey = selectedOffer ? `${selectedOffer.id}:${Boolean(texture)}` : "none";
    if (loggedDisplayRef.current === displayKey) return;

    loggedDisplayRef.current = displayKey;
    console.log("[StudioCLTD offers] Current image being displayed", {
      offer: selectedOffer?.name ?? "None",
      path: selectedOffer?.imagePath ?? null,
      textureReady: Boolean(texture),
    });
  }, [selectedOffer, texture]);

  return (
    <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={[8.4, 4.15]} />
      {texture ? (
        <meshStandardMaterial
          color="#c9c9c9"
          depthTest={false}
          emissive="#050505"
          emissiveIntensity={0.015}
          map={texture}
          metalness={0}
          roughness={0.78}
          side={DoubleSide}
        />
      ) : (
        <meshStandardMaterial color="#111827" depthTest={false} emissive="#020304" roughness={0.8} side={DoubleSide} />
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
  const pageOpenedRef = useRef(false);

  const startCountdown = (offer: OfferOption) => {
    onOfferSelect(offer.id);
    setCountdownOfferId(offer.id);
    setCountdownSeconds(3);
    countdownStartedAtRef.current = performance.now();
    pageOpenedRef.current = false;
    console.log("Offer pad entered", offer.name);
    console.log("Countdown started", offer.name);
    console.log(`${offer.name} offer selected`);
  };

  const cancelCountdown = (offer: OfferOption) => {
    if (countdownOfferId !== offer.id || pageOpenedRef.current) return;

    setCountdownOfferId(null);
    setCountdownSeconds(0);
    console.log("Countdown cancelled", offer.name);
  };

  useFrame(() => {
    if (!countdownOfferId) return;

    const elapsed = performance.now() - countdownStartedAtRef.current;
    const remaining = Math.max(0, Math.ceil((offerCountdownMs - elapsed) / 1000));
    setCountdownSeconds((current) => (current === remaining ? current : remaining));

    if (elapsed < offerCountdownMs || pageOpenedRef.current) return;

    pageOpenedRef.current = true;
    setCountdownOfferId(null);
    setCountdownSeconds(0);
    console.log("Opening offers page", offersPageUrl);
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

    if (!hitPlayer) {
      console.log("[StudioCLTD offers] Ignored non-player offer pad intersection", {
        colliderObject: event.other.colliderObject?.name,
        offer: offer.name,
        rigidBodyObject: event.other.rigidBodyObject?.name,
      });
      return false;
    }

    return true;
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
    const pulse = active ? 1 + Math.sin(clock.elapsedTime * 9) * 0.045 : 1;
    const opacity = active ? 0.78 + Math.sin(clock.elapsedTime * 12) * 0.12 : 0.5;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(pulse);
      const material = ringRef.current.material;
      if (material && !Array.isArray(material) && "opacity" in material) {
        material.opacity = opacity;
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active;
      pulseRef.current.scale.setScalar(active ? 1.15 + Math.sin(clock.elapsedTime * 10) * 0.08 : 1);
      const material = pulseRef.current.material;
      if (material && !Array.isArray(material) && "opacity" in material) {
        material.opacity = active ? 0.2 : 0;
      }
    }
  });

  return (
    <group name={`OfferPortal:${offer.id}`} position={offer.position}>
      <CuboidCollider
        sensor
        args={[0.95, 0.28, 0.95]}
        position={[0, 0.45, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <torusGeometry args={[0.84, 0.024, 10, 96]} />
        <meshBasicMaterial color={active ? "#ffe58a" : white} transparent opacity={active ? 0.9 : 0.5} depthWrite={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.58, 0.88, 96]} />
        <meshBasicMaterial color="#ffd35c" transparent opacity={0} depthWrite={false} />
      </mesh>
      <Text
        color={white}
        fontSize={offer.id === "site-improvement" ? 0.22 : 0.28}
        anchorX="center"
        anchorY="middle"
        position={[0, 1.05, 0]}
        maxWidth={2.8}
      >
        {offer.name}
      </Text>
      {countdownSeconds > 0 && (
        <Text
          color="#ffd76b"
          fontSize={0.2}
          anchorX="center"
          anchorY="middle"
          position={[0, 1.48, 0]}
          maxWidth={3.2}
        >
          {`Opening offers page in ${countdownSeconds}...`}
        </Text>
      )}
      <pointLight color="#ffd35c" intensity={active ? 5.5 : 0.8} distance={active ? 6 : 3} position={[0, 0.72, 0]} />
    </group>
  );
}

function EntranceMarker({ section }: { section: HubSection }) {
  return (
    <group name={`EntranceMarker:${section.id}`} position={[0, 0.24, 6.2]}>
      <mesh rotation-x={-Math.PI / 2}>
        <torusGeometry args={[2.3, 0.045, 10, 72]} />
        <meshBasicMaterial color={white} transparent opacity={0.58} />
      </mesh>
      <pointLight color="#ffffff" intensity={3.2} distance={8} position={[0, 1.2, 0]} />
    </group>
  );
}

function TriggerZone({ section }: { section: HubSection }) {
  return (
    <group name={`TriggerZone:${section.id}`} position={[0, 1.8, 6.2]}>
      <CuboidCollider sensor args={[4.5, 1.8, 4.5]} />
      <mesh position={[0, -1.66, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[4.2, 4.35, 72]} />
        <meshBasicMaterial color={white} transparent opacity={0.13} />
      </mesh>
    </group>
  );
}
