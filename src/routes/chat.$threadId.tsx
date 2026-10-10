import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Workbench } from "@/ide/Workbench";
export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({ meta: [
    { title: "Kiln Chat — Coding conversation" },
    { name: "description", content: "Your private coding conversation inside Kiln." },
    { property: "og:title", content: "Kiln Chat — Coding conversation" },
    { property: "og:description", content: "Your private coding conversation inside Kiln." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ChatPage,
});
function ChatPage() {
  const { threadId } = Route.useParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <Workbench conversationId={threadId} /> : <div className="h-screen bg-background" />;
}