"use client";

import React, {
  useRef,
  useState,
  useCallback,
  Suspense,
  useEffect,
  useMemo,
} from "react";
import Webcam from "react-webcam";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Html,
  ContactShadows,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";

// Preload the model
useGLTF.preload("/room.glb");

function CameraManager() {
  const { camera, scene, controls } = useThree();
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    camera.position.set(center.x, 1.6, center.z + 1); // Slight offset for better view
    if (controls) {
      (controls as any).target.set(center.x, 1.4, center.z);
      (controls as any).update();
    }
  }, [scene, camera, controls]);
  return null;
}

function Scene({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  // MATERIAL CALIBRATION: Realistic Wall Paint
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.85, // High roughness = Matte paint
        metalness: 0.0, // Walls are never metallic
        envMapIntensity: 0.5, // Reduce reflections on the wall
      }),
    []
  );

  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const name = obj.name.toLowerCase();
        const isFloor = name.includes("floor") || name.includes("ground");
        const isFurniture =
          name.includes("sofa") ||
          name.includes("couch") ||
          name.includes("plant") ||
          name.includes("lamp") ||
          name.includes("shelf") ||
          name.includes("cushion") ||
          name.includes("frame");
        const isCeiling = name.includes("ceiling") || name.includes("roof");

        if (!isFloor && !isFurniture && !isCeiling) {
          obj.material = wallMaterial;
        }
      }
    });
  }, [scene, wallMaterial]);

  useEffect(() => {
    // Convert hex to linear space for Three.js lighting math
    wallMaterial.color.set(wallColor).convertSRGBToLinear();
  }, [wallColor, wallMaterial]);

  return (
    <group>
      {/* NEUTRAL LIGHTING: Prevents the walls from looking blue or yellow */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer
            intensity={0.8}
            rotation-x={Math.PI / 2}
            position={[0, 5, -9]}
            scale={[10, 10, 1]}
          />
          <Lightformer
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, 1, -1]}
            scale={[10, 2, 1]}
          />
          <Lightformer
            intensity={2}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={[20, 2, 1]}
          />
        </group>
      </Environment>

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.5} />

      <primitive object={scene} />
      <CameraManager />
      {/* Shadow optimization: lower blur for mobile speed */}
      <ContactShadows opacity={0.25} scale={10} blur={1.5} far={1.6} />
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

  const pickColor = useCallback((e: any) => {
    if (!webcamRef.current || !canvasRef.current) return;
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const rect = video.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
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
          {isCaptured && (
            <div
              className="absolute w-12 h-12 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg"
              style={{ left: tapPos.x, top: tapPos.y, backgroundColor: color }}
            />
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-white p-10 rounded-t-[3.5rem] flex flex-col items-center shadow-2xl">
            <div className="flex items-center justify-between w-full max-w-md">
              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-2xl border-4"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    Selected Color
                  </p>
                  <p className="text-3xl font-mono font-black">
                    {color.toUpperCase()}
                  </p>
                </div>
              </div>
              {isCaptured && (
                <button
                  onClick={() => setMode("vr")}
                  className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-bold shadow-xl active:scale-95 transition-transform"
                >
                  VR VIEW
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 bg-[#f3f4f6]">
          <button
            onClick={() => setMode("camera")}
            className="absolute top-8 left-8 z-50 bg-white/90 backdrop-blur text-black px-6 py-3 rounded-2xl font-bold shadow-lg"
          >
            ← RETAKE
          </button>

          <Canvas
            // AgX ToneMapping is MUCH better for color accuracy than the default
            gl={{
              antialias: false,
              powerPreference: "high-performance",
              toneMapping: THREE.AgXToneMapping,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            dpr={[1, 1.5]}
            camera={{ fov: 45 }}
          >
            <Suspense fallback={<Html center>Optimizing Scene...</Html>}>
              <Scene wallColor={color} />
            </Suspense>
            <OrbitControls
              makeDefault
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 1.5}
            />
          </Canvas>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-8 py-4 rounded-3xl shadow-xl border border-white">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-bold text-black uppercase text-sm tracking-tighter">
                Paint: {color}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
