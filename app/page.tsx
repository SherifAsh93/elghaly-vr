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

// --- 1. SMART CAMERA POSITIONING ---
function CameraManager() {
  const { camera, scene, controls } = useThree();
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    camera.position.set(center.x, 1.6, center.z + 0.5); // Human height inside
    if (controls) {
      (controls as any).target.set(center.x, 1.4, center.z);
      (controls as any).update();
    }
  }, [scene, camera, controls]);
  return null;
}

// --- 2. REALISTIC VENEER SCENE ---
function Scene({ wallColor }: { wallColor: string }) {
  const { scene } = useGLTF("/room.glb");

  const walls = useMemo(() => {
    const list: THREE.Mesh[] = [];
    if (!scene) return list;
    const minY = new THREE.Box3().setFromObject(scene).min.y;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const name = obj.name.toLowerCase();
        const isFloor = name.includes("floor") || obj.position.y <= minY + 0.05;
        const isProp =
          name.includes("sofa") ||
          name.includes("couch") ||
          name.includes("plant") ||
          name.includes("lamp");

        if (!isFloor && !isProp) {
          const oldMat = obj.material as THREE.MeshStandardMaterial;
          const newMat = oldMat.clone();
          newMat.name = "veneer_final";
          // We clear the map to allow our chosen color to be the primary albedo
          newMat.map = null;

          // REALISM: Give it a "Satin Wood" finish
          newMat.roughness = 0.45; // Not too shiny, not too matte
          newMat.metalness = 0.02; // Very slight reflection

          obj.material = newMat;
          list.push(obj);
        }
      }
    });
    return list;
  }, [scene]);

  useEffect(() => {
    // Convert hex to Three.js Color and handle Color Space
    const colorObj = new THREE.Color(wallColor);

    walls.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // IMPORTANT: Set color with sRGB space correction for accuracy
      mat.color.copy(colorObj);
      mat.color.convertSRGBToLinear();
      mat.needsUpdate = true;
    });
  }, [walls, wallColor]);

  return (
    <group>
      <Environment preset="apartment" />
      <ambientLight intensity={0.5} />
      {/* Directional light to create highlights on the veneer sheen */}
      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
      <primitive object={scene} />
      <CameraManager />
      <ContactShadows opacity={0.4} scale={10} blur={2} />
    </group>
  );
}

// --- 3. THE MAIN APP ---
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

    const x = (clientX - rect.left) * (video.videoWidth / rect.width);
    const y = (clientY - rect.top) * (video.videoHeight / rect.height);

    setTapPos({ x: clientX, y: clientY });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // TECHNIQUE: Average a 5x5 block of pixels to remove camera "noise"
    const size = 5;
    const imgData = ctx.getImageData(x - 2, y - 2, size, size).data;
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      r += imgData[i];
      g += imgData[i + 1];
      b += imgData[i + 2];
    }
    const count = imgData.length / 4;
    const hex = `#${(
      (1 << 24) +
      (Math.round(r / count) << 16) +
      (Math.round(g / count) << 8) +
      Math.round(b / count)
    )
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

        <Canvas gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}>
          <color attach="background" args={["#f3f4f6"]} />
          <Suspense fallback={<Html center>Adjusting Veneer...</Html>}>
            <Scene wallColor={color} />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} />
        </Canvas>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border">
          <div
            className="w-8 h-8 rounded-full border shadow-inner"
            style={{ backgroundColor: color }}
          />
          <span className="font-black text-black uppercase tracking-widest text-sm">
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
        />
        <canvas ref={canvasRef} className="hidden" />
        {isCaptured && (
          <div
            className="absolute w-12 h-12 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-2xl animate-pulse"
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
                Material Tone
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
              VR PREVIEW
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
