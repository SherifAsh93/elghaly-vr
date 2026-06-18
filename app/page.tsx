"use client";

import React, {
  useRef,
  useState,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import Webcam from "react-webcam";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// Procedural room — no GLB needed, loads instantly
function Room({ wallColor }: { wallColor: string }) {
  const color = useMemo(() => new THREE.Color(wallColor), [wallColor]);
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c8bfb0",
        roughness: 0.9,
        metalness: 0.0,
      }),
    []
  );
  const ceilingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0ece6",
        roughness: 0.95,
        metalness: 0.0,
      }),
    []
  );

  // update wall color reactively without recreating material
  React.useEffect(() => {
    wallMat.color.set(wallColor).convertSRGBToLinear();
    wallMat.needsUpdate = true;
  }, [wallColor, wallMat]);

  const W = 6; // room width
  const D = 5; // room depth
  const H = 3; // room height

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 3, -2]} intensity={0.3} />
      {/* Soft ceiling light */}
      <pointLight position={[0, H - 0.2, 0]} intensity={0.5} color="#fff5e0" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <primitive object={ceilingMat} attach="material" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-W / 2, H / 2, 0]} receiveShadow>
        <planeGeometry args={[D, H]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[W / 2, H / 2, 0]} receiveShadow>
        <planeGeometry args={[D, H]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Simple furniture suggestions — couch silhouette */}
      <mesh position={[0, 0.25, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.5, 0.9]} />
        <meshStandardMaterial color="#7a6e64" roughness={0.9} />
      </mesh>
      {/* Couch back */}
      <mesh position={[0, 0.65, -2.2]} castShadow>
        <boxGeometry args={[2.4, 0.35, 0.25]} />
        <meshStandardMaterial color="#7a6e64" roughness={0.9} />
      </mesh>
      {/* Coffee table */}
      <mesh position={[0, 0.2, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.08, 0.55]} />
        <meshStandardMaterial color="#5c4f3a" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Table legs */}
      {[[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, -0.6 + z]} castShadow>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshStandardMaterial color="#4a3e2c" roughness={0.7} />
        </mesh>
      ))}

      <ContactShadows opacity={0.3} scale={8} blur={2} far={1.5} />
    </group>
  );
}

export default function MobileColorPicker() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#ffffff");
  const [mode, setMode] = useState<"camera" | "vr">("camera");
  const [isCaptured, setIsCaptured] = useState(false);
  const [tapPos, setTapPos] = useState({ x: 0, y: 0 });

  const pickColor = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!webcamRef.current || !canvasRef.current) return;
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const rect = video.getBoundingClientRect();
    const touch = (e as React.TouchEvent).touches?.[0];
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    setTapPos({ x: clientX, y: clientY });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
      .toString(16)
      .slice(1)}`;
    setColor(hex);
    setIsCaptured(true);
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {mode === "camera" ? (
        <div className="relative flex-1">
          <Webcam
            ref={webcamRef}
            className="h-full w-full object-cover"
            onTouchStart={pickColor}
            onClick={pickColor}
            videoConstraints={{ facingMode: "environment" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Tap hint */}
          {!isCaptured && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 text-white text-sm font-semibold px-5 py-3 rounded-2xl backdrop-blur-sm">
                Tap any surface to pick its color
              </div>
            </div>
          )}

          {isCaptured && (
            <div
              className="absolute w-12 h-12 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg pointer-events-none"
              style={{ left: tapPos.x, top: tapPos.y, backgroundColor: color }}
            />
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-white p-8 rounded-t-[2.5rem] flex flex-col items-center shadow-2xl">
            <div className="flex items-center justify-between w-full max-w-md">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl border-2 border-zinc-200 shadow-md transition-colors duration-300"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    Selected Color
                  </p>
                  <p className="text-2xl font-mono font-black text-zinc-800">
                    {color.toUpperCase()}
                  </p>
                </div>
              </div>
              {isCaptured && (
                <button
                  onClick={() => setMode("vr")}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all text-sm"
                >
                  Preview Room →
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 bg-[#eae6e0]">
          <button
            onClick={() => setMode("camera")}
            className="absolute top-6 left-6 z-50 bg-white/90 backdrop-blur text-black px-5 py-2.5 rounded-xl font-bold shadow-lg text-sm"
          >
            ← Retake
          </button>

          <Canvas
            gl={{
              antialias: true,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            dpr={[1, 1.5]}
            camera={{ fov: 55, position: [2.5, 1.6, 2.8] }}
            shadows
          >
            <Suspense fallback={null}>
              <Room wallColor={color} />
            </Suspense>
            <OrbitControls
              makeDefault
              target={[0, 1.2, -1]}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.1}
              minDistance={1.5}
              maxDistance={5}
              enablePan={false}
            />
          </Canvas>

          {/* Color label */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full border border-zinc-200 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="font-bold text-zinc-800 text-sm font-mono">
              {color.toUpperCase()}
            </span>
            <span className="text-zinc-400 text-xs font-medium">· Drag to explore</span>
          </div>
        </div>
      )}
    </div>
  );
}
