import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Plus, X, Trash2, Copy, FileCode2, MessageSquare, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { useIde } from "../store";
import agentLogo from "@/assets/kiln-agent.png";

type Snippet = { file: string; language: string; code: string };
const newId = () => Math.random().toString(36).slice(2, 10);

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Custom fetch that bridges DefaultChatTransport over Electron IPC when available */
const electronChatFetch: typeof fetch = async (input, init) => {
  const bridge = (window as any).kilnBridge;
  if (!bridge?.ai?.streamChat) {
    return fetch(input, init);
  }

  const parsed = init?.body ? JSON.parse(String(init.body)) : {};
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          closed = true;
        }
      };

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream already closed or errored
        }
      };

      const safeError = (errMsg: string) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(new Error(errMsg || "Stream failed."));
        } catch {
          // Stream already closed or errored
        }
      };

      bridge.ai.streamChat(
        { messages: parsed.messages ?? [], snippet: parsed.snippet ?? null },
        {
          onChunk: safeEnqueue,
          onEnd: safeClose,
          onError: safeError,
        },
        init?.signal ?? undefined,
      );
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
};

/** In-memory chat: threads vanish on reload. */
export function ChatPanel({ onClose }: { onClose: () => void }) {
  const ide = useIde();
  const { chatThreads: threads, setChatThreads } = ide;
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(GROQ_BASE_URL);
  const [model, setModel] = useState(GROQ_DEFAULT_MODEL);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const bridge = (window as any).kilnBridge;
    bridge?.ai?.getConfig?.().then((cfg: { hasKey: boolean; baseURL: string; model: string }) => {
      setHasKey(cfg.hasKey);
      setBaseURL(cfg.baseURL || GROQ_BASE_URL);
      setModel(cfg.baseURL ? cfg.model || GROQ_DEFAULT_MODEL : GROQ_DEFAULT_MODEL);
      if (!cfg.hasKey) setShowSettings(true);
    });
  }, []);

  const saveSettings = async () => {
    const bridge = (window as any).kilnBridge;
    if (!bridge?.ai?.saveConfig) return;
    const updated = await bridge.ai.saveConfig({ apiKey, baseURL, model });
    setHasKey(updated.hasKey);
    setApiKey("");
    setShowSettings(false);
  };

  const create = () => {
    const t = { id: newId(), title: "New conversation", messages: [] as UIMessage[] };
    setChatThreads((ts) => [t, ...ts]);
    setActiveId(t.id);
    return t.id;
  };
  useEffect(() => { if (!activeId) create(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const active = threads.find((t) => t.id === activeId);

  return (
    <aside aria-label="AI chat" className="kiln-chat-panel flex min-h-0 w-[390px] max-w-[calc(100vw-48px)] shrink-0 flex-col border-l bg-sidebar">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <img src={agentLogo} width={22} height={22} alt="" className="kiln-agent-logo size-[22px] object-contain" />
        <h2 className="flex-1 text-xs font-semibold">Kiln Chat</h2>
        <Button size="icon-sm" variant="ghost" title="AI Settings" aria-label="AI Settings" onClick={() => setShowSettings((s) => !s)}>
          <Settings className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" title="New conversation" aria-label="New conversation" onClick={create}>
          <Plus className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" title="Close chat" aria-label="Close chat" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      {showSettings && (
        <div className="space-y-2 border-b bg-background p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">AI Provider Settings</span>
            <button
              type="button"
              onClick={() => {
                setBaseURL(GROQ_BASE_URL);
                setModel(GROQ_DEFAULT_MODEL);
              }}
              className="text-[11px] text-primary hover:underline"
            >
              Use Groq defaults
            </button>
          </div>
          <input
            type="password"
            placeholder={hasKey ? "API key saved (paste to replace)" : "Paste Groq API Key (gsk_...)"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-7 w-full rounded border bg-input px-2 text-xs outline-none"
          />
          <input
            type="text"
            placeholder={GROQ_BASE_URL}
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            className="h-7 w-full rounded border bg-input px-2 text-xs outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={GROQ_DEFAULT_MODEL}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-7 flex-1 rounded border bg-input px-2 text-xs outline-none"
            />
            <Button size="sm" className="h-7 px-3 text-xs" onClick={saveSettings}>
              Save
            </Button>
          </div>
        </div>
      )}

      {threads.length > 1 && (
        <div className="max-h-32 shrink-0 overflow-y-auto border-b p-2">
          {threads.map((t) => (
            <div key={t.id} className="flex items-center rounded hover:bg-ide-hover">
              <Button
                variant="ghost"
                size="sm"
                className={`min-w-0 flex-1 justify-start gap-2 text-xs ${t.id === activeId ? "bg-ide-selected text-foreground" : "text-muted-foreground"}`}
                onClick={() => setActiveId(t.id)}
              >
                <MessageSquare className="size-3 shrink-0" />
                <span className="truncate">{t.title}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${t.title}`}
                onClick={() => {
                  setChatThreads((ts) => ts.filter((x) => x.id !== t.id));
                  if (t.id === activeId) setActiveId(threads.find((x) => x.id !== t.id)?.id ?? null);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {active && (
        <ChatWindow
          key={active.id}
          id={active.id}
          initialMessages={active.messages}
          onMessages={(messages) =>
            setChatThreads((ts) =>
              ts.map((t) =>
                t.id !== active.id
                  ? t
                  : {
                      ...t,
                      messages,
                      title:
                        t.title === "New conversation"
                          ? (messages[0]?.parts.find((p) => p.type === "text") as { text?: string } | undefined)?.text?.slice(0, 50) || t.title
                          : t.title,
                    },
              ),
            )
          }
        />
      )}
    </aside>
  );
}

function ChatWindow({ id, initialMessages, onMessages }: { id: string; initialMessages: UIMessage[]; onMessages: (m: UIMessage[]) => void }) {
  const ide = useIde();
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const snippetRef = useRef<Snippet | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: electronChatFetch,
        body: () => ({ snippet: snippetRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({ id, messages: initialMessages, transport });
  const busy = status === "submitted" || status === "streaming";
  const save = useRef(onMessages);
  save.current = onMessages;

  useEffect(() => {
    if (!busy) save.current(messages);
  }, [busy, messages]);

  // Pick up "Ask about selection" requests from the editor
  useEffect(() => {
    if (!ide.chatDraft) return;
    setSnippet({ file: ide.chatDraft.file, language: ide.chatDraft.language, code: ide.chatDraft.code });
    setText((t) => t || "What does this code do?");
    ide.setChatDraft(null);
    setTimeout(() => input.current?.select(), 0);
  }, [ide.chatDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    input.current?.focus();
  }, [status, id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 p-4">
          {messages.length === 0 && (
            <div className="py-6 text-xs text-muted-foreground">
              <h3 className="mb-2 text-base font-medium text-foreground">Ask about your code</h3>
              <p>
                Select code in the editor and press <kbd className="rounded border px-1">Ctrl+I</kbd> (or right-click → Ask Kiln About Selection), then type your question.
              </p>
              <p className="mt-2">Chats are kept only until you reload.</p>
            </div>
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role} className="max-w-full">
              {message.role === "assistant" && (
                <div className="flex items-center gap-2 text-xs font-medium">
                  <img src={agentLogo} width={18} height={18} alt="" className="kiln-agent-logo size-[18px]" />
                  Kiln
                </div>
              )}
              <MessageContent className="w-full text-[13px]">
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <MessageResponse key={index}>{part.text}</MessageResponse>
                  ) : part.type === "reasoning" ? (
                    <Reasoning key={index} defaultOpen={false} isStreaming={busy && message.id === messages.at(-1)?.id}>
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  ) : null,
                )}
              </MessageContent>
              {message.role === "assistant" && (
                <MessageActions>
                  <MessageAction
                    tooltip="Copy reply"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        message.parts
                          .filter((p) => p.type === "text")
                          .map((p) => p.text)
                          .join("\n"),
                      );
                      setCopied(message.id);
                    }}
                  >
                    {copied === message.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                  </MessageAction>
                </MessageActions>
              )}
            </Message>
          ))}
          {status === "submitted" && (
            <p role="status" className="text-xs text-muted-foreground">
              Kiln is thinking…
            </p>
          )}
          {error && (
            <p role="alert" className="break-words text-xs text-destructive">
              {error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="shrink-0 border-t p-3">
        {snippet && (
          <div className="mb-2 rounded border bg-background text-[11px]">
            <div className="flex items-center gap-1.5 border-b px-2 py-1 text-muted-foreground">
              <FileCode2 className="size-3" />
              <span className="flex-1 truncate">
                {snippet.file} · {snippet.code.split("\n").length} lines selected
              </span>
              <Button size="icon-xs" variant="ghost" aria-label="Remove selected code" onClick={() => setSnippet(null)}>
                <X className="size-3" />
              </Button>
            </div>
            <pre className="max-h-24 overflow-auto px-2 py-1 font-mono">{snippet.code}</pre>
          </div>
        )}
        <PromptInput
          onSubmit={async () => {
            if (!text.trim() || busy) return;
            const prompt = snippet ? `${text}\n\n\`\`\`${snippet.language}\n// ${snippet.file}\n${snippet.code}\n\`\`\`` : text;
            snippetRef.current = snippet;
            setText("");
            setSnippet(null);
            clearError();
            await sendMessage({ text: prompt });
          }}
        >
          <PromptInputTextarea
            ref={input}
            aria-label="Message Kiln"
            placeholder={snippet ? "Ask about the selected code…" : "Ask Kiln…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-20 text-[13px]"
          />
          <PromptInputFooter>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px] text-muted-foreground"
              onClick={() =>
                ide.selection
                  ? setSnippet({ file: ide.nodes[ide.selection.fileId]?.name ?? "selection", language: "", code: ide.selection.text })
                  : undefined
              }
              disabled={!ide.selection}
              type="button"
            >
              <FileCode2 className="size-3" />
              Attach selection
            </Button>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}