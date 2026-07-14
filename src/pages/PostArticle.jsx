import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { addHours, formatISO } from 'date-fns';

export default function PostArticle() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [tags, setTags] = useState([]);

  // Form State
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [tagId, setTagId] = useState('');
  
  // Overrides State
  const [isMandatory, setIsMandatory] = useState(true);
  const [voiceNoteRequired, setVoiceNoteRequired] = useState(true);
  const [deadlineAt, setDeadlineAt] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    const [settingsRes, tagsRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('topic_tags').select('*').eq('archived', false).order('sort_order')
    ]);
    
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      // Set Defaults
      setIsMandatory(true); // Should calculate if it's < default_mandatory_count for the day, but we default to true in UI for now
      setVoiceNoteRequired(settingsRes.data.default_voice_note_required);
      
      const deadline = addHours(new Date(), settingsRes.data.default_deadline_hours);
      // Format to datetime-local string (YYYY-MM-DDTHH:mm)
      setDeadlineAt(formatISO(deadline).slice(0, 16));
    }
    if (tagsRes.data) {
      setTags(tagsRes.data);
      if (tagsRes.data.length > 0) setTagId(tagsRes.data[0].id);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from('articles').insert([{
      posted_by: profile.id,
      title,
      url,
      summary,
      tag_id: tagId,
      is_mandatory: isMandatory,
      voice_note_required: voiceNoteRequired,
      deadline_at: new Date(deadlineAt).toISOString(),
      voice_note_max_seconds: settings.default_voice_note_max_seconds,
      voice_note_min_seconds: settings.default_voice_note_min_seconds,
      min_voice_length_enabled: settings.default_voice_note_min_seconds > 0,
      points_for_read: isMandatory ? settings.points_mandatory_read : settings.points_optional_read,
      points_for_voice_note: settings.points_voice_note,
    }]);

    setSubmitting(false);
    if (!error) {
      navigate('/');
    } else {
      console.error(error);
      alert('Failed to post article');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3 sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <button onClick={() => navigate(-1)} className="btn-squish p-2 bg-[var(--color-bg-secondary)] rounded-full hover:bg-[var(--color-border)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
        </button>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Post Article</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Core Info */}
        <section className="premium-card p-5 rounded-2xl space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Title</label>
            <input 
              required type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="The Future of AI..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Link (URL)</label>
            <input 
              required type="url" value={url} onChange={e => setUrl(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Summary / Admin Note</label>
            <textarea 
              value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
              placeholder="Yeh parhna zaroori hai kyunki..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Topic</label>
            <select 
              value={tagId} onChange={e => setTagId(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </section>

        {/* Rule Overrides */}
        <section className="premium-card p-5 rounded-2xl space-y-4">
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Rule Overrides</h2>
          
          <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)]">Mandatory Read?</label>
            <button type="button" onClick={() => setIsMandatory(!isMandatory)} className={`w-12 h-6 rounded-full transition-colors relative ${isMandatory ? 'bg-[var(--color-danger)]' : 'bg-[#D1D5DB]'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isMandatory ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)]">Voice Note Required?</label>
            <button type="button" onClick={() => setVoiceNoteRequired(!voiceNoteRequired)} className={`w-12 h-6 rounded-full transition-colors relative ${voiceNoteRequired ? 'bg-[var(--color-accent)]' : 'bg-[#D1D5DB]'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${voiceNoteRequired ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="py-2">
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-1">Deadline (PKT)</label>
            <input 
              required type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Default is +{settings?.default_deadline_hours} hours from now.</p>
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-[var(--color-accent)] text-white font-bold rounded-xl shadow-md hover:bg-[var(--color-accent-hover)] transition-colors flex items-center justify-center gap-2 btn-squish"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          Post Article
        </button>
      </form>
    </div>
  );
}
