import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { RANGE_LABEL, type RangeKey } from "@/lib/transactionAnalytics";

const RANGES: RangeKey[] = ["7d", "30d", "90d", "6m", "1y"];

export interface AccountOption {
  value: string;
  label: string;
}

interface AnalyticsHeaderProps {
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  categories: string[];
  account: string;
  onAccountChange: (a: string) => void;
  accountOptions: AccountOption[];
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export function AnalyticsHeader({
  range, onRangeChange, category, onCategoryChange, categories,
  account, onAccountChange, accountOptions, onExportCsv, onExportPdf,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transaction Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Understand your spending, income and cash flow patterns.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => onRangeChange(v as RangeKey)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r} value={r}>{RANGE_LABEL[r]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={account} onValueChange={onAccountChange}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            {accountOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" />Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCsv}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPdf}>Download Report (PDF)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
