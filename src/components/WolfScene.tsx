import { useRef, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function WolfModel() {
  const hoverGlow = useRef(0.4);
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/wolf.glb");

  const mouse = useRef({ x: 0, y: 0 });
  const gyro = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  const blinkRef = useRef<THREE.Mesh[]>([]);
  const nextBlink = useRef(Math.random() * 3 + 5);
  const blinkPhase = useRef(-1);

  const eyeMaterials = useRef<THREE.MeshStandardMaterial[]>([]);

  // Clone scene so we can modify materials
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    const eyeMats: THREE.MeshStandardMaterial[] = [];
    const eyeMeshes: THREE.Mesh[] = [];

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;

        if (mat.color && mat.color.b > 0.6 && mat.color.r < 0.4) {
          const newMat = mat.clone();
          newMat.emissive = new THREE.Color(0x00ccff);
          newMat.emissiveIntensity = 0.4;

          child.material = newMat;

          eyeMats.push(newMat);
          eyeMeshes.push(child);
        }
      }
    });

    eyeMaterials.current = eyeMats;
    blinkRef.current = eyeMeshes;

    return clone;
  }, [scene]);

  const { gl } = useThree();

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  useEffect(() => {

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleMouseDown = () => {
      hoverGlow.current = 1.5;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("touchstart", handleMouseDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("touchstart", handleMouseDown);
    };

  }, [handleMouseMove, gl]);

  useEffect(() => {

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.gamma !== null) {

        gyro.current.x = THREE.MathUtils.clamp(event.beta / 90, -0.5, 0.5);
        gyro.current.y = THREE.MathUtils.clamp(event.gamma / 90, -0.5, 0.5);

      }
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };

  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // floating motion
    ref.current.position.y = -0.40 + Math.sin(t * 1.2) * 0.05;

    // pointer + gyro target rotation
    const targetRotX =
      THREE.MathUtils.clamp(-mouse.current.y * 0.8, -0.7, 0.7) +
      gyro.current.x * 0.5;

    const targetRotY =
      THREE.MathUtils.clamp(mouse.current.x * 0.6, -0.6, 0.6) +
      gyro.current.y * 0.4;

    // smooth follow
    ref.current.rotation.x += (targetRotX - ref.current.rotation.x) * 0.12;
    ref.current.rotation.y += (targetRotY - ref.current.rotation.y) * 0.08;

    // Eye glow pulse
    const glowIntensity = hoverGlow.current + Math.sin(t * 2) * 0.15;
    hoverGlow.current *= 0.96;

    eyeMaterials.current.forEach((mat) => {
      mat.emissiveIntensity = glowIntensity;
    });

    // Blink animation
    nextBlink.current -= delta;

    if (nextBlink.current <= 0 && blinkPhase.current < 0) {
      blinkPhase.current = 0;
      nextBlink.current = Math.random() * 3 + 5;
    }

    if (blinkPhase.current >= 0) {
      blinkPhase.current += delta * 10;

      const blink =
        blinkPhase.current < 1
          ? 1 - blinkPhase.current
          : blinkPhase.current - 1;

      eyeMaterials.current.forEach((mat) => {
        mat.emissiveIntensity = blink * 0.4;
      });

      if (blinkPhase.current >= 2) {
        blinkPhase.current = -1;
      }
    }

  });

  return (
    <group ref={ref}>
      <primitive
        object={clonedScene}
        scale={1.5}
        rotation={[0, -Math.PI / 2, 0]}
      />
    </group>
  );
}

useGLTF.preload("/models/wolf.glb");

const WolfScene = () => {

  const isMobile = window.innerWidth < 768;

  return (
    <div
      className="w-full h-[100dvh] overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.3, isMobile ? 5.8 : 4.2], fov: 35 }}
        shadows
        dpr={[1, 1.2]}
        gl={{ alpha: true }}
        style={{ background: "transparent" }}
      >

        <ambientLight intensity={0.5} />

        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
        />

        <directionalLight
          position={[-3, 2, -2]}
          intensity={0.3}
        />

        <pointLight
          position={[0, 0, 3]}
          intensity={0.35}
          color="#00ccff"
        />

        <WolfModel />

        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.3}
          scale={6}
          blur={2.5}
          far={4}
        />

      </Canvas>
    </div>
  );
};

export default WolfScene;