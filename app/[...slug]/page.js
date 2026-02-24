'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Lightbulb, ArrowLeft } from 'lucide-react';

export default function CMSPage() {
  const params = useParams();
  const router = useRouter();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get slug from params (handles catch-all [...slug])
  const slug = Array.isArray(params?.slug) ? params.slug.join('/') : params?.slug;

  useEffect(() => {
    if (slug) {
      fetchPage();
    }
  }, [slug]);

  const fetchPage = async () => {
    try {
      const response = await axios.get(`/api/cms-pages/slug/${slug}`);
      setPage(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setError('Page not found');
      } else {
        setError('Failed to load page');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-[#0f0f10]">
        {/* Header */}
        <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
          <div className="container mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-[#FFB633]" />
              <div>
                <h1 className="font-bold text-white">DMDevelon</h1>
                <p className="text-xs text-gray-400">Transforming Ideas into Digital Success</p>
              </div>
            </a>
          </div>
        </header>

        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h1>
          <p className="text-gray-400 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[#FFB633] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f10]">
      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#FFB633]" />
            <div>
              <h1 className="font-bold text-white">DMDevelon</h1>
              <p className="text-xs text-gray-400">Transforming Ideas into Digital Success</p>
            </div>
          </a>
          <a
            href="/"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">{page.title}</h1>
          <div className="prose prose-invert prose-lg max-w-none cms-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold text-white mt-8 mb-4">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold text-white mt-6 mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold text-white mt-4 mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2 ml-4">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2 ml-4">{children}</ol>
                ),
                li: ({ children }) => <li className="text-gray-300 mb-2">{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} className="text-[#FFB633] hover:underline">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#FFB633] pl-4 my-4 italic text-gray-400 bg-[#1a1a1b] py-4 pr-4 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="bg-white/10 text-[#FFB633] px-1 rounded">{children}</code>
                  ) : (
                    <code className="block bg-[#1a1a1b] p-4 rounded-lg overflow-x-auto text-gray-300">
                      {children}
                    </code>
                  ),
                pre: ({ children }) => (
                  <pre className="bg-[#1a1a1b] p-4 rounded-lg overflow-x-auto my-4">{children}</pre>
                ),
                hr: () => <hr className="border-white/10 my-8" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-white/10">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-white/10 px-4 py-2 bg-white/5 text-white font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-white/10 px-4 py-2 text-gray-300">{children}</td>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-300">{children}</em>
                ),
                section: ({ children }) => (
                  <section className="my-6">{children}</section>
                ),
              }}
            >
              {page.content}
            </ReactMarkdown>
          </div>
          <div className="mt-12 pt-6 border-t border-white/10">
            <p className="text-gray-500 text-sm">
              Last updated: {new Date(page.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f0f10] border-t border-white/10 py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            Copyright © 2026. DMDevelon. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
