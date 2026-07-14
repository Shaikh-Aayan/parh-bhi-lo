import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Play, Pause, SmilePlus } from 'lucide-react';

export default function VoicePlayer({ voiceNote }) {
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const { data } = supabase.storage.from('voice-notes').getPublicUrl(voiceNote.storage_path);
    setAudioUrl(data.publicUrl);
    fetchReactions();
  }, [voiceNote]);

  const fetchReactions = async () => {
    const { data } = await supabase.from('voice_reactions').select('*').eq('voice_note_id', voiceNote.id);
    if (data) setReactions(data);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration || voiceNote.duration_seconds;
    setProgress((current / total) * 100);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--color-accent-light)]/50 border border-[var(--color-accent)]/20 rounded-2xl mt-3 relative overflow-hidden">
      {/* Decorative waveform background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q10 0 20 10 T40 10 T60 10 T80 10 T100 10' stroke='%236B7A3A' fill='none' stroke-width='2'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'center'
      }}></div>

      <div className="flex items-center gap-3 relative z-10">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md flex-shrink-0 btn-squish"
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
        </button>
        
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className="hidden"
          />
        )}
        
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-inner relative">
            <div 
              className="absolute top-0 left-0 bottom-0 bg-[var(--color-accent)] transition-all duration-75"
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] font-bold text-[var(--color-accent)]">
              {audioRef.current ? Math.floor(audioRef.current.currentTime) : 0}s
            </span>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
              {voiceNote.duration_seconds}s
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 relative z-10 pl-1">
        {['🔥', '👏', '😂', '🤔'].map(emoji => {
          const count = reactions.filter(r => r.emoji === emoji).length;
          return (
            <button key={emoji} className="px-2.5 py-1 rounded-full bg-white border border-[var(--color-border)] shadow-sm hover:border-[var(--color-accent)] text-xs transition-colors flex items-center gap-1 btn-squish">
              <span>{emoji}</span>
              {count > 0 && <span className="font-bold text-[var(--color-text-secondary)]">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
