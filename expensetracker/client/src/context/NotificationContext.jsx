import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, X, Bell, CheckCircle, Info, Trash2, Clock } from 'lucide-react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('notification_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('notification_history', JSON.stringify(history));
    }, [history]);

    const addNotification = useCallback((type, message) => {
        const id = Date.now();
        const newNotification = {
            id,
            type,
            message,
            timestamp: new Date().toISOString(),
            read: false
        };

        setNotifications((prev) => [...prev, newNotification]);
        setHistory((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50

        // Auto-remove from active toasts after 5 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, []);

    const markAllAsRead = useCallback(() => {
        setHistory((prev) => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    const togglePanel = useCallback(() => {
        setIsPanelOpen(prev => !prev);
        if (!isPanelOpen) {
            markAllAsRead();
        }
    }, [isPanelOpen, markAllAsRead]);

    const unreadCount = history.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            addNotification,
            removeNotification,
            history,
            isPanelOpen,
            togglePanel,
            unreadCount,
            clearHistory
        }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
                {notifications.map((notification) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>

            {/* Notification History Panel */}
            {isPanelOpen && (
                <NotificationPanel
                    history={history}
                    onClose={() => setIsPanelOpen(false)}
                    onClear={clearHistory}
                />
            )}
        </NotificationContext.Provider>
    );
};

const NotificationToast = ({ notification, onClose }) => {
    const { type, message } = notification;

    const getTypeStyles = () => {
        switch (type) {
            case 'warning':
                return {
                    bg: 'bg-[#111111]/95',
                    border: 'border-amber-500/30',
                    icon: <AlertCircle className="text-amber-500" size={20} />,
                    glow: 'shadow-amber-500/10'
                };
            case 'success':
                return {
                    bg: 'bg-[#111111]/95',
                    border: 'border-emerald-500/30',
                    icon: <CheckCircle className="text-emerald-500" size={20} />,
                    glow: 'shadow-emerald-500/10'
                };
            case 'info':
                return {
                    bg: 'bg-[#111111]/95',
                    border: 'border-[#15734C]/30',
                    icon: <Info className="text-[#10b981]" size={20} />,
                    glow: 'shadow-[#15734C]/10'
                };
            default:
                return {
                    bg: 'bg-[#111111]/95',
                    border: 'border-gray-500/30',
                    icon: <Bell className="text-gray-400" size={20} />,
                    glow: 'shadow-gray-500/10'
                };
        }
    };

    const styles = getTypeStyles();

    return (
        <div
            onClick={() => alert(`Details: ${message}`)}
            className={`
                pointer-events-auto cursor-pointer
                flex items-center gap-4 p-4 rounded-2xl border backdrop-blur-md
                animate-in slide-in-from-right duration-300
                max-w-md min-w-[300px] shadow-2xl hover:scale-[1.02] transition-all
                ${styles.bg} ${styles.border} ${styles.glow}
            `}
        >
            <div className="shrink-0">
                {styles.icon}
            </div>
            <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white leading-tight">
                    {message}
                </p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                className="shrink-0 p-1 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};

const NotificationPanel = ({ history, onClose, onClear }) => {
    return (
        <div className="fixed inset-0 z-100 flex items-start justify-end p-4 pointer-events-none">
            {/* Backdrop click to close */}
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

            <div className={`
                pointer-events-auto w-full max-w-sm h-fit max-h-[80vh] overflow-hidden
                flex flex-col rounded-3xl border border-[#15734C]/30 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-2xl
                animate-in slide-in-from-right-8 fade-in duration-300
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#15734C]/20 bg-[#15734C]/5">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-[#10b981]" />
                        <h3 className="font-bold text-white">Notifications</h3>
                        {history.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#15734C]/20 text-[#10b981] font-bold">
                                {history.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <button
                                onClick={onClear}
                                className="p-2 rounded-xl text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Clear all"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                            <div className="w-16 h-16 rounded-full bg-[#15734C]/5 flex items-center justify-center mb-4">
                                <Bell size={32} className="opacity-20" />
                            </div>
                            <p className="text-sm">No notifications yet</p>
                            <p className="text-xs opacity-60">Your history will appear here</p>
                        </div>
                    ) : (
                        history.map((n) => (
                            <div
                                key={n.id}
                                className={`
                                    group flex gap-3 p-4 rounded-2xl border transition-all duration-200
                                    ${n.read ? 'bg-white/[0.02] border-white/5' : 'bg-[#15734C]/5 border-[#15734C]/20'}
                                    hover:bg-white/[0.05] hover:border-[#15734C]/30
                                `}
                            >
                                <div className="shrink-0 mt-0.5">
                                    {n.type === 'warning' ? <AlertCircle size={16} className="text-amber-500" /> :
                                        n.type === 'success' ? <CheckCircle size={16} className="text-emerald-500" /> :
                                            <Info size={16} className="text-[#10b981]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-snug ${n.read ? 'text-gray-400' : 'text-white font-medium'}`}>
                                        {n.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                                        <Clock size={10} />
                                        <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span>•</span>
                                        <span>{new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/[0.02] border-t border-white/5">
                    <p className="text-[10px] text-center text-gray-500 italic">
                        All your recent activity at a glance
                    </p>
                </div>
            </div>
        </div>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
