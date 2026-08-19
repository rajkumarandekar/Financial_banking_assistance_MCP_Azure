import React, { useState } from "react";
import { CheckCircle2, Mail, MessageCircle, Bell, FileText, TrendingUp, Info, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClientWidgetProps } from "../WidgetRegistry";
import { useSendWidgetAction } from "../widgetUtils";

/**
 * Arguments expected by the ToolApprovalRequest widget
 */
interface ToolApprovalArgs {
  tool_name: string;
  tool_args: Record<string, unknown>;
  call_id: string;
  request_id: string;
  title?: string;
  description?: string;
}

// Fields that are internal plumbing (auth identity, blobs, framework
// bookkeeping) - never useful for a customer reviewing a confirmation.
const HIDDEN_FIELDS = new Set([
  "callerCustomerId", "callerRole", "customerId", "customer_id",
  "attachmentBase64", "call_id", "request_id",
]);

interface Presentation {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  bgClass: string;
  approveClass: string;
}

const TOOL_PRESENTATION: Record<string, Presentation> = {
  processPayment: { title: "Confirm Payment", icon: CheckCircle2, iconClass: "text-green-600", bgClass: "bg-green-100", approveClass: "bg-green-600 hover:bg-green-700" },
  sendEmail: { title: "Confirm Email", icon: Mail, iconClass: "text-blue-600", bgClass: "bg-blue-100", approveClass: "bg-blue-600 hover:bg-blue-700" },
  sendWhatsapp: { title: "Confirm WhatsApp Message", icon: MessageCircle, iconClass: "text-blue-600", bgClass: "bg-blue-100", approveClass: "bg-blue-600 hover:bg-blue-700" },
  sendNotification: { title: "Confirm Notification", icon: Bell, iconClass: "text-blue-600", bgClass: "bg-blue-100", approveClass: "bg-blue-600 hover:bg-blue-700" },
  applyLoan: { title: "Confirm Loan Application", icon: FileText, iconClass: "text-amber-600", bgClass: "bg-amber-100", approveClass: "bg-amber-600 hover:bg-amber-700" },
  approveLoan: { title: "Confirm Loan Approval", icon: CheckCircle2, iconClass: "text-green-600", bgClass: "bg-green-100", approveClass: "bg-green-600 hover:bg-green-700" },
  rejectLoan: { title: "Confirm Loan Rejection", icon: Info, iconClass: "text-red-600", bgClass: "bg-red-100", approveClass: "bg-red-600 hover:bg-red-700" },
  buyStock: { title: "Confirm Stock Purchase", icon: TrendingUp, iconClass: "text-amber-600", bgClass: "bg-amber-100", approveClass: "bg-amber-600 hover:bg-amber-700" },
  sellStock: { title: "Confirm Stock Sale", icon: TrendingUp, iconClass: "text-amber-600", bgClass: "bg-amber-100", approveClass: "bg-amber-600 hover:bg-amber-700" },
};

const DEFAULT_PRESENTATION: Presentation = {
  title: "Confirm Action",
  icon: Info,
  iconClass: "text-blue-600",
  bgClass: "bg-blue-100",
  approveClass: "bg-blue-600 hover:bg-blue-700",
};

function humanizeFieldName(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && key.toLowerCase().includes("amount")) {
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return String(value);
}

/**
 * Pre-built widget for tool approval requests - shows a human-readable
 * summary of the pending action instead of raw tool names/JSON.
 */
export function ToolApprovalRequest({ args, itemId }: ClientWidgetProps) {
  const { tool_name, tool_args, call_id, request_id } = args as ToolApprovalArgs;

  const [loadingButton, setLoadingButton] = useState<'approve' | 'reject' | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  const sendWidgetAction = useSendWidgetAction({
    onThreadEnded: () => {
      setIsDisabled(true);
      setLoadingButton(null);
    },
    onError: (error) => {
      console.error('Widget action error:', error);
      setIsDisabled(false);
      setLoadingButton(null);
    }
  });

  const presentation = TOOL_PRESENTATION[tool_name] ?? DEFAULT_PRESENTATION;
  const Icon = presentation.icon;

  // tool_args sometimes arrives as an already-parsed object and sometimes as
  // a raw JSON string (framework-dependent) - normalize before iterating, or
  // Object.entries on a string iterates its individual characters.
  const parsedToolArgs: Record<string, unknown> =
    typeof tool_args === "string"
      ? (() => {
          try {
            return JSON.parse(tool_args);
          } catch {
            return {};
          }
        })()
      : (tool_args ?? {});

  const detailEntries = Object.entries(parsedToolArgs).filter(([key]) => !HIDDEN_FIELDS.has(key));

  const handleApprove = () => {
    setLoadingButton('approve');
    sendWidgetAction(itemId, {
      type: "approval",
      payload: { tool_name, tool_args, approved: true, call_id, request_id },
    });
  };

  const handleReject = () => {
    setLoadingButton('reject');
    sendWidgetAction(itemId, {
      type: "approval",
      payload: { tool_name, tool_args, approved: false, call_id, request_id },
    });
  };

  return (
    <Card className="border p-0 overflow-hidden">
      <div className="flex flex-col items-center gap-2 p-5">
        <div className={`flex items-center justify-center rounded-full p-3 ${presentation.bgClass}`}>
          <Icon className={`h-7 w-7 ${presentation.iconClass}`} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{presentation.title}</h3>
        <p className="text-sm text-muted-foreground text-center">Please review the details below before continuing.</p>
      </div>

      {detailEntries.length > 0 && (
        <div className="flex flex-col gap-2 px-5 pb-4">
          {detailEntries.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{humanizeFieldName(key)}</span>
              <span className="font-medium text-foreground text-right">{formatValue(key, value)}</span>
            </div>
          ))}
        </div>
      )}

      <Separator />

      <div className="flex gap-2 p-4">
        <Button
          onClick={handleReject}
          variant="outline"
          className="flex-1"
          disabled={isDisabled || loadingButton !== null}
          loading={loadingButton === 'reject'}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApprove}
          className={`flex-1 text-white ${presentation.approveClass}`}
          disabled={isDisabled || loadingButton !== null}
          loading={loadingButton === 'approve'}
        >
          Approve
        </Button>
      </div>
    </Card>
  );
}
