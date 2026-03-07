import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ChevronDown, Eye, Loader2, Sparkles } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
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
  fetchTopicVisualizationById,
  fetchTopicVisualizations,
  generateTopicVisualization,
} from "../lib/api";

type Vec3 = [number, number, number];

type MoleculeKey = "CH4" | "NH3" | "H2O";
type MolecularSpec = Extract<VisualizationSpec, { visualizationType: "molecular-geometry-vsepr" }>;

const MOLECULE_META: Record<MoleculeKey, {
  concept: string;
  centralAtom: "C" | "N" | "O";
  outerAtom: "H";
  idealAngle: number;
}> = {
  CH4: {
    concept: "Tetrahedral molecular geometry",
    centralAtom: "C",
    outerAtom: "H",
    idealAngle: 109.5,
  },
  NH3: {
    concept: "Trigonal pyramidal molecular geometry",
    centralAtom: "N",
    outerAtom: "H",
    idealAngle: 107,
  },
  H2O: {
    concept: "Bent molecular geometry",
    centralAtom: "O",
    outerAtom: "H",
    idealAngle: 104.5,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function scale(v: Vec3, n: number): Vec3 {
  return [v[0] * n, v[1] * n, v[2] * n];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleBetweenDeg(a: Vec3, b: Vec3) {
  const cosine = clamp(dot(normalize(a), normalize(b)), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function moleculeVectors(molecule: MoleculeKey, bondAngleDeg: number, repulsionStrength: number): Vec3[] {
  const effectiveAngle = clamp(bondAngleDeg + (repulsionStrength - 1) * 24, 85, 128);
  const angleRad = (effectiveAngle * Math.PI) / 180;

  if (molecule === "CH4") {
    const cos = Math.cos(angleRad);
    const kSq = clamp((2 * (1 + cos)) / Math.max(0.02, 1 - cos), 0.05, 8);
    const k = Math.sqrt(kSq);
    return [
      normalize([1, 1, k]),
      normalize([-1, -1, k]),
      normalize([1, -1, -k]),
      normalize([-1, 1, -k]),
    ];
  }

  if (molecule === "NH3") {
    const cos = Math.cos(angleRad);
    const cosSqPhi = clamp((cos + 0.5) / 1.5, 0.01, 0.98);
    const phi = Math.acos(Math.sqrt(cosSqPhi));
    return [0, 120, 240].map((azimuth) => {
      const az = (azimuth * Math.PI) / 180;
      return normalize([
        Math.sin(phi) * Math.cos(az),
        Math.sin(phi) * Math.sin(az),
        -Math.cos(phi),
      ]);
    });
  }

  const half = angleRad / 2;
  return [
    normalize([Math.sin(half), 0, Math.cos(half)]),
    normalize([-Math.sin(half), 0, Math.cos(half)]),
  ];
}

function getDisplayedBondAngle(vectors: Vec3[]) {
  if (vectors.length < 2) return 0;
  return angleBetweenDeg(vectors[0], vectors[1]);
}

function ensureMolecularSpec(spec: VisualizationSpec | null, primaryConcept = ""): MolecularSpec {
  if (spec && spec.visualizationType === "molecular-geometry-vsepr") {
    const moleculeRaw = String(spec.parameters.molecule || "CH4").toUpperCase();
    const molecule: MoleculeKey = moleculeRaw === "NH3" || moleculeRaw === "H2O" ? moleculeRaw : "CH4";
    const ideal = MOLECULE_META[molecule].idealAngle;
    return {
      ...spec,
      parameters: {
        ...spec.parameters,
        molecule,
        bondAngleDeg: clamp(Number(spec.parameters.bondAngleDeg || ideal), 85, 125),
        bondLength: clamp(Number(spec.parameters.bondLength || 1), 0.7, 1.8),
        repulsionStrength: clamp(Number(spec.parameters.repulsionStrength || 1), 0.5, 1.8),
      },
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
      bondAngleDeg: MOLECULE_META[molecule].idealAngle,
      bondLength: 1,
      repulsionStrength: 1,
      showLonePairs: molecule !== "CH4",
    },
    notes: "Chemistry VSEPR molecular geometry view",
    scene: {
      template: "vsepr_molecular_geometry_v1",
      controls: ["bondAngleDeg", "bondLength", "repulsionStrength"],
      features: ["orbitControls", "ballAndStick", "grid", "hoverGuide"],
    },
  };
}

function cloneSpec(spec: VisualizationSpec): VisualizationSpec {
  return JSON.parse(JSON.stringify(spec)) as VisualizationSpec;
}

function atomColor(atom: "C" | "N" | "O" | "H") {
  if (atom === "C") return "#3b3b3b";
  if (atom === "N") return "#2f65d5";
  if (atom === "O") return "#d53f3f";
  return "#f6fafb";
}

function atomRadius(atom: "C" | "N" | "O" | "H") {
  if (atom === "H") return 0.23;
  if (atom === "C") return 0.35;
  return 0.33;
}

function Bond({ to, color = "#6e7f6c" }: { to: Vec3; color?: string }) {
  const fromVec = new THREE.Vector3(0, 0, 0);
  const toVec = new THREE.Vector3(to[0], to[1], to[2]);
  const midpoint = new THREE.Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(toVec, fromVec);
  const length = direction.length();
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());

  return (
    <mesh position={[midpoint.x, midpoint.y, midpoint.z]} quaternion={quaternion}>
      <cylinderGeometry args={[0.06, 0.06, length, 24]} />
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.5} />
    </mesh>
  );
}

function Atom({ atom, position }: { atom: "C" | "N" | "O" | "H"; position: Vec3 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[atomRadius(atom), 32, 32]} />
      <meshStandardMaterial color={atomColor(atom)} roughness={0.35} metalness={0.08} />
    </mesh>
  );
}

function MolecularViewer({ spec }: { spec: Extract<VisualizationSpec, { visualizationType: "molecular-geometry-vsepr" }> }) {
  const molecule = spec.parameters.molecule;
  const vectors = moleculeVectors(molecule, spec.parameters.bondAngleDeg, spec.parameters.repulsionStrength);
  const bondLength = spec.parameters.bondLength;
  const atomPoints = vectors.map((v) => scale(v, bondLength));
  const displayedAngle = getDisplayedBondAngle(vectors);
  const meta = MOLECULE_META[molecule];

  return (
    <Canvas camera={{ position: [0, 0, 6.2], fov: 48 }}>
      <color attach="background" args={["#f4f8ef"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 6]} intensity={1.1} />
      <pointLight position={[-5, -3, 3]} intensity={0.55} />

      <group>
        <Atom atom={meta.centralAtom} position={[0, 0, 0]} />
        {atomPoints.map((pt, idx) => (
          <group key={idx}>
            <Bond to={pt} />
            <Atom atom={meta.outerAtom} position={pt} />
          </group>
        ))}
      </group>

      <Html position={[0, -2.25, 0]} center>
        <div className="rounded-md border border-[#d4e1cb] bg-white/95 px-3 py-1.5 text-xs text-[#1f3d2e] shadow-sm">
          {meta.outerAtom}-{meta.centralAtom}-{meta.outerAtom} angle: {displayedAngle.toFixed(1)} deg
        </div>
      </Html>

      <OrbitControls enablePan={false} minDistance={3.5} maxDistance={10} />
      <gridHelper args={[14, 18, "#d7e5cf", "#ecf2e5"]} position={[0, -2.2, 0]} />
    </Canvas>
  );
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
  const [hoveredAtom, setHoveredAtom] = useState<"center" | number | null>(null);
  const vectorsData = useMemo(
    () => moleculeVectors(spec.parameters.molecule, spec.parameters.bondAngleDeg, spec.parameters.repulsionStrength),
    [spec.parameters.molecule, spec.parameters.bondAngleDeg, spec.parameters.repulsionStrength],
  );

  const centerAtomRadius = 0.36;
  const hydrogenAtomRadius = 0.24;
  const bondRadius = 0.07;
  const bondLength = spec.parameters.bondLength * 2.2;
  const atomPositions = vectorsData.map((v) => new THREE.Vector3(v[0] * bondLength, v[1] * bondLength, v[2] * bondLength));
  const centerPosition = new THREE.Vector3(0, 0, 0);
  const showGuide = hoveredAtom !== null;
  const guideVertices = useMemo(() => {
    const values: number[] = [];
    if (atomPositions.length < 3) return values;
    for (let i = 0; i < atomPositions.length; i += 1) {
      for (let j = i + 1; j < atomPositions.length; j += 1) {
        const a = atomPositions[i];
        const b = atomPositions[j];
        values.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    return values;
  }, [atomPositions]);

  return (
    <div className="relative w-full h-full rounded-lg border border-[#d8e7cf] bg-card overflow-hidden">
      <Canvas camera={{ position: [2.9, 2.2, 2.9], fov: 42 }}>
        <color attach="background" args={["#e3eddc"]} />
        <ambientLight intensity={0.68} />
        <directionalLight position={[4, 5, 4]} intensity={0.95} />
        <pointLight position={[-3, -2, 5]} intensity={0.45} />

        <gridHelper
          args={[8, 16, "#7f9a79", "#a8bca3"]}
          position={[0, -1.3, 0]}
          onUpdate={(helper) => {
            const mat = helper.material as THREE.Material & { opacity?: number; transparent?: boolean };
            mat.transparent = true;
            mat.opacity = 0.74;
          }}
        />

        <group position={[-2.2, -1.2, 2.2]}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([0, 0, 0, 0.52, 0, 0])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ad4f4f" transparent opacity={0.78} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([0, 0, 0, 0, 0.52, 0])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#3f7f4a" transparent opacity={0.78} />
          </line>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([0, 0, 0, 0, 0, 0.52])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#4663b0" transparent opacity={0.78} />
          </line>
        </group>

        {showGuide && guideVertices.length ? (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={guideVertices.length / 3}
                array={new Float32Array(guideVertices)}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#5d7c6b" transparent opacity={0.6} />
          </lineSegments>
        ) : null}

        <mesh
          position={[0, 0, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredAtom("center");
          }}
          onPointerOut={() => setHoveredAtom((prev) => (prev === "center" ? null : prev))}
        >
          <sphereGeometry args={[centerAtomRadius, 32, 32]} />
          <meshStandardMaterial
            color="#e33d3d"
            roughness={0.5}
            metalness={0.1}
            emissive="#ffffff"
            emissiveIntensity={hoveredAtom === "center" ? 0.18 : 0.02}
          />
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

              <mesh
                position={to.toArray()}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredAtom(index);
                }}
                onPointerOut={() => setHoveredAtom((prev) => (prev === index ? null : prev))}
              >
                <sphereGeometry args={[hydrogenAtomRadius, 32, 32]} />
                <meshStandardMaterial
                  color="#2f70ff"
                  roughness={0.48}
                  metalness={0.1}
                  emissive="#ffffff"
                  emissiveIntensity={hoveredAtom === index ? 0.2 : 0.02}
                />
              </mesh>
            </group>
          );
        })}

        <OrbitControls enablePan={false} enableZoom zoomSpeed={0.9} minDistance={1.4} maxDistance={12} />
      </Canvas>

      <div className="absolute left-3 bottom-2 text-[12px] font-semibold text-[#335942] pointer-events-none">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}

