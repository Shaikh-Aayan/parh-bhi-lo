import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VoiceRecorder({ article, onRecorded }) {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleStop;

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        if (mountedRef.current) setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      addToast('Microphone access denied or not available.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleStop = async () => {
    if (!mountedRef.current) return;
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setUploading(true);

    const fileName = `${profile.id}/${article.id}-${Date.now()}.webm`;
    let storagePath = null;

    try {
      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;
      storagePath = fileName;

      const { data, error: dbError } = await supabase
        .from('voice_notes')
        .insert([{
          article_id: article.id,
          user_id: profile.id,
          storage_path: fileName,
          duration_seconds: duration,
          points_earned: article.points_for_voice_note
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      if (onRecorded && mountedRef.current) onRecorded(data);
    } catch (err) {
      console.error('Upload failed:', err);
      // Clean up orphaned storage file if we uploaded but DB insert failed
      if (storagePath) {
        await supabase.storage.from('voice-notes').remove([storagePath]);
      }
      if (mountedRef.current) {
        addToast('Failed to save voice note.', 'error');
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (uploading) {
    return (
      <div className="flex items-center gap-2 py-2 px-4 bg-[var(--color-accent-light)] text-[var(--color-accent)] rounded-xl text-sm font-bold animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--color-bg-primary)] p-2 rounded-2xl border border-[var(--color-border)] shadow-sm">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`flex items-center justify-center w-12 h-12 rounded-full transition-all btn-squish flex-shrink-0 ${
          recording
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 relative recording-glow'
            : 'bg-[var(--color-accent-light)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
        }`}
      >
        {recording ? (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-75"></span>
            <Square className="w-5 h-5 relative z-10" fill="currentColor" />
          </>
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      <div className="flex-1 flex items-center justify-between pr-4">
        {recording ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-500 font-bold tracking-widest tabular-nums">{formatTime(duration)}</span>
          </div>
        ) : (
          <span className="text-sm font-bold text-[var(--color-text-secondary)]">Tap to record voice note</span>
        )}
      </div>
    </div>
  );
}
