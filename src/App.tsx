import { useState, useEffect, useRef } from "react";
import { useLayout } from "./hooks/useLayout";
import { useAccounts } from "./hooks/useAccounts";
import type { Article } from "./types";
import { useArticles, useArticleContent, useAnalysisStatus, useMarkRead, useDismissArticle } from "./hooks/useArticles";
import { useCardList, useCardContent, useMarkCardRead } from "./hooks/useCards";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { BookOpen, ExternalLink, X, ShieldCheck, FileText, Sparkles, Check } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { ArticleAdminPanel } from './components/ArticleAdminPanel';
import { Sidebar } from './components/Sidebar';
import { AdminManagementPanel } from './components/AdminManagementPanel';
import { AnalysisQueuePanel } from './components/AnalysisQueuePanel';
import { LoginScreen } from './components/LoginScreen';
import { AuthCallback } from './components/AuthCallback';
import { InviteManagementPanel } from './components/InviteManagementPanel';
import { UserManagementPanel } from './components/UserManagementPanel';
import AggregationQueuePanel from "./components/AggregationQueuePanel";
import { useAuth } from './lib/authStore';
import { API_BASE, WS_BASE } from './lib/api';
import { authingClient } from './lib/authing';
import "./App.css";

// Boot info — printed once at startup
getVersion()
  .then(v => {
    console.log(
      `%c Curation v${v} %c\n` +
      `  API:    ${API_BASE}\n` +
      `  WS:     ${WS_BASE}\n` +
      `  Auth:   ${import.meta.env.VITE_AUTHING_DOMAIN ?? '(not set)'}\n` +
      `  Env:    ${import.meta.env.MODE}`,
      'background:#1f6feb;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
      '',
    );
  })
  .catch(() => {});


/** Strip YAML frontmatter (---...---) from markdown content. */
function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("---", 3);
  if (end === -1) return md;
  return md.slice(end + 3).trim();
}

const mdComponents: any = {
  img: ({node, ...props}: any) => (
    <img {...props} referrerPolicy="no-referrer" loading="lazy" />
  ),
  table: ({ children, ...props }: any) => (
    <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d' }}>
      <table {...props} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }: any) => (
    <th {...props} style={{
      padding: '11px 16px', textAlign: 'left', fontWeight: 600,
      background: '#1f2937', color: '#f9fafb', borderBottom: '2px solid #3b82f6',
    }}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td {...props} style={{ padding: '9px 16px', color: '#c9d1d9' }}>{children}</td>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody {...props}>
      {Array.isArray(children) ? children.map((child: any, i: number) => {
        if (!child) return child;
        return (
          <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#161b22' }}>
            {child.props?.children}
          </tr>
        );
      }) : children}
    </tbody>
  ),
  pre: ({ children, ...props }: any) => (
    <pre {...props} style={{
      background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
      padding: '16px', overflow: 'auto', fontSize: '0.83rem', lineHeight: 1.6,
      margin: '16px 0',
    }}>{children}</pre>
  ),
  code: ({ children, className, ...props }: any) => {
    const isBlock = className?.startsWith('hljs') || className?.startsWith('language-');
    if (isBlock) return <code className={className} {...props}>{children}</code>;
    return (
      <code style={{
        background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4,
        fontSize: '0.85em', color: '#93c5fd',
      }} {...props}>{children}</code>
    );
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const doCheck = async () => {
      try {
        const u = await check();
        console.log('[updater] check result:', u ? `update available: ${u.version}` : 'up to date');
        if (u) {
          console.log('[updater] downloading in background...');
          await u.downloadAndInstall();
          console.log('[updater] download complete, ready to relaunch');
          setReady(true);
        }
      } catch (e) {
        console.error('[updater] check/download failed:', e);
      }
    };
    doCheck();
    const timer = setInterval(doCheck, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!ready) return null;

  return (
    <button onClick={() => relaunch()} style={{
      position: 'fixed', top: 12, right: 16, zIndex: 200,
      background: '#1f6feb', color: '#fff', border: 'none',
      borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
      fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: '0 2px 8px rgba(31,111,235,0.4)',
    }}>
      ↑ 重启以更新软件
    </button>
  );
}

