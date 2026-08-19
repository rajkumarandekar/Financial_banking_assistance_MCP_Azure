// Bottom-right floating chat launcher - the same real streaming assistant
// used elsewhere (ChatProvider + ChatShell), just collapsed into a
// corner button instead of an always-open inline panel on the dashboard.
import { useState } from "react";
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChatProvider,
  ChatShell,
  type RetryConfig,
  type ShellHeaderConfig,
  type ComposerConfig,
  type ShellContainerConfig,
} from "@/components/chat";
import type { StarterPrompt } from "@/components/chat/types";

const DASHBOARD_STARTER_PROMPTS: StarterPrompt[] = [
  { id: "analyze-spending", title: "Analyze my spending", description: "Breakdown by category and trend", icon: "📊", content: "Analyze my spending this month" },
  { id: "upcoming-payments", title: "Show upcoming payments", description: "EMIs and dues coming up", icon: "🗓️", content: "Show my upcoming payments" },
  { id: "improve-credit", title: "Improve my credit score", description: "What's helping or hurting it", icon: "📈", content: "How can I improve my credit score?" },
  { id: "afford-50k", title: "Can I afford ₹50K?", description: "Check disposable cash flow", icon: "💰", content: "Can I afford to spend ₹50,000 this month?" },
];

const retryConfig: RetryConfig = {
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

const headerConfig: ShellHeaderConfig = {
  showHeader: true,
  showIcon: true,
  icon: Bot,
  titleLabel: "SecureBank AI",
  showActiveThread: true,
  activeThreadFallback: "Your personal financial assistant",
  showNewThreadButton: true,
  showHistoryButton: false,
};

const composerConfig: ComposerConfig = {
  placeholder: "Ask SecureBank AI...",
  buttonSize: "md",
  showAttachmentCounter: false,
  maxAttachments: 3,
};

const shellContainerConfig: ShellContainerConfig = {
  showBorder: false,
  showRoundedCorners: false,
  showShadow: false,
  backgroundColor: "bg-white",
};

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const chatServerUrl = import.meta.env.VITE_CHAT_SERVER_URL || "/chatkit";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 h-[560px] w-[380px] overflow-hidden rounded-2xl border border-border/50 bg-white shadow-2xl">
          <ChatProvider
            starterPrompts={DASHBOARD_STARTER_PROMPTS}
            chatServerUrl={chatServerUrl}
            retryConfig={retryConfig}
            composerConfig={composerConfig}
            shellContainerConfig={shellContainerConfig}
          >
            <ChatShell headerConfig={headerConfig} />
          </ChatProvider>
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="ml-auto flex h-14 w-14 rounded-full shadow-lg"
        aria-label={open ? "Close SecureBank AI" : "Open SecureBank AI"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </Button>
    </div>
  );
}
