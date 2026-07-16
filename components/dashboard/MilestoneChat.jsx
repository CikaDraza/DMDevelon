"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectMessages } from "@/hooks/useClientProjects";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Send,
  Paperclip,
  FileText,
  X,
  Loader2,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Per-milestone chat thread. Header is the milestone title, messages below.
 * Shared by admin and client — viewerRole decides bubble alignment/color and
 * which authorRole the new message gets (server still derives it from token).
 */
export function MilestoneChat({
  projectId,
  milestone,
  viewerRole = "client",
  viewerName = "",
}) {
  const milestoneId = milestone?._id;
  const { messages, isLoading, sendMessage, uploadAttachment } =
    useProjectMessages(projectId, milestoneId);
  const [text, setText] = useState("");
  const [pending, setPending] = useState([]); // staged attachments {url,type,name}
  const [uploading, setUploading] = useState(false);
  const [messageType, setMessageType] = useState("question");
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const allowed =
          file.type.startsWith("image/") || file.type === "application/pdf";
        if (!allowed) {
          toast.error("Only images and PDF files are allowed");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10MB`);
          continue;
        }
        const dataUri = await readAsDataURL(file);
        const result = await uploadAttachment.mutateAsync({
          file: dataUri,
          name: file.name,
        });
        setPending((prev) => [...prev, result]);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && pending.length === 0) return;
    if (
      viewerRole === "client" &&
      messageType === "change_request" &&
      !text.trim()
    ) {
      toast.error("Describe the change you are requesting");
      return;
    }
    try {
      await sendMessage.mutateAsync({
        body: text.trim(),
        attachments: pending,
        authorName: viewerName,
        messageType: viewerRole === "client" ? messageType : "message",
      });
      setText("");
      setPending([]);
      setMessageType("question");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs text-gray-400">Conversation</p>
        <h4 className="text-white font-semibold">{milestone?.title}</h4>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]">
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Ask a question about this part of the project…
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorRole === viewerRole;
            const type = m.messageType || "message";
            return (
              <div
                key={m._id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    mine
                      ? "bg-[#FFB633] text-black"
                      : "bg-white/10 text-gray-100",
                  )}
                >
                  <p className="text-[10px] opacity-70 mb-0.5">
                    {m.authorName || (m.authorRole === "admin" ? "Admin" : "Client")}
                  </p>
                  {type === "question" && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <HelpCircle className="h-3 w-3" />
                      Question
                    </span>
                  )}
                  {type === "change_request" && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <RefreshCw className="h-3 w-3" />
                      Change request
                    </span>
                  )}
                  {type === "change_agreed" && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <CheckCircle2 className="h-3 w-3" />
                      Agreed change applied
                    </span>
                  )}
                  {m.body && (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {m.body}
                    </p>
                  )}
                  {m.attachments?.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.attachments.map((a, idx) =>
                        a.type === "image" ? (
                          <a
                            key={idx}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.url}
                              alt={a.name || "attachment"}
                              className="rounded-lg max-h-40 object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={idx}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 text-xs underline",
                              mine ? "text-black" : "text-[#FFB633]",
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            {a.name || "Document.pdf"}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {pending.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-white/10">
          {pending.map((a, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1 text-xs bg-white/10 text-gray-200 rounded px-2 py-1"
            >
              {a.type === "pdf" ? (
                <FileText className="w-3 h-3" />
              ) : (
                <Paperclip className="w-3 h-3" />
              )}
              {a.name || a.type}
              <button
                type="button"
                onClick={() =>
                  setPending((prev) => prev.filter((_, i) => i !== idx))
                }
                className="hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {viewerRole === "client" && (
        <div className="flex items-center gap-2 border-t border-white/10 px-4 pt-3">
          <span className="mr-1 text-xs text-gray-500">Send as:</span>
          <button
            type="button"
            onClick={() => setMessageType("question")}
            aria-pressed={messageType === "question"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
              messageType === "question"
                ? "border-[#FFB633] bg-[#FFB633]/15 text-[#FFB633]"
                : "border-white/10 text-gray-400 hover:text-white",
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Question
          </button>
          <button
            type="button"
            onClick={() => setMessageType("change_request")}
            aria-pressed={messageType === "change_request"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
              messageType === "change_request"
                ? "border-red-400 bg-red-500/15 text-red-300"
                : "border-white/10 text-gray-400 hover:text-white",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Request a change
          </button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-white/10"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-2 text-gray-400 hover:text-[#FFB633] transition-colors"
          title="Attach image or PDF"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            viewerRole === "client" && messageType === "change_request"
              ? "Describe the requested change…"
              : viewerRole === "client"
                ? "Ask a question…"
                : "Type a message…"
          }
          className="flex-1 bg-white/5 border border-white/10 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#FFB633]/50"
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || (!text.trim() && pending.length === 0)}
          className="p-2 bg-[#FFB633] text-black rounded-full hover:bg-[#e5a32e] disabled:opacity-50 transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MilestoneChat;
