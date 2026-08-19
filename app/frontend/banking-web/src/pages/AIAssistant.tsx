import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bot, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/common/utils";
import {
  ChatProvider,
  useChat,
  type RetryConfig,
  type ShellHeaderConfig,
  type ComposerConfig,
  type ShellContainerConfig,
} from "@/components/chat";
import { ShellHeader } from "@/components/chat/ShellHeader";
import { StreamViewport } from "@/components/chat/StreamViewport";
import { Composer } from "@/components/chat/Composer";
import type { StarterPrompt, Thread } from "@/components/chat/types";

const BANKING_STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "pay-bill",
    title: "Pay a bill",
    description: "Upload an invoice or share the details",
    icon: "🧾",
    content: "Pay my latest Alpine Utilities invoice for this month",
  },
  {
    id: "card-trend",
    title: "Review card spend",
    description: "Summaries, trends, and anomalies",
    icon: "💳",
    content: "Summarize my Platinum Visa spending from the past 30 days",
  },
  {
    id: "transactions-search",
    title: "Investigate payments",
    description: "Search through your payments based on various criteria.",
    icon: "🛡️",
    content: "when was last time I've paid contoso?",
  },
  {
    id: "loan-status",
    title: "Check my loan",
    description: "EMI schedule, status, and next payment",
    icon: "🏦",
    content: "What's the status of my active loan and when is my next EMI due?",
  },
  {
    id: "statement",
    title: "Generate a statement",
    description: "Produce a document for your account",
    icon: "📄",
    content: "Generate a statement for my account 1010",
  },
  {
    id: "credit-score",
    title: "Check credit score",
    description: "See your score and what's affecting it",
    icon: "📊",
    content: "What's my current credit score and what's affecting it?",
  },
];

const retryConfig: RetryConfig = {
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

const headerConfig: ShellHeaderConfig = {
  showHeader: true,
  showIcon: true,
  titleLabel: "SecureBank Assistant",
  showActiveThread: true,
  activeThreadFallback: "New conversation",
  showNewThreadButton: true,
  showHistoryButton: false, // the persistent left rail replaces the toggle-history overlay
};

const composerConfig: ComposerConfig = {
  placeholder: "Ask about payments, cards, loans, credit, or documents...",
  buttonSize: "md",
  showAttachmentCounter: true,
  maxAttachments: 5,
  showAttachmentTitle: true,
  showAttachmentSize: true,
};

const shellContainerConfig: ShellContainerConfig = {
  showBorder: false,
  showRoundedCorners: false,
  showShadow: false,
  backgroundColor: "bg-transparent",
};

function ThreadRail() {
  const { threads, activeThreadId, selectThread, createThread, deleteThread, getThreadItems } = useChat();
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteThread(target.id);
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border/70 bg-muted/20">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/70">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversations</p>
          <p className="text-sm font-semibold text-foreground">{threads.length} task{threads.length === 1 ? "" : "s"}</p>
        </div>
        <Button size="icon" variant="ghost" className="hover:bg-primary/10" onClick={() => createThread()}>
          <SquarePen className="h-4 w-4" />
          <span className="sr-only">New conversation</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {threads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No conversations yet. Pick a starter prompt or type a message to begin.
          </p>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {threads.map((thread) => {
              const items = getThreadItems(thread.id);
              const latest = items.at(-1);
              let preview = "";
              if (latest?.type === "user_message") {
                const t = latest.content.find((c) => c.type === "input_text");
                preview = t && t.type === "input_text" ? t.text : "";
              } else if (latest?.type === "assistant_message") {
                preview = latest.content.map((c) => c.text).join("");
              }
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    "group relative rounded-lg border transition-colors",
                    isActive ? "bg-primary/10 border-primary/30" : "hover:bg-muted border-transparent"
                  )}
                >
                  <button
                    onClick={() => selectThread(thread.id)}
                    className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2 pr-6">
                      <p className="text-sm font-medium text-foreground truncate">{thread.title || "Untitled task"}</p>
                      <Badge variant={thread.status.type === "active" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                        {thread.status.type}
                      </Badge>
                    </div>
                    {preview && (
                      <p className="text-xs text-muted-foreground truncate pr-6">{preview}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(thread);
                    }}
                    className="absolute right-2 top-2.5 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border/70 p-3">
        <p className="text-[11px] text-muted-foreground">
          Each task gets its own conversation, so you can jump between them without losing context.
        </p>
      </div>

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title || "Untitled task"}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the conversation and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssistantWorkspace() {
  const { activeThreadId, threads, createThread, starterPrompts } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as { prefill?: string } | null)?.prefill;
  const consumedPrefill = useRef(false);

  // Other pages (Payments' New Payment modal, its detail drawer) hand off a
  // real, specific request here via router state - this is what turns that
  // into an actual running thread instead of leaving the composer empty.
  // The ref + history.replaceState guards against re-firing on re-render or
  // a browser refresh replaying the same navigation state.
  useEffect(() => {
    if (!prefill || consumedPrefill.current) return;
    consumedPrefill.current = true;
    createThread(prefill);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <ThreadRail />
      <div className="flex min-h-0 flex-1 flex-col">
        <ShellHeader config={headerConfig} />
        <div className="min-h-0 flex-1">
          {activeThreadId ? (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <StreamViewport attachmentImageSize="lg" maxVisibleAttachments={3} />
              </div>
              <div className="border-t border-border/70 bg-background/95">
                <Composer {...composerConfig} />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">
                  {threads.length === 0 ? "Start your first task" : "Pick a conversation or start a new one"}
                </p>
                <p className="text-sm text-muted-foreground">Choose a starter prompt or type your own request below.</p>
              </div>
              <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {starterPrompts.map((prompt) => (
                  <Button
                    key={prompt.id}
                    variant="outline"
                    className="flex h-auto flex-col items-start gap-1 rounded-2xl border-border/70 px-4 py-3 text-left"
                    onClick={() => createThread(prompt.content, { title: prompt.title })}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {prompt.icon ? `${prompt.icon} ` : ""}
                      {prompt.title}
                    </span>
                    {prompt.description && <span className="text-xs text-muted-foreground">{prompt.description}</span>}
                  </Button>
                ))}
              </div>
              <div className="w-full max-w-2xl border-t border-border/70 pt-4">
                <Composer {...composerConfig} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const chatServerUrl = import.meta.env.VITE_CHAT_SERVER_URL || "/chatkit";

  return (
    <ChatProvider
      starterPrompts={BANKING_STARTER_PROMPTS}
      chatServerUrl={chatServerUrl}
      retryConfig={retryConfig}
      attachmentImageSize="lg"
      maxVisibleAttachments={3}
      composerConfig={composerConfig}
      shellContainerConfig={shellContainerConfig}
    >
      <AssistantWorkspace />
    </ChatProvider>
  );
}
