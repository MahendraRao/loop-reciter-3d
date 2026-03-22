import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Text, Torus, Environment, Stars } from "@react-three/drei";
import { Play, Pause, RotateCcw, Square, Upload, Music4, Video, Waves } from "lucide-react";

function NeonOrb({ isPlaying, progress, completedLoops, targetLoops }) {
  const group = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const pulse = useMemo(() => Math.max(0.12, progress), [progress]);

  useFrame((state, delta) => {
    if (!group.current || !ringA.current || !ringB.current) return;

    const speed = isPlaying ? 1.4 : 0.35;
    group.current.rotation.y += delta * speed * 0.45;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.35) * 0.18;

    ringA.current.rotation.x += delta * speed;
    ringA.current.rotation.z += delta * speed * 0.5;

    ringB.current.rotation.y -= delta * speed * 0.8;
    ringB.current.rotation.z -= delta * speed * 0.35;

    const scale =
      1 + pulse * 0.18 + (isPlaying ? Math.sin(state.clock.elapsedTime * 4.2) * 0.04 : 0);
    group.current.scale.setScalar(scale);
  });

  return (
    <group ref={group}>
      <Float speed={isPlaying ? 2 : 0.75} rotationIntensity={0.8} floatIntensity={1.1}>
        <mesh>
          <icosahedronGeometry args={[1.2, 2]} />
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#7c3aed"
            emissiveIntensity={isPlaying ? 2.8 : 1.2}
            metalness={0.65}
            roughness={0.2}
          />
        </mesh>

        <mesh scale={[1.35, 1.35, 1.35]}>
          <icosahedronGeometry args={[1.2, 1]} />
          <meshStandardMaterial
            color="#22d3ee"
            transparent
            opacity={0.16}
            emissive="#22d3ee"
            emissiveIntensity={isPlaying ? 1.8 : 0.65}
            wireframe
          />
        </mesh>
      </Float>

      <Torus ref={ringA} args={[2.1, 0.07, 24, 100]} rotation={[Math.PI / 4, 0, 0]}>
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={2.6}
          metalness={0.6}
          roughness={0.25}
        />
      </Torus>

      <Torus ref={ringB} args={[2.55, 0.05, 20, 100]} rotation={[0, Math.PI / 4, Math.PI / 3]}>
        <meshStandardMaterial
          color="#f472b6"
          emissive="#f472b6"
          emissiveIntensity={2.3}
          metalness={0.55}
          roughness={0.2}
        />
      </Torus>

      <Text position={[0, 0.1, 1.9]} fontSize={0.38} color="#ffffff" anchorX="center" anchorY="middle">
        {completedLoops}/{targetLoops}
      </Text>
      <Text position={[0, -0.45, 1.9]} fontSize={0.14} color="#cbd5e1" anchorX="center" anchorY="middle">
        LOOP COUNT
      </Text>
    </group>
  );
}

