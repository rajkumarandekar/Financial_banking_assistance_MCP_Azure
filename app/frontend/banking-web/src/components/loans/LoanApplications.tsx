import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLoanApplications, LOAN_TYPE_LABEL } from "@/lib/loanCenterService";
import type { ApplicationStatus } from "@/models/LoanCenter";

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  under_review: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-green-200 bg-green-50 text-green-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  under_review: "Under Review", approved: "Approved", rejected: "Rejected",
};

export function LoanApplications() {
  const applications = useLoanApplications();
  if (applications.length === 0) return null;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">My Applications</h3>
        <div className="mt-3 divide-y divide-border/50">
          {applications.map((app) => (
            <div key={app.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{LOAN_TYPE_LABEL[app.type]}</p>
                <p className="text-xs text-muted-foreground">{app.lenderName}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(app.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">₹{app.amount.toLocaleString()}</p>
                <Badge variant="outline" className={`mt-1 text-[10px] ${STATUS_BADGE[app.status]}`}>● {STATUS_LABEL[app.status]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
