import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Save, Plus, Trash2, ShieldAlert, BellRing } from 'lucide-react';

export default function Settings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // ALL useState hooks must be at the top — no hooks after early returns!
  const [settings, setSettings] = useState(null);
  const [tags, setTags] = useState([]);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B7A3A');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnExpireHours, setNewAnnExpireHours] = useState(24);
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [settingsRes, tagsRes, membersRes, annsRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('topic_tags').select('*').order('sort_order'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('announcements').select('*').order('created_at', { ascending: false })
    ]);
    if (settingsRes.data) setSettings(settingsRes.data);
    if (tagsRes.data) setTags(tagsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    if (annsRes.data) setAnnouncements(annsRes.data);
    setLoading(false);
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    await supabase.from('app_settings').update(settings).eq('id', 1);
    setSaving(false);
    alert('Settings saved! ✅');
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const { data } = await supabase.from('topic_tags').insert([
      { name: newTagName, color: newTagColor, sort_order: tags.length }
    ]).select().single();
    if (data) {
      setTags([...tags, data]);
      setNewTagName('');
    }
  };

  const handleDeleteTag = async (id) => {
    await supabase.from('topic_tags').update({ archived: true }).eq('id', id);
    setTags(tags.filter(t => t.id !== id));
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnContent.trim()) return;
    const expiresAt = newAnnExpireHours 
      ? new Date(Date.now() + newAnnExpireHours * 3600000).toISOString()
      : null;
    
    const { data } = await supabase.from('announcements').insert([{
      content: newAnnContent,
      expires_at: expiresAt,
      created_by: profile.id
    }]).select().single();

    if (data) {
      setAnnouncements([data, ...announcements]);
      setNewAnnContent('');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    await supabase.from('announcements').delete().eq('id', id);
    setAnnouncements(announcements.filter(a => a.id !== id));
  };

  const handleUpdateRole = async (memberId, newRole) => {
    if (!confirm(`Are you sure you want to make this user ${newRole}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
    if (!error) {
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } else {
      alert('Failed to update role');
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Your browser does not support Push Notifications.');
      return;
    }
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.error('SW registration failed:', err);
      }
    }
    const permission = await Notification.requestPermission();
    setNotifStatus(permission);
    if (permission === 'granted') {
      new Notification('PARH BHI LO! 📚', {
        body: 'Notifications chalu ho gayi! Ab koi deadline miss nahi hogi. 🔔',
      });
    }
  };

  // SettingRow defined as a regular function (not component) to avoid hooks-in-component issues
  const renderSettingRow = (label, type, objKey, { min, max, step } = {}) => (
    <div key={objKey} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
      <label className="text-sm font-semibold text-[var(--color-text-secondary)] pr-4">{label}</label>
      {type === 'toggle' ? (
        <button
          onClick={() => handleSettingChange(objKey, !settings[objKey])}
          className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${settings[objKey] ? 'bg-[var(--color-accent)]' : 'bg-[#D1D5DB]'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${settings[objKey] ? 'left-7' : 'left-1'}`} />
        </button>
      ) : (
        <input
          type="number"
          min={min} max={max} step={step}
          value={settings?.[objKey] ?? 0}
          onChange={e => handleSettingChange(objKey, type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
          className="w-20 flex-shrink-0 px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      )}
    </div>
  );

  // --- Early returns AFTER all hooks ---
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 premium-card rounded-2xl text-center mt-12">
        <ShieldAlert className="w-12 h-12 text-[var(--color-warning)] mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Member Profile</h1>
        <p className="text-[var(--color-text-secondary)] font-bold mb-6">
          Tum sirf parhne aaye ho. Settings admin ka kaam hai.
        </p>
        
        {/* PUSH NOTIFICATIONS FOR MEMBERS */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--color-border)] mb-6 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[var(--color-accent)]" /> Push Notifications
              </h3>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                {notifStatus === 'granted'
                  ? 'Active hai! Deadlines miss nahi hongi. 🔔'
                  : notifStatus === 'denied'
                    ? 'Blocked! Browser settings se manually allow karo.'
                    : 'Deadline se pehle phone par ping aayegi!'}
              </p>
            </div>
            {notifStatus === 'default' && (
              <button
                onClick={requestNotificationPermission}
                className="px-3 py-1.5 bg-[var(--color-accent-light)] text-[var(--color-accent)] border border-[var(--color-accent)] font-bold text-[10px] rounded-xl hover:bg-[var(--color-accent)] hover:text-white transition-colors btn-squish"
              >
                Enable
              </button>
            )}
            {notifStatus === 'granted' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Active ✅</span>
            )}
            {notifStatus === 'denied' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">Blocked ❌</span>
            )}
          </div>
        </div>

        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors btn-squish"
        >
          🚪 Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Admin Panel</h1>
          <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Control Everything</p>
        </div>
        {activeTab === 'rules' && (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white font-bold rounded-xl text-sm hover:bg-[var(--color-accent-hover)] transition-colors btn-squish"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
        {['rules', 'tags', 'announcements', 'members'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[80px] py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all btn-squish ${
              activeTab === tab
                ? 'bg-white shadow text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab === 'announcements' ? 'Anns' : tab}
          </button>
        ))}
      </div>

      {/* === RULES TAB === */}
      {activeTab === 'rules' && settings && (
        <div className="space-y-5">
          <section className="premium-card px-5 py-2 rounded-2xl">
            <h2 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mt-4 mb-1">Core Rules</h2>
            {renderSettingRow('Daily Article Target (Fallback)', 'number', 'daily_article_target')}
            {renderSettingRow('Default Deadline (Hours)', 'float', 'default_deadline_hours', { step: 0.5 })}
            {renderSettingRow('Grace Period (Hours)', 'float', 'grace_period_hours', { step: 0.5 })}
            {renderSettingRow('First N are Mandatory', 'number', 'default_mandatory_count')}
          </section>

          <section className="premium-card px-5 py-2 rounded-2xl">
            <h2 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mt-4 mb-1">Voice Notes</h2>
            {renderSettingRow('Voice Note Required (Default)', 'toggle', 'default_voice_note_required')}
            {renderSettingRow('Min Duration (Seconds)', 'number', 'default_voice_note_min_seconds')}
            {renderSettingRow('Max Duration (Seconds)', 'number', 'default_voice_note_max_seconds')}
          </section>

          <section className="premium-card px-5 py-2 rounded-2xl">
            <h2 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mt-4 mb-1">Scoring & Penalties</h2>
            {renderSettingRow('Points: Mandatory Read', 'number', 'points_mandatory_read')}
            {renderSettingRow('Points: Optional Read', 'number', 'points_optional_read')}
            {renderSettingRow('Points: Voice Note', 'number', 'points_voice_note')}
            {renderSettingRow('Penalty: Missed Mandatory', 'number', 'streak_penalty_mandatory')}
            {renderSettingRow('Penalty: Missed Optional', 'number', 'streak_penalty_optional')}
            {renderSettingRow('Optional Counts for Streaks', 'toggle', 'optional_counts_for_streak')}
          </section>

          <section className="premium-card px-5 py-2 rounded-2xl">
            <h2 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mt-4 mb-1">Notifications</h2>
            {renderSettingRow('Enable Push Notifications', 'toggle', 'notifications_enabled')}
            {renderSettingRow('Unread Reminder After (Hours)', 'float', 'unread_reminder_hours', { step: 0.5 })}
            {renderSettingRow('Voice Note Reminder After (Hours)', 'float', 'voice_note_reminder_hours', { step: 0.5 })}
          </section>
        </div>
      )}

      {/* === TAGS TAB === */}
      {activeTab === 'tags' && (
        <section className="premium-card px-5 py-4 rounded-2xl">
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Active Topic Tags</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.filter(t => !t.archived).map(tag => (
              <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${tag.color}15`, border: `1px solid ${tag.color}40` }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm font-bold" style={{ color: tag.color }}>{tag.name}</span>
                <button onClick={() => handleDeleteTag(tag.id)} className="ml-1 opacity-50 hover:opacity-100 btn-squish transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: tag.color }} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
            <input
              type="color"
              value={newTagColor}
              onChange={e => setNewTagColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer p-1 border border-[var(--color-border)]"
            />
            <input
              type="text"
              placeholder="New tag name..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTag()}
              className="flex-1 px-4 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <button
              onClick={handleAddTag}
              className="p-2.5 bg-[var(--color-accent-light)] text-[var(--color-accent)] rounded-xl hover:bg-[var(--color-accent)] hover:text-white transition-colors btn-squish"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>
      )}

      {/* === ANNOUNCEMENTS TAB === */}
      {activeTab === 'announcements' && (
        <section className="premium-card px-5 py-4 rounded-2xl">
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Manage Announcements</h2>
          
          <div className="mb-6 space-y-3 border-b border-[var(--color-border)] pb-6">
            <textarea
              placeholder="What's the announcement? (e.g., Kal chhutti hai!)"
              value={newAnnContent}
              onChange={e => setNewAnnContent(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">Expires In (Hours):</label>
              <input
                type="number"
                min="0"
                value={newAnnExpireHours}
                onChange={e => setNewAnnExpireHours(parseInt(e.target.value))}
                className="w-20 px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <span className="text-xs text-[var(--color-text-muted)]">(0 = never)</span>
            </div>
            <button
              onClick={handleAddAnnouncement}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors btn-squish"
            >
              <Plus className="w-5 h-5" /> Post Announcement
            </button>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center">No active announcements.</p>
            ) : announcements.map(ann => (
              <div key={ann.id} className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{ann.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {ann.expires_at ? `Expires: ${new Date(ann.expires_at).toLocaleString()}` : 'Never expires'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAnnouncement(ann.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 btn-squish"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === MEMBERS TAB === */}
      {activeTab === 'members' && (
        <section className="premium-card p-5 rounded-2xl">
          <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Registered Members ({members.length})</h2>
          <div className="space-y-3">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <div className="font-bold text-[var(--color-text-primary)]">{member.display_name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{member.email}</div>
                </div>
                {member.id !== profile.id ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border-2 ${
                      member.role === 'admin' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 focus:border-amber-400' 
                        : 'bg-blue-50 text-blue-600 border-blue-200 focus:border-blue-400'
                    }`}
                  >
                    <option value="member">MEMBER</option>
                    <option value="admin">ADMIN</option>
                  </select>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border-2 border-amber-200 opacity-50 cursor-not-allowed">
                    {member.role} (You)
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-6 text-center italic">
            Naye members add karne ke liye log out kar ke Sign Up page use karo.
          </p>
        </section>
      )}

      {/* PUSH NOTIFICATIONS */}
      <section className="premium-card p-5 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <BellRing className="w-5 h-5 text-[var(--color-accent)]" /> Push Notifications
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {notifStatus === 'granted'
                ? 'Active hai! Deadlines miss nahi hongi. 🔔'
                : notifStatus === 'denied'
                  ? 'Blocked! Browser settings se manually allow karo.'
                  : 'Deadline se pehle phone par ping aayegi!'}
            </p>
          </div>
          {notifStatus === 'default' && (
            <button
              onClick={requestNotificationPermission}
              className="px-4 py-2 bg-[var(--color-accent-light)] text-[var(--color-accent)] border border-[var(--color-accent)] font-bold text-sm rounded-xl hover:bg-[var(--color-accent)] hover:text-white transition-colors btn-squish"
            >
              Enable
            </button>
          )}
          {notifStatus === 'granted' && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Active ✅</span>
          )}
          {notifStatus === 'denied' && (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Blocked ❌</span>
          )}
        </div>
      </section>

      {/* LOGOUT */}
      <button
        onClick={async () => { await supabase.auth.signOut(); }}
        className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors btn-squish"
      >
        🚪 Log Out
      </button>
    </div>
  );
}
