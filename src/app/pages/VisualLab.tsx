import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, Eye, Loader2, Sparkles, X } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  TopicDocument,
  TopicVisualization,
  VisualizationSpec,
  fetchTopicFiles,
  fetchTopicVisualizations,
  generateTopicVisualization,
} from "../lib/api";

type Vec3 = { x: number; y: number; z: number };

function rotatePoint(point: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = point.x * cy - point.z * sy;
  const z1 = point.x * sy + point.z * cy;
  const y2 = point.y * cp - z1 * sp;
  const z2 = point.y * sp + z1 * cp;
  return { x: x1, y: y2, z: z2 };
}

function project(point: Vec3, width: number, height: number, distance = 6) {
  const scale = Math.min(width, height) * 0.14;
  const depth = distance + point.z;
  return {
    x: width / 2 + (point.x / depth) * scale * distance,
    y: height / 2 - (point.y / depth) * scale * distance,
  };
}

function drawLine(ctx: CanvasRenderingContext2D, a: Vec3, b: Vec3, width: number, height: number, color: string, lineWidth = 2) {
  const p1 = project(a, width, height);
  const p2 = project(b, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function wavelengthToColor(wavelengthNm: number) {
  const t = Math.max(380, Math.min(700, wavelengthNm));
  if (t < 450) return "#4C6FFF";
  if (t < 500) return "#00A6FF";
  if (t < 570) return "#2DD36F";
  if (t < 600) return "#F6C744";
  if (t < 650) return "#FF8B3D";
  return "#FF4D4D";
}

function prismRayOutAngle(incidentDeg: number, refractiveIndex: number, prismDeg: number) {
  const i = (incidentDeg * Math.PI) / 180;
  const a = (prismDeg * Math.PI) / 180;
  const n = Math.max(1, refractiveIndex);
  const r1 = Math.asin(Math.sin(i) / n);
  const r2Input = n * Math.sin(Math.max(0, a - r1));
  const r2 = r2Input >= 1 ? Math.PI / 2 : Math.asin(r2Input);
  return (r2 * 180) / Math.PI;
}

function prismPhysicsSnapshot(spec: VisualizationSpec) {
  if (spec.visualizationType !== "prism-refraction-3d") return null;
  const n1 = 1;
  const n2 = Math.max(1, spec.parameters.refractiveIndex);
  const i = (spec.parameters.incidentAngleDeg * Math.PI) / 180;
  const r = Math.asin(Math.min(1, (n1 / n2) * Math.sin(i)));
  const critical = n2 > n1 ? Math.asin(n1 / n2) : Math.PI / 2;
  const tirLikely = r > critical * 0.94 && spec.parameters.incidentAngleDeg >= 52;
  return {
    n1,
    n2,
    incidentDeg: spec.parameters.incidentAngleDeg,
    refractedDeg: (r * 180) / Math.PI,
    criticalDeg: (critical * 180) / Math.PI,
    tirLikely,
  };
}

function parameterConditionMet(spec: VisualizationSpec, parameter: string) {
  if (spec.visualizationType === "prism-refraction-3d") {
    if (parameter === "refractiveIndex") return spec.parameters.refractiveIndex >= 1.45;
    if (parameter === "incidentAngleDeg") return spec.parameters.incidentAngleDeg >= 46;
    if (parameter === "wavelengthNm") return spec.parameters.wavelengthNm <= 460 || spec.parameters.wavelengthNm >= 620;
    if (parameter === "beamIntensity") return spec.parameters.beamIntensity >= 0.75;
    return true;
  }
  if (parameter === "springConstant") return spec.parameters.springConstant >= 30;
  if (parameter === "mass") return spec.parameters.mass >= 1.6;
  if (parameter === "displacement") return spec.parameters.displacement >= 0.35;
  if (parameter === "damping") return spec.parameters.damping >= 0.12;
  return true;
}

function VisualSimulationCanvas({
  spec,
}: {
  spec: VisualizationSpec;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [orbitYaw, setOrbitYaw] = useState(0.55);
  const [orbitPitch, setOrbitPitch] = useState(-0.2);
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const startAt = performance.now();

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      if (spec.visualizationType === "prism-refraction-3d") {
        gradient.addColorStop(0, "#02091D");
        gradient.addColorStop(1, "#091A40");
      } else {
        gradient.addColorStop(0, "#040B21");
        gradient.addColorStop(1, "#0A1736");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const elapsed = (now - startAt) / 1000;
      const yaw = orbitYaw;
      const pitch = orbitPitch;
      const rotate = (p: Vec3) => rotatePoint(p, yaw, pitch);

      if (spec.visualizationType === "spring-mass-3d") {
        const { springConstant, mass, displacement, damping } = spec.parameters;
        const omega = Math.sqrt(Math.max(0.01, springConstant / Math.max(0.1, mass)));
        const amp = displacement * Math.exp(-damping * elapsed);
        const x = amp * Math.cos(omega * elapsed);

        const anchor: Vec3 = { x: -2.4, y: 0.4, z: 0 };
        const massCenter: Vec3 = { x: -0.2 + x * 2.4, y: 0.4, z: 0 };
        const coilPoints: Vec3[] = [];
        const coils = 18;
        for (let i = 0; i <= coils; i += 1) {
          const t = i / coils;
          const px = anchor.x + (massCenter.x - anchor.x) * t;
          const py = anchor.y + Math.sin(t * Math.PI * 2 * 8) * 0.16;
          coilPoints.push(rotate({ x: px, y: py, z: 0 }));
        }

        ctx.strokeStyle = "#2D6A4F";
        ctx.lineWidth = 3;
        ctx.beginPath();
        const first = project(coilPoints[0], width, height);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < coilPoints.length; i += 1) {
          const p = project(coilPoints[i], width, height);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        const massSize = 0.55;
        const cube = [
          { x: massCenter.x - massSize, y: massCenter.y - massSize, z: -massSize },
          { x: massCenter.x + massSize, y: massCenter.y - massSize, z: -massSize },
          { x: massCenter.x + massSize, y: massCenter.y + massSize, z: -massSize },
          { x: massCenter.x - massSize, y: massCenter.y + massSize, z: -massSize },
          { x: massCenter.x - massSize, y: massCenter.y - massSize, z: massSize },
          { x: massCenter.x + massSize, y: massCenter.y - massSize, z: massSize },
          { x: massCenter.x + massSize, y: massCenter.y + massSize, z: massSize },
          { x: massCenter.x - massSize, y: massCenter.y + massSize, z: massSize },
        ].map(rotate);

        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ];
        for (const [a, b] of edges) {
          drawLine(ctx, cube[a], cube[b], width, height, "#1E3A2D", 2.2);
        }
      } else {
        const { incidentAngleDeg, refractiveIndex, wavelengthNm, prismAngleDeg, beamIntensity } = spec.parameters;
        const prism = [
          { x: -0.9, y: -1.2, z: -0.7 },
          { x: 1.15, y: -1.2, z: -0.7 },
          { x: 0.1, y: 1.1, z: -0.7 },
          { x: -0.9, y: -1.2, z: 0.7 },
          { x: 1.15, y: -1.2, z: 0.7 },
          { x: 0.1, y: 1.1, z: 0.7 },
        ].map(rotate);
        const prismEdges = [
          [0, 1], [1, 2], [2, 0],
          [3, 4], [4, 5], [5, 3],
          [0, 3], [1, 4], [2, 5],
        ];

        ctx.strokeStyle = "rgba(30, 106, 79, 0.85)";
        ctx.lineWidth = 2.2;
        for (const [a, b] of prismEdges) {
          drawLine(ctx, prism[a], prism[b], width, height, "rgba(30, 106, 79, 0.75)", 2);
        }

        const beamInStart = rotate({ x: -3.2, y: 0.25, z: 0 });
        const entry = rotate({ x: -1.0, y: 0.25, z: 0 });
        drawLine(ctx, beamInStart, entry, width, height, `rgba(255,80,80,${beamIntensity})`, 3);

        const baseOut = prismRayOutAngle(incidentAngleDeg, refractiveIndex, prismAngleDeg);
        const colors = [430, wavelengthNm, 670];
        const offsets = [-6, 0, 6];
        for (let i = 0; i < colors.length; i += 1) {
          const lambda = colors[i];
          const nShift = refractiveIndex + ((580 - lambda) / 700) * 0.16;
          const outDeg = baseOut + offsets[i] + (nShift - refractiveIndex) * 16;
          const outRad = (outDeg * Math.PI) / 180;
          const inside = rotate({ x: -1.0, y: 0.25, z: 0 });
          const exit = rotate({ x: 0.9, y: -0.22, z: 0 });
          const tirLikely = refractiveIndex >= 1.45 && incidentAngleDeg >= 55 && i !== 1;
          const outEnd = rotate({
            x: 0.9 + Math.cos(outRad) * 2.5,
            y: -0.22 + Math.sin(outRad) * 2.5,
            z: 0.02 * (i - 1),
          });
          drawLine(ctx, inside, exit, width, height, `rgba(255,255,255,${0.65 * beamIntensity})`, 2.4);
          if (tirLikely) {
            const reflectedEnd = rotate({
              x: 0.05,
              y: 0.62,
              z: 0.02 * (i - 1),
            });
            drawLine(ctx, exit, reflectedEnd, width, height, wavelengthToColor(lambda), 2.8);
          } else {
            drawLine(ctx, exit, outEnd, width, height, wavelengthToColor(lambda), 2.8);
          }
        }

        ctx.fillStyle = "rgba(216, 227, 255, 0.85)";
        ctx.font = "600 15px sans-serif";
        ctx.fillText("Snell's Law", width * 0.45, 32);
        ctx.font = "12px sans-serif";
        ctx.fillText("n1 sin(theta1) = n2 sin(theta2)", width * 0.41, 50);
        ctx.fillStyle = "rgba(186, 201, 238, 0.85)";
        ctx.fillText("Incident Ray", width * 0.28, height * 0.14);
        ctx.fillText("Refracted Ray", width * 0.58, height * 0.62);
        ctx.fillText("Medium Boundary", width * 0.44, height * 0.53);
      }

      ctx.fillStyle = "rgba(182, 200, 235, 0.78)";
      ctx.font = "12px sans-serif";
      ctx.fillText("Drag to rotate view", 12, height - 14);
      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [spec, orbitYaw, orbitPitch]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-lg border border-border bg-card"
      onMouseDown={(e) => {
        draggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!draggingRef.current) return;
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setOrbitYaw((prev) => prev + dx * 0.01);
        setOrbitPitch((prev) => Math.max(-1.1, Math.min(1.1, prev + dy * 0.01)));
      }}
      onMouseUp={() => {
        draggingRef.current = false;
      }}
      onMouseLeave={() => {
        draggingRef.current = false;
      }}
    />
  );
}

function cloneSpec(spec: VisualizationSpec): VisualizationSpec {
  return JSON.parse(JSON.stringify(spec)) as VisualizationSpec;
}

export default function VisualLab() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const navigate = useNavigate();
  const { state, loading, error } = useAppData();
  const [documents, setDocuments] = useState<TopicDocument[]>([]);
  const [savedVisualizations, setSavedVisualizations] = useState<TopicVisualization[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [conceptInput, setConceptInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [resourceLoading, setResourceLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeVisualization, setActiveVisualization] = useState<TopicVisualization | null>(null);
  const [viewerSpec, setViewerSpec] = useState<VisualizationSpec | null>(null);
  const [guidedStepIndex, setGuidedStepIndex] = useState(0);

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;
  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);

  const backPath = useMemo(() => {
    if (!moduleName || !topicName) return "/dashboard/modules";
    return `/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}`;
  }, [moduleName, topicName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!moduleName || !topicName) return;
      setResourceLoading(true);
      setResourceError("");
      try {
        const [docResult, vizResult] = await Promise.all([
          fetchTopicFiles(moduleName, topicName),
          fetchTopicVisualizations(moduleName, topicName),
        ]);
        if (cancelled) return;
        const docs = docResult.documents;
        setDocuments(docs);
        setSavedVisualizations(vizResult.visualizations);
      } catch (err) {
        if (cancelled) return;
        setResourceError(err instanceof Error ? err.message : "Failed to load Visual Lab resources.");
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName]);

  const openVisualization = (visualization: TopicVisualization) => {
    setActiveVisualization(visualization);
    setViewerSpec(cloneSpec(visualization.spec));
    setGuidedStepIndex(0);
    setViewerOpen(true);
  };

  const handleCreate = async () => {
    if (!moduleName || !topicName) return;
    setCreating(true);
    setResourceError("");
    setStatusMessage("");
    try {
      const result = await generateTopicVisualization({
        moduleName,
        topicName,
        selectedDocumentIds,
        conceptInput,
        promptInput,
      });
      const latest = await fetchTopicVisualizations(moduleName, topicName);
      setSavedVisualizations(latest.visualizations);
      setStatusMessage(`Generated: ${result.extraction.primaryConcept}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate visualisation.";
      if (message.toLowerCase().includes("not found") || message.includes("(404)")) {
        setResourceError("Visual Lab API route not found. Restart the backend server so the new endpoint is loaded.");
      } else {
        setResourceError(message);
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedDocumentsLabel = useMemo(() => {
    if (!selectedDocumentIds.length) return "No Document(s) selected";
    if (selectedDocumentIds.length === 1) {
      return documents.find((doc) => doc.id === selectedDocumentIds[0])?.fileName || "1 document selected";
    }
    return `${selectedDocumentIds.length} documents selected`;
  }, [documents, selectedDocumentIds]);

  const currentGuidedSteps = activeVisualization?.analysis?.guidedSteps || [];
  const currentStep = currentGuidedSteps[guidedStepIndex] || null;
  const conditionMet = viewerSpec && currentStep
    ? parameterConditionMet(viewerSpec, currentStep.focusParameter || "")
    : false;
  const prismSnapshot = viewerSpec ? prismPhysicsSnapshot(viewerSpec) : null;

  if (loading && !state) return <div className="p-8 text-muted-foreground">Loading Visual Lab...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;
  if (!moduleName || !topicName || !moduleState) {
    return (
      <div className="p-8">
        <div className="text-lg text-foreground mb-3">Topic not found.</div>
        <Link className="text-primary hover:underline" to="/dashboard/modules">Back to Modules</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {topicName}
          </button>
          <h1 className="text-3xl font-medium text-foreground">Visual Lab</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Generate an interactive concept visualization from your topic documents.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-lg font-medium text-foreground mb-1">Select Document(s)</h2>
            {resourceLoading && <div className="text-sm text-muted-foreground">Loading uploaded documents...</div>}
            {!resourceLoading && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:max-w-xl justify-between">
                    <span className="truncate text-left">{selectedDocumentsLabel}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[min(38rem,90vw)]">
                  <DropdownMenuLabel>Select Document(s)</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={!selectedDocumentIds.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedDocumentIds([]);
                    }}
                  >
                    No Document
                  </DropdownMenuCheckboxItem>
                  {documents.map((doc) => {
                    const checked = selectedDocumentIds.includes(doc.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={doc.id}
                        checked={checked}
                        onCheckedChange={(next) => {
                          const enabled = Boolean(next);
                          setSelectedDocumentIds((prev) => {
                            if (enabled) return Array.from(new Set([...prev, doc.id]));
                            return prev.filter((id) => id !== doc.id);
                          });
                        }}
                      >
                        {doc.fileName}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Concept / Topic</label>
            <Input
              value={conceptInput}
              onChange={(e) => setConceptInput(e.target.value)}
              className="placeholder:italic"
              placeholder="eg. Physics, Hooke's Law"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">What do you want to see?</label>
            <Textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="min-h-24 placeholder:italic"
              placeholder="eg. How it varies with different variables"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Create
            </Button>
            {statusMessage && <span className="text-sm text-primary">{statusMessage}</span>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-lg font-medium text-foreground mb-4">Saved Visualisations</h2>
          {!savedVisualizations.length && <div className="text-sm text-muted-foreground">No saved visualisations for this topic yet.</div>}
              <div className="space-y-3">
            {savedVisualizations.map((viz) => (
              <div key={viz.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{viz.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(viz.createdAt).toLocaleString()} · {viz.primaryConcept}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {viz.promptSummary || viz.analysis?.learningGoal || "Interactive concept visualisation"}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openVisualization(viz)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Open Visualisation
                </Button>
              </div>
            ))}
          </div>
        </div>

        {resourceError && <div className="text-sm text-destructive">{resourceError}</div>}
      </div>

      {viewerOpen && activeVisualization && viewerSpec && (
        <div className="fixed inset-2 md:inset-4 z-50 bg-[#020818] border border-[#1A2440] rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A2440] bg-[#050F26] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-[#90A4D4]">Interactive Visualisation Workspace</div>
              <div className="text-lg font-medium text-[#EAF0FF] truncate">{activeVisualization.title}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewerOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] bg-[#020818]">
            <div className="border-b lg:border-b-0 lg:border-r border-[#1A2440] p-4 space-y-4 bg-[#061233]">
              <div className="text-xs font-semibold tracking-[0.08em] text-[#8FA6DA]">OPTICS CONTROLS</div>
              {viewerSpec.visualizationType === "prism-refraction-3d" ? (
                <>
                  <label className="text-xs text-[#C9D5F0] block">
                    Refractive Index: {viewerSpec.parameters.refractiveIndex.toFixed(2)}
                    <input
                      type="range"
                      min={1}
                      max={2.6}
                      step={0.01}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.refractiveIndex}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "prism-refraction-3d"
                          ? { ...prev, parameters: { ...prev.parameters, refractiveIndex: value } }
                          : prev));
                      }}
                    />
                  </label>
                  <label className="text-xs text-[#C9D5F0] block">
                    Incident Angle: {Math.round(viewerSpec.parameters.incidentAngleDeg)} deg
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={1}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.incidentAngleDeg}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "prism-refraction-3d"
                          ? { ...prev, parameters: { ...prev.parameters, incidentAngleDeg: value } }
                          : prev));
                      }}
                    />
                  </label>
                  <label className="text-xs text-[#C9D5F0] block">
                    Wavelength: {Math.round(viewerSpec.parameters.wavelengthNm)} nm
                    <input
                      type="range"
                      min={380}
                      max={700}
                      step={1}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.wavelengthNm}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "prism-refraction-3d"
                          ? { ...prev, parameters: { ...prev.parameters, wavelengthNm: value } }
                          : prev));
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-xs text-[#C9D5F0] block">
                    Spring Constant: {viewerSpec.parameters.springConstant.toFixed(1)}
                    <input
                      type="range"
                      min={2}
                      max={120}
                      step={0.5}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.springConstant}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "spring-mass-3d"
                          ? { ...prev, parameters: { ...prev.parameters, springConstant: value } }
                          : prev));
                      }}
                    />
                  </label>
                  <label className="text-xs text-[#C9D5F0] block">
                    Mass: {viewerSpec.parameters.mass.toFixed(2)}
                    <input
                      type="range"
                      min={0.2}
                      max={8}
                      step={0.05}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.mass}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "spring-mass-3d"
                          ? { ...prev, parameters: { ...prev.parameters, mass: value } }
                          : prev));
                      }}
                    />
                  </label>
                  <label className="text-xs text-[#C9D5F0] block">
                    Damping: {viewerSpec.parameters.damping.toFixed(2)}
                    <input
                      type="range"
                      min={0}
                      max={0.6}
                      step={0.01}
                      className="w-full mt-1 accent-[#FFD84D]"
                      value={viewerSpec.parameters.damping}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setViewerSpec((prev) => (prev && prev.visualizationType === "spring-mass-3d"
                          ? { ...prev, parameters: { ...prev.parameters, damping: value } }
                          : prev));
                      }}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="p-2 md:p-4 min-h-0">
              <div className="w-full h-full min-h-[420px]">
                <VisualSimulationCanvas spec={viewerSpec} />
              </div>
            </div>

            <div className="border-t lg:border-t-0 lg:border-l border-[#1A2440] p-4 overflow-auto space-y-3 bg-[#061233] text-[#D7E2FF]">
              <div className="text-xs font-semibold tracking-[0.08em] text-[#8FA6DA]">GUIDED INSIGHTS</div>
              <div className="text-sm font-semibold">{activeVisualization.primaryConcept}</div>
              <div className="text-xs text-[#A8B8DE]">
                {activeVisualization.analysis?.learningGoal || "Explore how parameter changes affect the concept in real time."}
              </div>

              <div className="text-xs text-[#C9D5F0] rounded-md border border-[#1A2440] p-2 bg-[#040E2A]">
                {viewerSpec.visualizationType === "prism-refraction-3d" && prismSnapshot ? (
                  <>
                    <div>Incident: {prismSnapshot.incidentDeg.toFixed(1)} deg</div>
                    <div>Refracted (approx): {prismSnapshot.refractedDeg.toFixed(1)} deg</div>
                    <div>n1 to n2: {prismSnapshot.n1.toFixed(2)} to {prismSnapshot.n2.toFixed(2)}</div>
                  </>
                ) : (
                  <>
                    <div>Spring k: {viewerSpec.parameters.springConstant.toFixed(1)}</div>
                    <div>Mass: {viewerSpec.parameters.mass.toFixed(2)}</div>
                    <div>Damping: {viewerSpec.parameters.damping.toFixed(2)}</div>
                  </>
                )}
              </div>

              <div className="text-xs text-[#C9D5F0] rounded-md border border-[#1A2440] p-2 bg-[#040E2A] space-y-1">
                {viewerSpec.visualizationType === "prism-refraction-3d" ? (
                  <>
                    <div>Light bends more toward the normal in denser material.</div>
                    <div>{prismSnapshot?.tirLikely ? "At this setting, total internal reflection is likely starting." : "Current settings favor refraction-dominant behavior."}</div>
                  </>
                ) : (
                  <>
                    <div>Higher spring constant increases oscillation frequency.</div>
                    <div>Higher damping reduces amplitude more quickly.</div>
                  </>
                )}
              </div>

              {currentStep && (
                <div className="rounded-md border border-[#1A2440] p-3 bg-[#040E2A] space-y-2">
                  <div className="text-[11px] text-[#8FA6DA]">Step {guidedStepIndex + 1} / {currentGuidedSteps.length || 1}</div>
                  <div className="text-sm font-medium">{currentStep.title}</div>
                  <div className="text-xs text-[#B6C4E9]">{currentStep.instruction}</div>
                  <div className={`text-xs font-medium ${conditionMet ? "text-[#57D18B]" : "text-[#FF7A7A]"}`}>
                    {conditionMet ? "Condition met" : "Condition not met"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGuidedStepIndex((prev) => Math.max(0, prev - 1))}
                      disabled={guidedStepIndex <= 0}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGuidedStepIndex((prev) => Math.min((currentGuidedSteps.length || 1) - 1, prev + 1))}
                      disabled={guidedStepIndex >= (currentGuidedSteps.length || 1) - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
