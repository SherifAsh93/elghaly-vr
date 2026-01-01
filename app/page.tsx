"use client";

import React, {
  useRef,
  useState,
  useCallback,
  Suspense,
  useEffect,
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

// --- This script finds the center of your room and puts you in it ---
function CameraAutoSetup() {
  const { camera, scene, controls } = useThree();

  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Position camera inside at center, eye level (1.6m)
    camera.position.set(center.x, 1.6, center.z);

    if (controls) {
      (controls as any).target.set(center.x, 1.4, center.z - 0.1);
      (controls as any).update();
    }
  }, [scene, camera, controls]);

  return null;
}

function Scene({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");
  const [hovered, setHovered] = useState<string | null>(null);

  // Apply color to the main walls automatically on load
  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const name = obj.name.toLowerCase();
        // Automatic detection for the main big walls
        if (
          name.includes("wall") ||
          name.includes("structure") ||
          obj.scale.y > 1.5
        ) {
          applyColor(obj, wallColor);
        }
      }
    });
  }, [scene, wallColor]);

  const applyColor = (mesh: THREE.Mesh, hex: string) => {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    // Reuse material to prevent "Context Lost" memory leaks
    if (mat.name !== "custom_veneer") {
      mesh.material = mat.clone();
      mesh.material.name = "custom_veneer";
    }
    (mesh.material as THREE.MeshStandardMaterial).color.set(hex);
    (mesh.material as THREE.MeshStandardMaterial).roughness = 0.6; // Realistic wood finish
  };

  return (
    <group
      onPointerOver={(e) => (e.stopPropagation(), setHovered(e.object.name))}
      onPointerOut={() => setHovered(null)}
      onClick={(e) => (
        e.stopPropagation(), applyColor(e.object as THREE.Mesh, wallColor)
      )}
    >
      <Environment preset="apartment" />
      <ambientLight intensity={0.7} />
      <pointLight position={[5, 5, 5]} intensity={1} />

      <primitive object={scene} />
      <CameraAutoSetup />
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
      <div className="fixed inset-0 bg-[#e5e7eb] flex flex-col">
        <button
          onClick={() => setMode("camera")}
          className="absolute top-6 left-6 z-50 bg-black text-white px-6 py-3 rounded-2xl font-bold shadow-2xl"
        >
          ← EXIT VR
        </button>

        <Canvas shadows>
          {/* BACKGROUND: Soft grey instead of black hole */}
          <color attach="background" args={["#e5e7eb"]} />

          <Suspense fallback={<Html center>Loading 3D...</Html>}>
            <Scene wallColor={color} />
          </Suspense>

          <OrbitControls
            makeDefault
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-8 py-4 rounded-3xl shadow-2xl border flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full border"
              style={{ backgroundColor: color }}
            />
            <span className="font-bold text-zinc-900 uppercase text-sm tracking-tight">
              Veneer: {color}
            </span>
          </div>
          <p className="text-[9px] font-bold text-zinc-400 uppercase">
            Tip: Tap a wall to apply color
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      <Webcam
        ref={webcamRef}
        audio={false}
        className="h-full w-full object-cover"
        onClick={pickColor}
        onTouchStart={pickColor}
        videoConstraints={{ facingMode: "environment" }}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-white p-10 rounded-t-[3.5rem] shadow-2xl flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-md">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl border-4"
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
              className="bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-bold shadow-xl active:scale-95 transition-all"
            >
              PREVIEW
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
