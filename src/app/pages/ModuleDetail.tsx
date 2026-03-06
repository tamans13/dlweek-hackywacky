import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { ArrowLeft, CheckCircle2, Calendar, Plus, Upload, ChevronDown, X } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { addTopic } from "../lib/api";
import { daysUntil, formatDate } from "../lib/format";

export default function ModuleDetail() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { state, readiness, loading, error, saveExamPlan, saveProfileData, uploadTopicFiles, refresh } = useAppData();

  const moduleNames = state ? state.profile.modules : [];
  const moduleName = fromSlugMatch(moduleId || "", moduleNames || []);
  const moduleState = moduleName && state ? state.modules[moduleName] : null;
  const examPlan = moduleName && state ? state.examPlans[moduleName] : null;

  useEffect(() => {
    (window as unknown as { __brainosaurModule?: string }).__brainosaurModule = moduleName || undefined;
  }, [moduleName]);

  const topics = useMemo(() => {
    if (!moduleState) return [];
    const moduleAttempts = state?.quizAttempts.filter((q) => q.moduleName === moduleName) || [];
    const attemptsByTopic = new Map<string, number>();
    for (const attempt of moduleAttempts) {
      attemptsByTopic.set(attempt.topicName, (attemptsByTopic.get(attempt.topicName) || 0) + 1);
    }

    return Object.entries(moduleState.topics)
      .map(([topicKey, topic]) => {
        const topicName = topic?.topicName?.trim() || topicKey;
        const hasAttempts = (attemptsByTopic.get(topicName) || 0) > 0;
        const estimated = hasAttempts ? (topic.estimatedMasteryNow ?? topic.mastery) : 0;
        const masteryPct = Math.round((estimated / 10) * 100);
        const retentionPct = hasAttempts ? Math.round((estimated / Math.max(1, topic.mastery)) * 100) : 0;
        const status = masteryPct >= 85 ? "mastered" : masteryPct >= 65 ? "good" : "review";
        return {
          id: toSlug(topicName || topicKey),
          name: topicName,
          masteryPct,
          retentionPct,
          status,
          nextReviewAt: topic.nextReviewAt,
          documents: topic.documents || [],
        };
      })
      .sort((a, b) => a.masteryPct - b.masteryPct);
  }, [moduleState, state, moduleName]);

  const [showAddExamDialog, setShowAddExamDialog] = useState(false);
  const [showAddTopicDialog, setShowAddTopicDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [examName, setExamName] = useState(examPlan?.examName || "");
  const [examDate, setExamDate] = useState(examPlan?.examDate || "");
  const [topicsTested, setTopicsTested] = useState<string[]>(examPlan?.topicsTested || []);
  const [topicsDropdownOpen, setTopicsDropdownOpen] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [uploadTopicName, setUploadTopicName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setExamName(examPlan?.examName || "");
    setExamDate(examPlan?.examDate || "");
    setTopicsTested(examPlan?.topicsTested || []);
    setExamError(null);
  }, [examPlan]);

  useEffect(() => {
    const validTopicNames = new Set(topics.map((topic) => topic.name));
    setTopicsTested((prev) => prev.filter((name) => validTopicNames.has(name)));
  }, [topics]);

  useEffect(() => {
    if (!showAddExamDialog) {
      setTopicsDropdownOpen(false);
    }
  }, [showAddExamDialog]);

  const handleAddTopic = async () => {
    if (!moduleName || !newTopicName.trim()) return;
    await addTopic({ moduleName, topicName: newTopicName.trim() });
    setNewTopicName("");
    setShowAddTopicDialog(false);
    await refresh();
  };

  const handleSaveExam = async () => {
    if (!moduleName) return;
    const trimmedExamName = examName.trim();
    if (!trimmedExamName || !examDate) {
      setExamError("Please provide exam name and exam date.");
      return;
    }

    if (!topicsTested.length) {
      setExamError("Please select at least one tested topic.");
      return;
    }

    try {
      await saveExamPlan({
        moduleName,
        examName: trimmedExamName,
        examDate,
        topicsTested,
      });
      setExamError(null);
      setShowAddExamDialog(false);
    } catch (err) {
      setExamError(err instanceof Error ? err.message : "Failed to save exam. Please try again.");
    }
  };

  const toggleExamTopic = (topicName: string, checked: boolean) => {
    setExamError(null);
    setTopicsTested((prev) => {
      if (checked) return Array.from(new Set([...prev, topicName]));
      return prev.filter((name) => name !== topicName);
    });
  };

  const topicsLoading = loading && !topics.length;
  const noTopicsFound = !topicsLoading && topics.length === 0;

  const handleDeleteModule = async () => {
    if (!state || !moduleName) return;
    if (!window.confirm(`Delete module "${moduleName}"? This will remove its topics and related records.`)) return;

    const nextModules = state.profile.modules.filter((name) => name !== moduleName);
    await saveProfileData({
      university: state.profile.university,
      yearOfStudy: state.profile.yearOfStudy,
      courseOfStudy: state.profile.courseOfStudy,
      modules: nextModules,
    });
    navigate("/dashboard/modules");
  };

  const handleUploadClick = (topicName: string) => {
    setUploadTopicName(topicName);
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!moduleName || !uploadTopicName) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadStatus(null);
    try {
      await uploadTopicFiles({ moduleName, topicName: uploadTopicName, files });
      setUploadStatus({
        type: "success",
        message: `Uploaded ${files.length} file${files.length === 1 ? "" : "s"} to ${uploadTopicName}.`,
      });
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      e.target.value = "";
    }
  };

  if (loading && !state) {
    return <div className="p-8 text-muted-foreground">Loading module...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  if (!moduleName || !moduleState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-medium text-foreground mb-2">Module not found</h2>
          <Link to="/dashboard/modules" className="text-primary hover:underline">
            Back to modules
          </Link>
        </div>
      </div>
    );
  }

  const readinessInfo = readiness.find((item) => item.moduleName === moduleName);

  const fallbackReadiness =
    state && state.modules[moduleName]
      ? Math.round(
          (topics.reduce((sum, t) => sum + t.masteryPct, 0) / Math.max(1, topics.length)) * 0.9 +
            10,
        )
      : 0;

  const moduleReadiness = Math.min(100, readinessInfo?.score ?? fallbackReadiness);

  const readinessReason =
    readinessInfo?.reason ?? (moduleReadiness ? "Estimated locally" : "No data yet");
  const predictor = readinessInfo?.prediction;
  const predictorToneClass =
    predictor?.riskBand === "low" ? "text-success" : predictor?.riskBand === "medium" ? "text-warning" : "text-destructive";
  const predictorBandLabel =
    predictor?.riskBand === "low" ? "Low Risk" : predictor?.riskBand === "medium" ? "Medium Risk" : "High Risk";

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link to="/dashboard/modules" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to modules
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-medium text-foreground">{moduleName}</h1>
              <div className="flex items-center gap-6 mt-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {examPlan
                      ? `${daysUntil(examPlan.examDate)} days until ${examPlan.examName || "exam"} (${formatDate(examPlan.examDate)})`
                      : "No exam date set"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Exam Readiness:</span>
                  <span className="text-lg font-medium text-foreground">{moduleReadiness}%</span>
                  {moduleReadiness === 0 && <span className="text-sm text-muted-foreground">No data yet</span>}
                </div>
              </div>
              {moduleReadiness === 0 && <p className="text-sm text-muted-foreground mt-1">{readinessReason}</p>}
            </div>
            <Dialog open={showAddExamDialog} onOpenChange={setShowAddExamDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Exam/Midterm
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Exam or Midterm</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Exam Name</Label>
                    <Input
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      placeholder="e.g., Economics CA1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Topics Covered</Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal min-h-10 h-auto"
                        disabled={topicsLoading || noTopicsFound}
                        onClick={() => setTopicsDropdownOpen((prev) => !prev)}
                      >
                        <span className="flex flex-wrap items-center gap-2 text-left">
                          {!topicsTested.length && (
                            <span className="text-muted-foreground">
                              {topicsLoading
                                ? "Loading topics..."
                                : noTopicsFound
                                  ? "No topics found"
                                  : "Select topics"}
                            </span>
                          )}
                          {topicsTested.map((topicName) => (
                            <span
                              key={topicName}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-xs text-foreground"
                            >
                              <span>{topicName}</span>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Remove ${topicName}`}
                                className="rounded-sm text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExamTopic(topicName, false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleExamTopic(topicName, false);
                                  }
                                }}
                              >
                                <X className="w-3 h-3" />
                              </span>
                            </span>
                          ))}
                        </span>
                        <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground flex-shrink-0" />
                      </Button>
                      {topicsDropdownOpen && !topicsLoading && !noTopicsFound && (
                        <div className="absolute z-50 mt-2 w-full rounded-md border border-border bg-popover p-3 shadow-md">
                          <div className="space-y-2 max-h-52 overflow-auto">
                            {topics.map((topic) => {
                              const selected = topicsTested.includes(topic.name);
                              return (
                                <button
                                  key={topic.id}
                                  type="button"
                                  className={`w-full flex items-center gap-2 text-sm rounded-md px-2 py-2 text-left transition-colors ${
                                    selected ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground"
                                  }`}
                                  onClick={() => toggleExamTopic(topic.name, !selected)}
                                >
                                  <Checkbox checked={selected} className="pointer-events-none" />
                                  <span>{topic.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {examError && (
                    <p className="text-sm text-destructive">{examError}</p>
                  )}
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleSaveExam}
                    disabled={!examName.trim() || !examDate || !topicsTested.length || topics.length === 0}
                  >
                    Save Exam
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {examPlan && predictor && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-medium text-foreground text-lg">AI Exam Predictor</h3>
                <p className="text-sm text-muted-foreground mt-1">{predictor.explanation}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Model</div>
                <div className="text-sm font-medium text-foreground">{predictor.modelType}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Risk</div>
                <div className={`text-sm font-medium ${predictorToneClass}`}>{predictorBandLabel}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Projected Readiness</div>
                <div className="text-sm font-medium text-foreground">{predictor.projectedReadiness}%</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-sm font-medium text-foreground">{predictor.confidence}%</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Untested Topics</div>
                <div className="text-sm font-medium text-foreground">{predictor.untestedTopicCount}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">Daily Target</div>
                <div className="text-sm font-medium text-foreground">{predictor.dailyTopicTarget} topic/day</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">Priority Weak Topics</div>
              <div className="flex flex-wrap gap-2">
                {predictor.priorityTopics.length ? (
                  predictor.priorityTopics.map((item) => (
                    <span key={item.topicName} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                      <span>{item.topicName}</span>
                      <span className="text-xs text-muted-foreground">{item.masteryPct}%</span>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No weak topics detected yet.</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground text-lg">Topics</h3>
            <Dialog open={showAddTopicDialog} onOpenChange={setShowAddTopicDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Topic
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Topic</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Topic Name</Label>
                    <Input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="e.g., Monetary Policy" />
                  </div>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleAddTopic}>
                    Add Topic
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={`/dashboard/modules/${toSlug(moduleName)}/topics/${topic.id}`}
                className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-foreground flex-1">{topic.name}</h4>
                  {topic.status === "mastered" && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Mastery Level</span>
                      <span className="text-foreground font-medium">{topic.masteryPct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${topic.masteryPct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUploadClick(topic.name);
                    }}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload Notes
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{topic.documents.length} file{topic.documents.length === 1 ? "" : "s"}</span>
                  {topic.documents[0] && (
                    <span className="truncate max-w-[180px]" title={topic.documents[0].name}>
                      {topic.documents[0].name}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              e.stopPropagation();
              void handleUploadChange(e);
            }}
          />
          {uploadStatus && (
            <p className={`mt-3 text-sm ${uploadStatus.type === "error" ? "text-destructive" : "text-success"}`}>{uploadStatus.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleDeleteModule}>
            Delete Module
          </Button>
        </div>
      </div>
    </div>
  );
}