function CardHeader({ meta }: { meta: { title: string; url: string; publish_time: string; author: string; article_id?: string } }) {
  return (
    <div style={{
      padding: '14px 20px',
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      fontSize: '0.82rem',
      lineHeight: 1.9,
      color: '#8b949e',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div>
        <a href="#" onClick={(e) => { e.preventDefault(); /* TODO: navigate to article */ }}
          style={{ color: '#e6edf3', textDecoration: 'none', fontWeight: 500, fontSize: '0.88rem', borderBottom: '1px dashed #58a6ff60', cursor: 'pointer' }}>
          {meta.title}
        </a>
      </div>
      <div>{meta.publish_time} — {meta.author}</div>
      <div>
        <a href={meta.url} target="_blank" rel="noopener noreferrer"
          style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '0.8rem' }}>
          微信原文 ↗
        </a>
      </div>
    </div>
  );
}

function App() {
  const { state: authState, logout } = useAuth();

  if (authState.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0d1117", color: "#8b949e", fontSize: 14 }}>
        <UpdateBanner />
        加载中…
      </div>
    );
  }

  // Authing uses fragment mode by default: code comes back in window.location.hash
  const isCallback = authingClient.isRedirectCallback();
  if (isCallback) {
    return <AuthCallback onDone={() => window.location.replace("/")} />;
  }

  if (authState.status === "unauthenticated") {
    return (
      <>
        <UpdateBanner />
        <LoginScreen />
      </>
    );
  }

  const currentUser = authState.user;

  function handleLogout() {
    logout();  // clear local session
    authingClient.logoutWithRedirect({
      redirectUri: import.meta.env.VITE_AUTHING_REDIRECT_URI?.replace("/auth/callback", "") || window.location.origin,
    });
  }

  return (
    <QueryClientProvider client={queryClient}>
      <UpdateBanner />
      <AppMain key={currentUser.id} currentUser={currentUser} onLogout={handleLogout} />
    </QueryClientProvider>
  );
}

