import { Html, Text } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
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
  Texture,
  TextureLoader,
  Vector3,
  VideoTexture,
} from "three";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { gameTextFont } from "../../ui/textFont";
import { hubSections, HubSection } from "../hubSections";

type HubSectionsProps = {
  restartKey: number;
  serviceResolutions: Record<string, boolean>;
};

const center = new Vector3(0, 0, 0);
const sectionPosition = new Vector3();
const offerCountdownMs = 3000;
const offerDisplayMs = 10000;
const simpleDisplayMs = 10000;
const portalTriggerRadius = 1.06;
const portalActivationCooldownMs = 900;
const offersPageUrl = "https://www.crystalthedeveloper.ca/offers";
const white = "#f5f7fb";
const softWhite = "#d8dde8";
const screenImageTint = "#c7c7c7";
const screenIdleColor = "#0b1018";
const screenContentSize: [number, number] = [9.05, 4.62];
const screenContentAspect = screenContentSize[0] / screenContentSize[1];
const serviceSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const serviceScreenImages: Record<string, { bad: string; good: string }> = {
  "quick-fix": {
    bad: "/images/optimized/quickFix/quick-fix-bad.jpg",
    good: "/images/optimized/quickFix/quick-fix-good.jpg",
  },
  "urgent-fix": {
    bad: "/images/optimized/urgentFix/urgent-fix-bad.jpg",
    good: "/images/optimized/urgentFix/urgent-fix-good.jpg",
  },
  performance: {
    bad: "/images/optimized/performance/performance-bad.jpg",
    good: "/images/optimized/performance/performance-good.webp",
  },
  "site-improvement": {
    bad: "/images/optimized/siteImprovement/site-improvement-bad.jpg",
    good: "/images/optimized/siteImprovement/site-improvement-good.webp",
  },
};
const simpleDisplaySections: Record<string, { imagePath: string; label: string }> = {
  tips: {
    imagePath: "/images/optimized/tips/tip.jpg",
    label: "Show Tip",
  },
};
const valueDisplayOptions = [
  { id: "trust", label: "Trust", imagePath: "/images/optimized/values/value.jpg", position: [-1.8, 0.18, 9.2] as [number, number, number] },
  { id: "speed", label: "Speed", imagePath: "/images/optimized/values/value-2.jpg", position: [1.8, 0.18, 9.2] as [number, number, number] },
];
const offerOptions = [
  {
    id: "quick-fix",
    imagePath: "/images/optimized/offers/quick-fix.jpg",
    name: "Quick Fix",
    position: [-5.4, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "urgent-fix",
    imagePath: "/images/optimized/offers/urgent-fix.jpg",
    name: "Urgent Fix",
    position: [-1.8, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "performance",
    imagePath: "/images/optimized/offers/performance.jpg",
    name: "Performance",
    position: [1.8, 0.18, 9.2] as [number, number, number],
  },
  {
    id: "site-improvement",
    imagePath: "/images/optimized/offers/site-improvement.jpg",
    name: "Site Improvement",
    position: [5.4, 0.18, 9.2] as [number, number, number],
  },
];

type OfferOption = (typeof offerOptions)[number];
type ShowcaseVideoState = {
  playing: boolean;
};

const textureLoader = new TextureLoader();
const lazyTextureCache = new Map<string, Texture>();
const lazyTexturePromises = new Map<string, Promise<Texture>>();
let lazyTextureRequestIndex = 0;
let showcaseVideoElement: HTMLVideoElement | null = null;
let showcaseVideoTexture: VideoTexture | null = null;
let showcaseUnlockPromise: Promise<void> | null = null;
const requiredScreenImagePaths = Array.from(
  new Set([
    ...Object.values(serviceScreenImages).flatMap((images) => [images.bad, images.good]),
    ...Object.values(simpleDisplaySections).map((display) => display.imagePath),
    ...valueDisplayOptions.map((display) => display.imagePath),
    ...offerOptions.map((offer) => offer.imagePath),
  ])
);

function configureScreenTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  configureTextureCover(texture, screenContentAspect);
  texture.needsUpdate = true;
}

function loadScreenTexture(path: string) {
  const cached = lazyTextureCache.get(path);
  if (cached) return Promise.resolve(cached);

  const existingPromise = lazyTexturePromises.get(path);
  if (existingPromise) return existingPromise;

  const loadPromise = textureLoader.loadAsync(path).then((loadedTexture) => {
    configureScreenTexture(loadedTexture);
    lazyTextureCache.set(path, loadedTexture);
    lazyTexturePromises.delete(path);
    return loadedTexture;
  });

  lazyTexturePromises.set(path, loadPromise);
  return loadPromise;
}

export function preloadScreenTextures() {
  return Promise.allSettled(requiredScreenImagePaths.map(loadScreenTexture)).then(() => undefined);
}

function configureTextureCover(texture: Texture, targetAspect: number) {
  const image = texture.image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number }
    | undefined;
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!width || !height) return;

  const imageAspect = width / height;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);

  if (imageAspect > targetAspect) {
    const repeatX = targetAspect / imageAspect;
    texture.repeat.x = repeatX;
    texture.offset.x = (1 - repeatX) / 2;
    return;
  }

  const repeatY = imageAspect / targetAspect;
  texture.repeat.y = repeatY;
  texture.offset.y = (1 - repeatY) / 2;
}

