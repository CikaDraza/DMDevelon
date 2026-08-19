"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { downloadFileToDevice, shortenFileName } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

/**
 * Full attachment preview.
 *
 * Images render inline. PDFs deliberately do NOT: an <iframe> pointed at a
 * Cloudinary raw file renders as a broken-file icon on mobile, so a document
 * gets a download card instead — the one action that works everywhere.
 * MessageBubble skips this dialog entirely for documents and downloads them
 * straight away; this branch only catches a document that reaches the dialog
 * some other way.
 */
export function AttachmentPreview({ attachment, open, onOpenChange }) {
  if (!attachment) return null;
  const { url, type, name } = attachment;
  const label =
    shortenFileName(name) || (type === "pdf" ? "Document" : "Image");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1b] border-white/10 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-3xl p-0 overflow-hidden">
        {/* pr-12 keeps the download button clear of DialogContent's own close
            button, which is absolutely positioned at right-4 — they overlapped,
            and on touch the close button won every tap. */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 pr-12 border-b border-white/10">
          <DialogTitle className="min-w-0 flex-1 text-sm truncate" title={name}>
            {label}
          </DialogTitle>
          {/* One tap saves the file. This used to be a ⋯ menu holding a single
              Download item, which made saving a picture a two-tap affair for
              no reason. */}
          <button
            type="button"
            onClick={() => downloadFileToDevice(url, name)}
            aria-label={name ? `Download ${name}` : "Download"}
            title={name ? `Download ${name}` : "Download"}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-auto bg-black/40 flex items-center justify-center">
          {type === "pdf" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <FileText className="w-12 h-12 text-gray-500" />
              <p
                className="max-w-full break-all text-sm text-gray-300"
                title={name}
              >
                {shortenFileName(name) || "Document.pdf"}
              </p>
              <p className="max-w-xs text-xs text-gray-500">
                Documents open in whatever your device uses for PDFs.
              </p>
              <button
                type="button"
                onClick={() => downloadFileToDevice(url, name)}
                className="flex items-center gap-2 rounded-lg bg-[#FFB633] px-4 py-2 text-sm font-medium text-black hover:bg-[#e5a32e]"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={name || "attachment"}
              className="max-w-full max-h-[75vh] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AttachmentPreview;
