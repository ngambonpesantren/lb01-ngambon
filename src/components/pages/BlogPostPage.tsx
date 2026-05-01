'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { Post } from '../../lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react';

function formatDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
}

function readingTime(html?: string) {
  if (!html) return '1 mnt';
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} mnt baca`;
}

export function BlogPostPage({ slug }: { slug: string }) {
  const { data: post, isLoading } = useQuery<Post>({
    queryKey: ['public-post', slug],
    queryFn: async () => {
      const res = await apiFetch('/api/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      const all: Post[] = await res.json();
      const match = all.find(p => p.slug === slug || p.id === slug);
      if (!match || match.status !== 'published') throw new Error('Post not found');
      return match;
    }
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {post && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              "headline": post.title,
              "image": post.featured_image ? [post.featured_image] : [],
              "datePublished": post.published_at,
              "dateModified": post.updated_at,
              "description": post.excerpt || post.title,
              "publisher": { "@type": "Organization", "name": "PPMH Insight" }
            })
          }}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
        <nav className="mb-8">
          <Link href="/blog" className="inline-flex items-center text-foreground/70 font-semibold hover:text-foreground transition-colors text-sm uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 mr-2" /> PPMH Insight
          </Link>
        </nav>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-3 bg-muted/60 w-32" />
            <div className="h-12 bg-muted/60 w-full" />
            <div className="h-12 bg-muted/60 w-3/4" />
            <div className="h-4 bg-muted/60 w-1/3 mt-6" />
          </div>
        ) : !post ? (
          <div className="text-center py-24 border border-dashed border-border">
            <h2 className="font-display text-3xl font-bold mb-2">Artikel tidak ditemukan</h2>
            <p className="text-muted-foreground font-serif-body italic">Mungkin artikel telah dipindahkan atau dihapus.</p>
          </div>
        ) : (
          <article>
            {/* Category eyebrow */}
            {post.category && (
              <div className="text-center mb-5">
                <span className="inline-block text-[11px] uppercase tracking-[0.4em] font-bold text-primary border-y border-primary py-1.5 px-4">
                  {post.category}
                </span>
              </div>
            )}

            {/* Headline */}
            <header className="text-center max-w-3xl mx-auto mb-6">
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black text-foreground leading-[1.05] tracking-tight">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="font-serif-body italic text-lg md:text-xl text-foreground/70 mt-5 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
            </header>

            {/* Byline */}
            <div className="flex items-center justify-center gap-6 text-xs uppercase tracking-widest text-muted-foreground font-semibold border-y border-border py-4 mb-10">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" />
                <time dateTime={post.published_at || ''}>{formatDate(post.published_at)}</time>
              </div>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{readingTime(post.content)}</span>
              </div>
            </div>

            {/* Featured image */}
            {post.featured_image && (
              <figure className="mb-12 -mx-4 sm:mx-0">
                <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
                  <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" priority className="object-cover" />
                </div>
                <figcaption className="text-xs text-muted-foreground italic font-serif-body text-center mt-3 px-4">
                  {post.title}
                </figcaption>
              </figure>
            )}

            {/* Body — drop cap, serif body */}
            <section
              className="dropcap font-serif-body text-foreground/90 prose prose-lg max-w-none
                         prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground
                         prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
                         prose-h3:text-2xl
                         prose-p:leading-[1.85] prose-p:text-[1.075rem]
                         prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                         prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:font-display prose-blockquote:italic prose-blockquote:text-2xl prose-blockquote:text-foreground
                         prose-img:rounded-none prose-img:mx-auto"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* End mark */}
            <div className="text-center mt-16 mb-8">
              <span className="inline-block w-2 h-2 bg-foreground rotate-45" />
            </div>

            <div className="text-center">
              <Link href="/blog" className="inline-flex items-center text-foreground font-semibold uppercase tracking-widest text-xs border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors">
                Kembali ke PPMH Insight
              </Link>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
