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
} from "@react-three/drei";
import * as THREE from "three";

// --- 1. SMART POSITIONING (Instant Entry) ---
function CameraManager() {
  const { camera, scene, controls } = useThree();
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // Position at eye level inside the room
    camera.position.set(center.x, 1.6, center.z + 0.5);
    if (controls) {
      (controls as any).target.set(center.x, 1.4, center.z);
      (controls as any).update();
    }
  }, [scene, camera, controls]);
  return null;
}

// --- 2. VENEER SCENE (Fast & Selective) ---
function Scene({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  // PRE-SCAN: Identify paintable parts ONLY ONCE when model loads
  const paintableWalls = useMemo(() => {
    const list: THREE.Mesh[] = [];
    if (!scene) return list;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const name = obj.name.toLowerCase();

        // SURGICAL FILTER: Exclude everything that ISN'T a wall
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
          // Prepare a single reusable material for this mesh
          const oldMat = obj.material as THREE.MeshStandardMaterial;
          const newMat = oldMat.clone();
          newMat.name = "active_veneer";
          newMat.map = null; // Remove heavy textures for speed
          newMat.roughness = 0.45; // Wood-like sheen
          newMat.metalness = 0.02;
          obj.material = newMat;
          list.push(obj);
        }
      }
    });
    return list;
  }, [scene]);

  // INSTANT UPDATE: Change colors without re-scanning or re-cloning
  useEffect(() => {
    const colorObj = new THREE.Color(wallColor).convertSRGBToLinear();
    paintableWalls.forEach((mesh) => {
      (mesh.material as THREE.MeshStandardMaterial).color.copy(colorObj);
    });
  }, [paintableWalls, wallColor]);

  return (
    <group>
      <Environment preset="apartment" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <primitive object={scene} />
      <CameraManager />
      <ContactShadows opacity={0.4} scale={10} blur={2} />
    </group>
  );
}

// --- 3. MAIN COMPONENT ---
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

    // Average pixels to reduce camera noise
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
      .toString(16)
      .slice(1)}`;

    setColor(hex);
    setIsCaptured(true);
  }, []);

  if (mode === "vr") {
    return (
      <div className="fixed inset-0 bg-[#f3f4f6] flex flex-col">
        <button
          onClick={() => setMode("camera")}
          className="absolute top-8 left-8 z-50 bg-black text-white px-6 py-3 rounded-2xl font-bold shadow-2xl"
        >
          ← BACK
        </button>

        {/* Performance: Antialias off on mobile for speed */}
        <Canvas gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}>
          <color attach="background" args={["#f3f4f6"]} />
          <Suspense
            fallback={
              <Html
                center
                className="font-bold opacity-50 uppercase tracking-widest"
              >
                Entering VR...
              </Html>
            }
          >
            <Scene wallColor={color} />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border">
          <div
            className="w-8 h-8 rounded-full border shadow-inner"
            style={{ backgroundColor: color }}
          />
          <span className="font-black text-black uppercase text-sm tracking-widest">
            Veneer: {color}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      <div className="relative flex-1">
        <Webcam
          ref={webcamRef}
          className="h-full w-full object-cover"
          onTouchStart={pickColor}
          onClick={pickColor}
          videoConstraints={{ facingMode: "environment" }} // BACK CAMERA FIXED
        />
        <canvas ref={canvasRef} className="hidden" />
        {isCaptured && (
          <div
            className="absolute w-12 h-12 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-2xl"
            style={{ left: tapPos.x, top: tapPos.y, backgroundColor: color }}
          />
        )}
      </div>
      <div className="bg-white p-10 rounded-t-[3.5rem] shadow-2xl flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-md">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-3xl border-4"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase">
                Selection
              </p>
              <p className="text-3xl font-mono font-black">
                {color.toUpperCase()}
              </p>
            </div>
          </div>
          {isCaptured && (
            <button
              onClick={() => setMode("vr")}
              className="bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-bold shadow-lg"
            >
              VR VIEW
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
