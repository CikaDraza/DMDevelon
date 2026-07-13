"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared Markdown renderer for user-authored rich text (proposal scope, etc.).
// Styled for the dark dashboard; mirrors the project-detail markdown styling.
const components = {
  h1: ({ children }) => (
    <h2 className="text-lg font-bold text-white mt-3 mb-2">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-white mt-3 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-white mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 mb-2 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-gray-300 mb-2 space-y-1">
      {children}
    </ul>
  ),
  // Forward `start` (and other attrs) so split ordered lists keep counting
  // (e.g. "2." after an intervening paragraph) instead of restarting at 1.
  ol: ({ node, children, ...props }) => (
    <ol
      {...props}
      className="list-decimal list-inside text-gray-300 mb-2 space-y-1"
    >
      {children}
    </ol>
  ),
  li: ({ node, children, ...props }) => (
    <li {...props} className="marker:text-[#FFB633]">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#FFB633] hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#FFB633]/50 pl-3 text-gray-400 italic my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/10 my-3" />,
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-white/10 text-[#FFB633] px-1 rounded text-[0.9em]">
        {children}
      </code>
    ) : (
      <code className="block bg-[#0f0f10] p-3 rounded-lg overflow-x-auto text-gray-300 text-xs my-2">
        {children}
      </code>
    ),
};

export default function MarkdownContent({ content, className = "" }) {
  if (!content) return null;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
