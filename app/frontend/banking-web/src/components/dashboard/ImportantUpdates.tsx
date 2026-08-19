// Compact activity feed replacing what used to be two large "Documents" and
// "Communications" KPI-style cards - same underlying data (real documents +
// communication history), merged into one recent-activity list.
import { Link } from "react-router-dom";
import { FileText, Mail, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentSummary, CommunicationEvent } from "@/models/Domain";

interface ImportantUpdatesProps {
  documents: DocumentSummary[];
  communications: CommunicationEvent[];
}

interface UpdateRow {
  id: string;
  title: string;
  date: string | null | undefined;
  icon: typeof FileText;
}

export function ImportantUpdates({ documents, communications }: ImportantUpdatesProps) {
  const rows: UpdateRow[] = [
    ...documents.map((d) => ({ id: `doc-${d.id}`, title: d.title || d.documentType, date: d.generatedAt, icon: FileText })),
    ...communications.map((c) => ({ id: `comm-${c.id}`, title: c.subject || c.body.slice(0, 60), date: c.sentAt, icon: Mail })),
  ]
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    .slice(0, 5);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground">Important Updates</h3>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No recent activity.</p>
        ) : (
          <div className="mt-3 divide-y divide-border/50">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <row.icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm text-foreground truncate flex-1">{row.title}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {row.date ? new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "--"}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link to="/documents" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View documents <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
