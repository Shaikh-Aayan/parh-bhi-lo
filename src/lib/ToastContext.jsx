import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto toast-enter overflow-hidden
              flex items-start justify-between gap-3 p-4 rounded-2xl shadow-xl border-2
              ${toast.type === 'success' ? 'bg-[#58CC02] border-[#58CC02] text-white shadow-[#58CC02]/20' : ''}
              ${toast.type === 'error' ? 'bg-[#FF4B4B] border-[#FF4B4B] text-white shadow-[#FF4B4B]/20' : ''}
              ${toast.type === 'warning' ? 'bg-[#FFC800] border-[#FFC800] text-[#AF8900] shadow-[#FFC800]/20' : ''}
              ${toast.type === 'info' ? 'bg-[#CE82FF] border-[#CE82FF] text-white shadow-[#CE82FF]/20' : ''}
            `}
          >
            <div className="flex-1 font-bold text-sm leading-tight pt-0.5">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity p-1 -mr-2 -mt-2"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Progress bar line at the bottom */}
            <div 
              className="absolute bottom-0 left-0 h-1 bg-black/20"
              style={{
                animation: `toast-progress ${toast.duration}ms linear forwards`
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
