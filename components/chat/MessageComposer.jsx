"use client";

import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useChatMessages } from "@/hooks/useProjectChat";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { cn, readAsDataURL } from "@/lib/utils";
import {
  ChevronDown,
  FileText,
  Flag,
  Loader2,
  MoreVertical,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FLAG_OPTIONS = [
  { value: "none", label: "No flag" },
  { value: "request", label: "Request" },
  { value: "task", label: "Task" },
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "incident", label: "Incident" },
  { value: "decision", label: "Decision" },
];

const MAX_TEXTAREA_HEIGHT = 200;

// File extensions the composer also accepts when the browser does not report
// a MIME type (common on mobile, or for .doc/.docx on some OS configs).
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];

/**
 * `flag`/`search` are passed through only so this component's own
 * useChatMessages(channelId, {flag, q}) call resolves to the SAME query key
 * MessageList is reading — React Query then shares one cache entry/poll
 * instead of this composer quietly running a second, differently-filtered
 * background query for mutations it doesn't otherwise need the data for.
 */
export function MessageComposer({
  channelId,
  projectId,
  flag,
  search,
  replyTo,
  onCancelReply,
  // Fired after the server accepted a message, so the thread can scroll to
  // the bottom immediately instead of waiting for the next refetch to notice.
  onSent,
}) {
  const { sendMessage, uploadAttachment } = useChatMessages(channelId, {
    flag,
    q: search,
  });
  const { members } = useProjectMembers(projectId);

  const [text, setText] = useState("");
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [messageFlag, setMessageFlag] = useState("none");
  const [mentionQuery, setMentionQuery] = useState(null);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  // Mobile gets 3 visible rows for easier typing; desktop keeps 1.
  const [textareaRows, setTextareaRows] = useState(1);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setTextareaRows(mq.matches ? 3 : 1);
    const handler = (e) => setTextareaRows(e.matches ? 3 : 1);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    autoGrow(e.target);

    const cursor = e.target.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const match = upToCursor.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (name) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const upToCursor = text.slice(0, cursor);
    const replaced = upToCursor.replace(/@([^\s@]*)$/, `@${name} `);
    const next = replaced + text.slice(cursor);
    setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => el.focus());
  };

  const mentionCandidates =
    mentionQuery === null
      ? []
      : members
          .filter((m) =>
            m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 5);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        const allowed =
          file.type.startsWith("image/") ||
          file.type === "application/pdf" ||
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          file.type === "application/msword" ||
          file.type === "text/plain" ||
          ALLOWED_FILE_EXTENSIONS.includes(ext);
        if (!allowed) {
          toast.error("Only images, PDF, DOC/DOCX, and TXT files are allowed");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10MB`);
          continue;
        }
        // Derive attachment `type` from MIME when available; fall back to
        // extension when the browser doesn't report MIME (mobile, some .doc).
        let uploadType;
        if (file.type.startsWith("image/")) {
          uploadType = "image";
        } else if (file.type === "application/pdf" || ext === ".pdf") {
          uploadType = "pdf";
        } else if (
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          file.type === "application/msword" ||
          ext === ".doc" ||
          ext === ".docx"
        ) {
          uploadType = "doc";
        } else if (ext === ".txt") {
          uploadType = "txt";
        } else {
          uploadType = "pdf"; // safe fallback
        }
        const dataUri = await readAsDataURL(file);
        const result = await uploadAttachment.mutateAsync({
          file: dataUri,
          name: file.name,
          projectId,
        });
        setPending((prev) => [...prev, { ...result, type: uploadType }]);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!text.trim() && pending.length === 0) return;
    try {
      await sendMessage.mutateAsync({
        body: text.trim(),
        attachments: pending,
        flag: messageFlag,
        replyToMessageId: replyTo?._id || undefined,
      });
      setText("");
      setPending([]);
      setMessageFlag("none");
      onCancelReply?.();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      // Only after the server accepted it: a failed send must not scroll the
      // reader away from whatever they were looking at.
      onSent?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send");
    }
  };

  // Enter alone is left completely alone — the textarea's own default
  // behavior (a newline) is exactly what's wanted. Only Ctrl/Cmd+Enter sends.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-white/10 shrink-0">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 px-4 pt-2 text-xs text-gray-400">
          <span className="truncate">
            Replying to{" "}
            <strong className="text-gray-300">{replyTo.authorName}</strong>:{" "}
            {replyTo.body}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-gray-500 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="px-4 pt-2 flex flex-wrap gap-2">
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

      <div className="flex items-center gap-2 px-3 md:px-4 py-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          multiple
          onChange={handleFiles}
          className="hidden"
        />

        {/* Mobile: one ⋮ button folding Attach and Flag away, so the text
            field gets the width instead of two controls that are used far
            less often than typing. Desktop keeps them as direct buttons. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "md:hidden shrink-0 p-2 rounded-lg transition-colors",
              messageFlag !== "none"
                ? "text-[#FFB633]"
                : "text-gray-400 hover:text-white",
            )}
            title="Attach or flag"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <MoreVertical className="w-5 h-5" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="bg-[#1a1a1b] border-white/10 text-gray-200"
          >
            <DropdownMenuItem
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2 cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach file
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                <Flag className="w-3.5 h-3.5" />
                Flag
                <span className="ml-auto pl-2 text-[10px] text-gray-500">
                  {FLAG_OPTIONS.find((o) => o.value === messageFlag)?.label}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  side="top"
                  align="end"
                  className="bg-[#1a1a1b] border-white/10 text-gray-200"
                >
                  {FLAG_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setMessageFlag(opt.value)}
                      className="cursor-pointer"
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="hidden md:block p-2 text-gray-400 hover:text-[#FFB633] transition-colors shrink-0"
          title="Attach file"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "hidden md:flex shrink-0 items-center gap-1 px-2.5 py-2 text-xs rounded-lg border transition-colors",
              messageFlag !== "none"
                ? "border-[#FFB633] text-[#FFB633]"
                : "border-white/10 text-gray-400 hover:text-white",
            )}
          >
            {FLAG_OPTIONS.find((o) => o.value === messageFlag)?.label}
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a1b] border-white/10 text-gray-200">
            {FLAG_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setMessageFlag(opt.value)}
                className="cursor-pointer"
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter for new line, Ctrl+Enter to send)"
            rows={textareaRows}
            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#FFB633]/50 resize-none overflow-y-auto"
            style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
          />
          {mentionCandidates.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 w-56 bg-[#1a1a1b] border border-white/10 rounded-lg shadow-lg overflow-hidden z-10">
              {mentionCandidates.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => insertMention(m.name)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={
            sendMessage.isPending || (!text.trim() && pending.length === 0)
          }
          className="p-2 bg-[#FFB633] text-black rounded-full hover:bg-[#e5a32e] disabled:opacity-50 transition-colors shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default MessageComposer;