function LoopScene({ isPlaying, progress, completedLoops, targetLoops }) {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 50 }}>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 7, 16]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 5, 3]} intensity={2.4} color="#ffffff" />
      <pointLight position={[-4, -2, 4]} intensity={18} color="#22d3ee" />
      <pointLight position={[4, 2, -2]} intensity={18} color="#a855f7" />
      <Stars radius={60} depth={30} count={1800} factor={3} fade speed={1} />
      <Environment preset="city" />
      <NeonOrb
        isPlaying={isPlaying}
        progress={progress}
        completedLoops={completedLoops}
        targetLoops={targetLoops}
      />
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={isPlaying ? 1.7 : 0.35} />
    </Canvas>
  );
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function App() {
  const mediaRef = useRef(null);
  const objectUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  const wakeLockRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const isStoppedRef = useRef(false);

  const [fileName, setFileName] = useState("No media selected");
  const [mediaType, setMediaType] = useState("audio");
  const [mediaSrc, setMediaSrc] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedLoops, setCompletedLoops] = useState(0);
  const [targetLoops, setTargetLoops] = useState(108);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Upload an audio or video file to begin.");

  const progress = duration > 0 ? currentTime / duration : 0;
  const isTargetReached = completedLoops >= targetLoops;

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && isPlaying) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: fileName || "3D Loop Reciter",
      artist: "Loop Reciter",
      album: "3D Loop Reciter"
    });

    navigator.mediaSession.setActionHandler("play", async () => {
      await handlePlay();
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      handlePause();
    });

    navigator.mediaSession.setActionHandler("stop", () => {
      handleStop();
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [fileName, isPlaying]);

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (error) {
      console.error("Wake lock request failed:", error);
    }
  }

  async function releaseWakeLock() {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (error) {
      console.error("Wake lock release failed:", error);
    }
  }

  const attachMediaHandlers = (element) => {
    if (!element) return;

    element.onloadedmetadata = () => {
      setDuration(element.duration || 0);
      setCurrentTime(0);
    };

    element.ontimeupdate = () => {
      setCurrentTime(element.currentTime || 0);
    };

    element.onplay = async () => {
      setIsPlaying(true);
      setStatus("Playback in progress.");
      await requestWakeLock();
    };

    element.onpause = async () => {
      setIsPlaying(false);
      if (!isTargetReached && !isStoppedRef.current) {
        setStatus("Playback paused.");
      }
      await releaseWakeLock();
    };

    element.onended = async () => {
      if (isStoppedRef.current) return;

      setCompletedLoops((prev) => {
        const next = prev + 1;

        if (next >= targetLoops) {
          setStatus(`Target completed. Played ${next} times.`);
          setIsPlaying(false);
          releaseWakeLock();
          return next;
        }

        restartTimeoutRef.current = setTimeout(async () => {
          if (!mediaRef.current || isStoppedRef.current) return;

          mediaRef.current.currentTime = 0;

          try {
            await mediaRef.current.play();
            setStatus(`Auto-loop running: ${next}/${targetLoops}`);
          } catch (error) {
            console.error("Restart play failed:", error);
            setStatus("Playback restart was blocked. Press Play to continue.");
            setIsPlaying(false);
          }
        }, 80);

        return next;
      });
    };
  };

  const resetPlaybackState = () => {
    setCompletedLoops(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    isStoppedRef.current = false;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    const inferredType = file.type.startsWith("video") ? "video" : "audio";

    setMediaSrc(url);
    setMediaType(inferredType);
    setFileName(file.name);
    resetPlaybackState();
    setStatus(`Loaded ${file.name}. Press Play to start looping.`);
  };

  const handlePlay = async () => {
    if (!mediaRef.current || !mediaSrc) {
      setStatus("Please upload audio or video first.");
      return;
    }

    isStoppedRef.current = false;

    if (isTargetReached) {
      mediaRef.current.currentTime = 0;
      setCompletedLoops(0);
      setStatus("Counter reset. Starting again from 1.");
    }

    try {
      await requestWakeLock();
      await mediaRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Play failed:", error);
      setStatus("Unable to start playback. Tap Play again.");
    }
  };

  const handlePause = () => {
    isStoppedRef.current = false;
    mediaRef.current?.pause();
    setIsPlaying(false);
    setStatus("Playback paused.");
  };

  const handleStop = async () => {
    isStoppedRef.current = true;

    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    if (mediaRef.current) {
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setCompletedLoops(0);
    setStatus("Playback stopped. Counter reset to 0.");
    await releaseWakeLock();
  };

  const handleReplay = async () => {
    if (!mediaRef.current || !mediaSrc) return;

    isStoppedRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    mediaRef.current.pause();
    mediaRef.current.currentTime = 0;
    setCompletedLoops(0);
    setCurrentTime(0);
    setStatus("Replay started. Counter reset to 0.");

    try {
      await requestWakeLock();
      await mediaRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Replay failed:", error);
      setStatus("Replay is ready. Press Play to continue.");
      setIsPlaying(false);
    }
  };

  const MediaPlayer = mediaType === "video" ? "video" : "audio";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-cyan-300">
                <Waves className="h-4 w-4" />
                3D Loop Reciter
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Loop audio, recordings, and videos with a live recitation counter
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Upload a file, set your target loop count, and let the player keep replaying
                automatically until the counter reaches your goal.
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <Upload className="h-4 w-4" />
              Upload Media
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.22),transparent_32%)]" />
            <div className="relative h-[380px] w-full md:h-[560px]">
              <LoopScene
                isPlaying={isPlaying}
                progress={progress}
                completedLoops={completedLoops}
                targetLoops={targetLoops}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:p-5">
            <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current file</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  {mediaType === "video" ? (
                    <Video className="h-6 w-6 text-pink-300" />
                  ) : (
                    <Music4 className="h-6 w-6 text-cyan-300" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{fileName}</p>
                  <p className="text-xs text-slate-400">
                    {mediaType === "video" ? "Video loop mode" : "Audio or recording loop mode"}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300">{status}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Completed" value={String(completedLoops)} />
              <StatCard label="Target" value={String(targetLoops)} />
              <StatCard label="Elapsed" value={formatTime(currentTime)} />
              <StatCard label="Duration" value={formatTime(duration)} />
            </div>

            <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                Target loop count
              </label>
              <input
                type="number"
                min="1"
                max="9999"
                value={targetLoops}
                onChange={(e) => setTargetLoops(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <ControlButton icon={Play} label="Play" onClick={handlePlay} />
              <ControlButton icon={Pause} label="Pause" onClick={handlePause} />
              <ControlButton icon={RotateCcw} label="Replay" onClick={handleReplay} />
              <ControlButton icon={Square} label="Stop" onClick={handleStop} />
            </div>

            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>Loop progress</span>
                <span>{Math.min(completedLoops, targetLoops)}/{targetLoops}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-400 transition-all duration-500"
                  style={{ width: `${Math.min((completedLoops / targetLoops) * 100, 100)}%` }}
                />
              </div>
            </div>

            {mediaSrc ? (
              <div className="rounded-[26px] border border-white/10 bg-black/20 p-3">
                <MediaPlayer
                  ref={(node) => {
                    mediaRef.current = node;
                    if (node) attachMediaHandlers(node);
                  }}
                  src={mediaSrc}
                  controls
                  playsInline
                  preload="auto"
                  className={`w-full rounded-2xl bg-black ${mediaType === "video" ? "aspect-video" : "h-16"
                    }`}
                />
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-slate-400">
                Upload an MP3, WAV, M4A, MP4, MOV, or other browser-supported media file.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/10 px-4 py-4 text-sm font-medium text-white transition hover:bg-white/15"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}