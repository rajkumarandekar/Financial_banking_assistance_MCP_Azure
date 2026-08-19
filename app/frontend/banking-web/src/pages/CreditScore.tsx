// Credit Score page - composition only. All data assembly lives in
// useCreditScoreData, all rules in lib/creditScore, all visuals in
// components/credit. Reading order answers, in sequence:
//
//   what is my score -> is it good -> is it moving -> what affects it
//   -> what changed -> what should I do -> the full log
import { useRef } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCreditScoreData } from "@/hooks/useCreditScoreData";
import { ScoreOverviewCard } from "@/components/credit/ScoreOverviewCard";
import { ScoreRangeCard } from "@/components/credit/ScoreRangeCard";
import { ScoreFactorsCard } from "@/components/credit/ScoreFactorsCard";
import { ScoreTrendCard } from "@/components/credit/ScoreTrendCard";
import { RecentChangesCard } from "@/components/credit/RecentChangesCard";
import { ImprovementTipsCard } from "@/components/credit/ImprovementTipsCard";
import { CreditHistoryCard } from "@/components/credit/CreditHistoryCard";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}

export default function CreditScorePage() {
  const { data, isLoading, isError, isRefreshing, refresh } = useCreditScoreData();
  const historyRef = useRef<HTMLDivElement>(null);
  const tipsRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const lastUpdatedLabel = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Credit Score</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your credit health at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {isRefreshing ? "Updating…" : lastUpdatedLabel ? `Last updated: ${lastUpdatedLabel}` : "Not yet updated"}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={refresh}
                disabled={isRefreshing}
                aria-label="Refresh credit data"
                className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Refresh credit data</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : isError && data.score == null ? (
        // Only a hard failure with nothing cached blocks the page; if we still
        // hold a previous score we fall through and render it below.
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">Unable to load your latest credit score</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We couldn't reach the credit service. Your other account data is unaffected.
              </p>
            </div>
            <Button onClick={refresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {isError && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">Couldn't fetch your latest score — showing the last value we have{lastUpdatedLabel ? ` from ${lastUpdatedLabel}` : ""}.</span>
              <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing}>Try again</Button>
            </div>
          )}

          {/* Score + range */}
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ScoreOverviewCard
              score={data.score}
              band={data.band}
              milestone={data.milestone}
              previousScore={data.previousScore}
              onSeeImprovements={() => scrollTo(tipsRef)}
            />
            <ScoreRangeCard band={data.band} />
          </div>

          {/* Factors + trend */}
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <ScoreFactorsCard factors={data.factors} />
            <ScoreTrendCard trend={data.trend} insight={data.insight} />
          </div>

          {/* Changes + tips */}
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <RecentChangesCard history={data.history} onViewAll={() => scrollTo(historyRef)} />
            <div ref={tipsRef} className="scroll-mt-6">
              <ImprovementTipsCard recommendations={data.recommendations} />
            </div>
          </div>

          <CreditHistoryCard ref={historyRef} history={data.history} />
        </>
      )}
    </div>
  );
}
