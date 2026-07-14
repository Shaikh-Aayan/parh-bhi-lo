import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { BookOpen, BarChart2, Settings, User, Radio, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('article_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      if (count !== null) setUnreadCount(count);
    };
    fetchUnread();
  }, [profile?.id]);

  return (
    <div className="pb-24"> {/* Padding for bottom bar */}
      <main className="max-w-md mx-auto p-4 min-h-screen">
        <div key={location.pathname} className="tab-fade">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto px-6 py-4 pb-safe glass-nav rounded-t-3xl flex justify-between items-center">
          
          <NavLink
            to="/"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
            }
          >
            <div className="relative">
              <BookOpen className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-[var(--color-danger)] text-white text-[9px] font-bold rounded-full px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Feed</span>
          </NavLink>

          <NavLink
            to="/stats"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
            }
          >
            <BarChart2 className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
          </NavLink>

          <NavLink
            to="/wall"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
            }
          >
            <Radio className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Wall</span>
          </NavLink>

          <NavLink
            to="/chat"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
            }
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
            }
          >
            {isAdmin ? <Settings className="w-6 h-6" /> : <User className="w-6 h-6" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isAdmin ? 'Settings' : 'Profile'}
            </span>
          </NavLink>

        </div>
      </nav>
    </div>
  );
}
