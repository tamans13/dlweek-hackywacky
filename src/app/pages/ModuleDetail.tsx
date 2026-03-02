import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { ArrowLeft, Clock, CheckCircle2, Calendar, Plus, Upload, X, Play } from "lucide-react";
import { useAppData } from "../state/AppDataContext";
import { fromSlugMatch, toSlug } from "../lib/ids";
import { addTopic } from "../lib/api";
import { daysUntil, formatDate } from "../lib/format";
import { startExtensionTracking, stopExtensionTracking } from "../lib/extension";

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function dueInLabel(dateIso: string) {
  const days = daysUntil(dateIso);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export default function ModuleDetail() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { state, readiness, loading, error, startSession, stopSession, saveExamPlan, saveProfileData, uploadTopicFiles, refresh } = useAppData();

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

    return Object.values(moduleState.topics)
      .map((topic) => {
        const hasAttempts = (attemptsByTopic.get(topic.topicName) || 0) > 0;
        const estimated = hasAttempts ? (topic.estimatedMasteryNow ?? topic.mastery) : 0;
        const masteryPct = Math.round((estimated / 10) * 100);
        const retentionPct = hasAttempts ? Math.round((estimated / Math.max(1, topic.mastery)) * 100) : 0;
        const status = masteryPct >= 85 ? "mastered" : masteryPct >= 65 ? "good" : "review";
        return {
          id: toSlug(topic.topicName),
          name: topic.topicName,
          masteryPct,
          retentionPct,
          status,
          nextReviewAt: topic.nextReviewAt,
          documents: topic.documents || [],
        };
      })
      .sort((a, b) => a.masteryPct - b.masteryPct);
  }, [moduleState, state, moduleName]);

  const spacedRepetition = useMemo(
    () => [...topics].sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()).slice(0, 6),
    [topics],
  );

  const activeSession = useMemo(() => {
    if (!state || !moduleName) return null;
    return [...state.studySessions]
      .reverse()
      .find((session) => session.moduleName === moduleName && !session.endAt) || null;
  }, [state, moduleName]);

  const [currentTopic, setCurrentTopic] = useState("");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showAddExamDialog, setShowAddExamDialog] = useState(false);
  const [showAddTopicDialog, setShowAddTopicDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [examDate, setExamDate] = useState(examPlan?.examDate || "");
  const [totalTopics, setTotalTopics] = useState(examPlan?.totalTopics?.toString() || "");
  const [topicsCovered, setTopicsCovered] = useState(examPlan?.topicsCovered?.toString() || "");
  const [uploadTopicName, setUploadTopicName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setExamDate(examPlan?.examDate || "");
    setTotalTopics(examPlan?.totalTopics?.toString() || "");
    setTopicsCovered(examPlan?.topicsCovered?.toString() || "");
  }, [examPlan]);

  useEffect(() => {
    if (!activeSession) {
      setSessionSeconds(0);
      return;
    }

    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(activeSession.startAt).getTime()) / 1000));
      setSessionSeconds(secs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStartStudy = async () => {
    if (!moduleName || !currentTopic) return;
    const sessionId = await startSession(moduleName, currentTopic);
    if (sessionId) {
      await startExtensionTracking(sessionId).catch(() => { });
    }
  };

  const handleEndStudy = async () => {
    if (!activeSession) return;
    await stopSession(activeSession.id);
    await stopExtensionTracking("user_ended_session").catch(() => { });
    
    // Ask user if they want to take a quiz
    const takeQuiz = window.confirm("Session ended! 🎉\n\nWould you like to take a quiz now? (An AI quiz with 10 questions will be auto-generated from your notes.)");
    
    if (!takeQuiz) {
      // User declined - return to module page
      navigate(`/dashboard/modules/${toSlug(moduleName)}`);
      return;
    }
    
    // Navigate first, then auto-generate in TopicDetail to avoid first-attempt race/mismatch issues.
    navigate(`/dashboard/modules/${toSlug(moduleName)}/topics/${toSlug(activeSession.topicName)}?autoQuiz=10`);
  };

  const handleAddTopic = async () => {
    if (!moduleName || !newTopicName.trim()) return;
    await addTopic({ moduleName, topicName: newTopicName.trim() });
    setNewTopicName("");
    setShowAddTopicDialog(false);
    await refresh();
  };

  const handleSaveExam = async () => {
    if (!moduleName || !examDate) return;
    await saveExamPlan({
      moduleName,
      examDate,
      totalTopics: Number(totalTopics || topics.length),
      topicsCovered: Number(topicsCovered || 0),
      topicsTested: examPlan?.topicsTested || topics.map((topic) => topic.name),
    });
    setShowAddExamDialog(false);
  };

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
    await uploadTopicFiles({ moduleName, topicName: uploadTopicName, files });
    e.target.value = "";
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
          (topics.reduce((sum, t) => sum + t.masteryPct, 0) / Math.max(1, topics.length)) * 0.55 +
            (Number(topicsCovered || 0) / Math.max(1, Number(totalTopics || topics.length))) * 100 * 0.35 +
            10,
        )
      : 0;

  const moduleReadiness = Math.min(100, readinessInfo?.score ?? fallbackReadiness);

  const readinessReason =
    readinessInfo?.reason ?? (moduleReadiness ? "Estimated locally" : "No data yet");

  return (
    <div className="min-h-screen">
      {activeSession && (
        <div className="fixed top-4 right-4 bg-card border-2 border-primary rounded-lg p-4 shadow-lg z-50 min-w-[300px]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground">Study Session Active</h4>
            <button onClick={handleEndStudy} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Topic:</span>
              <span className="font-medium text-foreground">{activeSession.topicName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span className="text-2xl font-medium text-primary">{formatDuration(sessionSeconds)}</span>
            </div>
          </div>
          <Button onClick={handleEndStudy} variant="outline" className="w-full mt-4" size="sm">
            End Session
          </Button>
        </div>
      )}

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
                    {examPlan ? `${daysUntil(examPlan.examDate)} days until exam (${formatDate(examPlan.examDate)})` : "No exam date set"}
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
                    <Label>Date</Label>
                    <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Total Topics</Label>
                      <Input type="number" value={totalTopics} onChange={(e) => setTotalTopics(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Topics Covered</Label>
                      <Input type="number" value={topicsCovered} onChange={(e) => setTopicsCovered(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSaveExam}>
                    Save Exam
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="font-medium text-foreground text-lg mb-4">Study Session</h3>
          {!activeSession ? (
            <div className="flex items-center gap-3">
              <Select value={currentTopic} onValueChange={setCurrentTopic}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select topic to study" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.name}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleStartStudy} disabled={!currentTopic} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Play className="w-4 h-4 mr-2" />
                Start Study Session
              </Button>
            </div>
          ) : (
            <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">Study session in progress. Use the floating panel to stop.</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground text-lg">Spaced Repetition Queue</h3>
          </div>

          <div className="space-y-3">
            {!spacedRepetition.length && <div className="text-sm text-muted-foreground">No topics yet. Add topics and complete quizzes.</div>}
            {spacedRepetition.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div>
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="text-sm text-muted-foreground">Due: {dueInLabel(item.nextReviewAt)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/modules/${toSlug(moduleName)}/topics/${item.id}`)}>
                  Review Now
                </Button>
              </div>
            ))}
          </div>
        </div>

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

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Retention</span>
                      <span className={`font-medium ${topic.retentionPct < 50 ? "text-destructive" : topic.retentionPct < 80 ? "text-warning" : "text-success"}`}>
                        {topic.retentionPct}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${topic.retentionPct >= 80 ? "bg-success" : topic.retentionPct >= 50 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${topic.retentionPct}%` }}
                      />
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
