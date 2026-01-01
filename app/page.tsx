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
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";

// --- 1. THE POSITIONER (Instant teleport) ---
function CameraManager() {
  const { camera, scene, controls } = useThree();

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    camera.position.set(center.x, 1.6, center.z);
    if (controls) {
      (controls as any).target.set(center.x, 1.6, center.z - 0.1);
      (controls as any).update();
    }
  }, [scene, camera, controls]);

  return null;
}

// --- 2. OPTIMIZED SCENE (Ultra Fast) ---
function Scene({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  // OPTIMIZATION: Scan the room ONLY ONCE when it first loads
  const walls = useMemo(() => {
    const list: THREE.Mesh[] = [];
    if (!scene) return list;

    const box = new THREE.Box3().setFromObject(scene);
    const minY = box.min.y;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const name = obj.name.toLowerCase();
        // Identify walls by height and ignore floor/furniture
        const isFloor = name.includes("floor") || obj.position.y <= minY + 0.05;
        const isProp =
          name.includes("sofa") ||
          name.includes("couch") ||
          name.includes("plant") ||
          name.includes("lamp");

        if (!isFloor && !isProp) {
          // Prepare the material once
          const oldMat = obj.material as THREE.MeshStandardMaterial;
          const newMat = oldMat.clone();
          newMat.name = "veneer_final";
          newMat.map = null; // Remove heavy textures for speed
          obj.material = newMat;
          list.push(obj);
        }
      }
    });
    return list;
  }, [scene]);

  // OPTIMIZATION: Instant color update without re-scanning
  useEffect(() => {
    walls.forEach((mesh) => {
      (mesh.material as THREE.MeshStandardMaterial).color.set(wallColor);
    });
  }, [walls, wallColor]);

  return (
    <group>
      <Environment preset="apartment" />
      <ambientLight intensity={0.8} />
      <primitive object={scene} />
      <CameraManager />
    </group>
  );
}

export default function MobileColorPicker() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#ffffff");
  const [mode, setMode] = useState<"camera" | "vr">("camera");
  const [isCaptured, setIsCaptured] = useState(false);

  const pickColor = useCallback((e: any) => {
    if (!webcamRef.current || !canvasRef.current) return;
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;
    const rect = video.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (video.videoWidth / rect.width);
    const y = (clientY - rect.top) * (video.videoHeight / rect.height);

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixel = context.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
      .toString(16)
      .slice(1)}`;
    setColor(hex);
    setIsCaptured(true);
  }, []);

  if (mode === "vr") {
    return (
      <div className="fixed inset-0 bg-white flex flex-col">
        <button
          onClick={() => setMode("camera")}
          className="absolute top-6 left-6 z-50 bg-black text-white px-6 py-3 rounded-2xl font-bold shadow-xl"
        >
          ← BACK
        </button>

        <Canvas
          shadows
          gl={{ antialias: false, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#f3f4f6"]} />
          <Suspense fallback={<Html center>LOADING...</Html>}>
            <Scene wallColor={color} />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-8 py-4 rounded-full shadow-2xl flex items-center gap-4">
          <div
            className="w-5 h-5 rounded-full border"
            style={{ backgroundColor: color }}
          />
          <span className="font-bold text-black uppercase text-xs">
            Veneer: {color}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      <Webcam
        ref={webcamRef}
        className="h-full w-full object-cover"
        onTouchStart={pickColor}
        onClick={pickColor}
        videoConstraints={{ facingMode: "environment" }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="bg-white p-10 rounded-t-[3rem] shadow-2xl flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-md">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-3xl border-4"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none mb-1">
                Color
              </p>
              <p className="text-3xl font-mono font-black text-zinc-900">
                {color.toUpperCase()}
              </p>
            </div>
          </div>
          {isCaptured && (
            <button
              onClick={() => setMode("vr")}
              className="bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-bold shadow-xl active:scale-95 transition-all"
            >
              VIEW VR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
