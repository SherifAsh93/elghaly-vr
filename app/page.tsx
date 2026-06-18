"use client";

import React, {
  useRef, useState, useCallback, useMemo, useEffect,
} from "react";
import Webcam from "react-webcam";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

/* ─────────────────────────────────────────────
   PROCEDURAL TEXTURES
───────────────────────────────────────────── */

function makeFloorTex(): THREE.CanvasTexture {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const plankH = 96;
  const colors = ["#8B6020", "#7A5518", "#96692A", "#855E1C"];
  for (let row = 0; row < S; row += plankH) {
    const c = colors[Math.floor(row / plankH) % colors.length];
    ctx.fillStyle = c;
    ctx.fillRect(0, row, S, plankH - 2);
    for (let i = 0; i < 25; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.07})`;
      ctx.lineWidth = Math.random() < 0.25 ? 2 : 1;
      ctx.beginPath();
      const sx = Math.random() * S;
      ctx.moveTo(sx, row);
      ctx.bezierCurveTo(
        sx + (Math.random() - 0.5) * 40, row + plankH * 0.33,
        sx + (Math.random() - 0.5) * 40, row + plankH * 0.66,
        sx + (Math.random() - 0.5) * 30, row + plankH
      );
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, row); ctx.lineTo(S, row); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

function makeWainscotTex(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#9B7340";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.08})`;
    ctx.lineWidth = Math.random() < 0.2 ? 2 : 1;
    const sy = Math.random() * H;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.bezierCurveTo(W / 3, sy + (Math.random() - 0.5) * 18, 2 * W / 3, sy + (Math.random() - 0.5) * 18, W, sy + (Math.random() - 0.5) * 14);
    ctx.stroke();
  }
  const panels = 4;
  const pw = W / panels;
  const pad = 14;
  for (let p = 0; p < panels; p++) {
    const x = p * pw + pad;
    const y = pad;
    const bw = pw - pad * 2;
    const bh = H - pad * 2;
    ctx.strokeStyle = "rgba(255,255,200,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, bw, bh);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(x + 3, y + 3, bw - 3, bh - 3);
    ctx.strokeStyle = "rgba(255,255,200,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 7, y + 7, bw - 14, bh - 14);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

/* ─────────────────────────────────────────────
   ROOM SCENE
───────────────────────────────────────────── */

function Room({ wallColor }: { wallColor: string }) {
  const floorTex     = useMemo(() => makeFloorTex(), []);
  const wainscotTex  = useMemo(() => makeWainscotTex(), []);

  const paintMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }), []);
  const wainMat  = useMemo(() => new THREE.MeshStandardMaterial({ map: wainscotTex, roughness: 0.72, metalness: 0 }), [wainscotTex]);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0 }), [floorTex]);
  const trimMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8A050", roughness: 0.55, metalness: 0.08 }), []);
  const ceilMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: "#F4F0EA", roughness: 0.95, metalness: 0 }), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8E0F0", transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.12 }), []);

  useEffect(() => {
    paintMat.color.set(wallColor).convertSRGBToLinear();
    paintMat.needsUpdate = true;
  }, [wallColor, paintMat]);

  const W = 7.0;   // room width
  const D = 5.5;   // room depth
  const H = 3.2;   // room height
  const RAIL = 1.1; // chair rail height
  const TR = 0.1;   // trim thickness

  const PaintPlane = ({ args, pos, rotY = 0 }: { args: [number, number]; pos: [number, number, number]; rotY?: number }) => (
    <mesh rotation={[0, rotY, 0]} position={pos} receiveShadow>
      <planeGeometry args={args} />
      <primitive object={paintMat} attach="material" />
    </mesh>
  );
  const WainPlane = ({ args, pos, rotY = 0 }: { args: [number, number]; pos: [number, number, number]; rotY?: number }) => (
    <mesh rotation={[0, rotY, 0]} position={pos}>
      <planeGeometry args={args} />
      <primitive object={wainMat} attach="material" />
    </mesh>
  );

  return (
    <group>
      {/* ── LIGHTING ── */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 4]} intensity={0.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 5, -3]} intensity={0.25} color="#fff4e0" />
      {/* Ceiling light fixture glow */}
      <pointLight position={[0, H - 0.25, -D / 5]} intensity={1.1} color="#FFF5E0" distance={8} decay={2} />
      <pointLight position={[0, H - 0.25, D / 4]} intensity={0.6} color="#FFF8F0" distance={6} decay={2} />
      {/* Window natural light */}
      <spotLight position={[0.2, 2.1, -D / 2 + 0.5]} target-position={[0, 1, 0]} intensity={2.5} color="#D4EEFF" angle={0.55} penumbra={0.8} distance={8} decay={2} />

      {/* ── FLOOR ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* ── CEILING ── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <primitive object={ceilMat} attach="material" />
      </mesh>

      {/* ── BACK WALL ── */}
      <PaintPlane args={[W, H - RAIL]} pos={[0, RAIL + (H - RAIL) / 2, -D / 2]} />
      <WainPlane  args={[W, RAIL]}      pos={[0, RAIL / 2, -D / 2 + 0.002]} />

      {/* ── LEFT WALL ── */}
      <PaintPlane args={[D, H - RAIL]} pos={[-W / 2, RAIL + (H - RAIL) / 2, 0]} rotY={Math.PI / 2} />
      <WainPlane  args={[D, RAIL]}      pos={[-W / 2 + 0.002, RAIL / 2, 0]}      rotY={Math.PI / 2} />

      {/* ── RIGHT WALL ── */}
      <PaintPlane args={[D, H - RAIL]} pos={[W / 2, RAIL + (H - RAIL) / 2, 0]} rotY={-Math.PI / 2} />
      <WainPlane  args={[D, RAIL]}      pos={[W / 2 - 0.002, RAIL / 2, 0]}       rotY={-Math.PI / 2} />

      {/* ── CHAIR RAIL ── */}
      {([
        { pos: [0, RAIL, -D / 2 + TR / 2] as [number,number,number],      size: [W, TR, TR] as [number,number,number] },
        { pos: [-W / 2 + TR / 2, RAIL, 0] as [number,number,number],      size: [TR, TR, D] as [number,number,number] },
        { pos: [W / 2 - TR / 2, RAIL, 0] as [number,number,number],       size: [TR, TR, D] as [number,number,number] },
      ] as { pos: [number,number,number]; size: [number,number,number] }[]).map(({ pos, size }, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={size} />
          <primitive object={trimMat} attach="material" />
        </mesh>
      ))}

      {/* ── CROWN MOLDING ── */}
      {([
        { pos: [0, H - TR / 2, -D / 2 + TR / 2] as [number,number,number],      size: [W, TR * 1.4, TR] as [number,number,number] },
        { pos: [-W / 2 + TR / 2, H - TR / 2, 0] as [number,number,number],      size: [TR, TR * 1.4, D] as [number,number,number] },
        { pos: [W / 2 - TR / 2, H - TR / 2, 0] as [number,number,number],       size: [TR, TR * 1.4, D] as [number,number,number] },
      ] as { pos: [number,number,number]; size: [number,number,number] }[]).map(({ pos, size }, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={size} />
          <primitive object={trimMat} attach="material" />
        </mesh>
      ))}

      {/* ── BASEBOARD ── */}
      {([
        { pos: [0, 0.07, -D / 2 + 0.035] as [number,number,number],      size: [W, 0.14, 0.05] as [number,number,number] },
        { pos: [-W / 2 + 0.035, 0.07, 0] as [number,number,number],      size: [0.05, 0.14, D] as [number,number,number] },
        { pos: [W / 2 - 0.035, 0.07, 0] as [number,number,number],       size: [0.05, 0.14, D] as [number,number,number] },
      ] as { pos: [number,number,number]; size: [number,number,number] }[]).map(({ pos, size }, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={size} />
          <primitive object={trimMat} attach="material" />
        </mesh>
      ))}

      {/* ── WINDOW (back wall) ── */}
      {/* Frame */}
      <mesh position={[0, 2.0, -D / 2 + 0.06]} castShadow>
        <boxGeometry args={[1.5, 1.7, 0.09]} />
        <primitive object={trimMat} attach="material" />
      </mesh>
      {/* Glass pane */}
      <mesh position={[0, 2.0, -D / 2 + 0.10]}>
        <boxGeometry args={[1.26, 1.46, 0.012]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
      {/* Cross dividers */}
      <mesh position={[0, 2.0, -D / 2 + 0.11]}>
        <boxGeometry args={[1.26, 0.04, 0.025]} />
        <primitive object={trimMat} attach="material" />
      </mesh>
      <mesh position={[0, 2.0, -D / 2 + 0.11]}>
        <boxGeometry args={[0.04, 1.46, 0.025]} />
        <primitive object={trimMat} attach="material" />
      </mesh>

      {/* ── CEILING LIGHT FIXTURE ── */}
      <mesh position={[0, H - 0.02, -D / 5]}>
        <cylinderGeometry args={[0.18, 0.22, 0.04, 16]} />
        <meshStandardMaterial color="#d4c9b0" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, H - 0.12, -D / 5]}>
        <sphereGeometry args={[0.10, 12, 8]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff0a0" emissiveIntensity={1.5} roughness={0.3} />
      </mesh>

      {/* ── SOFA ── */}
      {/* Seat */}
      <mesh position={[0, 0.32, -1.9]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.48, 1.05]} />
        <meshStandardMaterial color="#8B7355" roughness={0.88} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.78, -2.32]} castShadow>
        <boxGeometry args={[2.7, 0.75, 0.22]} />
        <meshStandardMaterial color="#7A6347" roughness={0.88} />
      </mesh>
      {/* Armrests */}
      {([-1.32, 1.32] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0.52, -1.95]} castShadow>
          <boxGeometry args={[0.2, 0.5, 1.0]} />
          <meshStandardMaterial color="#7A6347" roughness={0.88} />
        </mesh>
      ))}
      {/* Cushions */}
      {([-0.65, 0, 0.65] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0.6, -1.95]} castShadow>
          <boxGeometry args={[0.82, 0.18, 0.88]} />
          <meshStandardMaterial color="#A09070" roughness={0.85} />
        </mesh>
      ))}
      {/* Throw pillow */}
      <mesh position={[-0.9, 0.82, -2.1]} rotation={[0, 0.3, 0.15]} castShadow>
        <boxGeometry args={[0.4, 0.36, 0.1]} />
        <meshStandardMaterial color="#C08060" roughness={0.9} />
      </mesh>

      {/* ── COFFEE TABLE ── */}
      <mesh position={[0, 0.22, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.07, 0.6]} />
        <meshStandardMaterial color="#4A3018" roughness={0.5} metalness={0.06} />
      </mesh>
      {([[-0.47, -0.23], [0.47, -0.23], [-0.47, 0.23], [0.47, 0.23]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, -0.55 + z]} castShadow>
          <boxGeometry args={[0.06, 0.22, 0.06]} />
          <meshStandardMaterial color="#3A2408" roughness={0.6} />
        </mesh>
      ))}
      {/* Decorative vase on table */}
      <mesh position={[0.3, 0.35, -0.55]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.26, 12]} />
        <meshStandardMaterial color="#7090A0" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* ── SIDE TABLE ── */}
      <mesh position={[-1.5, 0.55, -1.9]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.06, 16]} />
        <meshStandardMaterial color="#5C4020" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[-1.5, 0.26, -1.9]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
        <meshStandardMaterial color="#4A3018" roughness={0.5} />
      </mesh>
      {/* Lamp */}
      <mesh position={[-1.5, 0.95, -1.9]} castShadow>
        <coneGeometry args={[0.2, 0.32, 16, 1, true]} />
        <meshStandardMaterial color="#E8DCC8" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[-1.5, 0.85, -1.9]} intensity={0.7} color="#FFE0A0" distance={3} decay={2} />

      <ContactShadows opacity={0.35} scale={9} blur={2.5} far={1.8} />
    </group>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export default function MobileColorPicker() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor]         = useState("#D4C5A9");
  const [mode, setMode]           = useState<"camera" | "vr">("camera");
  const [isCaptured, setIsCaptured] = useState(false);
  const [tapPos, setTapPos]       = useState({ x: 0, y: 0 });

  const pickColor = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!webcamRef.current || !canvasRef.current) return;
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const rect   = video.getBoundingClientRect();
    const touch  = (e as React.TouchEvent).touches?.[0];
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    setTapPos({ x: clientX, y: clientY });

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const scaleX = video.videoWidth  / rect.width;
    const scaleY = video.videoHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top)  * scaleY;

    const px  = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = `#${((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1)}`;
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

          {!isCaptured && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 text-white text-sm font-semibold px-5 py-3 rounded-2xl backdrop-blur-sm">
                Tap any wall surface to pick its color
              </div>
            </div>
          )}

          {isCaptured && (
            <div
              className="absolute w-12 h-12 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg pointer-events-none"
              style={{ left: tapPos.x, top: tapPos.y, backgroundColor: color }}
            />
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-white px-8 pt-7 pb-10 rounded-t-[2.5rem] shadow-2xl">
            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl border-2 border-zinc-200 shadow-md transition-colors duration-300"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Selected Color</p>
                  <p className="text-2xl font-mono font-black text-zinc-800">{color.toUpperCase()}</p>
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
        <div className="relative flex-1 bg-[#E8E0D8]">
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
              toneMappingExposure: 1.1,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
            dpr={[1, 1.5]}
            camera={{ fov: 52, position: [2.8, 1.65, 2.6] }}
            shadows
          >
            <Room wallColor={color} />
            <OrbitControls
              makeDefault
              target={[0, 1.3, -1.2]}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={1.5}
              maxDistance={5.5}
              enablePan={false}
            />
          </Canvas>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-xl border border-white/50 flex items-center gap-3 whitespace-nowrap">
            <div className="w-5 h-5 rounded-full border border-zinc-200 shadow-sm" style={{ backgroundColor: color }} />
            <span className="font-bold text-zinc-800 text-sm font-mono">{color.toUpperCase()}</span>
            <span className="text-zinc-400 text-xs">· Drag to look around</span>
          </div>
        </div>
      )}
    </div>
  );
}
