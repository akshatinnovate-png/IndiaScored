import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/lib/api";
import type {
  Application,
  ApplicantDossier,
  Narration,
  QueueEntry,
  ReviewStatus,
  RiskGrade,
  UnderwritingQueue,
} from "@/lib/types";
import {
  DECISION_STYLES,
  GRADE_STYLES,
  formatDateTime,
  formatPercent,
  formatRupees,
  humaniseFeature,
} from "@/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const STATUS_FILTERS = ["All", "submitted", "pending", "approved", "rejected", "flagged"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const GRADE_COLOURS: Record<RiskGrade, string> = {
  "A+": "#059669",
  A: "#16a34a",
  B: "#ca8a04",
  C: "#ea580c",
  D: "#dc2626",
};

const STATUS_BADGES: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  flagged: "bg-purple-100 text-purple-800 border-purple-200",
};

/**
 * The underwriter's console: pipeline health, the review queue, and a detail
 * panel where a file is explained and then approved, rejected or flagged.
 */
export default function UnderwritingDashboard() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState<UnderwritingQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const [dossier, setDossier] = useState<ApplicantDossier | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingDossier, setLoadingDossier] = useState(false);

  const [remarks, setRemarks] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [narration, setNarration] = useState<Narration | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      setQueue(await api.underwriting.queue());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const openApplicant = async (clerkUserId: string) => {
    setLoadingDossier(true);
    setRemarks("");
    setInternalNotes("");
    setSelectedIndex(0);
    try {
      const data = await api.underwriting.dossier(clerkUserId);
      setDossier(data);
      setNarration(data.applications[0]?.narration ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this applicant.");
    } finally {
      setLoadingDossier(false);
    }
  };

  const selected: Application | undefined = dossier?.applications[selectedIndex];

  const generateRemark = async () => {
    if (!dossier || !selected) return;
    setNarrating(true);
    try {
      const result = await api.underwriting.remark(dossier.clerk_user_id, selected.submitted_at);
      setNarration(result.narration ?? null);
      // Seed the remarks box, so the officer edits rather than retypes.
      if (result.narration?.remark) setRemarks(result.narration.remark);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a remark.");
    } finally {
      setNarrating(false);
    }
  };

  const decide = async (status: ReviewStatus) => {
    if (!dossier || !selected || deciding) return;
    setDeciding(true);
    try {
      const result = await api.underwriting.decide(dossier.clerk_user_id, selected.submitted_at, {
        status,
        remarks,
        internal_notes: internalNotes,
      });
      flash(`Application ${result.status}. The applicant has been notified.`);
      await loadQueue();
      await openApplicant(dossier.clerk_user_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the decision.");
    } finally {
      setDeciding(false);
    }
  };

  const visibleApplications = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (queue?.applications ?? []).filter((entry: QueueEntry) => {
      const matchesStatus = statusFilter === "All" || entry.status === statusFilter;
      const matchesSearch =
        !term ||
        (entry.name ?? "").toLowerCase().includes(term) ||
        entry.clerk_user_id.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [queue, search, statusFilter]);

  const gradeChartData = useMemo(
    () =>
      Object.entries(queue?.grade_distribution ?? {}).map(([grade, count]) => ({
        grade: grade as RiskGrade,
        count: count as number,
      })),
    [queue],
  );

  const driverChartData = useMemo(
    () =>
      (selected?.score_card?.drivers ?? [])
        .map((driver) => ({
          name: humaniseFeature(driver.feature),
          contribution: Number(driver.contribution.toFixed(3)),
          raisesRisk: driver.contribution > 0,
        }))
        .reverse(),
    [selected],
  );

  if (loading && !queue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const pipeline = queue?.pipeline;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Underwriting</h1>
            <p className="text-sm text-slate-500">
              Every file is scored on submission. Review the explanation before deciding.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadQueue()} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        {notice && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Pipeline */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total applications", value: pipeline?.total ?? 0, icon: Clock, tone: "text-slate-900" },
            { label: "Awaiting decision", value: pipeline?.open ?? 0, icon: Clock, tone: "text-amber-600" },
            { label: "Approved", value: pipeline?.approved ?? 0, icon: CheckCircle, tone: "text-green-600" },
            { label: "Rejected or flagged", value: pipeline?.adverse ?? 0, icon: XCircle, tone: "text-red-600" },
          ].map((tile) => (
            <Card key={tile.label}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-sm text-slate-500">{tile.label}</p>
                  <p className={`text-3xl font-bold ${tile.tone}`}>{tile.value}</p>
                </div>
                <tile.icon className={`h-8 w-8 opacity-20 ${tile.tone}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {gradeChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk grade distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={gradeChartData}
                    dataKey="count"
                    nameKey="grade"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {gradeChartData.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLOURS[entry.grade]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Queue */}
          <Card className="lg:col-span-2">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Review queue</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or applicant id"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                      statusFilter === status
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-[32rem] space-y-2 overflow-y-auto">
              {visibleApplications.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nothing matches this filter.
                </p>
              ) : (
                visibleApplications.map((entry) => (
                  <button
                    key={`${entry.clerk_user_id}-${entry.submitted_at}`}
                    onClick={() => void openApplicant(entry.clerk_user_id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      dossier?.clerk_user_id === entry.clerk_user_id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {entry.name ?? "Unnamed applicant"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(entry.submitted_at)} ·{" "}
                        {formatRupees(entry.loan_amount_requested ?? 0)}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge className={STATUS_BADGES[entry.status] ?? STATUS_BADGES.submitted}>
                          {entry.status}
                        </Badge>
                        {entry.grade && (
                          <Badge className={GRADE_STYLES[entry.grade]}>{entry.grade}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-2">
                      {entry.india_score != null && (
                        <span className="text-lg font-semibold text-slate-900">
                          {entry.india_score}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Detail */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">
                {dossier ? dossier.profile?.name ?? "Applicant file" : "Select an applicant"}
              </CardTitle>
              {dossier && (
                <p className="text-sm text-slate-500">
                  {dossier.profile?.occupation ?? "Occupation not recorded"} ·{" "}
                  {dossier.profile?.state ?? "State not recorded"}
                  {dossier.psychometric &&
                    ` · psychometric ${formatPercent(dossier.psychometric.score)}`}
                </p>
              )}
            </CardHeader>

            <CardContent className="space-y-5">
              {loadingDossier ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : !dossier || !selected ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  Pick a file from the queue to see its score, its drivers and the AI remark.
                </p>
              ) : (
                <>
                  {dossier.applications.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {dossier.applications.map((app, index) => (
                        <button
                          key={app.submitted_at}
                          onClick={() => {
                            setSelectedIndex(index);
                            setNarration(app.narration ?? null);
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs ${
                            index === selectedIndex
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {formatDateTime(app.submitted_at)}
                        </button>
                      ))}
                    </div>
                  )}

                  {selected.score_card ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">IndiaScore</p>
                          <p className="text-2xl font-bold text-slate-900">
                            {selected.score_card.india_score}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Grade</p>
                          <Badge className={GRADE_STYLES[selected.score_card.grade]}>
                            {selected.score_card.grade}
                          </Badge>
                          <p className="mt-1 text-xs text-slate-500">
                            PD {formatPercent(selected.score_card.probability_of_default, 2)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Eligible</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatRupees(selected.score_card.sanctioned_amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            of {formatRupees(selected.score_card.requested_amount)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Model says</p>
                          <Badge className={DECISION_STYLES[selected.score_card.decision]}>
                            {selected.score_card.decision}
                          </Badge>
                          <p className="mt-1 text-xs text-slate-500">
                            {selected.score_card.indicative_apr}% p.a.
                          </p>
                        </div>
                      </div>

                      {driverChartData.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium text-slate-700">
                            Top drivers (red raised the risk)
                          </p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={driverChartData} layout="vertical" margin={{ left: 30 }}>
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={160}
                                tick={{ fontSize: 10 }}
                              />
                              <ChartTooltip formatter={(value: number) => value.toFixed(3)} />
                              <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                                {driverChartData.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.raisesRisk ? "#dc2626" : "#16a34a"}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      This application has not been scored.
                    </p>
                  )}

                  {/* RAG remark */}
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">AI underwriting remark</p>
                      <Button size="sm" variant="outline" onClick={generateRemark} disabled={narrating}>
                        {narrating ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-4 w-4" />
                        )}
                        {narration ? "Regenerate" : "Generate"}
                      </Button>
                    </div>
                    {narration ? (
                      <>
                        <p className="mt-3 text-sm leading-relaxed text-slate-700">
                          {narration.remark}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {narration.generated_by === "mistral"
                            ? "Written by Mistral running locally"
                            : "Ollama unavailable — rule-based summary"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Generate a remark to see the drivers explained in plain English.
                      </p>
                    )}
                  </div>

                  {/* Decision */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <Textarea
                      placeholder="Remarks shown to the applicant"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      rows={3}
                    />
                    <Textarea
                      placeholder="Internal notes (never shown to the applicant)"
                      value={internalNotes}
                      onChange={(event) => setInternalNotes(event.target.value)}
                      rows={2}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => void decide("approved")}
                        disabled={deciding}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void decide("rejected")}
                        disabled={deciding}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void decide("flagged")}
                        disabled={deciding}
                      >
                        <Flag className="mr-1 h-4 w-4" />
                        Flag for checks
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/underwriting/applicants/${dossier.clerk_user_id}`)}
                        disabled={deciding}
                      >
                        Full report
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Current status:{" "}
                      <span className="font-medium text-slate-600">{selected.status}</span>
                      {selected.review?.decided_at &&
                        ` · decided ${formatDateTime(selected.review.decided_at)}`}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
