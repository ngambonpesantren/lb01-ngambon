import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewProps,
} from '@tiptap/react';
import { FileText, Link as LinkIcon, Video, Trash2, Loader2, Download } from 'lucide-react';

/* =====================================================================
 * Video Block — supports YouTube, Vimeo, and direct mp4 URLs
 * Serialized: <div data-block="video" data-src="..." data-provider="..."></div>
 * =====================================================================*/

function detectProvider(url: string): 'youtube' | 'vimeo' | 'file' {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  return 'file';
}

function toEmbedUrl(url: string): string {
  const provider = detectProvider(url);
  if (provider === 'youtube') {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }
  if (provider === 'vimeo') {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : url;
  }
  return url;
}

function VideoView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const src: string = node.attrs.src || '';
  const provider = detectProvider(src);
  const [editing, setEditing] = useState(!src);
  const [draft, setDraft] = useState(src);

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Video className="w-4 h-4" /> Video Block
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tempel URL YouTube, Vimeo, atau .mp4..."
            className="w-full bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (draft) {
                  updateAttributes({ src: draft, provider: detectProvider(draft) });
                  setEditing(false);
                }
              }}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sisipkan
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="px-3 py-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-destructive"
            >
              Batal
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-6">
      <div className="relative group/video rounded-xl overflow-hidden border border-border bg-black aspect-video">
        {provider === 'file' ? (
          <video src={src} controls className="w-full h-full" />
        ) : (
          <iframe
            src={toEmbedUrl(src)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            title="Video"
          />
        )}
        <button
          type="button"
          contentEditable={false}
          onClick={deleteNode}
          className="absolute top-2 right-2 opacity-0 group-hover/video:opacity-100 bg-background/80 backdrop-blur p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-opacity"
          aria-label="Hapus video"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      provider: { default: 'youtube' },
    };
  },
  parseHTML() {
    return [{
      tag: 'div[data-block="video"]',
      getAttrs: (el) => ({
        src: (el as HTMLElement).getAttribute('data-src') || '',
        provider: (el as HTMLElement).getAttribute('data-provider') || 'youtube',
      }),
    }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-block': 'video',
      'data-src': node.attrs.src || '',
      'data-provider': node.attrs.provider || 'youtube',
    })];
  },
  addNodeView() { return ReactNodeViewRenderer(VideoView); },
});

/* =====================================================================
 * Bookmark Block — Notion-style link preview card
 * =====================================================================*/

function BookmarkView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { url, title, description, image, siteName } = node.attrs;
  const [editing, setEditing] = useState(!url);
  const [draft, setDraft] = useState(url || '');
  const [loading, setLoading] = useState(false);

  const fetchMeta = async (target: string) => {
    setLoading(true);
    try {
      // Use a free metadata service (no API key); falls back gracefully.
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(target)}`);
      const json = await res.json();
      const d = json?.data || {};
      updateAttributes({
        url: target,
        title: d.title || target,
        description: d.description || '',
        image: d.image?.url || '',
        siteName: d.publisher || new URL(target).hostname,
      });
    } catch {
      try {
        updateAttributes({
          url: target,
          title: target,
          siteName: new URL(target).hostname,
        });
      } catch {
        updateAttributes({ url: target, title: target });
      }
    } finally {
      setLoading(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <LinkIcon className="w-4 h-4" /> Web Bookmark
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://..."
            className="w-full bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !draft}
              onClick={() => fetchMeta(draft)}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Buat Preview
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="px-3 py-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-destructive"
            >
              Batal
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark-card group/bm flex items-stretch border border-border rounded-xl overflow-hidden bg-card hover:border-primary/60 transition-colors no-underline"
      >
        <div className="flex-1 min-w-0 p-4 flex flex-col gap-1">
          <div className="font-semibold text-foreground truncate">{title || url}</div>
          {description && (
            <div className="text-sm text-muted-foreground line-clamp-2">{description}</div>
          )}
          <div className="text-xs text-muted-foreground/70 mt-auto pt-2 truncate flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" /> {siteName || url}
          </div>
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="w-32 sm:w-44 h-full object-cover shrink-0 border-l border-border"
          />
        )}
      </a>
    </NodeViewWrapper>
  );
}

export const BookmarkBlock = Node.create({
  name: 'bookmarkBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      siteName: { default: '' },
    };
  },
  parseHTML() {
    return [{
      tag: 'a[data-block="bookmark"]',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return {
          url: e.getAttribute('href') || '',
          title: e.getAttribute('data-title') || '',
          description: e.getAttribute('data-description') || '',
          image: e.getAttribute('data-image') || '',
          siteName: e.getAttribute('data-site') || '',
        };
      },
    }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['a', mergeAttributes(HTMLAttributes, {
      'data-block': 'bookmark',
      href: node.attrs.url || '#',
      'data-title': node.attrs.title || '',
      'data-description': node.attrs.description || '',
      'data-image': node.attrs.image || '',
      'data-site': node.attrs.siteName || '',
      target: '_blank',
      rel: 'noopener noreferrer',
    })];
  },
  addNodeView() { return ReactNodeViewRenderer(BookmarkView); },
});

/* =====================================================================
 * File Attachment Block — beautiful card for PDFs / files
 * =====================================================================*/

function FileAttachmentView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { url, name, size } = node.attrs;
  const [editing, setEditing] = useState(!url);
  const [draftUrl, setDraftUrl] = useState(url || '');
  const [draftName, setDraftName] = useState(name || '');

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FileText className="w-4 h-4" /> File Attachment
          </div>
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="URL file (PDF, dokumen, dll.)"
            className="w-full bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Nama tampilan (mis. Brosur 2026.pdf)"
            className="w-full bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (draftUrl) {
                  updateAttributes({ url: draftUrl, name: draftName || draftUrl.split('/').pop() });
                  setEditing(false);
                }
              }}
              className="px-3 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sisipkan
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="px-3 py-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-destructive"
            >
              Batal
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="my-5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="file-attachment group/fa flex items-center gap-4 p-4 border border-border rounded-xl bg-card hover:border-primary/60 transition-colors no-underline"
      >
        <div className="shrink-0 w-12 h-14 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 border border-border flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{name || 'File'}</div>
          <div className="text-xs text-muted-foreground truncate">{size || 'Klik untuk membuka / unduh'}</div>
        </div>
        <Download className="w-4 h-4 text-muted-foreground group-hover/fa:text-primary transition-colors shrink-0" />
      </a>
    </NodeViewWrapper>
  );
}

export const FileAttachmentBlock = Node.create({
  name: 'fileAttachmentBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: '' },
      name: { default: '' },
      size: { default: '' },
    };
  },
  parseHTML() {
    return [{
      tag: 'a[data-block="file-attachment"]',
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return {
          url: e.getAttribute('href') || '',
          name: e.getAttribute('data-name') || '',
          size: e.getAttribute('data-size') || '',
        };
      },
    }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['a', mergeAttributes(HTMLAttributes, {
      'data-block': 'file-attachment',
      href: node.attrs.url || '#',
      'data-name': node.attrs.name || '',
      'data-size': node.attrs.size || '',
      target: '_blank',
      rel: 'noopener noreferrer',
    })];
  },
  addNodeView() { return ReactNodeViewRenderer(FileAttachmentView); },
});
