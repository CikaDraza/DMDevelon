"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { Send, Paperclip, FileText, X, Loader2 } from "lucide-react";

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeLabel(d) {
  if (!d) return "";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Support-ticket style thread for a ProjectRequest. Presentational + composer;
 * the parent owns the data (useProjectRequest) and passes the mutations down.
 * Shared by client detail page and admin manager.
 */
export function RequestConversation({
  request,
  viewerRole = "client",
  viewerName = "",
  postMessage,
  uploadAttachment,
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const messages = request?.messages || [];

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
    try {
      await postMessage.mutateAsync({
        body: text.trim(),
        attachments: pending,
        authorName: viewerName,
      });
      setText("");
      setPending([]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send");
    }
  };

  const renderAttachments = (atts) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {atts.map((a, idx) =>
        a.type === "image" ? (
          <a key={idx} href={a.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.name || "attachment"}
              className="rounded-lg max-h-40 object-cover border border-white/10"
            />
          </a>
        ) : (
          <a
            key={idx}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#FFB633] underline bg-white/5 rounded px-2 py-1"
          >
            <FileText className="w-4 h-4" />
            {a.name || "Document.pdf"}
          </a>
        ),
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="space-y-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            No messages yet.
          </p>
        )}
        {messages.map((m) => {
          if (m.type === "system") {
            return (
              <div key={m._id} className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-500">{m.body}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            );
          }
          const isAdmin = m.authorRole === "admin";
          return (
            <div
              key={m._id}
              className="bg-[#0f0f10] border border-white/10 rounded-lg p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isAdmin ? "text-[#FFB633]" : "text-white",
                  )}
                >
                  {m.authorName || (isAdmin ? "DMDevelon" : "Client")}
                </span>
                <span className="text-[10px] text-gray-500">
                  {timeLabel(m.createdAt)}
                </span>
              </div>
              {m.body && (
                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {m.body}
                </p>
              )}
              {m.attachments?.length > 0 && renderAttachments(m.attachments)}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {pending.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
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

      <form
        onSubmit={handleSend}
        className="mt-4 flex items-end gap-2 bg-[#0f0f10] border border-white/10 rounded-xl p-2"
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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply…"
          rows={2}
          className="flex-1 bg-transparent text-white text-sm px-2 py-1 focus:outline-none resize-y min-h-[40px] max-h-72 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={postMessage.isPending || (!text.trim() && pending.length === 0)}
          className="p-2 bg-[#FFB633] text-black rounded-lg hover:bg-[#e5a32e] disabled:opacity-50 transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default RequestConversation;