function useLazyScreenTexture(path: string | null, enabled: boolean, delayMs = 0) {
  const [texture, setTexture] = useState<Texture | null>(() => (path ? lazyTextureCache.get(path) ?? null : null));
  const cachedTexture = path && enabled ? lazyTextureCache.get(path) ?? null : null;

  useEffect(() => {
    if (!path || !enabled) {
      setTexture(null);
      return undefined;
    }

    const cached = lazyTextureCache.get(path);
    if (cached) {
      setTexture(cached);
      return undefined;
    }

    let cancelled = false;
    const requestDelay = delayMs + lazyTextureRequestIndex * 90;
    lazyTextureRequestIndex += 1;

    const timeout = window.setTimeout(() => {
      loadScreenTexture(path).then((loadedTexture) => {
        if (cancelled) return;

        setTexture(loadedTexture);
      }).catch(() => undefined);
    }, requestDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [delayMs, enabled, path]);

  return enabled ? cachedTexture ?? texture : null;
}

function getShowcaseVideoElement() {
  if (!showcaseVideoElement) {
    const video = document.createElement("video");
    const useMobileVideo = window.matchMedia("(max-width: 768px)").matches;
    video.src = useMobileVideo ? "/videos/showcase-mobile.mp4" : "/videos/showcase.mp4";
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;
    video.preload = "metadata";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    showcaseVideoElement = video;
    console.info("[Showcase] Video initialized");
  }

  return showcaseVideoElement;
}

function pauseShowcaseVideo(video = getShowcaseVideoElement(), reset = false) {
  video.pause();
  if (reset) video.currentTime = 0;
  console.info("[Showcase] Video paused");
}

function playShowcaseVideo(video = getShowcaseVideoElement(), restart = true) {
  if (restart) video.currentTime = 0;

  return video.play().then(() => {
    console.info("[Showcase] Video playing");
    return true;
  }).catch((error: unknown) => {
    console.error("[Showcase] Video playback failed", error);
    return false;
  });
}

export function unlockShowcaseVideoPlayback() {
  if (showcaseUnlockPromise) return showcaseUnlockPromise;

  const video = getShowcaseVideoElement();
  showcaseUnlockPromise = video.play().then(() => {
    pauseShowcaseVideo(video, true);
    console.info("[Showcase] Mobile playback unlocked");
  }).catch((error: unknown) => {
    showcaseUnlockPromise = null;
    console.error("[Showcase] Video playback failed", error);
  });

  return showcaseUnlockPromise;
}

function getShowcaseVideoTexture(video: HTMLVideoElement) {
  if (!showcaseVideoTexture) {
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = false;
    showcaseVideoTexture = texture;
  }

  return showcaseVideoTexture;
}

export function HubSections({ restartKey, serviceResolutions }: HubSectionsProps) {
  const displayTimersRef = useRef<Record<string, number>>({});
  const [activeSimpleDisplays, setActiveSimpleDisplays] = useState<Record<string, string>>({});
  const [visibleSectionCount, setVisibleSectionCount] = useState(2);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [showcaseVideoState, setShowcaseVideoState] = useState<ShowcaseVideoState>({
    playing: false,
  });

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
    setVisibleSectionCount(2);
    setActiveSimpleDisplays({});
    setSelectedOfferId(null);
    setShowcaseVideoState({ playing: false });

    if (showcaseVideoElement) {
      pauseShowcaseVideo(showcaseVideoElement, true);
    }
  }, [restartKey]);

  useEffect(() => {
    if (visibleSectionCount >= hubSections.length) return undefined;

    const timeout = window.setTimeout(() => {
      setVisibleSectionCount((current) => Math.min(hubSections.length, current + 2));
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [visibleSectionCount]);

  const showSimpleDisplay = (sectionId: string, imagePath: string) => {
    const existingTimer = displayTimersRef.current[sectionId];
    if (existingTimer) window.clearTimeout(existingTimer);

    setActiveSimpleDisplays((current) => ({
      ...current,
      [sectionId]: imagePath,
    }));

    displayTimersRef.current[sectionId] = window.setTimeout(() => {
      setActiveSimpleDisplays((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== sectionId)),
      );
      delete displayTimersRef.current[sectionId];
    }, simpleDisplayMs);
  };

  return (
    <group name="HubSections">
      <HubPaths />
      {hubSections.slice(0, visibleSectionCount).map((section) => (
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
            if (showcaseVideoElement) pauseShowcaseVideo(showcaseVideoElement);
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
  activeSimpleDisplays: Record<string, string>;
  onOfferSelect: (offerId: string | null) => void;
  onShowcasePause: () => void;
  onShowcasePlay: () => void;
  onSimpleDisplayTrigger: (sectionId: string, imagePath: string) => void;
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
          onPlayerEnter={() => onSimpleDisplayTrigger(section.id, simpleDisplaySections[section.id].imagePath)}
        />
      )}
      {section.id === "value" && (
        <ValueDisplaySelector
          selectedImagePath={activeSimpleDisplays.value ?? null}
          onSelect={(imagePath) => onSimpleDisplayTrigger("value", imagePath)}
        />
      )}
      {section.id === "showcase" && (
        <ShowcaseSelector
          isPlaying={showcaseVideoState.playing}
          onPlayerEnter={onShowcasePlay}
          onPlayerExit={onShowcasePause}
        />
      )}
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
  activeSimpleDisplays: Record<string, string>;
  section: HubSection;
  serviceResolutions: Record<string, boolean>;
  selectedOffer: OfferOption | null;
  showcaseVideoState: ShowcaseVideoState;
}) {
  const isOffers = section.id === "offers";
  const simpleDisplay = simpleDisplaySections[section.id];
  const selectedSimpleDisplayPath = activeSimpleDisplays[section.id] ?? null;
  const isServiceSection = serviceSectionIds.includes(section.id);
  const isShowcase = section.id === "showcase";
  const isFramePrototype = section.id === "value";

  return (
    <group name={`Billboard:${section.id}`} position={[0, 4.8, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[5.35, 3.05, 0.24]} position={[0, 0.12, -0.1]} />
        <mesh position={[0, 0, -0.08]}>
          <boxGeometry args={[10.4, 5.8, 0.32]} />
          <meshStandardMaterial
            color={isFramePrototype ? "#28313b" : "#101621"}
            emissive={isFramePrototype ? "#111820" : "#000000"}
            emissiveIntensity={isFramePrototype ? 0.32 : 0}
            metalness={isFramePrototype ? 0.82 : 0.72}
            roughness={isFramePrototype ? 0.24 : 0.34}
          />
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
          <meshBasicMaterial
            color={softWhite}
            transparent
            opacity={0.64}
            toneMapped={false}
          />
        </mesh>
        {isFramePrototype && <BrightTvFrame />}
      </RigidBody>
      <Text
        color={white}
        font={gameTextFont}
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
      ) : simpleDisplay || section.id === "value" ? (
        <SimpleDisplayScreen imagePath={selectedSimpleDisplayPath} />
      ) : isServiceSection ? (
        <ServiceScreenContent resolved={Boolean(serviceResolutions[section.id])} section={section} />
      ) : isShowcase ? (
        <ShowcaseScreenContent isPlaying={showcaseVideoState.playing} />
      ) : (
        <Text
          color="#9fb5cc"
          font={gameTextFont}
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
            font={gameTextFont}
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

function BrightTvFrame() {
  const railColor = "#ffd66b";
  const cornerX = 5.31;
  const cornerY = 2.84;
  const horizontalLength = 0.72;
  const verticalLength = 0.72;

  return (
    <group name="BrightTvFramePrototype" position={[0, 0, -0.3]}>
      {([-1, 1] as const).flatMap((xDirection) =>
        ([-1, 1] as const).map((yDirection) => (
          <group key={`${xDirection}-${yDirection}`}>
            <mesh
              position={[
                xDirection * (cornerX - horizontalLength / 2),
                yDirection * cornerY,
                0,
              ]}
            >
              <boxGeometry args={[horizontalLength, 0.1, 0.12]} />
              <meshBasicMaterial color={railColor} toneMapped={false} />
            </mesh>
            <mesh
              position={[
                xDirection * cornerX,
                yDirection * (cornerY - verticalLength / 2),
                0,
              ]}
            >
              <boxGeometry args={[0.1, verticalLength, 0.12]} />
              <meshBasicMaterial color={railColor} toneMapped={false} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

function OffersScreenContent({ selectedOffer }: { selectedOffer: OfferOption | null }) {
  const texture = useLazyScreenTexture(selectedOffer?.imagePath ?? null, Boolean(selectedOffer));

  return (
    <mesh key={selectedOffer?.id ?? "offers-empty-screen"} position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={screenContentSize} />
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

function SimpleDisplayScreen({ imagePath }: { imagePath: string | null }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const texture = useLazyScreenTexture(imagePath, Boolean(imagePath));

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.map = texture;
    material.color.set(texture ? screenImageTint : screenIdleColor);
    material.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={screenContentSize} />
      <meshBasicMaterial ref={materialRef} color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
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
  const texturePath = resolved ? goodImage : badImage;
  const texture = useLazyScreenTexture(texturePath, true, 240);

  return (
    <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
      <planeGeometry args={screenContentSize} />
      {texture ? (
        <meshBasicMaterial color={screenImageTint} depthTest={false} map={texture} side={DoubleSide} toneMapped />
      ) : (
        <meshBasicMaterial color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
      )}
    </mesh>
  );
}

function ShowcaseScreenContent({ isPlaying }: { isPlaying: boolean }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const screenOpacityRef = useRef(0);
  const [videoTexture, setVideoTexture] = useState<VideoTexture | null>(() => showcaseVideoTexture);
  const [showTapToPlay, setShowTapToPlay] = useState(false);

  useEffect(() => {
    if (!isPlaying && !showcaseVideoElement) return undefined;

    const video = getShowcaseVideoElement();
    let disposed = false;

    const attachTextureWhenReady = () => {
      if (disposed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      setVideoTexture(getShowcaseVideoTexture(video));
    };

    video.addEventListener("loadeddata", attachTextureWhenReady);
    video.addEventListener("canplay", attachTextureWhenReady);
    video.addEventListener("playing", attachTextureWhenReady);

    if (isPlaying) {
      setShowTapToPlay(false);
      void playShowcaseVideo(video).then((playing) => {
        if (disposed) return;
        setShowTapToPlay(!playing);
        if (playing) attachTextureWhenReady();
      });
      attachTextureWhenReady();
    } else {
      pauseShowcaseVideo(video);
      setShowTapToPlay(false);
      screenOpacityRef.current = 0;
      if (materialRef.current) materialRef.current.opacity = 0;
      if (showcaseVideoTexture) showcaseVideoTexture.needsUpdate = false;
    }

    return () => {
      disposed = true;
      video.removeEventListener("loadeddata", attachTextureWhenReady);
      video.removeEventListener("canplay", attachTextureWhenReady);
      video.removeEventListener("playing", attachTextureWhenReady);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (showcaseVideoElement) pauseShowcaseVideo(showcaseVideoElement);
    };
  }, []);

  const handleTapToPlay = () => {
    const video = getShowcaseVideoElement();
    void playShowcaseVideo(video).then((playing) => {
      setShowTapToPlay(!playing);
      if (playing && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setVideoTexture(getShowcaseVideoTexture(video));
      }
    });
  };

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    if (!isPlaying && screenOpacityRef.current <= 0.01) return;

    const targetOpacity = isPlaying && videoTexture ? 1 : 0;
    screenOpacityRef.current = MathUtils.damp(screenOpacityRef.current, targetOpacity, isPlaying ? 8 : 18, Math.min(delta, 1 / 30));
    material.opacity = screenOpacityRef.current;
  });

  return (
    <>
      <mesh position={[0, -0.03, -0.2]} renderOrder={20}>
        <planeGeometry args={screenContentSize} />
        {videoTexture ? (
          <meshBasicMaterial
            ref={materialRef}
            color={screenImageTint}
            depthTest={false}
            map={videoTexture}
            opacity={0}
            side={DoubleSide}
            toneMapped
            transparent
          />
        ) : (
          <meshBasicMaterial color={screenIdleColor} depthTest={false} side={DoubleSide} toneMapped />
        )}
      </mesh>
      {isPlaying && showTapToPlay && (
        <Html center position={[0, -0.03, -0.42]} transform distanceFactor={8} zIndexRange={[50, 40]}>
          <button className="showcase-play-fallback" type="button" onClick={handleTapToPlay}>
            Tap to Play Video
          </button>
        </Html>
      )}
    </>
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
  const countdownIntervalRef = useRef(0);
  const offerOpenTimerRef = useRef(0);
  const pageOpenedRef = useRef(false);

  const clearCountdownTimers = () => {
    window.clearInterval(countdownIntervalRef.current);
    window.clearTimeout(offerOpenTimerRef.current);
    countdownIntervalRef.current = 0;
    offerOpenTimerRef.current = 0;
  };

  const startCountdown = (offer: OfferOption) => {
    clearCountdownTimers();
    onOfferSelect(offer.id);
    setCountdownOfferId(offer.id);
    countdownSecondsRef.current = 3;
    setCountdownSeconds(3);
    countdownStartedAtRef.current = performance.now();
    pageOpenedRef.current = false;

    countdownIntervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - countdownStartedAtRef.current;
      const remaining = Math.max(0, Math.ceil((offerCountdownMs - elapsed) / 1000));
      if (countdownSecondsRef.current === remaining) return;

      countdownSecondsRef.current = remaining;
      setCountdownSeconds(remaining);
    }, 180);

    offerOpenTimerRef.current = window.setTimeout(() => {
      pageOpenedRef.current = true;
      clearCountdownTimers();
      setCountdownOfferId(null);
      countdownSecondsRef.current = 0;
      setCountdownSeconds(0);
      window.open(offersPageUrl, "_blank", "noopener,noreferrer");
    }, offerCountdownMs);
  };

  const cancelCountdown = (offer: OfferOption) => {
    if (countdownOfferId !== offer.id || pageOpenedRef.current) return;

    clearCountdownTimers();
    setCountdownOfferId(null);
    countdownSecondsRef.current = 0;
    setCountdownSeconds(0);
  };

  useEffect(() => clearCountdownTimers, []);

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

function ValueDisplaySelector({
  onSelect,
  selectedImagePath,
}: {
  onSelect: (imagePath: string) => void;
  selectedImagePath: string | null;
}) {
  return (
    <group name="ValueDisplaySelector">
      {valueDisplayOptions.map((option) => (
        <ShowcasePortalPad
          key={option.id}
          active={selectedImagePath === option.imagePath}
          label={option.label}
          name={`ValueDisplayPortal:${option.id}`}
          onPlayerEnter={() => onSelect(option.imagePath)}
          onPlayerExit={() => undefined}
          position={option.position}
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
  const activatedThisEntryRef = useRef(false);
  const lastActivatedAtRef = useRef(-Infinity);
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
    activatedThisEntryRef.current = false;

    const now = performance.now();
    if (now - lastActivatedAtRef.current < portalActivationCooldownMs) return;
    lastActivatedAtRef.current = now;
    activatedThisEntryRef.current = true;
    onPlayerEnter();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event) || !playerInsideRef.current) return;
    playerInsideRef.current = false;
    if (activatedThisEntryRef.current) onPlayerExit();
    activatedThisEntryRef.current = false;
  };

  useFrame(({ clock }) => {
    if (!active && !wasActiveRef.current) return;

    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const pulse = 1 + activationGlow * 0.05;
    const opacity = 0.56 + activationGlow * 0.28;
    wasActiveRef.current = active;

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
      <CylinderCollider
        sensor
        args={[0.28, portalTriggerRadius]}
        position={[0, 0.32, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <torusGeometry args={[1, 0.026, 8, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.56} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.68, 1.05, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <BillboardLabel
        color={white}
        fontSize={offer.id === "site-improvement" ? 0.22 : 0.28}
        position={[0, 1.05, 0]}
        maxWidth={2.8}
        maxVisibleDistance={12}
      >
        {offer.name}
      </BillboardLabel>
      {countdownSeconds > 0 && (
        <BillboardLabel
          color="#FFE600"
          fontSize={0.2}
          position={[0, 1.48, 0]}
          maxWidth={3.2}
          maxVisibleDistance={12}
        >
          {`Opening offers page in ${countdownSeconds}...`}
        </BillboardLabel>
      )}
    </group>
  );
}

function ShowcasePortalPad({
  active,
  label,
  name,
  onPlayerEnter,
  onPlayerExit,
  position = [0, 0.18, 9.2],
}: {
  active: boolean;
  label: string;
  name: string;
  onPlayerEnter: () => void;
  onPlayerExit: () => void;
  position?: [number, number, number];
}) {
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const playerInsideRef = useRef(false);
  const activatedThisEntryRef = useRef(false);
  const lastActivatedAtRef = useRef(-Infinity);
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
    activatedThisEntryRef.current = false;

    const now = performance.now();
    if (now - lastActivatedAtRef.current < portalActivationCooldownMs) return;
    lastActivatedAtRef.current = now;
    activatedThisEntryRef.current = true;
    onPlayerEnter();
  };

  const deactivate = () => {
    if (!playerInsideRef.current) return;
    playerInsideRef.current = false;
    if (activatedThisEntryRef.current) onPlayerExit();
    activatedThisEntryRef.current = false;
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
    if (!active && !wasActiveRef.current) return;

    if (active && !wasActiveRef.current) {
      activeStartedAtRef.current = clock.elapsedTime;
    }

    const activationGlow = active ? Math.max(0, 1 - (clock.elapsedTime - activeStartedAtRef.current) / 1) : 0;
    const steadyGlow = active ? 0.2 : 0;
    const pulse = 1 + activationGlow * 0.05;
    const opacity = 0.58 + steadyGlow + activationGlow * 0.16;
    wasActiveRef.current = active;

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
    <group name={name} position={position}>
      <CylinderCollider
        sensor
        args={[0.28, portalTriggerRadius]}
        position={[0, 0.32, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}>
        <torusGeometry args={[1, 0.026, 8, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.58} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.68, 1.05, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <BillboardLabel color={white} fontSize={0.28} position={[0, 1.05, 0]} maxWidth={3} maxVisibleDistance={12}>
        {label}
      </BillboardLabel>
    </group>
  );
}