function AppMain({ currentUser, onLogout }: {
  currentUser: { id: number; email: string; username: string; role: string };
  onLogout: () => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(-1); // -1 for All Articles
  const { data: articles = [] } = useArticles(selectedAccountId);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"unprocessed" | "all">("unprocessed");
  const [hidingArticleId, setHidingArticleId] = useState<string | null>(null);

  // Article content via React Query
  const { data: articleContent } = useArticleContent(selectedArticleId);
  const baseArticle = articles.find(a => a.short_id === selectedArticleId) ?? null;
  const activeArticle: (Article & { summaryWordCount?: number; rawWordCount?: number }) | null =
    baseArticle && articleContent
      ? { ...baseArticle, ...articleContent }
      : baseArticle;

  // Word counts derived from content
  const summaryWordCount = articleContent?.summaryWordCount ?? 0;
  const rawWordCount = articleContent?.rawWordCount ?? 0;

  // Analysis polling
  const contentAnalysisStatus = articleContent?.analysisStatus ?? "none";
  const { data: polledStatus } = useAnalysisStatus(selectedArticleId, contentAnalysisStatus);
  const analysisStatus = polledStatus ?? contentAnalysisStatus;

  // Optimistic mutations
  const markRead = useMarkRead(selectedAccountId);
  const dismissArticle = useDismissArticle(selectedAccountId);

  // Layout
  const { isSidebarCollapsed, sidebarWidth, listWidth, isResizingList, startResizeList, toggleSidebar } = useLayout();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminView, setAdminView] = useState<"management" | "analysis" | "queue" | "aggregation" | "invites" | "users">("management");
  const [viewRaw, setViewRaw] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Card view state
  type AppMode = "articles" | "cards";
  const [appMode, setAppMode] = useState<AppMode>("articles");
  const [cardViewDate, setCardViewDate] = useState<string | null>(null); // null = 全部
  const [cardDates, setCardDates] = useState<string[]>([]);
  const [cardViewTab, setCardViewTab] = useState<"aggregated" | "source">("aggregated");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingJumpCardId, setPendingJumpCardId] = useState<string | null>(null);

  // Card data via React Query
  const { data: cardList = [] } = useCardList(cardViewDate, cardViewTab, appMode === "cards");
  const { data: cardContentData } = useCardContent(selectedCardId, cardViewTab);
  const baseCard = cardList.find(c => c.card_id === selectedCardId) ?? null;
  const activeCard = baseCard && cardContentData
    ? { ...baseCard, content: cardContentData.content, title: cardContentData.title ?? baseCard.title, article_meta: cardContentData.article_meta }
    : null;
  const markCardRead = useMarkCardRead(cardViewDate, cardViewTab);

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  // Animate out the previous article when switching selection (if it was read)
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevSelectedRef.current;
    if (prevId && prevId !== selectedArticleId) {
      const prevArt = articles.find(a => a.short_id === prevId);
      if (prevArt && prevArt.read_status) {
        setHidingArticleId(prevId);
      }
    }
    prevSelectedRef.current = selectedArticleId;
  }, [selectedArticleId]);

  // Auto-set viewRaw based on content source
  useEffect(() => {
    if (!articleContent) return;
    if (articleContent.content_source === "enqueued" || articleContent.content_source === "error") {
      setViewRaw(true);
    } else if (articleContent.content_source === "analysis") {
      setViewRaw(false);
    }
  }, [articleContent]);

  // Admin tab: auto-switch to analysis when article selected in admin mode
  useEffect(() => {
    if (isAdminMode && selectedArticleId) setAdminView("analysis");
  }, [selectedArticleId, isAdminMode]);

  // Reset admin view when leaving admin mode
  useEffect(() => {
    if (!isAdminMode) setAdminView("management");
  }, [isAdminMode]);

  // Notification when analysis completes
  useEffect(() => {
    if (polledStatus === "done" && activeArticle) {
      setNotification(`「${activeArticle.title?.slice(0, 20) ?? ""}」AI 总结已生成`);
      setViewRaw(false);
    }
  }, [polledStatus]);

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(id);
  }, [notification]);

  // Generate recent 14 days for card date list
  useEffect(() => {
    if (appMode !== "cards") return;
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    setCardDates(dates);
  }, [appMode]);

  function jumpToSourceCard(id: string) {
    setPendingJumpCardId(id);
    setCardViewTab("source");
  }

  // Resolve pending jump once the card list has loaded
  useEffect(() => {
    if (!pendingJumpCardId || cardList.length === 0) return;
    const found = cardList.find((c: any) => c.card_id === pendingJumpCardId);
    if (found) {
      setSelectedCardId(found.card_id);
      setPendingJumpCardId(null);
    }
  }, [cardList, pendingJumpCardId]);

  const handleMarkRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markRead.mutate(id);
  };

  const handleDismissArticle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHidingArticleId(id);
    dismissArticle.mutate(id);
  };

  return (
    <div className="app-container">
      <Sidebar
        appMode={appMode}
        onAppModeChange={setAppMode}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        cardViewDate={cardViewDate}
        onCardViewDateChange={setCardViewDate}
        cardDates={cardDates}
        isSidebarCollapsed={isSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        onToggleSidebar={toggleSidebar}
        isAdminMode={isAdminMode}
        onToggleAdminMode={() => setIsAdminMode(v => !v)}
        currentUser={currentUser}
        onLogout={onLogout}
        appVersion={appVersion}
      />

      {/* Pane 2: Article List (articles mode) */}
      {appMode === "articles" && <section className="article-list-pane" style={{ width: listWidth }}>
        <header className="list-header">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="搜索文章标题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'unprocessed' ? 'active' : ''}`}
              onClick={() => setViewMode('unprocessed')}
            >未读</button>
            <button
              className={`view-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >全部</button>
          </div>
        </header>
        <div className="list-content">
          {(() => {
            let lastDate = '';
            return articles
              .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .filter(a => viewMode === 'all' || (!a.read_status && !a.dismissed))
              .map(art => {
              const dateStr = (art.publish_time || '').split(' ')[0] || '';
              const showSeparator = dateStr && dateStr !== lastDate;
              if (dateStr) lastDate = dateStr;
              return (
                <div key={art.short_id}>
                  {showSeparator && <div className="date-separator">{dateStr}</div>}
                  <div
                    className={`article-card-wrapper ${hidingArticleId === art.short_id && viewMode === 'unprocessed' ? 'hiding' : ''}`}
                    onTransitionEnd={(e) => {
                      if (e.propertyName === 'max-height' && hidingArticleId === art.short_id) {
                        setHidingArticleId(null);
                      }
                    }}
                  >
                    <div
                      className={`article-card ${selectedArticleId === art.short_id ? 'active' : ''}`}
                      onClick={() => setSelectedArticleId(art.short_id)}
                    >
                      <div className="article-card-left">
                        <div className={`article-card-title ${art.read_status ? 'read' : ''}`}>{art.title}</div>
                        {art.digest && <div className="article-card-digest">{art.digest}</div>}
                        <div className="article-card-meta">
                          {art.publish_time}{art.word_count ? ` · 约${art.word_count}字 · 阅读约${Math.max(1, Math.round(art.word_count / 400))}分钟` : ''}{art.account && <> · <span
                            onClick={e => { e.stopPropagation(); if (art.account_id) setSelectedAccountId(art.account_id); }}
                            style={{ cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                          >{art.account}</span></>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        {art.cover_url && (
                          <img src={art.cover_url} alt="Cover" className="article-card-thumb" referrerPolicy="no-referrer" />
                        )}
                        {!art.read_status && (
                          <button className="btn-icon" title="标记已读" onClick={(e) => handleMarkRead(e, art.short_id)}
                            style={{ color: '#8b949e' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#3fb950')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#8b949e')}>
                            <Check size={14} />
                          </button>
                        )}
                        <button className="btn-icon dismiss-btn" onClick={(e) => handleDismissArticle(e, art.short_id)}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </section>}

      {/* Resizer 2 (articles mode) */}
      {appMode === "articles" && <div
        className={`resizer ${isResizingList ? 'resizing' : ''}`}
        onMouseDown={startResizeList}
      />}

      {/* Pane 3: Reader View / Admin Panel (articles mode) */}
      {appMode === "articles" && <main className="reader-pane" style={isAdminMode ? { overflow: 'hidden' } : undefined}>
        {isAdminMode ? (
          <>
            {/* Admin toolbar with tabs */}
            <div className="reader-toolbar" style={{ borderBottom: '1px solid #30363d', paddingBottom: 8, justifyContent: 'flex-start', gap: 8 }}>
              <ShieldCheck size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600, flexShrink: 0 }}>管理</span>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                <button
                  onClick={() => setAdminView("management")}
                  style={{
                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    background: adminView === "management" ? '#1f6feb' : '#21262d',
                    color: adminView === "management" ? '#fff' : '#8b949e',
                  }}
                >
                  内容管理
                </button>
                <button
                  onClick={() => activeArticle && setAdminView("analysis")}
                  disabled={!activeArticle}
                  style={{
                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none',
                    cursor: activeArticle ? 'pointer' : 'default',
                    background: adminView === "analysis" ? '#1f6feb' : '#21262d',
                    color: adminView === "analysis" ? '#fff' : (activeArticle ? '#8b949e' : '#4b5563'),
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={activeArticle?.title}
                >
                  {activeArticle ? `分析: ${activeArticle.title.slice(0, 20)}…` : "分析（请选择文章）"}
                </button>
                <button
                  onClick={() => setAdminView("queue")}
                  style={{
                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    background: adminView === "queue" ? '#1f6feb' : '#21262d',
                    color: adminView === "queue" ? '#fff' : '#8b949e',
                  }}
                >
                  任务队列
                </button>
                <button
                  onClick={() => setAdminView("aggregation")}
                  style={{
                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    background: adminView === "aggregation" ? '#1f6feb' : '#21262d',
                    color: adminView === "aggregation" ? '#fff' : '#8b949e',
                  }}
                >
                  聚合队列
                </button>
                {currentUser.role === "admin" && (
                  <>
                    <button
                      onClick={() => setAdminView("invites")}
                      style={{
                        fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                        background: adminView === "invites" ? '#1f6feb' : '#21262d',
                        color: adminView === "invites" ? '#fff' : '#8b949e',
                      }}
                    >
                      邀请码
                    </button>
                    <button
                      onClick={() => setAdminView("users")}
                      style={{
                        fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                        background: adminView === "users" ? '#1f6feb' : '#21262d',
                        color: adminView === "users" ? '#fff' : '#8b949e',
                      }}
                    >
                      用户管理
                    </button>
                  </>
                )}
              </div>
              <div style={{ flex: 1 }} />
              {activeArticle && (
                <button className="btn-icon" title="打开原文" onClick={() => window.open(activeArticle.url)}>
                  <ExternalLink size={16} />
                </button>
              )}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {adminView === "management" ? (
                <AdminManagementPanel
                  accounts={accounts}
                  articles={articles}
                  onRefresh={() => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); queryClient.invalidateQueries({ queryKey: ["articles"] }); }}
                  onSelectArticle={(id) => {
                    setSelectedArticleId(id);
                    setAdminView("analysis");
                  }}
                />
              ) : adminView === "queue" ? (
                <AnalysisQueuePanel onNavigateToArticle={(id) => {
                  setSelectedArticleId(id);
                  setIsAdminMode(false);
                }} />
              ) : adminView === "aggregation" ? (
                <AggregationQueuePanel />
              ) : adminView === "invites" ? (
                <InviteManagementPanel />
              ) : adminView === "users" ? (
                <UserManagementPanel />
              ) : activeArticle ? (
                <ArticleAdminPanel
                  article={activeArticle}
                  onArticleUpdate={() => queryClient.invalidateQueries({ queryKey: ["articles"] })}
                />
              ) : (
                <div className="reader-empty">
                  <div className="reader-empty-icon"><BookOpen size={48} /></div>
                  <h3>请先在内容管理中选择一篇文章</h3>
                </div>
              )}
            </div>
          </>
        ) : !isAdminMode && activeArticle ? (
          <>
            <div className="reader-toolbar">
              {/* View mode segmented control */}
              <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #30363d', marginRight: 'auto' }}>
                <button
                  onClick={() => setViewRaw(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', padding: '5px 12px',
                    border: 'none', cursor: 'pointer',
                    background: viewRaw ? '#3b82f6' : '#21262d',
                    color: viewRaw ? '#fff' : '#8b949e',
                    transition: 'background 0.15s',
                  }}
                >
                  <FileText size={13} />
                  原文
                </button>
                <button
                  onClick={() => setViewRaw(false)}
                  disabled={activeArticle.content_source !== "analysis" && analysisStatus !== "pending" && analysisStatus !== "running"}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', padding: '5px 12px',
                    border: 'none',
                    cursor: activeArticle.content_source === "analysis" ? 'pointer' : 'default',
                    background: !viewRaw ? '#3b82f6' : '#21262d',
                    color: (!viewRaw ? '#fff' : (analysisStatus === "none" || analysisStatus === "failed") ? '#4b5563' : '#8b949e'),
                    transition: 'background 0.15s',
                  }}
                >
                  <Sparkles size={13} />
                  深度总结
                </button>
              </div>
              <button className="btn-icon" title="打开原文" onClick={() => window.open(activeArticle.url)}>
                <ExternalLink size={18} />
              </button>
            </div>
            {/* Word count info bar */}
            {activeArticle.content_source === "analysis" && summaryWordCount > 0 && rawWordCount > 0 && (
              <div style={{
                padding: '6px 16px', fontSize: '0.78rem', color: '#8b949e',
                background: '#161b22', borderBottom: '1px solid #21262d',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>全文约{summaryWordCount}字 · 阅读约{Math.max(1, Math.round(summaryWordCount / 400))}分钟（原文约{rawWordCount}字）</span>
                {summaryWordCount / rawWordCount > 0.7 && (
                  <span style={{ color: '#d29922', marginLeft: 4 }}>
                    — AI 认为这是一篇值得完整阅读的文章
                  </span>
                )}
              </div>
            )}
            {activeArticle.content_source !== "analysis" && rawWordCount > 0 && viewRaw && (
              <div style={{
                padding: '6px 16px', fontSize: '0.78rem', color: '#8b949e',
                background: '#161b22', borderBottom: '1px solid #21262d',
              }}>
                全文约{rawWordCount}字 · 阅读约{Math.max(1, Math.round(rawWordCount / 400))}分钟
              </div>
            )}
            <div className="reader-content animate-in">
              {activeArticle.content_source === "not_loaded" ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: '#8b949e' }}>
                  <Sparkles size={32} style={{ opacity: 0.4 }} className="animate-spin" />
                  <span style={{ fontSize: '0.9rem' }}>正在加载文章内容...</span>
                </div>
              ) : !viewRaw && (analysisStatus === "pending" || analysisStatus === "running") ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: '#8b949e' }}>
                  <Sparkles size={32} style={{ opacity: 0.4 }} className="animate-spin" />
                  <span style={{ fontSize: '0.9rem' }}>正在生成 AI 总结...</span>
                </div>
              ) : (
                <>
                  <div className="markdown-body">
                    {viewRaw && activeArticle.contentFormat === "html" ? (
                      <div
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: activeArticle.rawMarkdown || "" }}
                      />
                    ) : !viewRaw && activeArticle.cards && activeArticle.cards.length > 0 ? (
                      <>
                        {/* Article meta header - once */}
                        {activeArticle.article_meta && <CardHeader meta={activeArticle.article_meta} />}

                        {/* Card list */}
                        {activeArticle.cards.map((card) => (
                          <div key={card.card_id} className="mb-6 border border-gray-200 rounded-lg p-4" style={{ marginBottom: 24, border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>{card.title}</h3>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                              components={mdComponents}
                            >
                              {stripFrontmatter(card.content)}
                            </ReactMarkdown>
                          </div>
                        ))}

                        {/* Unpushed content at bottom */}
                        {(() => {
                          const unpushedItems: { topic: string; reason: string }[] = [];
                          for (const card of activeArticle.cards) {
                            if (!card.unpushed) continue;
                            try {
                              const parsed = typeof card.unpushed === "string"
                                ? JSON.parse(card.unpushed)
                                : card.unpushed;
                              if (Array.isArray(parsed)) unpushedItems.push(...parsed);
                            } catch { /* ignore */ }
                          }
                          if (unpushedItems.length === 0) return null;
                          return (
                            <div style={{ padding: '20px', borderTop: '2px solid #21262d' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>未推送内容</div>
                              {unpushedItems.map((item, i) => (
                                <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: '2px solid #30363d' }}>
                                  <div style={{ color: '#c9d1d9', fontWeight: 500, marginBottom: 4, fontSize: '0.82rem' }}>{item.topic}</div>
                                  <div style={{ color: '#6b7280', lineHeight: 1.6, fontSize: '0.82rem' }}>{item.reason}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={mdComponents}
                      >
                        {(viewRaw ? activeArticle.rawMarkdown : activeArticle.markdown) || ""}
                      </ReactMarkdown>
                    )}
                  </div>

                  {/* Metadata Inspector (Proof of 100% preservation) */}
                  <div className="metadata-inspector">
                    <h4>元数据详情</h4>
                    <div className="meta-grid">
                      <div className="meta-item"><label>HashID</label><span>{activeArticle.hashid || '-'}</span></div>
                      <div className="meta-item"><label>Idx</label><span>{activeArticle.idx || '-'}</span></div>
                      <div className="meta-item"><label>IP 归属</label><span>{activeArticle.ip_wording || '-'}</span></div>
                      <div className="meta-item"><label>原创</label><span>{activeArticle.is_original ? '是' : '否'}</span></div>
                      <div className="meta-item"><label>送达人数</label><span>{activeArticle.send_to_fans_num || '-'}</span></div>
                      <div className="meta-item"><label>发布时间</label><span>{activeArticle.publish_time}</span></div>
                      <div className="meta-item"><label>创建时间</label><span>{activeArticle.create_time || '-'}</span></div>
                      <div className="meta-item"><label>用户码 (Alias)</label><span>{activeArticle.alias || '-'}</span></div>
                      <div className="meta-item"><label>ID (UserName)</label><span>{activeArticle.user_name || '-'}</span></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="reader-empty">
            <div className="reader-empty-icon"><BookOpen size={64} /></div>
            <h3>请选择文章或通过「+」添加内容</h3>
          </div>
        )}
      </main>}

      {/* Card view panes (cards mode) */}
      {appMode === "cards" && (
        <>
          {/* Card list pane */}
          <section className="article-list-pane" style={{ width: listWidth }}>
            <header className="list-header">
              <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid #30363d' }}>
                <button
                  style={{
                    flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: cardViewTab === "aggregated" ? '#e6edf3' : '#8b949e',
                    borderBottom: cardViewTab === "aggregated" ? '2px solid #3b82f6' : '2px solid transparent',
                    fontWeight: cardViewTab === "aggregated" ? 600 : 400,
                  }}
                  onClick={() => setCardViewTab("aggregated")}
                >
                  聚合卡片
                </button>
                <button
                  style={{
                    flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: cardViewTab === "source" ? '#e6edf3' : '#8b949e',
                    borderBottom: cardViewTab === "source" ? '2px solid #3b82f6' : '2px solid transparent',
                    fontWeight: cardViewTab === "source" ? 600 : 400,
                  }}
                  onClick={() => setCardViewTab("source")}
                >
                  原始卡片
                </button>
              </div>
            </header>
            <div className="list-content">
              {cardList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e', fontSize: '0.85rem' }}>
                  暂无卡片
                </div>
              ) : cardList.map((card: any) => (
                <div
                  key={card.card_id}
                  style={{
                    padding: '12px 14px', cursor: 'pointer',
                    borderBottom: '1px solid #21262d',
                    background: activeCard?.card_id === card.card_id ? '#1c2333' : 'transparent',
                  }}
                  onClick={() => setSelectedCardId(card.card_id)}
                  onMouseEnter={(e) => { if (activeCard?.card_id !== card.card_id) (e.currentTarget as HTMLElement).style.background = '#161b22'; }}
                  onMouseLeave={(e) => { if (activeCard?.card_id !== card.card_id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: card.read_at ? 400 : 500, color: card.read_at ? '#6e7681' : '#e6edf3' }}>{card.title}</div>
                  {card.article_title && (
                    <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: 4 }}>{card.article_title}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Resizer */}
          <div
            className={`resizer ${isResizingList ? 'resizing' : ''}`}
            onMouseDown={startResizeList}
          />

          {/* Card reader pane */}
          <main className="reader-pane">
            {activeCard ? (
              <>
                <div className="reader-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e6edf3' }}>
                    {activeCard.title}
                  </span>
                  {!activeCard.read_at && (
                    <button
                      onClick={() => markCardRead.mutate(activeCard.card_id)}
                      style={{
                        background: 'none', border: '1px solid #30363d', borderRadius: 4,
                        color: '#8b949e', padding: '2px 10px', cursor: 'pointer', fontSize: '0.78rem',
                      }}
                    >
                      标记已读
                    </button>
                  )}
                </div>
                {activeCard.article_meta && <CardHeader meta={activeCard.article_meta} />}
                <div className="reader-content animate-in">
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={mdComponents}
                    >
                      {stripFrontmatter(activeCard.content || "")}
                    </ReactMarkdown>
                  </div>

                  {/* Source tracing for aggregated cards */}
                  {activeCard.source_card_ids && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #30363d', fontSize: '0.82rem', color: '#8b949e' }}>
                      <span>来源卡片：</span>
                      {(() => {
                        try {
                          const ids = typeof activeCard.source_card_ids === "string"
                            ? JSON.parse(activeCard.source_card_ids)
                            : activeCard.source_card_ids;
                          return (ids as string[]).map((id: string) => (
                            <button
                              key={id}
                              onClick={() => jumpToSourceCard(id)}
                              style={{
                                marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer',
                                color: '#58a6ff', fontSize: '0.82rem', textDecoration: 'none',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {id.slice(0, 8)}...
                            </button>
                          ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="reader-empty">
                <div className="reader-empty-icon"><BookOpen size={64} /></div>
                <h3>请选择一张卡片</h3>
              </div>
            )}
          </main>
        </>
      )}

      {/* Toast notification */}
      {notification && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          background: '#161b22', border: '1px solid #3fb950',
          borderRadius: 10, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <Sparkles size={16} style={{ color: '#3fb950', flexShrink: 0 }} />
          <span style={{ color: '#e6edf3', fontSize: '0.85rem' }}>{notification}</span>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 2, marginLeft: 4 }}>
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}

export default App;