function isMolecularSpec(spec: VisualizationSpec): spec is Extract<VisualizationSpec, { visualizationType: "molecular-geometry-vsepr" }> {
  return spec.visualizationType === "molecular-geometry-vsepr";
}

export default function VisualLab() {
  const { moduleId, topicId } = useParams<{ moduleId: string; topicId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [activeVisualization, setActiveVisualization] = useState<TopicVisualization | null>(null);
  const [viewerSpec, setViewerSpec] = useState<VisualizationSpec | null>(null);

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;
  const topicNames = moduleState ? Object.keys(moduleState.topics) : [];
  const topicName = fromSlugMatch(topicId || "", topicNames);
  const vizId = searchParams.get("vizId") || "";

  const backPath = useMemo(() => {
    if (!moduleName || !topicName) return "/dashboard/modules";
    return `/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(topicName)}`;
  }, [moduleName, topicName]);

  const openVisualization = (visualization: TopicVisualization, syncUrl = true) => {
    setActiveVisualization(visualization);
    setViewerSpec(ensureMolecularSpec(cloneSpec(visualization.spec), visualization.primaryConcept));
    if (syncUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("vizId", visualization.id);
        return next;
      });
    }
  };

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

  useEffect(() => {
    let cancelled = false;
    if (!vizId || !moduleName || !topicName) return;
    if (activeVisualization?.id === vizId) return;

    const inMemory = savedVisualizations.find((item) => item.id === vizId);
    if (inMemory) {
      openVisualization(inMemory, false);
      return;
    }

    async function loadById() {
      try {
        const result = await fetchTopicVisualizationById(moduleName, topicName, vizId);
        if (cancelled) return;
        setSavedVisualizations((prev) => {
          if (prev.some((item) => item.id === result.visualization.id)) return prev;
          return [result.visualization, ...prev];
        });
        openVisualization(result.visualization, false);
      } catch {
        if (cancelled) return;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("vizId");
          return next;
        });
      }
    }

    void loadById();
    return () => {
      cancelled = true;
    };
  }, [moduleName, topicName, savedVisualizations, vizId, activeVisualization?.id, setSearchParams]);

  const handleCreate = async () => {
    if (!moduleName || !topicName || !documents.length) return;
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
      setResourceError(err instanceof Error ? err.message : "Failed to generate visualisation.");
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

  const molecularSpec = viewerSpec && isMolecularSpec(viewerSpec) ? viewerSpec : null;
  const moleculeKey: MoleculeKey = molecularSpec?.parameters.molecule || "CH4";
  const vectors = molecularSpec ? moleculeVectors(moleculeKey, molecularSpec.parameters.bondAngleDeg, molecularSpec.parameters.repulsionStrength) : [];
  const displayedAngle = vectors.length > 1 ? getDisplayedBondAngle(vectors) : 109.5;
  const insightMeta = MOLECULE_META[moleculeKey];
  const noDocuments = !resourceLoading && documents.length === 0;

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
    <div className="min-h-screen bg-[#faf9f2]">
      <div className="border-b border-[#dbe6d1] bg-[#f4f8ec]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="inline-flex items-center gap-2 text-sm text-[#5a735f] hover:text-[#1f3d2e] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {topicName}
          </button>
          <h1 className="text-3xl font-semibold text-[#1f3d2e]">Visual Lab</h1>
          <p className="text-sm text-[#557061] mt-2">
            VSEPR Molecular Geometry Explorer for chemistry visual learning.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="rounded-xl border border-[#dbe6d1] bg-white p-5 space-y-5">
          {noDocuments ? (
            <div className="rounded-lg border border-[#f1c7c7] bg-[#fff5f5] p-4">
              <div className="text-sm font-medium text-[#7b2f2f]">Upload topic documents first</div>
              <div className="text-sm text-[#8e4f4f] mt-1">
                Visual Lab needs at least one uploaded topic document before chemistry concept extraction and generation can run.
              </div>
              <Button variant="outline" className="mt-3" onClick={() => navigate(backPath)}>
                Go to Topic Documents
              </Button>
            </div>
          ) : null}

          <div>
            <h2 className="text-lg font-medium text-[#1f3d2e] mb-1">Select Document(s)</h2>
            {resourceLoading && <div className="text-sm text-[#607969]">Loading uploaded documents...</div>}
            {!resourceLoading && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:max-w-2xl justify-between">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#1f3d2e] block mb-2">Concept / Topic</label>
              <Input
                value={conceptInput}
                onChange={(e) => setConceptInput(e.target.value)}
                className="placeholder:italic"
                placeholder="eg. Hooke's Law"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1f3d2e] block mb-2">What do you want to see?</label>
              <Textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                className="min-h-[42px] placeholder:italic border-[#9ab58f] bg-white shadow-sm focus-visible:border-[#5f8f63] focus-visible:ring-[#5f8f63]/25"
                placeholder="eg. Effect of changing spring stiffness on oscillation frequency"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleCreate} disabled={creating || noDocuments}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Create
            </Button>
            {statusMessage && <span className="text-sm text-[#2f7d4e]">{statusMessage}</span>}
          </div>
        </div>

        <div className="rounded-xl border border-[#dbe6d1] bg-white p-5">
          <h2 className="text-lg font-medium text-[#1f3d2e] mb-4">Saved Visualisations</h2>
          {!savedVisualizations.length && <div className="text-sm text-[#607969]">No saved visualisations for this topic yet.</div>}
          <div className="space-y-3">
            {savedVisualizations.map((viz) => (
              <div key={viz.id} className="border border-[#e3ecda] rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#1f3d2e] truncate">{viz.title}</div>
                  <div className="text-xs text-[#607969] mt-1">
                    {new Date(viz.createdAt).toLocaleString()} · {viz.primaryConcept}
                  </div>
                  <div className="text-xs text-[#607969] mt-1 truncate">
                    {viz.promptSummary || viz.analysis?.learningGoal || "Interactive chemistry visualisation"}
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

        {resourceError && (
          <div className="rounded-lg border border-[#f1c7c7] bg-[#fff5f5] p-4 text-sm text-[#7b2f2f]">
            {resourceError}
          </div>
        )}

        {activeVisualization && viewerSpec ? (
          <div className="rounded-xl border border-[#dbe6d1] bg-white overflow-hidden">
            <div className="border-b border-[#16472f] px-5 py-4 bg-[#1f5a3f]">
              <div className="text-xs text-[#d3efd8]">Learning Workspace</div>
              <div className="text-lg font-semibold text-[#f2fff4]">{activeVisualization.title}</div>
            </div>

            {molecularSpec ? (
              <>
                <div className="relative min-h-[560px]">
                  <div className="h-[560px]">
                    <VisualSimulationCanvas spec={molecularSpec} />
                  </div>

                  <div className="absolute right-4 top-4 w-[min(360px,calc(100%-2rem))] rounded-xl border border-[#cfe2c5] bg-[#fbfff7]/95 p-4 shadow-sm">
                    <div className="text-xs tracking-[0.06em] text-[#6e8d76] font-semibold">LEARNING INSIGHT</div>
                    <div className="mt-1 text-sm font-semibold text-[#1f3d2e]">
                      {activeVisualization.primaryConcept || insightMeta.concept}
                    </div>
                    <div className="text-xs text-[#557061] mt-2">
                      Tetrahedral molecules form when four bonding pairs surround a central atom.
                    </div>
                    <div className="text-xs text-[#557061] mt-2">
                      Current {insightMeta.outerAtom}-{insightMeta.centralAtom}-{insightMeta.outerAtom} angle: {displayedAngle.toFixed(1)} deg.
                    </div>
                    <div className="text-xs text-[#557061] mt-2">
                      Increasing repulsion pushes bonding pairs further apart and changes observed angle.
                    </div>
                    {moleculeKey !== "CH4" ? (
                      <div className="text-xs text-[#557061] mt-2">
                        Demo currently optimized for CH4; {moleculeKey} is included as a secondary template.
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-md border border-[#dce8d5] bg-[#f7fcf3] p-2">
                      <div className="text-xs font-semibold text-[#476d4d]">Guided Exploration</div>
                      <ul className="mt-1 space-y-1 text-xs text-[#33563b] list-disc list-inside">
                        <li>Change repulsion strength and observe how the H-C-H bond angle changes.</li>
                        <li>Adjust bond length to see hydrogen atoms move closer to or farther from carbon.</li>
                        <li>Rotate the molecule to inspect the tetrahedral arrangement from multiple views.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 rounded-md border border-[#d2e3ca] bg-white/95 px-3 py-2 shadow-sm">
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

                <div className="border-t border-[#e2ebd8] bg-[#f6faef] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="text-xs text-[#1f3d2e] block">
                      {labelWithTooltip(
                        "Bond Angle",
                        "Changing Bond Angle adjusts the angle between bonds and shifts the molecular shape.",
                      )}: {molecularSpec.parameters.bondAngleDeg.toFixed(1)} deg
                      <input
                        type="range"
                        min={85}
                        max={125}
                        step={0.1}
                        className="w-full mt-2 accent-[#3f8f58]"
                        value={molecularSpec.parameters.bondAngleDeg}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setViewerSpec((prev) => (prev && isMolecularSpec(prev)
                            ? { ...prev, parameters: { ...prev.parameters, bondAngleDeg: value } }
                            : prev));
                        }}
                      />
                    </label>

                    <label className="text-xs text-[#1f3d2e] block">
                      {labelWithTooltip(
                        "Bond Length",
                        "Changing Bond Length moves hydrogen atoms closer to or farther from the central atom.",
                      )}: {molecularSpec.parameters.bondLength.toFixed(2)}
                      <input
                        type="range"
                        min={0.7}
                        max={1.8}
                        step={0.01}
                        className="w-full mt-2 accent-[#3f8f58]"
                        value={molecularSpec.parameters.bondLength}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setViewerSpec((prev) => (prev && isMolecularSpec(prev)
                            ? { ...prev, parameters: { ...prev.parameters, bondLength: value } }
                            : prev));
                        }}
                      />
                    </label>

                    <label className="text-xs text-[#1f3d2e] block">
                      {labelWithTooltip(
                        "Repulsion Strength",
                        "Changing Repulsion Strength simulates stronger or weaker electron pair repulsion, affecting how far bonding directions spread apart and the observed bond angle.",
                      )}: {molecularSpec.parameters.repulsionStrength.toFixed(2)}
                      <input
                        type="range"
                        min={0.5}
                        max={1.8}
                        step={0.01}
                        className="w-full mt-2 accent-[#3f8f58]"
                        value={molecularSpec.parameters.repulsionStrength}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setViewerSpec((prev) => (prev && isMolecularSpec(prev)
                            ? { ...prev, parameters: { ...prev.parameters, repulsionStrength: value } }
                            : prev));
                        }}
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-5 text-sm text-[#7b2f2f] bg-[#fff5f5]">
                This saved visualisation uses a legacy template and cannot be rendered in the chemistry Visual Lab viewer.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
