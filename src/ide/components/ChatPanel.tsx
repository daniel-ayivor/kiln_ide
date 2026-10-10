import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Copy, FileCode2, MessageSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "../auth";
import { useIde } from "../store";
import { createThread, deleteThread, getThread, listThreads } from "../chat.functions";
import agentLogo from "@/assets/kiln-agent.png";

export function ChatPanel({ conversationId, onClose }: { conversationId?: string; onClose: () => void }) {
  const { user, ready, openAccount } = useAccount();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [failure, setFailure] = useState("");
  const [creating, setCreating] = useState(false);
  const threads = useQuery({ queryKey: ["chat-threads", user?.id], queryFn: () => listThreads(), enabled: !!user });
  const thread = useQuery({ queryKey: ["chat-thread", user?.id, conversationId], queryFn: () => getThread({ data: { id: conversationId ?? "" } }), enabled: !!user && !!conversationId });
  async function newConversation() {
    setCreating(true); setFailure("");
    try { const result = await createThread(); await cache.invalidateQueries({ queryKey: ["chat-threads"] }); await navigate({ to: "/chat/$threadId", params: { threadId: result.id } }); }
    catch (e) { setFailure(e instanceof Error ? e.message : "Could not create conversation."); }
    finally { setCreating(false); }
  }
  return <aside aria-label="AI chat" className="kiln-chat-panel flex min-h-0 w-[390px] max-w-[calc(100vw-48px)] shrink-0 flex-col border-l bg-sidebar">
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <img src={agentLogo} width={22} height={22} alt="" className="kiln-agent-logo size-[22px] object-contain" />
      <h2 className="flex-1 text-xs font-semibold">Kiln Chat</h2>
      <Button size="icon-sm" variant="ghost" title="New conversation" aria-label="New conversation" disabled={!user || creating} onClick={newConversation}><Plus className="size-4" /></Button>
      <Button size="icon-sm" variant="ghost" title="Close chat" aria-label="Close chat" onClick={onClose}><X className="size-4" /></Button>
    </header>
    {!ready ? <p className="p-5 text-muted-foreground">Loading account…</p> : !user ? <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><img src={agentLogo} width={56} height={56} alt="Kiln" className="kiln-agent-logo size-14 object-contain" /><h3 className="text-lg font-semibold">Your coding companion</h3><Button onClick={openAccount}>Sign in to chat</Button></div> : <>
      <div className="max-h-36 shrink-0 overflow-y-auto border-b p-2">
        {threads.isPending ? <p className="p-2 text-xs text-muted-foreground">Loading conversations…</p> : threads.error ? <p role="alert" className="p-2 text-xs text-destructive">{threads.error.message}</p> : threads.data?.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No conversations yet</p> : threads.data?.map(t => <div key={t.id} className="group flex items-center rounded hover:bg-ide-hover">
          <Button variant="ghost" size="sm" className={`min-w-0 flex-1 justify-start gap-2 text-xs ${t.id === conversationId ? "bg-ide-selected text-foreground" : "text-muted-foreground"}`} onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}><MessageSquare className="size-3 shrink-0" /><span className="truncate">{t.title}</span></Button>
          <Button variant="ghost" size="icon-xs" title="Delete conversation" aria-label={`Delete ${t.title}`} onClick={async () => {
            if (!window.confirm("Delete this conversation?")) return;
            try { await deleteThread({ data: { id: t.id } }); await cache.invalidateQueries({ queryKey: ["chat-threads"] }); if (t.id === conversationId) await navigate({ to: "/" }); }
            catch (e) { setFailure(e instanceof Error ? e.message : "Could not delete conversation."); }
          }}><Trash2 className="size-3" /></Button>
        </div>)}
      </div>
      {failure && <p role="alert" className="p-3 text-xs text-destructive">{failure}</p>}
      {!conversationId ? <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6"><h3 className="text-base font-medium">What are you working on?</h3><Button size="sm" disabled={creating} onClick={newConversation}><Plus className="size-4" />New conversation</Button></div> : thread.isPending ? <p className="p-4 text-muted-foreground">Loading conversation…</p> : thread.error ? <p role="alert" className="p-4 text-destructive">{thread.error.message}</p> : thread.data ? <ChatWindow key={`${user.id}:${conversationId}`} id={conversationId} initialMessages={thread.data.messages as unknown as UIMessage[]} /> : null}
    </>}
  </aside>;
}

