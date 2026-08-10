"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelPurgeMenu } from "./ChannelPurgeMenu";
import { ChevronLeft, Hash, ListTodo, MessageCircle, Search } from "lucide-react";

// "attachment:image"/"attachment:document" are a distinct filter dimension
// from the message flag (idea/problem/…), but share this one dropdown by
// request — useChatMessages translates the prefixed value into the server's
// separate `attachmentType` query param instead of `flag`.
const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pinned", label: "Pinned" },
  { value: "request", label: "Request" },
  { value: "task", label: "Task" },
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "incident", label: "Incident" },
  { value: "decision", label: "Decision" },
  { value: "attachment:image", label: "Images" },
  { value: "attachment:document", label: "Documents" },
];

// Debounce delay (ms) before a keystroke actually changes the `q` used by
// useChatMessages' query key (I8) — every keystroke otherwise fires its own
// request and its own cache entry, one per partial search string typed.
const SEARCH_DEBOUNCE_MS = 400;

export function ChatHeader({
  channel,
  flag,
  onFlagChange,
  search,
  onSearchChange,
  onOpenItems,
  onBack,
}) {
  const Icon = channel?.kind === "dm" ? MessageCircle : Hash;

  // Local state so typing feels instant; the debounced value is what
  // actually reaches the parent (and from there, the message query key).
  const [draft, setDraft] = useState(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  useEffect(() => {
    if (draft === search) return;
    const t = setTimeout(() => onSearchChange(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    // Two stacked rows on a phone — title across the full width, controls
    // across the full width beneath it — collapsing to a single row from md
    // up. Cramming all of it onto one narrow line left the channel name
    // truncated to a few characters and the search box unusably small.
    <div className="px-3 md:px-4 py-2.5 border-b border-white/10 shrink-0 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <div className="flex items-center gap-2 min-w-0 md:flex-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-1 -ml-1 rounded-lg text-gray-400 hover:text-white shrink-0"
            title="Back to channels"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <Icon className="w-4 h-4 text-gray-500 shrink-0" />
        <h3 className="text-white font-semibold truncate">
          {channel?.name || "Direct message"}
        </h3>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <Select value={flag} onValueChange={onFlagChange}>
          <SelectTrigger className="w-[116px] md:w-[130px] h-8 shrink-0 bg-white/5 border-white/10 text-white text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Takes whatever width is left on mobile; fixed on desktop. */}
        <div className="relative flex-1 min-w-0 md:flex-none md:w-40">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search…"
            className="pl-7 h-8 w-full bg-white/5 border-white/10 text-white text-xs"
          />
        </div>

        {onOpenItems && (
          <button
            type="button"
            onClick={onOpenItems}
            title="Decisions & items"
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#FFB633] hover:bg-white/5"
          >
            <ListTodo className="w-4 h-4" />
          </button>
        )}

        {/* Renders nothing unless the viewer may moderate this channel. */}
        <ChannelPurgeMenu channel={channel} />
      </div>
    </div>
  );
}

export default ChatHeader;
