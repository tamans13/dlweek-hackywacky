import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, Eye, Loader2, Sparkles, X } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  TopicDocument,
  TopicVisualization,
  VisualizationSpec,
  fetchTopicFiles,
  fetchTopicVisualizations,
  generateTopicVisualization,
} from "../lib/api";

type Vec3 = { x: number; y: number; z: number };

type MoleculeKey = "CH4" | "NH3" | "H2O";

type MolecularSpec = {
  visualizationType: "molecular-geometry-vsepr";
  parameters: {
    molecule: MoleculeKey;
    bondAngleDeg: number;
    bondLength: number;
    repulsionStrength: number;
    showLonePairs?: boolean;
  };
  scene?: {
    template?: string;
  };
  notes?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(v: Vec3): Vec3 {
  const mag = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

function angleBetweenDeg(a: Vec3, b: Vec3) {
  const an = normalize(a);
  const bn = normalize(b);
  const c = clamp(an.x * bn.x + an.y * bn.y + an.z * bn.z, -1, 1);
  return (Math.acos(c) * 180) / Math.PI;
}

function getIdealAngle(molecule: MoleculeKey) {
  if (molecule === "NH3") return 107;
  if (molecule === "H2O") return 104.5;
  return 109.5;
}

function getMoleculeVectors(molecule: MoleculeKey, bondAngleDeg: number, repulsionStrength: number) {
  const repulsionAngleShift = (repulsionStrength - 1) * 24;
  const effectiveAngle = clamp(bondAngleDeg + repulsionAngleShift, 86, 128);
  const angleRad = (effectiveAngle * Math.PI) / 180;

  if (molecule === "CH4") {
    const cos = Math.cos(angleRad);
    const kSq = clamp((2 * (1 + cos)) / Math.max(0.03, 1 - cos), 0.04, 8);
    const k = Math.sqrt(kSq);
    const base = [
      normalize({ x: 1, y: 1, z: k }),
      normalize({ x: -1, y: -1, z: k }),
      normalize({ x: 1, y: -1, z: -k }),
      normalize({ x: -1, y: 1, z: -k }),
    ];
    const radialScale = 1 + (repulsionStrength - 1) * 0.22;
    return {
      vectors: base.map((v) => ({ x: v.x * radialScale, y: v.y * radialScale, z: v.z * radialScale })),
      effectiveAngle,
    };
  }

  if (molecule === "NH3") {
    const cos = Math.cos(angleRad);
    const cosSqPhi = clamp((cos + 0.5) / 1.5, 0.01, 0.98);
    const phi = Math.acos(Math.sqrt(cosSqPhi));
    const radialScale = 1 + (repulsionStrength - 1) * 0.2;
    const vectors = [0, 120, 240].map((azimuth) => {
      const az = (azimuth * Math.PI) / 180;
      const v = normalize({
        x: Math.sin(phi) * Math.cos(az),
        y: Math.sin(phi) * Math.sin(az),
        z: -Math.cos(phi),
      });
      return { x: v.x * radialScale, y: v.y * radialScale, z: v.z * radialScale };
    });
    return { vectors, effectiveAngle };
  }

  const half = angleRad / 2;
  const radialScale = 1 + (repulsionStrength - 1) * 0.24;
  return {
    vectors: [
      normalize({ x: Math.sin(half), y: 0, z: Math.cos(half) }),
      normalize({ x: -Math.sin(half), y: 0, z: Math.cos(half) }),
    ].map((v) => ({ x: v.x * radialScale, y: v.y * radialScale, z: v.z * radialScale })),
    effectiveAngle,
  };
}

function getObservedAngle(vectors: Vec3[]) {
  if (vectors.length < 2) return 0;
  return angleBetweenDeg(vectors[0], vectors[1]);
}

function ensureMolecularSpec(spec: VisualizationSpec | null, primaryConcept = "Tetrahedral molecular geometry"): MolecularSpec {
  if (spec && (spec as any).visualizationType === "molecular-geometry-vsepr") {
    const raw = spec as any;
    const moleculeRaw = String(raw.parameters?.molecule || "CH4").toUpperCase();
    const molecule: MoleculeKey = moleculeRaw === "NH3" || moleculeRaw === "H2O" ? moleculeRaw : "CH4";
    return {
      visualizationType: "molecular-geometry-vsepr",
      parameters: {
        molecule,
        bondAngleDeg: clamp(Number(raw.parameters?.bondAngleDeg || getIdealAngle(molecule)), 86, 128),
        bondLength: clamp(Number(raw.parameters?.bondLength || 1), 0.65, 1.9),
        repulsionStrength: clamp(Number(raw.parameters?.repulsionStrength || 1), 0.5, 1.8),
        showLonePairs: Boolean(raw.parameters?.showLonePairs),
      },
      scene: raw.scene,
      notes: raw.notes,
    };
  }

  const lower = String(primaryConcept || "").toLowerCase();
  const molecule: MoleculeKey = lower.includes("nh3") || lower.includes("ammonia")
    ? "NH3"
    : lower.includes("h2o") || lower.includes("water")
      ? "H2O"
      : "CH4";

  return {
    visualizationType: "molecular-geometry-vsepr",
    parameters: {
      molecule,
      bondAngleDeg: getIdealAngle(molecule),
      bondLength: 1,
      repulsionStrength: 1,
      showLonePairs: molecule !== "CH4",
    },
    scene: { template: "vsepr_molecular_geometry_v1" },
    notes: "Chemistry VSEPR visualisation",
  };
}

function cloneSpec(spec: MolecularSpec): MolecularSpec {
  return JSON.parse(JSON.stringify(spec)) as MolecularSpec;
}

function labelWithTooltip(label: string, content: string) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center border-b border-dotted border-[#8fbf9a] text-[#1f3d2e]">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-xs bg-[#1f5a3f] text-[#f5faef]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function VisualSimulationCanvas({ spec }: { spec: MolecularSpec }) {
  const vectorsData = useMemo(
    () => getMoleculeVectors(spec.parameters.molecule, spec.parameters.bondAngleDeg, spec.parameters.repulsionStrength),
    [spec.parameters.molecule, spec.parameters.bondAngleDeg, spec.parameters.repulsionStrength],
  );

  const centerAtomRadius = 0.36;
  const hydrogenAtomRadius = 0.24;
  const bondRadius = 0.07;
  const bondLength = spec.parameters.bondLength * 2.2;
  const atomPositions = vectorsData.vectors.map((v) => new THREE.Vector3(v.x * bondLength, v.y * bondLength, v.z * bondLength));
  const centerPosition = new THREE.Vector3(0, 0, 0);

  return (
    <div className="relative w-full h-full rounded-lg border border-[#d8e7cf] bg-card overflow-hidden">
      <Canvas camera={{ position: [2.9, 2.2, 2.9], fov: 42 }}>
        <color attach="background" args={["#f6fbf2"]} />
        <ambientLight intensity={0.68} />
        <directionalLight position={[4, 5, 4]} intensity={0.95} />
        <pointLight position={[-3, -2, 5]} intensity={0.45} />

        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[centerAtomRadius, 32, 32]} />
          <meshStandardMaterial color="#e33d3d" roughness={0.5} metalness={0.1} />
        </mesh>

        {atomPositions.map((to, index) => {
          const direction = new THREE.Vector3().subVectors(to, centerPosition);
          const safeDirection = direction.clone().normalize();

          const start = centerPosition.clone().addScaledVector(safeDirection, centerAtomRadius * 0.72);
          const end = to.clone().addScaledVector(safeDirection, -hydrogenAtomRadius * 0.72);
          const rod = new THREE.Vector3().subVectors(end, start);
          const rodLength = Math.max(0.02, rod.length());
          const midpoint = start.clone().addScaledVector(rod, 0.5);
          const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            safeDirection,
          );

          return (
            <group key={index}>
              <mesh position={midpoint} quaternion={quaternion}>
                <cylinderGeometry args={[bondRadius, bondRadius, rodLength, 24]} />
                <meshStandardMaterial color="#d8d8d8" roughness={0.52} metalness={0.1} />
              </mesh>

              <mesh position={to.toArray()}>
                <sphereGeometry args={[hydrogenAtomRadius, 32, 32]} />
                <meshStandardMaterial color="#2f70ff" roughness={0.48} metalness={0.1} />
              </mesh>
            </group>
          );
        })}

        <OrbitControls enablePan={false} enableZoom zoomSpeed={0.9} minDistance={1.4} maxDistance={12} />
      </Canvas>

      <div className="absolute left-3 bottom-2 text-[12px] font-semibold text-[#335942] pointer-events-none">
        Drag to rotate molecule
      </div>
    </div>
  );
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
  const [viewerSpec, setViewerSpec] = useState<MolecularSpec | null>(null);

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
        setDocuments(docResult.documents);
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
    setViewerSpec(cloneSpec(ensureMolecularSpec(visualization.spec, visualization.primaryConcept)));
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
      openVisualization(result.visualization);
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

  const vectorsData = useMemo(() => {
    if (!viewerSpec) return null;
    return getMoleculeVectors(
      viewerSpec.parameters.molecule,
      viewerSpec.parameters.bondAngleDeg,
      viewerSpec.parameters.repulsionStrength,
    );
  }, [viewerSpec]);

  const observedAngle = useMemo(() => {
    if (!vectorsData) return 109.5;
    return getObservedAngle(vectorsData.vectors);
  }, [vectorsData]);

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
              placeholder="eg. Chemistry, VSEPR molecular geometry"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">What do you want to see?</label>
            <Textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="min-h-24 placeholder:italic"
              placeholder="eg. How repulsion changes CH4 bond arrangement"
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

      {viewerOpen && activeVisualization && viewerSpec && vectorsData && (
        <div className="fixed inset-2 md:inset-4 z-50 bg-[#f8fbf6] border border-[#d3e3cb] rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1d5236] bg-[#1f5a3f] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-[#d3efd8]">Learning Workspace</div>
              <div className="text-lg font-medium text-[#f1fff3] truncate">{activeVisualization.title}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setViewerOpen(false)}>
              <X className="w-4 h-4 text-[#e8f9ec]" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col bg-[#f8fbf6]">
            <div className="relative p-3 md:p-4 min-h-0 flex-1">
              <div className="w-full h-full min-h-[460px]">
                <VisualSimulationCanvas spec={viewerSpec} />
              </div>

              <div className="absolute top-6 right-6 w-[300px] rounded-lg border border-[#d2e3ca] bg-white/95 p-3 text-[#1f3d2e] shadow-sm">
                <div className="text-xs font-semibold tracking-[0.06em] text-[#5d7b60]">LEARNING INSIGHT</div>
                <div className="text-sm font-semibold mt-1">{activeVisualization.primaryConcept}</div>
                <div className="text-xs mt-2">Tetrahedral molecules form when four bonding pairs surround a central atom.</div>
                <div className="text-xs mt-2">The current H-C-H bond angle is {observedAngle.toFixed(1)} deg.</div>
                <div className="text-xs mt-2">Increasing repulsion pushes bonding pairs further apart and changes observed angle.</div>

                <div className="mt-3 rounded-md border border-[#dce8d5] bg-[#f7fcf3] p-2">
                  <div className="text-xs font-semibold text-[#476d4d]">Guided Exploration</div>
                  <ul className="mt-1 space-y-1 text-xs text-[#33563b] list-disc list-inside">
                    <li>Change repulsion strength and observe how the H-C-H bond angle changes.</li>
                    <li>Adjust bond length to see hydrogen atoms move closer to or farther from carbon.</li>
                    <li>Rotate the molecule to inspect the tetrahedral arrangement from multiple views.</li>
                  </ul>
                </div>
              </div>

              <div className="absolute right-6 bottom-6 rounded-md border border-[#d2e3ca] bg-white/95 px-3 py-2 shadow-sm">
                <div className="text-[11px] font-semibold text-[#4d6f53] mb-1">Atom Legend</div>
                <div className="flex items-center gap-2 text-xs text-[#2f4a37]">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e33d3d]" />
                  Carbon
                </div>
                <div className="flex items-center gap-2 text-xs text-[#2f4a37] mt-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#2f70ff]" />
                  Hydrogen
                </div>
              </div>
            </div>

            <div className="border-t border-[#d3e3cb] p-4 bg-[#eef6e9]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-xs text-[#2f4a37] block">
                  {labelWithTooltip(
                    "Bond Angle",
                    "Changing Bond Angle adjusts the angle between bonds and shifts the molecular shape.",
                  )}: {viewerSpec.parameters.bondAngleDeg.toFixed(1)} deg
                  <input
                    type="range"
                    min={86}
                    max={128}
                    step={0.1}
                    className="w-full mt-1 accent-[#2f7a4f]"
                    value={viewerSpec.parameters.bondAngleDeg}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setViewerSpec((prev) => (prev
                        ? { ...prev, parameters: { ...prev.parameters, bondAngleDeg: value } }
                        : prev));
                    }}
                  />
                </label>

                <label className="text-xs text-[#2f4a37] block">
                  {labelWithTooltip(
                    "Bond Length",
                    "Changing Bond Length moves hydrogen atoms closer to or farther from the central carbon atom.",
                  )}: {viewerSpec.parameters.bondLength.toFixed(2)}
                  <input
                    type="range"
                    min={0.65}
                    max={1.9}
                    step={0.01}
                    className="w-full mt-1 accent-[#2f7a4f]"
                    value={viewerSpec.parameters.bondLength}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setViewerSpec((prev) => (prev
                        ? { ...prev, parameters: { ...prev.parameters, bondLength: value } }
                        : prev));
                    }}
                  />
                </label>

                <label className="text-xs text-[#2f4a37] block">
                  {labelWithTooltip(
                    "Repulsion Strength",
                    "Changing Repulsion Strength simulates stronger or weaker electron pair repulsion, spreading or contracting bond directions and changing observed bond angle.",
                  )}: {viewerSpec.parameters.repulsionStrength.toFixed(2)}
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.01}
                    className="w-full mt-1 accent-[#2f7a4f]"
                    value={viewerSpec.parameters.repulsionStrength}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setViewerSpec((prev) => (prev
                        ? { ...prev, parameters: { ...prev.parameters, repulsionStrength: value } }
                        : prev));
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
