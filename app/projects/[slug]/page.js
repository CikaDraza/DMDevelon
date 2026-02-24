"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Lightbulb,
  ArrowLeft,
  ExternalLink,
  Github,
  GitBranchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const slug = params?.slug;

  useEffect(() => {
    if (slug) {
      fetchProject();
    }
  }, [slug]);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/api/projects/slug/${slug}`);
      setProject(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setError("Project not found");
      } else {
        setError("Failed to load project");
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

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0f0f10]">
        <header className="bg-[#1a1a1b] border-b border-white/10 px-6 py-4">
          <div className="container mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-[#FFB633]" />
              <div>
                <h1 className="font-bold text-white">DMDevelon</h1>
                <p className="text-xs text-gray-400">
                  Transforming Ideas into Digital Success
                </p>
              </div>
            </a>
          </div>
        </header>

        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Project Not Found
          </h1>
          <p className="text-gray-400 mb-8">
            The project you're looking for doesn't exist or has been removed.
          </p>
          <a
            href="/#projects"
            className="inline-flex items-center gap-2 text-[#FFB633] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
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
              <p className="text-xs text-gray-400">
                Transforming Ideas into Digital Success
              </p>
            </div>
          </a>
          <a
            href="/#projects"
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <div className={`${colorMap[project.color] || "bg-blue-500"} py-20`}>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
              {project.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {project.title}
            </h1>
            <div className="flex flex-wrap justify-center gap-4">
              {project.live_preview_url && (
                <a
                  href={project.live_preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-white text-black hover:bg-gray-100">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Live Preview
                  </Button>
                </a>
              )}
              {!project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-black text-white hover:bg-white/10">
                    <GitBranchIcon className="w-4 h-4 mr-2" />
                    View Source
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Image */}
      {project.image_url && (
        <div className="container mx-auto px-4 -mt-10">
          <div className="max-w-4xl mx-auto">
            <img
              src={project.image_url}
              alt={project.title}
              className="w-full rounded-xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <article className="max-w-4xl mx-auto">
          <div className="bg-[#1a1a1b] rounded-xl p-8 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-6">
              About This Project
            </h2>
            <div className="prose prose-invert prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold text-white mt-8 mb-4">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-bold text-white mt-6 mb-3">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold text-white mt-4 mb-2">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-300 mb-4 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-300">{children}</li>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-[#FFB633] hover:underline">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[#FFB633] pl-4 my-4 italic text-gray-400">
                      {children}
                    </blockquote>
                  ),
                  code: ({ inline, children }) =>
                    inline ? (
                      <code className="bg-white/10 text-[#FFB633] px-1 rounded">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-[#0f0f10] p-4 rounded-lg overflow-x-auto text-gray-300">
                        {children}
                      </code>
                    ),
                  pre: ({ children }) => (
                    <pre className="bg-[#0f0f10] p-4 rounded-lg overflow-x-auto my-4">
                      {children}
                    </pre>
                  ),
                  hr: () => <hr className="border-white/10 my-8" />,
                }}
              >
                {project.description}
              </ReactMarkdown>
            </div>
          </div>

          {/* Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Project Details
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-gray-500 text-sm">Category</dt>
                  <dd className="text-white">{project.category}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-sm">Created</dt>
                  <dd className="text-white">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
            {(project.live_preview_url || project.github_url) && (
              <div className="bg-[#1a1a1b] rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Links</h3>
                <div className="space-y-3">
                  {project.live_preview_url && (
                    <a
                      href={project.live_preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#FFB633] hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Live Preview
                    </a>
                  )}
                  {!project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-black text-white hover:bg-slate-900"
                    >
                      <GitBranchIcon className="w-4 h-4" />
                      GitHub Repository
                    </a>
                  )}
                </div>
              </div>
            )}
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
