import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Link } from 'react-router-dom';
import { Loader2, Plus, ExternalLink, CheckCircle2, Trash2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import VoiceRecorder from '../components/VoiceRecorder';
import VoicePlayer from '../components/VoicePlayer';
import InstallPrompt from '../components/InstallPrompt';

export default function Feed() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const isAdmin = profile?.role === 'admin';
  const [articles, setArticles] = useState([]);
  const [interactions, setInteractions] = useState({});
  const [voiceNotes, setVoiceNotes] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [bounceId, setBounceId] = useState(null);
  const [ink, setInk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    fetchFeed();
  }, []);

  // First app open of the day: one-time olive ink-wash behind the logo (< 1s)
  useEffect(() => {
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem('pbl_first_open_day') !== today) {
        localStorage.setItem('pbl_first_open_day', today);
        setInk(true);
        const t = setTimeout(() => setInk(false), 1000);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  // First article of each day (for the drop-cap flourish)
  const firstOfDayIds = useMemo(() => {
    const seen = new Set();
    const set = new Set();
    articles.forEach((a) => {
      const d = new Date(a.posted_at).toDateString();
      if (!seen.has(d)) { seen.add(d); set.add(a.id); }
    });
    return set;
  }, [articles]);

  const fetchFeed = async () => {
    const [artsRes, intRes, vnRes, annRes, tagRes] = await Promise.all([
      supabase.from('articles').select('*, topic_tags(name, color)').order('posted_at', { ascending: false }),
      supabase.from('article_interactions').select('*').eq('user_id', profile.id),
      supabase.from('voice_notes').select('*').eq('user_id', profile.id),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('topic_tags').select('*').eq('archived', false).order('sort_order')
    ]);
    
    if (artsRes.data) setArticles(artsRes.data);
    if (annRes.data) {
      // Filter out expired announcements
      const activeAnns = annRes.data.filter(a => !a.expires_at || new Date(a.expires_at) > new Date());
      setAnnouncements(activeAnns);
    }
    
    if (intRes.data) {
      const intMap = {};
      intRes.data.forEach(i => intMap[i.article_id] = i);
      setInteractions(intMap);
    }

    if (vnRes.data) {
      const vnMap = {};
      vnRes.data.forEach(v => vnMap[v.article_id] = v);
      setVoiceNotes(vnMap);
    }
    if (tagRes.data) setTags(tagRes.data);

    setLoading(false);
  };

  const markAsRead = async (article) => {
    const { data, error } = await supabase.from('article_interactions').insert([
      { 
        article_id: article.id, 
        user_id: profile.id, 
        is_read: true, 
        read_at: new Date().toISOString(),
        points_earned: article.points_for_read
      }
    ]).select().single();
    
    if (data) {
      setInteractions(prev => ({ ...prev, [article.id]: data }));
      setBounceId(article.id);
      addToast(`Zabardast! Article parh liya! (+${article.points_for_read} pts)`, 'success');
    } else {
      console.error(error);
      addToast('Error saving progress.', 'error');
    }
  };

  const markAsUnread = async (articleId) => {
    const { error } = await supabase.from('article_interactions').delete().match({ article_id: articleId, user_id: profile.id });
    if (!error) {
      setInteractions(prev => {
        const next = { ...prev };
        delete next[articleId];
        return next;
      });
      addToast('Unmarked! Dobara parhna padega.', 'warning');
    } else {
      addToast('Error unmarking article.', 'error');
    }
  };

  const deleteArticle = async (articleId) => {
    if (!confirm('Are you sure you want to delete this article? This will cascade and delete all interactions and voice notes for it.')) return;
    
    const { error } = await supabase.from('articles').delete().eq('id', articleId);
    if (!error) {
      setArticles(prev => prev.filter(a => a.id !== articleId));
      addToast('Article deleted!', 'info');
    } else {
      addToast('Failed to delete article.', 'error');
      console.error(error);
    }
  };

  const handleEditClick = (article) => {
    setEditingArticleId(article.id);
    setEditFormData({
      title: article.title,
      url: article.url,
      deadline_at: article.deadline_at.slice(0, 16) // for datetime-local input
    });
  };

  const saveArticleEdit = async (articleId) => {
    const { data, error } = await supabase
      .from('articles')
      .update({
        title: editFormData.title,
        url: editFormData.url,
        deadline_at: new Date(editFormData.deadline_at).toISOString()
      })
      .eq('id', articleId)
      .select('*, topic_tags(name, color)')
      .single();

    if (data) {
      setArticles(prev => prev.map(a => a.id === articleId ? data : a));
      setEditingArticleId(null);
      addToast('Article updated!', 'success');
    } else {
      addToast('Failed to update article.', 'error');
      console.error(error);
    }
  };

  const handleVoiceRecorded = (articleId, newVoiceNote) => {
    setVoiceNotes(prev => ({ ...prev, [articleId]: newVoiceNote }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative min-h-screen">
      <InstallPrompt />
      <div className="flex items-center justify-between sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <div className="relative overflow-hidden">
          <h1 className="relative z-10 text-3xl font-black text-[var(--color-accent)] tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            PARH BHI LO!
          </h1>
          {ink && <div className="ink-wash" />}
          <p className="relative z-10 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Today's Feed</p>
        </div>
      </div>

      {/* Domain filter */}
      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4">
          <button
            onClick={() => setActiveTag(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors btn-squish ${
              activeTag === null ? 'bg-[var(--color-accent)] text-white' : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border)]'
            }`}
          >
            All
          </button>
          {tags.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTag(activeTag === t.id ? null : t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors btn-squish border ${
                activeTag === t.id ? 'text-white border-transparent' : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)]'
              }`}
              style={activeTag === t.id ? { backgroundColor: t.color, borderColor: t.color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTag === t.id ? '#fff' : t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-purple-100 border-2 border-purple-300 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-20">📢</div>
              <h3 className="text-purple-800 font-bold text-sm uppercase tracking-wider mb-1">Announcement</h3>
              <p className="text-purple-900 font-medium">{ann.content}</p>
            </div>
          ))}
        </div>
      )}

      {articles.filter(a => !activeTag || a.tag_id === activeTag).length === 0 ? (
        <div className="p-8 premium-card rounded-2xl text-center">
          <p className="text-[var(--color-text-secondary)] font-bold">
            {activeTag ? 'Is domain mein koi article nahi hai.' : 'Koi article nahi hai, jao so jao! 😴'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.filter(a => !activeTag || a.tag_id === activeTag).map((article, index) => {
            const isMissed = isPast(new Date(article.deadline_at));
            const interaction = interactions[article.id];
            const voiceNote = voiceNotes[article.id];
            const isRead = interaction?.is_read;

            return (
              <div
                key={article.id}
                className={`premium-card p-5 rounded-2xl relative overflow-hidden group card-enter ${bounceId === article.id ? 'read-bounce' : ''}`}
                onAnimationEnd={() => bounceId === article.id && setBounceId(null)}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5" 
                  style={{ backgroundColor: article.is_mandatory ? 'var(--color-danger)' : (article.topic_tags?.color || 'var(--color-border)') }}
                />
                
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {article.is_mandatory && (
                      <span className="px-2 py-0.5 bg-red-100 text-[var(--color-danger)] text-[10px] font-bold uppercase tracking-wider rounded-md">
                        Mandatory
                      </span>
                    )}
                    {article.topic_tags && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ backgroundColor: `${article.topic_tags.color}15`, color: article.topic_tags.color }}>
                        {article.topic_tags.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isMissed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                      Due {format(new Date(article.deadline_at), 'MMM d, h:mm a')}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-2 border-l border-[var(--color-border)] pl-2">
                        <button 
                          onClick={() => handleEditClick(article)}
                          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors rounded hover:bg-gray-100"
                          title="Edit Article"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button 
                          onClick={() => deleteArticle(article.id)}
                          className="p-1 text-[var(--color-text-muted)] hover:text-red-600 transition-colors rounded hover:bg-red-50"
                          title="Delete Article"
                        >
                          <Trash2 className="w-14 h-14" style={{width: '14px', height: '14px'}} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editingArticleId === article.id ? (
                  <div className="bg-[var(--color-bg-secondary)] p-4 rounded-xl mb-4 space-y-3 border border-[var(--color-border)]">
                    <input 
                      type="text" 
                      value={editFormData.title} 
                      onChange={e => setEditFormData({...editFormData, title: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm font-bold"
                      placeholder="Title"
                    />
                    <input 
                      type="url" 
                      value={editFormData.url} 
                      onChange={e => setEditFormData({...editFormData, url: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm"
                      placeholder="URL"
                    />
                    <input 
                      type="datetime-local" 
                      value={editFormData.deadline_at} 
                      onChange={e => setEditFormData({...editFormData, deadline_at: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm"
                    />
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setEditingArticleId(null)} className="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                      <button onClick={() => saveArticleEdit(article.id)} className="px-3 py-1.5 text-sm font-bold bg-[var(--color-accent)] text-white rounded-lg">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className={`text-lg font-bold leading-snug mb-1 ${isRead ? 'text-[var(--color-text-muted)] line-through decoration-2' : 'text-[var(--color-text-primary)]'} ${firstOfDayIds.has(article.id) ? 'drop-cap' : ''}`}>
                      {article.title}
                    </h2>
                    
                    {article.summary && (
                      <p className="text-sm text-[var(--color-text-secondary)] mb-4 bg-[var(--color-bg-primary)] p-3 rounded-xl italic">
                        "{article.summary}"
                      </p>
                    )}
                  </>
                )}

                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex gap-2">
                    <a 
                      href={article.url} target="_blank" rel="noreferrer"
                      className="btn-squish flex-1 flex justify-center items-center gap-2 py-2.5 bg-white text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300"
                    >
                      Read <ExternalLink className="w-4 h-4" />
                    </a>
                    
                    {!isRead ? (
                      <button 
                        onClick={() => markAsRead(article)}
                        className="btn-squish flex-1 flex justify-center items-center gap-2 py-2.5 bg-[var(--color-accent-light)] text-[var(--color-accent)] rounded-xl text-sm font-bold hover:bg-[var(--color-accent)] hover:text-white"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Done
                      </button>
                    ) : (
                      <button 
                        onClick={() => markAsUnread(article.id)}
                        className="btn-squish flex-1 flex justify-center items-center gap-2 py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-bold hover:bg-red-50 hover:text-red-600 group"
                      >
                        <span className="group-hover:hidden flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Read!</span>
                        <span className="hidden group-hover:block">Unmark</span>
                      </button>
                    )}
                  </div>

                  {/* Voice Note Section */}
                  {isRead && article.voice_note_required && !voiceNote && (
                    <VoiceRecorder 
                      article={article} 
                      onRecorded={(vn) => handleVoiceRecorded(article.id, vn)} 
                    />
                  )}

                  {voiceNote && (
                    <VoicePlayer voiceNote={voiceNote} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <Link 
          to="/post"
          className="fixed bottom-24 right-4 w-14 h-14 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[var(--color-accent-hover)] btn-squish z-20"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}
