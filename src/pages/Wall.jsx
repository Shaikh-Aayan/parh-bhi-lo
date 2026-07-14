import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Radio, Trash2 } from 'lucide-react';
import VoiceRecorder from '../components/VoiceRecorder';
import VoicePlayer from '../components/VoicePlayer';
import { format } from 'date-fns';

export default function Wall() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWall();
  }, []);

  const fetchWall = async () => {
    // Fetch ALL articles where deadline is passed (show even ones without voice notes so admin can record)
    const { data: arts } = await supabase
      .from('articles')
      .select('*, topic_tags(name, color), voice_notes(*, profiles(display_name))')
      .lt('deadline_at', new Date().toISOString())
      .order('deadline_at', { ascending: false });
    
    if (arts) {
      setArticles(arts);
    }
    setLoading(false);
  };

  const deleteVoiceNote = async (vnId, articleId) => {
    if (!confirm('Delete this voice note forever?')) return;
    
    const { error } = await supabase.from('voice_notes').delete().eq('id', vnId);
    if (!error) {
      // Update local state
      setArticles(prev => prev.map(art => {
        if (art.id === articleId) {
          return { ...art, voice_notes: art.voice_notes.filter(vn => vn.id !== vnId) };
        }
        return art;
      }));
    } else {
      alert('Failed to delete voice note.');
      console.error(error);
    }
  };

  const handleVoiceRecorded = (articleId, newVoiceNote) => {
    // Add the new voice note to the article's list
    setArticles(prev => prev.map(art => {
      if (art.id === articleId) {
        return { ...art, voice_notes: [...(art.voice_notes || []), { ...newVoiceNote, profiles: { display_name: profile.display_name } }] };
      }
      return art;
    }));
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
      <div className="flex items-center justify-between sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <Radio className="w-6 h-6 text-[var(--color-accent)]" /> The Wall
        </h1>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] font-medium">
        Deadline guzar gayi. Ab suno sab ki awazein! 🔊
      </p>

      {articles.length === 0 ? (
        <div className="p-8 premium-card rounded-2xl text-center">
          <p className="text-[var(--color-text-secondary)] font-bold">Wall abhi khaali hai. Pehle koi article toh post karo! 🤫</p>
        </div>
      ) : (
        <div className="space-y-6">
          {articles.map((article) => (
            <div key={article.id} className="premium-card p-5 rounded-2xl relative overflow-hidden">
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5" 
                style={{ backgroundColor: article.topic_tags?.color || 'var(--color-border)' }}
              />
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                {format(new Date(article.deadline_at), 'MMM d, yyyy')}
              </div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-snug mb-4">{article.title}</h2>
              
              {/* Voice Notes */}
              <div className="space-y-3">
                {(article.voice_notes || []).map(vn => (
                  <div key={vn.id} className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-[var(--color-border)] flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                        🎤 {vn.profiles?.display_name || 'Member'}
                      </span>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteVoiceNote(vn.id, article.id)} 
                          className="text-[var(--color-text-muted)] hover:text-red-600 transition-colors btn-squish"
                          title="Delete this voice note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <VoicePlayer voiceNote={vn} />
                  </div>
                ))}

                {/* No voice notes yet message */}
                {(!article.voice_notes || article.voice_notes.length === 0) && (
                  <p className="text-xs text-[var(--color-text-muted)] italic text-center py-2">Kisi ne bhi voice note nahi diya. Sharam aani chahiye! 😤</p>
                )}
              </div>

              {/* Admin can record voice notes on The Wall */}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <VoiceRecorder 
                    article={article} 
                    onRecorded={(data) => handleVoiceRecorded(article.id, data)} 
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