function ChatWindow({ id, initialMessages }: { id: string; initialMessages: UIMessage[] }) {
  const ide = useIde();
  const cache = useQueryClient();
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [includeFile, setIncludeFile] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const active = ide.groups[ide.activeGroup]?.active;
  const node = active ? ide.nodes[active] : undefined;
  const context = useRef<{ name: string; content: string } | undefined>(undefined);
  context.current = includeFile && node?.type === "file" ? { name: node.name, content: node.content ?? "" } : undefined;
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", headers: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }, body: () => ({ conversationId: id, fileContext: context.current }) }), [id]);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({ id, messages: initialMessages, transport, onFinish: () => {
    void cache.invalidateQueries({ queryKey: ["chat-threads"] });
    void cache.invalidateQueries({ queryKey: ["chat-thread", undefined, id] });
  } });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    const focused = document.activeElement;
    if (!document.querySelector('[role="dialog"]') && (!focused || focused === document.body || focused === input.current)) input.current?.focus();
  }, [status, id]);
  useEffect(() => () => { void stop(); }, [stop]);
  return <div className="flex min-h-0 flex-1 flex-col">
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="gap-5 p-4">
        {messages.length === 0 && <div className="py-8"><h3 className="mb-4 text-base font-medium">Let’s build something.</h3><div className="flex flex-col gap-1">{["Explain this file", "Find potential bugs", "Suggest a refactor"].map(prompt => <Button key={prompt} variant="ghost" className="justify-start text-xs text-muted-foreground" onClick={() => { setText(prompt); input.current?.focus(); }}><FileCode2 className="size-4" />{prompt}</Button>)}</div></div>}
        {messages.map(message => <Message key={message.id} from={message.role} className="max-w-full">
          {message.role === "assistant" && <div className="flex items-center gap-2 text-xs font-medium"><img src={agentLogo} width={18} height={18} alt="" className="kiln-agent-logo size-[18px]" />Kiln</div>}
          <MessageContent className="w-full text-[13px]">
            {message.parts.map((part, index) => part.type === "text" ? message.role === "assistant" ? <MessageResponse key={index}>{part.text}</MessageResponse> : <p key={index} className="whitespace-pre-wrap break-words">{part.text}</p> : part.type === "reasoning" ? <Reasoning key={index} defaultOpen={false} isStreaming={busy && message.id === messages.at(-1)?.id}><ReasoningTrigger /><ReasoningContent>{part.text}</ReasoningContent></Reasoning> : null)}
          </MessageContent>
          {message.role === "assistant" && <MessageActions><MessageAction tooltip="Copy reply" onClick={async () => { await navigator.clipboard.writeText(message.parts.filter(p => p.type === "text").map(p => p.text).join("\n")); setCopied(message.id); }} >{copied === message.id ? <Check className="size-3" /> : <Copy className="size-3" />}</MessageAction></MessageActions>}
        </Message>)}
        {status === "submitted" && <p role="status" className="text-xs text-muted-foreground">Kiln is thinking…</p>}
        {error && <p role="alert" className="break-words text-xs text-destructive">{error.message}</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <div className="shrink-0 border-t p-3">
      <PromptInput onSubmit={async () => {
        if (!text.trim() || busy) return;
        const prompt = text; setText(""); clearError(); input.current?.focus();
        await sendMessage({ text: prompt });
      }}>
        <PromptInputTextarea ref={input} aria-label="Message Kiln" placeholder="Ask Kiln…" value={text} onChange={e => setText(e.target.value)} className="min-h-20 text-[13px]" />
        <PromptInputFooter>
          <label className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground"><Checkbox checked={includeFile} onCheckedChange={v => setIncludeFile(v === true)} disabled={!node} /><FileCode2 className="size-3 shrink-0" /><span className="max-w-44 truncate">{node?.name ?? "No file selected"}</span></label>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  </div>;
}