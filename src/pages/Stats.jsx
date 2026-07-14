import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Loader2, Target, Flame, Frown, ShieldAlert, BellRing } from 'lucide-react';

export default function Stats() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const isAdmin = profile?.role === 'admin';
  const [stats, setStats] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [todayArticles, setTodayArticles] = useState([]);
  const [todayInteractions, setTodayInteractions] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [statsRes, setRes] = await Promise.all([
      supabase.from('user_stats_view').select('*').order('total_points', { ascending: false }),
      supabase.from('app_settings').select('*').eq('id', 1).single()
    ]);
    
    if (statsRes.data) setStats(statsRes.data);
    if (setRes.data) setSettings(setRes.data);

    if (isAdmin) {
      const todayStr = new Date().toISOString().split('T')[0];
      const [arts, inters, profs] = await Promise.all([
        supabase.from('articles').select('id, title, is_mandatory').gte('posted_at', todayStr),
        supabase.from('article_interactions').select('*').gte('created_at', todayStr),
        supabase.from('profiles').select('*').neq('role', 'admin')
      ]);
      setTodayArticles(arts.data || []);
      setTodayInteractions(inters.data || []);
      setMembers(profs.data || []);
    }

    setLoading(false);
  };

  const handleRemind = async (member) => {
    // In a real app with deployed Edge Functions, this would trigger the push notification API.
    // For now we simulate it visually.
    addToast(`Reminder sent to ${member.display_name}! 🔔`, 'info');
  };

  const bannedIds = useMemo(() => new Set(members.filter(m => m.banned).map(m => m.id)), [members]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  const todayMandatory = todayArticles.filter(a => a.is_mandatory);
  // Daily Quota logic: if there are mandatory articles today, quota is that count. Otherwise fallback to settings.
  const dailyTarget = todayMandatory.length > 0 ? todayMandatory.length : (settings?.daily_article_target || 5);

  return (
    <div className="space-y-6 pb-24 relative min-h-screen">
      <div className="flex items-center justify-between sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Leaderboard</h1>
      </div>

      <div className="space-y-3">
        {stats.filter(s => !bannedIds.has(s.user_id)).map((userStat, index) => (
          <div 
            key={userStat.user_id} 
            className={`flex items-center p-4 rounded-2xl border premium-card ${
              userStat.user_id === profile.id 
                ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)]' 
                : ''
            }`}
          >
            <div className="w-8 font-bold text-lg text-[var(--color-text-muted)]">
              #{index + 1}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[var(--color-text-primary)]">
                {userStat.display_name} {index === 0 && '👑'}
              </h2>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {userStat.total_articles_read} reads • {userStat.total_voice_notes} voice notes
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-accent)]">
              {userStat.total_points} <span className="text-sm">pts</span>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-8 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[var(--color-danger)]" /> Admin Overview
          </h1>
          <div className="premium-card p-5 rounded-2xl space-y-4">
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">
              Today's Mandatory Articles: {todayMandatory.length}
            </p>
            {members.filter(m => !m.banned).map(member => {
              const readCount = todayMandatory.filter(art => 
                todayInteractions.some(i => i.article_id === art.id && i.user_id === member.id && i.is_read)
              ).length;
              const allDone = todayMandatory.length > 0 && readCount === todayMandatory.length;
              
              return (
                <div key={member.id} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="font-bold text-[var(--color-text-primary)] flex-1">{member.display_name}</span>
                  <div className="flex items-center gap-3">
                    {!allDone && (
                      <button 
                        onClick={() => handleRemind(member)}
                        className="p-1.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition-colors btn-squish"
                        title="Send Reminder"
                      >
                        <BellRing className="w-4 h-4" />
                      </button>
                    )}
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${allDone ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {readCount} / {todayMandatory.length} read
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-8 mb-4">Your Progress</h1>

      <section className="premium-card p-5 rounded-2xl space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--color-success)]" />
            <h2 className="font-bold text-[var(--color-text-primary)]">Daily Quota</h2>
          </div>
          <span className="text-sm font-bold text-[var(--color-text-secondary)]">
            {myStats?.total_articles_read || 0} / {dailyTarget}
          </span>
        </div>
        <div className="h-3 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[var(--color-success)] transition-all duration-500" 
            style={{ width: `${Math.min(((myStats?.total_articles_read || 0) / dailyTarget) * 100, 100)}%` }} 
          />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="premium-card p-5 rounded-2xl flex flex-col items-center text-center">
          <Flame className="w-8 h-8 text-[var(--color-warning)] mb-2" />
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Streak</h2>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
            0 <span className="text-sm">days</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-tight">
            Computed dynamically <br/> in Phase 6 cron
          </p>
        </div>

        <div className="premium-card p-5 rounded-2xl flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-red-500 opacity-5" />
          <Frown className="w-8 h-8 text-[var(--color-danger)] mb-2 relative z-10" />
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider relative z-10">Laziness Index</h2>
          <div className="text-2xl font-bold text-[var(--color-danger)] mt-1 relative z-10">
            {(myStats?.total_missed || 0) * 10}%
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-tight relative z-10">
            {myStats?.total_missed || 0} missed articles
          </p>
        </div>
      </div>

    </div>
  );
}
