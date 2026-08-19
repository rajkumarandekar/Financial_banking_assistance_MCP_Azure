import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, FolderPlus, NotebookText, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/common/utils";
import { useChat } from "./ChatProvider";
import type { Thread } from "./types";

export function HistoryView() {
  const {
    threads,
    activeThreadId,
    selectThread,
    createThread,
    deleteThread,
    starterPrompts,
    getThreadItems,
  } = useChat();
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteThread(target.id);
  };

  const renderThreads = () => (
    <ScrollArea className="flex-1">
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => createThread()}
          className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 text-muted-foreground transition hover:border-primary/60 hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">New chat</span>
        </button>
        {threads.map((thread) => {
          const threadItems = getThreadItems(thread.id);
          const latestMessage = threadItems.at(-1);
          const isActive = thread.id === activeThreadId;
          
          // Extract preview text from latest message
          let previewText = "";
          if (latestMessage?.type === "user_message") {
            const textContent = latestMessage.content.find((c) => c.type === "input_text");
            previewText = textContent && textContent.type === "input_text" ? textContent.text : "";
          } else if (latestMessage?.type === "assistant_message") {
            previewText = latestMessage.content.map((c) => c.text).join("");
          }

          return (
            <Card
              key={thread.id}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-3 border border-border/70 px-4 py-3 transition",
                isActive ? "border-primary bg-primary/5" : "hover:border-primary/60",
              )}
              onClick={() => selectThread(thread.id)}
            >
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(thread);
                }}
                className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="pr-6 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{thread.title || "Untitled thread"}</p>
              </div>
              {previewText && (
                <p className="text-xs text-muted-foreground" title={previewText}>
                  {previewText.slice(0, 120)}
                  {previewText.length > 120 ? "…" : ""}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );

  const renderStarterPrompts = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">Start a new banking conversation</p>
        <p className="text-sm text-muted-foreground">Choose a template prompt or craft your own request.</p>
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
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Thread history</p>
          <p className="text-sm font-medium text-foreground">Pick a conversation or spin up a new one.</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => createThread()}>
          <FolderPlus className="h-4 w-4" /> New thread
        </Button>
      </div>

      {threads.length ? (
        <>
          {renderThreads()}
          <Separator className="mx-4" />
          <div className="flex flex-col gap-2 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>Threads are sorted by most recent activity.</span>
            </div>
            <div className="flex items-center gap-2">
              <NotebookText className="h-3.5 w-3.5" />
              <span>Starter prompts will appear when you archive your existing threads.</span>
            </div>
          </div>
        </>
      ) : (
        renderStarterPrompts()
      )}

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title || "Untitled thread"}"?</AlertDialogTitle>
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
