import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Loader2, Send, Search, ArrowLeft, Hash, Trash2, MessageCircle } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

const AVATAR_COLORS = ['#6B7A3A', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#0EA5E9', '#10B981', '#EF4444', '#7C3AED', '#0D9488'];

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const avatarColor = (id = '') =>
  AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const dayLabel = (d) => {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
};

export default function Chat() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const me = profile?.id;
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // null = list, 'global' or userId
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [lastSeen, setLastSeen] = useState({});
  const messagesEndRef = useRef(null);

  // --- Unread tracking (per conversation, persisted locally) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pbl_lastseen_${me}`);
      if (raw) setLastSeen(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [me]);

  const persistLastSeen = useCallback((conv, ts) => {
    setLastSeen((prev) => {
      const next = { ...prev, [conv]: ts };
      try { localStorage.setItem(`pbl_lastseen_${me}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [me]);

  const bannedIds = useMemo(
    () => new Set(profiles.filter((p) => p.banned).map((p) => p.id)),
    [profiles]
  );

  const fetchInitial = async () => {
    const [{ data: profs }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('*').order('display_name'),
      supabase
        .from('chat_messages')
        .select('*, sender:profiles!sender_id(display_name, role, banned)')
        .or(`receiver_id.is.null, sender_id.eq.${me}, receiver_id.eq.${me}`)
        .order('created_at', { ascending: true }),
    ]);
    if (profs) setProfiles(profs);
    if (msgs) setAllMessages(msgs);
    setLoading(false);
  };

  useEffect(() => { if (me) fetchInitial(); }, [me]);

  // Mark conversation seen when opened
  useEffect(() => {
    if (activeChat) persistLastSeen(activeChat, new Date().toISOString());
  }, [activeChat, persistLastSeen]);

  // Realtime
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const m = payload.new;
        const isGlobal = m.receiver_id === null;
        if (!isGlobal && m.sender_id !== me && m.receiver_id !== me) return;

        const { data: senderInfo } = await supabase
          .from('profiles')
          .select('display_name, role, banned')
          .eq('id', m.sender_id)
          .single();

        setAllMessages((prev) => {
          const cleaned = prev.filter(
            (x) => !(x._temp && x.sender_id === m.sender_id && x.content === m.content)
          );
          if (cleaned.some((x) => x.id === m.id)) return cleaned;
          return [...cleaned, { ...m, sender: senderInfo }];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setAllMessages((prev) => prev.filter((x) => x.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [me]);

  useEffect(() => {
    if (activeChat) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, activeChat]);

  // --- Build conversations from messages ---
  const { conversations, thread } = useMemo(() => {
    const convMap = new Map();
    convMap.set('global', { key: 'global', msgs: [] });
    profiles.forEach((p) => {
      if (p.id !== me && !p.banned) convMap.set(p.id, { key: p.id, profile: p, msgs: [] });
    });

    allMessages
      .filter((m) => !m.sender?.banned)
      .forEach((m) => {
        const key = m.receiver_id === null ? 'global' : m.sender_id === me ? m.receiver_id : m.sender_id;
        const conv = convMap.get(key);
        if (conv) conv.msgs.push(m);
      });

    const list = Array.from(convMap.values());
    list.forEach((c) => {
      c.lastMsg = c.msgs[c.msgs.length - 1] || null;
      const seen = lastSeen[c.key] ? new Date(lastSeen[c.key]) : new Date(0);
      c.unread = c.msgs.filter((m) => m.sender_id !== me && new Date(m.created_at) > seen).length;
    });
    list.sort((a, b) => {
      const ta = a.lastMsg ? new Date(a.lastMsg.created_at).getTime() : 0;
      const tb = b.lastMsg ? new Date(b.lastMsg.created_at).getTime() : 0;
      return tb - ta;
    });

    return { conversations: list, thread: activeChat ? convMap.get(activeChat) || null : null };
  }, [allMessages, profiles, me, bannedIds, lastSeen, activeChat]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const receiver_id = activeChat === 'global' ? null : activeChat;
    const temp = {
      id: `temp-${Date.now()}`,
      _temp: true,
      content: newMessage,
      sender_id: me,
      receiver_id,
      created_at: new Date().toISOString(),
      sender: { display_name: profile.display_name, role: profile.role },
    };
    setAllMessages((prev) => [...prev, temp]);
    setNewMessage('');

    const { error } = await supabase.from('chat_messages').insert([{ content: newMessage, sender_id: me, receiver_id }]);
    if (error) {
      setAllMessages((prev) => prev.filter((x) => x.id !== temp.id));
      addToast('Message nahi bheja ja saka.', 'error');
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm('Delete this message?')) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) addToast('Delete fail ho gaya.', 'error');
  };

  const preview = (m) => {
    if (!m) return 'No messages yet';
    const who = m.sender_id === me ? 'You: ' : m.sender?.display_name ? `${m.sender.display_name.split(' ')[0]}: ` : '';
    return who + m.content;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  // ===================== THREAD VIEW =====================
  if (activeChat) {
    const msgs = thread?.msgs || [];
    const other = activeChat === 'global' ? null : profiles.find((p) => p.id === activeChat);
    const title = activeChat === 'global' ? 'Global Chat' : other?.display_name || 'Unknown';
    const subtitle = activeChat === 'global' ? 'Baat cheet for everyone!' : 'Private Direct Message';

    return (
      <div className="flex flex-col h-[calc(100vh-80px)] -mx-4 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] sticky top-0 z-10 flex-shrink-0">
          <button onClick={() => setActiveChat(null)} className="btn-squish p-2 -ml-2 rounded-full hover:bg-white transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
          </button>
          {activeChat === 'global' ? (
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: avatarColor(activeChat) }}
            >
              {initials(other?.display_name)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-black text-base text-[var(--color-text-primary)] truncate">{title}</h2>
            <p className="text-[11px] text-[var(--color-text-muted)] font-bold truncate">{subtitle}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {msgs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] opacity-50">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p className="font-bold">Koi message nahi. Be the first!</p>
            </div>
          ) : (
            msgs.map((msg, i) => {
              const isMe = msg.sender_id === me;
              const prev = msgs[i - 1];
              const showDay = !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !== format(new Date(msg.created_at), 'yyyy-MM-dd');
              const showName = !isMe && (!prev || prev.sender_id !== msg.sender_id);
              return (
                <div key={msg.id}>
                  {showDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider bg-white px-3 py-1 rounded-full border border-[var(--color-border)]">
                        {dayLabel(new Date(msg.created_at))}
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && (
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] ml-3 mb-0.5">
                        {msg.sender?.display_name || 'Unknown'} {msg.sender?.role === 'admin' && '👑'}
                      </span>
                    )}
                    <div className={`relative group max-w-[78%] rounded-2xl px-4 py-2 shadow-sm ${
                      isMe
                        ? 'bg-gradient-to-br from-[var(--color-accent)] to-[#4a5428] text-white rounded-br-sm'
                        : 'bg-white border border-[#E5E7EB] text-[#1F2937] rounded-bl-sm'
                    }`}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`text-[9px] font-bold mt-1 opacity-75 flex justify-end ${isMe ? 'text-green-100' : 'text-gray-400'}`}>
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </div>
                      {(isMe || isAdmin) && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className={`absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 ${isMe ? '-left-12' : '-right-12'}`}
                          title="Delete Message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="w-11 h-11 flex items-center justify-center bg-[var(--color-accent)] text-white rounded-full hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-all btn-squish flex-shrink-0"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ===================== CONVERSATION LIST =====================
  const dmConvs = conversations.filter((c) => c.key !== 'global');
  const filteredDms = dmConvs.filter((c) =>
    c.profile?.display_name?.toLowerCase().includes(search.toLowerCase())
  );
  const globalConv = conversations.find((c) => c.key === 'global');

  return (
    <div className="space-y-4 pb-24 relative min-h-screen">
      <div className="flex items-center justify-between sticky top-0 glass-nav -mx-4 px-4 pt-4 pb-2 z-10">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-[var(--color-accent)]" /> Chats
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Global chat */}
      {globalConv && (
        <button
          onClick={() => setActiveChat('global')}
          className="w-full flex items-center gap-3 p-3 premium-card rounded-2xl hover:shadow-md transition-shadow text-left relative"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center flex-shrink-0">
            <Hash className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-text-primary)]">Global Chat</h3>
              {globalConv.lastMsg && (
                <span className="text-[10px] text-[var(--color-text-muted)] font-bold">
                  {format(new Date(globalConv.lastMsg.created_at), 'h:mm a')}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{preview(globalConv.lastMsg)}</p>
          </div>
          {globalConv.unread > 0 && (
            <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {globalConv.unread}
            </span>
          )}
        </button>
      )}

      {/* DM list */}
      {filteredDms.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8 font-bold">
          {search ? 'Koi member nahi mila.' : 'Kisi se bhi DM shuru karo! 👇'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredDms.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveChat(c.key)}
              className="w-full flex items-center gap-3 p-3 premium-card rounded-2xl hover:shadow-md transition-shadow text-left relative"
            >
              <div
                className="w-12 h-12 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0"
                style={{ backgroundColor: avatarColor(c.key) }}
              >
                {initials(c.profile?.display_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[var(--color-text-primary)] truncate">
                    {c.profile?.display_name} {c.profile?.role === 'admin' && '👑'}
                  </h3>
                  {c.lastMsg && (
                    <span className="text-[10px] text-[var(--color-text-muted)] font-bold">
                      {format(new Date(c.lastMsg.created_at), 'h:mm a')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">{preview(c.lastMsg)}</p>
              </div>
              {c.unread > 0 && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
