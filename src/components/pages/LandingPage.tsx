'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { Post, Student } from '../../lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Trophy, BookOpen, Clock, Activity, Users } from 'lucide-react';
import { motion } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

export function LandingPage() {
  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['public-posts'],
    queryFn: async () => {
      const res = await apiFetch('/api/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      const all: Post[] = await res.json();
      return all.filter(p => p.status === 'published').slice(0, 3);
    }
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['public-students'],
    queryFn: async () => {
      const res = await apiFetch('/api/students');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }
  });

  const topStudents = [...students].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 3);

  // Mock data for trends
  const trendData = [
    { name: 'Sen', aktif: 40, baru: 24 },
    { name: 'Sel', aktif: 30, baru: 13 },
    { name: 'Rab', aktif: 20, baru: 58 },
    { name: 'Kam', aktif: 27, baru: 39 },
    { name: 'Jum', aktif: 18, baru: 48 },
    { name: 'Sab', aktif: 23, baru: 38 },
    { name: 'Min', aktif: 34, baru: 43 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero / Masthead */}
      <section className="border-b-4 border-double border-foreground">
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-14 pb-16 md:pt-20 md:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-4 inline-flex items-center gap-2">
              <Activity className="w-3 h-3" /> Sistem Informasi Terpadu Pesantren
            </p>
            <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-black text-foreground tracking-tight leading-[0.9]">
              PPMH <span className="italic font-normal text-primary">Insight</span>
            </h1>
            <div className="mt-6 max-w-2xl mx-auto">
              <p className="font-serif-body italic text-lg md:text-xl text-foreground/70 leading-relaxed">
                Pusat data, pencapaian santri, dan berita terkini Pondok Pesantren Miftahul Huda — disajikan dengan keterbukaan dan kejernihan.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
              <Link href="/leaderboard" className="px-8 py-3.5 bg-foreground text-background font-bold uppercase tracking-widest text-xs hover:bg-primary transition-colors w-full sm:w-auto inline-flex justify-center items-center">
                <Trophy className="w-4 h-4 mr-2" /> Lihat Leaderboard
              </Link>
              <Link href="/blog" className="px-8 py-3.5 border-2 border-foreground text-foreground font-bold uppercase tracking-widest text-xs hover:bg-foreground hover:text-background transition-colors w-full sm:w-auto inline-flex justify-center items-center">
                <BookOpen className="w-4 h-4 mr-2" /> Baca Insight
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats & Trends Section */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          visible: { transition: { staggerChildren: 0.2 } },
          hidden: {}
        }}
        className="max-w-6xl mx-auto px-4 md:px-8 py-16 -mt-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Students Podium */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 50 } }
            }}
            className="lg:col-span-1 bg-base-0 p-8 rounded-3xl border border-border shadow-soft relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" /> Top Santri
              </h2>
              <Link href="/leaderboard" className="text-primary text-sm font-bold hover:underline">
                Lihat Semua
              </Link>
            </div>
            
            <div className="space-y-4">
              {topStudents.map((student, i) => (
                <div key={student.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-base-50 transition-colors border border-transparent hover:border-border">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0 ${
                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.bio || 'Santri PPMH'}</p>
                  </div>
                  <div className="font-black text-primary">
                    {student.totalPoints || 0} pt
                  </div>
                </div>
              ))}
              {topStudents.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">Belum ada data santri.</p>
              )}
            </div>
          </motion.div>

          {/* Activity Trend Chart */}
          <motion.div 
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 50 } }
            }}
            className="lg:col-span-2 bg-base-0 p-8 rounded-3xl border border-border shadow-soft"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" /> Tren Aktivitas
              </h2>
              <span className="text-sm font-medium text-muted-foreground bg-base-100 px-3 py-1 rounded-full">
                7 Hari Terakhir
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAktif" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="aktif" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAktif)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Latest News Section */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
          hidden: {}
        }}
        className="max-w-6xl mx-auto px-4 md:px-8 py-16"
      >
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-3 inline-flex items-center gap-2">
              <BookOpen className="w-3 h-3" /> Sekilas PPMH
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground tracking-tight">Berita & Insight</h2>
          </div>
          <Link href="/blog" className="inline-flex items-center text-foreground font-bold hover:text-primary transition-colors uppercase tracking-widest text-xs border-b border-foreground hover:border-primary pb-1">
            Semua Artikel <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="editorial-rule mb-10" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 50 } }
              }}
            >
              <Link href={`/blog/${post.slug || post.id}`} className="group block h-full">
                {post.featured_image ? (
                  <div className="relative w-full aspect-[4/3] overflow-hidden mb-4 bg-muted">
                    <Image src={post.featured_image} alt={post.title} fill referrerPolicy="no-referrer" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] bg-foreground/[0.03] flex items-center justify-center mb-4">
                    <BookOpen className="w-10 h-10 text-foreground/20" />
                  </div>
                )}
                {post.category && (
                  <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-bold text-primary mb-2">
                    {post.category}
                  </span>
                )}
                <h3 className="font-display text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-3">
                  {post.title}
                </h3>
                <p className="font-serif-body text-sm text-foreground/70 mt-2 leading-relaxed line-clamp-2">
                  {post.excerpt || 'Klik untuk membaca selengkapnya…'}
                </p>
                <div className="flex items-center text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mt-4 pt-3 border-t border-border">
                  <Clock className="w-3 h-3 mr-1.5" />
                  {post.published_at ? new Date(post.published_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                </div>
              </Link>
            </motion.div>
          ))}
          {posts.length === 0 && (
            <div className="col-span-3 text-center py-20 border border-dashed border-border">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-serif-body italic">Belum ada artikel yang diterbitkan.</p>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
