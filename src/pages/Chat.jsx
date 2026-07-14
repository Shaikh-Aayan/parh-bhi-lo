import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Send, MessageCircle, Hash, Users, ShieldAlert, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Chat() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  
  // 'global' or profile.id
  const [activeChat, setActiveChat] = useState('global');
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      subscribeToMessages();
    }
  }, [loading, activeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchInitialData = async () => {
    const { data: profs } = await supabase.from('profiles').select('*').order('display_name');
    if (profs) setProfiles(profs);
    await fetchMessages('global');
    setLoading(false);
  };

  const fetchMessages = async (chatTarget) => {
    let query = supabase.from('chat_messages').select('*, sender:profiles!sender_id(*)').order('created_at', { ascending: true });
    
    if (chatTarget === 'global') {
      query = query.is('receiver_id', null);
    } else {
      query = query.or(`and(sender_id.eq.${profile.id},receiver_id.eq.${chatTarget}),and(sender_id.eq.${chatTarget},receiver_id.eq.${profile.id})`);
    }

    const { data } = await query;
    if (data) setMessages(data);
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const newMsg = payload.new;
        
        // Ensure the message belongs in the current view
        const isGlobalView = activeChat === 'global';
        const isGlobalMsg = newMsg.receiver_id === null;
        
        let shouldAdd = false;
        if (isGlobalView && isGlobalMsg) shouldAdd = true;
        if (!isGlobalView && !isGlobalMsg && (
          (newMsg.sender_id === profile.id && newMsg.receiver_id === activeChat) ||
          (newMsg.sender_id === activeChat && newMsg.receiver_id === profile.id)
        )) shouldAdd = true;

        if (shouldAdd) {
          // Fetch sender info to display properly
          const { data: senderInfo } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).single();
          setMessages(prev => [...prev, { ...newMsg, sender: senderInfo }]);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const handleChatSwitch = async (chatTarget) => {
    setActiveChat(chatTarget);
    setLoading(true);
    await fetchMessages(chatTarget);
    setLoading(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const payload = {
      content: newMessage,
      sender_id: profile.id,
      receiver_id: activeChat === 'global' ? null : activeChat
    };

    setNewMessage(''); // Optimistic clear

    const { error } = await supabase.from('chat_messages').insert([payload]);
    if (error) {
      console.error("Failed to send message", error);
      alert('Failed to send message');
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm('Delete this message?')) return;
    await supabase.from('chat_messages').delete().eq('id', id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  const getActiveChatName = () => {
    if (activeChat === 'global') return 'Global Chat';
    const p = profiles.find(p => p.id === activeChat);
    return p ? p.display_name : 'Unknown User';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] relative overflow-hidden -mx-4">
      {/* Top Bar / Channels */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] sticky top-0 z-10 flex-shrink-0 hide-scrollbar">
        <button
          onClick={() => handleChatSwitch('global')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors btn-squish ${
            activeChat === 'global' 
              ? 'bg-[var(--color-accent)] text-white shadow-md' 
              : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
        >
          <Hash className="w-4 h-4" /> Global
        </button>
        
        <div className="w-px h-6 bg-[var(--color-border)] mx-1" />
        
        {profiles.filter(p => p.id !== profile.id).map(p => (
          <button
            key={p.id}
            onClick={() => handleChatSwitch(p.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors btn-squish ${
              activeChat === p.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-[var(--color-text-secondary)] border border-[var(--color-border)]'
            }`}
          >
            <Users className="w-4 h-4" /> {p.display_name}
          </button>
        ))}
      </div>

      {/* Header Context */}
      <div className="px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-[var(--color-border)] flex-shrink-0">
        <h2 className="font-black text-lg text-[var(--color-text-primary)] flex items-center gap-2">
          {activeChat === 'global' ? <Hash className="text-[var(--color-accent)]" /> : <Users className="text-purple-600" />}
          {getActiveChatName()}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] font-bold">
          {activeChat === 'global' ? 'Baat cheet for everyone!' : 'Private Direct Message'}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] opacity-50">
            <MessageCircle className="w-12 h-12 mb-2" />
            <p className="font-bold">Koi message nahi. Be the first!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === profile.id;
            const showName = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
            const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1].sender_id !== msg.sender_id);
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1`}>
                {showName && (
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] ml-3 mb-0.5">
                    {msg.sender?.display_name || 'Unknown'} {msg.sender?.role === 'admin' && '👑'}
                  </span>
                )}
                <div className={`relative group max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMe 
                    ? 'bg-gradient-to-br from-[var(--color-accent)] to-[#4a5428] text-white rounded-br-sm ml-auto' 
                    : 'bg-white border border-[#E5E7EB] text-[#1F2937] rounded-bl-sm mr-auto'
                }`}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  
                  <div className={`text-[9px] font-bold mt-1 opacity-75 flex justify-end gap-1 ${isMe ? 'text-green-100' : 'text-gray-400'}`}>
                    <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                  </div>

                  {(isMe || isAdmin) && (
                    <button 
                      onClick={() => deleteMessage(msg.id)}
                      className={`absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 ${
                        isMe ? '-left-12' : '-right-12'
                      }`}
                      title="Delete Message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
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
