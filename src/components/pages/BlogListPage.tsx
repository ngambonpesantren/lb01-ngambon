import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { Post } from '../../lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, ChevronRight, LayoutGrid, TrendingUp, Flame } from 'lucide-react';
import { slugifyCategory } from '../../lib/categorySlug';

function formatDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
}

function todayLabel() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function BlogListPage() {
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ['public-posts'],
    queryFn: async () => {
      const res = await apiFetch('/api/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      const all: Post[] = await res.json();
      return all.filter(p => p.status === 'published');
    }
  });

  // Featured: latest 3
  const featured = posts.slice(0, 3);
  const [lead, ...secondaryFeatured] = featured;

  // Popular: sorted by views (or fallback newest)
  const popular = [...posts].sort((a, b) => ((b as any).views || 0) - ((a as any).views || 0)).slice(0, 6);

  // Group by category
  const categoryMap = new Map<string, Post[]>();
  posts.forEach(p => {
    const cat = p.category || 'Umum';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(p);
  });

  // Remaining posts (excluding featured)
  const featuredIds = new Set(featured.map(p => p.id));
  const tail = posts.filter(p => !featuredIds.has(p.id));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-8 md:pt-12">
        <nav className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center text-foreground/70 font-semibold hover:text-foreground transition-colors text-sm uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 mr-2" /> Beranda
          </Link>
          <Link href="/berita/kategori" className="inline-flex items-center text-foreground/70 font-semibold hover:text-foreground transition-colors text-sm uppercase tracking-widest">
            <LayoutGrid className="w-4 h-4 mr-2" /> Kategori
          </Link>
        </nav>

        {/* Masthead */}
        <header className="text-center border-y-4 border-double border-foreground py-8 md:py-10 mb-8">
          <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-3">Edisi Digital · {todayLabel()}</p>
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-foreground leading-none tracking-tight">
            PPMH <span className="italic font-normal">Insight</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-4 italic font-serif-body">
            "Membangun generasi unggul melalui keterbukaan informasi."
          </p>
        </header>

        {/* Section bar */}
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] font-bold text-muted-foreground mb-10">
          <span className="text-foreground">Berita Terbaru</span>
          <span className="flex-1 editorial-rule" />
          <span>{posts.length} Artikel</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-[420px] bg-muted/40 animate-pulse rounded-sm" />
            <div className="space-y-6">
              <div className="h-48 bg-muted/40 animate-pulse rounded-sm" />
              <div className="h-48 bg-muted/40 animate-pulse rounded-sm" />
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground border border-dashed border-border">
            <p className="font-serif-body italic">Belum ada artikel yang diterbitkan.</p>
          </div>
        ) : (
          <>
            {/* Featured / Lead story + secondary */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 pb-12 mb-12 border-b border-border" id="featured">
              {lead && (
                <article className="lg:col-span-2 group">
                  <Link href={`/blog/${lead.slug || lead.id}`} className="block">
                    {lead.featured_image ? (
                      <div className="relative w-full aspect-[16/10] overflow-hidden mb-6 bg-muted">
                        <Image src={lead.featured_image} alt={lead.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                      </div>
                    ) : (
                      <div className="w-full aspect-[16/10] bg-foreground/[0.03] flex items-center justify-center mb-6">
                        <span className="font-display text-foreground/10 text-7xl font-black">PPMH</span>
                      </div>
                    )}
                    {lead.category && (
                      <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-3">
                        {lead.category}
                      </span>
                    )}
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-[1.05] tracking-tight group-hover:text-primary transition-colors">
                      {lead.title}
                    </h2>
                    {lead.excerpt && (
                      <p className="font-serif-body text-lg text-foreground/75 mt-4 leading-relaxed line-clamp-3">
                        {lead.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mt-5 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <time>{formatDate(lead.published_at)}</time>
                    </div>
                  </Link>
                </article>
              )}

              <div className="lg:col-span-1 lg:border-l lg:border-border lg:pl-8 space-y-8 divide-y divide-border">
                {secondaryFeatured.map((post, idx) => (
                  <article key={post.id} className={`group ${idx > 0 ? 'pt-8' : ''}`}>
                    <Link href={`/blog/${post.slug || post.id}`} className="block">
                      {post.featured_image && (
                        <div className="relative w-full aspect-[16/9] overflow-hidden mb-4 bg-muted">
                          <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                        </div>
                      )}
                      {post.category && (
                        <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-2">
                          {post.category}
                        </span>
                      )}
                      <h3 className="font-display text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="font-serif-body text-sm text-foreground/70 mt-2 leading-relaxed line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mt-3 font-semibold">
                        <Clock className="w-3 h-3" />
                        <time>{formatDate(post.published_at)}</time>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            {/* Popular Posts */}
            {popular.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] font-bold text-muted-foreground mb-8">
                  <span className="text-foreground inline-flex items-center gap-2"><Flame className="w-3.5 h-3.5 text-primary" /> Populer</span>
                  <span className="flex-1 editorial-rule" />
                </div>
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 pb-12 mb-12 border-b border-border">
                  {popular.map((post) => (
                    <article key={post.id} className="group">
                      <Link href={`/blog/${post.slug || post.id}`} className="block">
                        {post.featured_image ? (
                          <div className="relative w-full aspect-[4/3] overflow-hidden mb-4 bg-muted">
                            <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] bg-foreground/[0.03] flex items-center justify-center mb-4">
                            <span className="font-display text-foreground/10 text-4xl font-black">PPMH</span>
                          </div>
                        )}
                        {post.category && (
                          <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-2">{post.category}</span>
                        )}
                        <h3 className="font-display text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <time className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{formatDate(post.published_at)}</time>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" /> {(post as any).views || 0}</span>
                        </div>
                      </Link>
                    </article>
                  ))}
                </section>
              </>
            )}

            {/* By Category */}
            {Array.from(categoryMap.entries()).map(([catName, catPosts]) => (
              <section key={catName} className="mb-12">
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] font-bold text-muted-foreground mb-8">
                  <span className="text-foreground">{catName}</span>
                  <span className="flex-1 editorial-rule" />
                  <Link href={`/berita/kategori/${slugifyCategory(catName)}`} className="text-primary hover:underline text-[11px]">Lihat Semua</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
                  {catPosts.slice(0, 3).map((post) => (
                    <article key={post.id} className="group">
                      <Link href={`/blog/${post.slug || post.id}`} className="block">
                        {post.featured_image ? (
                          <div className="relative w-full aspect-[4/3] overflow-hidden mb-4 bg-muted">
                            <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] bg-foreground/[0.03] flex items-center justify-center mb-4">
                            <span className="font-display text-foreground/10 text-4xl font-black">PPMH</span>
                          </div>
                        )}
                        <h3 className="font-display text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                        <p className="font-serif-body text-sm text-foreground/70 mt-2 leading-relaxed line-clamp-2">{post.excerpt}</p>
                        <time className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mt-3">{formatDate(post.published_at)}</time>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {/* All remaining posts */}
            {tail.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] font-bold text-muted-foreground mb-8">
                  <span className="text-foreground">Lebih Banyak</span>
                  <span className="flex-1 editorial-rule" />
                </div>
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                  {tail.map((post) => (
                    <article key={post.id} className="group">
                      <Link href={`/blog/${post.slug || post.id}`} className="block">
                        {post.featured_image ? (
                          <div className="relative w-full aspect-[4/3] overflow-hidden mb-4 bg-muted">
                            <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] bg-foreground/[0.03] flex items-center justify-center mb-4">
                            <span className="font-display text-foreground/10 text-4xl font-black">PPMH</span>
                          </div>
                        )}
                        {post.category && (
                          <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-2">
                            {post.category}
                          </span>
                        )}
                        <h3 className="font-display text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-3">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="font-serif-body text-sm text-foreground/70 mt-2 leading-relaxed line-clamp-2">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                          <time className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                            {formatDate(post.published_at)}
                          </time>
                          <span className="inline-flex items-center text-xs font-bold text-primary uppercase tracking-widest">
                            Baca <ChevronRight className="w-3 h-3 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </Link>
                    </article>
                  ))}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
