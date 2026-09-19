import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/lib/api";
import type { Application, ApplicantDossier, Narration } from "@/lib/types";
import {
  DECISION_STYLES,
  GRADE_STYLES,
  formatDateTime,
  formatPercent,
  formatRupees,
  humaniseFeature,
  scoreBandLabel,
  scorePosition,
} from "@/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface CreditRiskReportProps {
  clerkUserId: string;
}

/**
 * The per-applicant credit risk report an underwriter opens from the queue:
 * the score, the SHAP drivers behind it, and the natural-language remark.
 */
export default function CreditRiskReport({ clerkUserId }: CreditRiskReportProps) {
  const navigate = useNavigate();

  const [dossier, setDossier] = useState<ApplicantDossier | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [narration, setNarration] = useState<Narration | null>(null);
  const [narrating, setNarrating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.underwriting
      .dossier(clerkUserId)
      .then((data) => {
        if (cancelled) return;
        setDossier(data);
        setError(null);
      })
      .catch((cause: Error) => !cancelled && setError(cause.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [clerkUserId]);

  const application: Application | undefined = dossier?.applications[selectedIndex];
  const scoreCard = application?.score_card ?? null;

  // A stored remark is shown straight away; the button regenerates it.
  useEffect(() => {
    setNarration(application?.narration ?? null);
  }, [application]);

  const driverChartData = useMemo(
    () =>
      (scoreCard?.drivers ?? [])
        .map((driver) => ({
          name: humaniseFeature(driver.feature),
          contribution: Number(driver.contribution.toFixed(3)),
          raisesRisk: driver.contribution > 0,
        }))
        .reverse(),
    [scoreCard],
  );

  const requestRemark = async () => {
    if (!application) return;
    setNarrating(true);
    try {
      const result = await api.underwriting.remark(clerkUserId, application.submitted_at);
      setNarration(result.narration ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the remark.");
    } finally {
      setNarrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Could not load this applicant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">{error ?? "No file found."}</p>
            <Button variant="outline" onClick={() => navigate("/underwriting")}>
              Back to the queue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/underwriting")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Queue
            </Button>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {dossier.profile?.name ?? "Applicant"}
            </h1>
            <p className="text-sm text-slate-500">
              {dossier.profile?.occupation ?? "Occupation not recorded"} ·{" "}
              {dossier.profile?.state ?? "State not recorded"} · {clerkUserId}
            </p>
          </div>

          {dossier.psychometric && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Psychometric</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatPercent(dossier.psychometric.score)}
              </p>
              <p className="text-xs text-slate-400">
                {formatDateTime(dossier.psychometric.taken_at)}
              </p>
            </div>
          )}
        </div>

        {/* One tab per application, so an applicant's history stays visible. */}
        {dossier.applications.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {dossier.applications.map((app, index) => (
              <button
                key={app.submitted_at}
                onClick={() => setSelectedIndex(index)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {formatDateTime(app.submitted_at)}
              </button>
            ))}
          </div>
        )}

        {!scoreCard ? (
          <Card>
            <CardContent className="py-10 text-center text-slate-500">
              This application has not been scored yet.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">IndiaScore</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">{scoreCard.india_score}</p>
                  <p className="text-xs text-slate-500">{scoreBandLabel(scoreCard.india_score)}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${scorePosition(scoreCard.india_score) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Risk grade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge className={GRADE_STYLES[scoreCard.grade]}>{scoreCard.grade}</Badge>
                  <p className="text-xs text-slate-500">
                    PD {formatPercent(scoreCard.probability_of_default, 2)} · {scoreCard.indicative_apr}% p.a.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Exposure</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold text-slate-900">
                    {formatRupees(scoreCard.sanctioned_amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    of {formatRupees(scoreCard.requested_amount)} requested
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Model decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge className={DECISION_STYLES[scoreCard.decision]}>{scoreCard.decision}</Badge>
                  <p className="text-xs text-slate-500">
                    Repayment confidence {formatPercent(scoreCard.repayment_confidence)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">What drove this decision</CardTitle>
                  <p className="text-sm text-slate-500">
                    SHAP contributions to the log-odds of default. Bars to the right raised the
                    risk; bars to the left lowered it.
                  </p>
                </CardHeader>
                <CardContent>
                  {driverChartData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No attributions were recorded for this application.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={driverChartData} layout="vertical" margin={{ left: 40 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={170}
                          tick={{ fontSize: 11 }}
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
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Underwriter's remark</CardTitle>
                  <Button size="sm" variant="outline" onClick={requestRemark} disabled={narrating}>
                    {narrating ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-4 w-4" />
                    )}
                    {narration ? "Regenerate" : "Generate"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {narration ? (
                    <>
                      <p className="text-sm leading-relaxed text-slate-700">{narration.remark}</p>
                      <p className="text-xs text-slate-400">
                        Written by{" "}
                        {narration.generated_by === "mistral"
                          ? "Mistral (local)"
                          : "the rule-based fallback"}
                      </p>
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        {narration.evidence.map((item) => (
                          <div key={item.feature} className="text-xs">
                            <p className="font-medium text-slate-700">
                              {item.label}{" "}
                              <span
                                className={
                                  item.direction === "increases_risk"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }
                              >
                                ({item.strength})
                              </span>
                            </p>
                            <p className="text-slate-500">{item.reading}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No remark has been generated for this application yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alternative data on file</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(application?.alternative_data ?? {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-slate-100 pb-1">
                      <dt className="text-slate-500">{humaniseFeature(key)}</dt>
                      <dd className="font-medium text-slate-900">
                        {typeof value === "number" ? Number(value.toFixed(3)) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
