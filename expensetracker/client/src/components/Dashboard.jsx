import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell, Sun, Moon, Search, List,
  TrendingUp, Wallet, PieChart, ArrowUpRight, ArrowDownLeft,
  ShoppingCart, Car, Utensils, Briefcase, Plane, Zap, Film, Heart, Gift,
  Gamepad2, Wifi, Phone, CreditCard, ChevronRight, Plus, X, Edit3,
  FileText, Tag, IndianRupee, Calendar, ArrowUpDown
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('expense_track_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Category icons mapping
const categoryIcons = {
  "Shopping": ShoppingCart,
  "Food": Utensils,
  "Transport": Car,
  "Travel": Plane,
  "Bills": Zap,
  "Entertainment": Film,
  "Healthcare": Heart,
  "Salary": Briefcase,
  "Investment": TrendingUp,
  "Gifts": Gift,
  "Gaming": Gamepad2,
  "Internet": Wifi,
  "Phone": Phone,
  "Other": CreditCard
};

// Category colors mapping
const categoryColors = {
  "Shopping": "#8b5cf6",
  "Food": "#f97316",
  "Transport": "#3b82f6",
  "Travel": "#06b6d4",
  "Bills": "#f59e0b",
  "Entertainment": "#ec4899",
  "Healthcare": "#ef4444",
  "Salary": "#10b981",
  "Investment": "#22c55e",
  "Gifts": "#f43f5e",
  "Gaming": "#6366f1",
  "Internet": "#14b8a6",
  "Phone": "#8b5cf6",
  "Other": "#6b7280"
};

// ===========================================
// REUSABLE COMPONENTS
// ===========================================

// Dashboard Card Component
const DashboardCard = ({ icon: Icon, title, value, color, isDarkMode, isMain = false }) => {
  const colorStyles = {
    purple: {
      iconBg: 'bg-gradient-to-br from-[#15734C] to-[#10b981]',
      border: 'border-l-[#15734C]',
      iconColor: 'text-white'
    },
    emerald: {
      iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      border: 'border-l-emerald-500',
      iconColor: 'text-white'
    },
    rose: {
      iconBg: 'bg-gradient-to-br from-rose-400 to-pink-500',
      border: 'border-l-rose-500',
      iconColor: 'text-white'
    }
  };

  const styles = colorStyles[color] || colorStyles.purple;

  if (isMain) {
    return (
      <div className={`
        group relative rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#15734C]/10
        ${isDarkMode
          ? 'bg-linear-to-br from-[#15734C] to-[#0f5a3b]'
          : 'bg-linear-to-br from-[#15734C] to-[#10b981]'}
      `}>
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <Icon size={16} className="text-white/70 sm:w-5 sm:h-5" />
            <p className="text-xs sm:text-sm font-medium text-white/70">{title}</p>
          </div>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">{value}</p>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-300" />
        <div className="absolute right-8 sm:right-12 bottom-3 sm:bottom-4 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className={`
      group relative rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border-l-4 overflow-hidden cursor-pointer
      transition-all duration-200 ease-out
      hover:-translate-y-0.5 hover:shadow-lg
      ${isDarkMode
        ? 'bg-slate-800/80 hover:shadow-[#15734C]/5'
        : 'bg-white shadow-sm hover:shadow-[#15734C]/10'}
      ${styles.border}
    `}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs sm:text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
          <p className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg ${styles.iconBg}`}>
          <Icon size={18} className={`${styles.iconColor} sm:w-5 sm:h-5 md:w-[22px] md:h-[22px]`} />
        </div>
      </div>
    </div>
  );
};

// Chart Card Component
const ChartCard = ({ title, subtitle, children, isDarkMode, className = "", headerRight }) => (
  <div className={`
    rounded-2xl p-6 transition-all duration-300 border
    ${isDarkMode
      ? 'bg-[#111111] border-[#15734C]/20 hover:border-[#15734C]/40'
      : 'bg-[#111111] border-[#15734C]/20 hover:border-[#15734C]/40 hover:shadow-lg hover:shadow-[#15734C]/10'}
    ${className}
  `}>
    <div className="flex items-start justify-between mb-6">
      <div>
        <h3 className="text-base font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm mt-0.5 text-[#10b981]/70">{subtitle}</p>}
      </div>
      {headerRight}
    </div>
    {children}
  </div>
);

// Transaction Item Component
const TransactionItem = ({ tx, isDarkMode, formatDate }) => {
  const Icon = categoryIcons[tx.category] || CreditCard;
  const color = categoryColors[tx.category] || "#6b7280";

  return (
    <div className={`
      group px-5 py-4 flex items-center gap-4 cursor-pointer
      transition-all duration-200
      ${isDarkMode
        ? 'hover:bg-slate-700/50'
        : 'hover:bg-[#15734C]/5'}
    `}>
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: isDarkMode ? `${color}20` : `${color}12` }}
      >
        <Icon size={20} style={{ color }} />
      </div>

      {/* Description & Date */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          {tx.name}
        </p>
        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {formatDate(tx.date)}
        </p>
      </div>

      {/* Category Badge */}
      <div className="hidden sm:block">
        <span className={`
          text-xs px-3 py-1.5 rounded-full font-medium
          ${isDarkMode
            ? 'bg-[#15734C]/20 text-[#10b981]'
            : 'bg-[#15734C]/10 text-[#15734C]'}
        `}>
          {tx.category}
        </span>
      </div>

      {/* Payment Method */}
      <div className="hidden lg:block w-20">
        <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {tx.paymentmethod || 'Cash'}
        </span>
      </div>

      {/* Amount */}
      <p className={`font-bold text-sm shrink-0 min-w-20 text-right ${tx.type === "income" ? 'text-emerald-500' : 'text-rose-500'}`}>
        {tx.type === "income" ? '+' : '-'}₹{tx.amount?.toLocaleString()}
      </p>
    </div>
  );
};

// ===========================================
// MAIN DASHBOARD COMPONENT
// ===========================================

const Dashboard = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useUser();
  const { addNotification, togglePanel, unreadCount } = useNotification();
  const notifiedCategories = React.useRef(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Shopping",
    amount: "",
    type: "expense",
    method: "UPI",
    date: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    categoryBreakdown: [],
    monthlyTrend: [],
    recentTransactions: []
  });

  // Filter transactions based on search query
  const filteredTransactions = React.useMemo(() => {
    if (!searchQuery.trim()) return stats.recentTransactions;
    const query = searchQuery.toLowerCase();
    return stats.recentTransactions?.filter(tx => 
      tx.name?.toLowerCase().includes(query) ||
      tx.category?.toLowerCase().includes(query) ||
      tx.type?.toLowerCase().includes(query) ||
      tx.amount?.toString().includes(query)
    ) || [];
  }, [stats.recentTransactions, searchQuery]);

  // Category config for the form
  const categoryConfig = [
    "Shopping", "Food", "Transport", "Travel", "Bills", "Entertainment",
    "Healthcare", "Salary", "Investment", "Gifts", "Gaming", "Internet", "Phone", "Other"
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [statsRes, budgetRes] = await Promise.all([
        fetch(`${API_BASE}/transactions/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/budgets/analysis`, { headers: getAuthHeaders() })
      ]);

      if (!statsRes.ok || !budgetRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const statsData = await statsRes.json();
      const budgetData = await budgetRes.json();

      setStats(statsData);

      // Check for budget alerts (80% threshold)
      if (budgetData.categoryAnalysis) {
        budgetData.categoryAnalysis.forEach(cat => {
          if (cat.percentage >= 80 && !notifiedCategories.current.has(cat.categoryName)) {
            const message = cat.percentage >= 100
              ? `Critical: You have exceeded your budget for ${cat.categoryName}!`
              : `Alert: You've used ${cat.percentage}% of your budget for ${cat.categoryName}!`;

            addNotification('warning', message);
            notifiedCategories.current.add(cat.categoryName);
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Form handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      category: "Shopping",
      amount: "",
      type: "expense",
      method: "UPI",
      date: new Date().toISOString().split('T')[0]
    });
  };

  const openAddModal = (type = "expense") => {
    resetForm();
    setForm(prev => ({ ...prev, type }));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form)
      });

      if (response.ok) {
        await fetchStats();
        resetForm();
        setShowModal(false);
      }
    } catch (error) {
      console.error("Failed to create transaction:", error);
    }
  };

  // Helper functions
  const getInitials = (name) => {
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount?.toLocaleString() || 0}`;
  };

  // Generate pie chart conic gradient
  const generatePieSegments = () => {
    if (!stats.categoryBreakdown || stats.categoryBreakdown.length === 0) {
      return isDarkMode ? "rgb(51 65 85) 0deg 360deg" : "rgb(237 233 254) 0deg 360deg";
    }
    const total = stats.categoryBreakdown.reduce((sum, c) => sum + c.total, 0);
    let acc = 0;
    return stats.categoryBreakdown.map((c) => {
      const start = (acc / total) * 360;
      acc += c.total;
      const end = (acc / total) * 360;
      const color = categoryColors[c._id] || "#6b7280";
      return `${color} ${start}deg ${end}deg`;
    }).join(", ");
  };

  // Calculate total investment
  const totalInvestment = stats.categoryBreakdown?.find(c => c._id === "Investment")?.total || 0;

  // Get chart max value for bar heights
  const maxTrend = stats.monthlyTrend?.length > 0
    ? Math.max(...stats.monthlyTrend.map(m => Math.max(m.income || 0, m.expense || 0)), 1000)
    : 10000;

  return (
    <main className={`
      min-h-screen pb-24 lg:pb-0
      lg:ml-64 xl:ml-72
      w-full lg:w-[calc(100%-16rem)] xl:w-[calc(100%-18rem)]
      transition-colors duration-300 
      ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
    `}>

      {/* TOP BAR - Desktop Only */}
      <header className={`
        hidden lg:block sticky top-0 z-30 px-4 lg:px-6 py-4 border-b
        bg-[#0a0a0a]/95 border-[#15734C]/30 backdrop-blur-xl
      `}>
        <div className="flex items-center justify-between gap-4">
          {/* Greeting */}
          <div>
            <h1 className="text-lg xl:text-xl font-semibold text-white">
              Hi, {user?.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="text-xs md:text-sm text-[#10b981]">
              Welcome back to your dashboard
            </p>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 bg-[#111111] border-[#15734C]/20 focus-within:border-[#15734C]/50">
              <Search size={18} className="text-[#10b981]" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="w-5 h-5 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition-colors"
                >
                  <X size={12} className="text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${isDarkMode ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-[#15734C]/10 text-slate-500'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={togglePanel}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 bg-[#15734C]/10 text-[#10b981] border border-[#15734C]/20 hover:bg-[#15734C]/20"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#15734C] rounded-full ring-2 ring-[#0a0a0a]" />
              )}
            </button>
            <Link to="/profile">
              <div className={`w-10 h-10 rounded-xl overflow-hidden ring-2 transition-all duration-200 ${isDarkMode ? 'ring-slate-700 hover:ring-[#15734C]/50' : 'ring-[#15734C]/20 hover:ring-[#15734C]/40'}`}>
                {user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="User" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-medium bg-linear-to-br from-[#15734C] to-[#10b981] text-white">
                    {getInitials(user?.name || "User")}
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="w-full">

          {/* Mobile: Compact padding, Desktop: Generous padding */}
          <div className="px-4 py-4 lg:px-6 lg:py-6 space-y-5 lg:space-y-6">

            {/* ======================= */}
            {/* MAIN BALANCE CARD - Featured */}
            {/* ======================= */}
            <div className={`
              relative rounded-2xl p-4 sm:p-5 lg:p-6 overflow-hidden
              bg-linear-to-br from-[#0a0a0a] via-[#151515] to-[#1a1a1a]
              shadow-xl shadow-black/30
              border border-[#15734C]/20
            `}>
              {/* Background decorative elements */}
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5" />
              <div className="absolute right-4 bottom-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="absolute left-1/3 top-1/2 w-16 h-16 rounded-full bg-white/5" />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4 mb-5 lg:mb-6">
                  <div>
                    <p className="text-white/70 text-xs sm:text-sm font-medium mb-2">Total Balance</p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                      {loading ? "..." : formatCurrency(stats.balance)}
                    </h2>
                  </div>
                  <button className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <ArrowDownLeft size={14} className="text-emerald-300 sm:w-4 sm:h-4" />
                      </div>
                      <span className="text-white/70 text-[10px] sm:text-xs font-medium">Income</span>
                    </div>
                    <p className="text-white text-lg sm:text-xl lg:text-2xl font-bold">
                      {loading ? "..." : formatCurrency(stats.monthlyIncome)}
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <ArrowUpRight size={14} className="text-rose-300 sm:w-4 sm:h-4" />
                      </div>
                      <span className="text-white/70 text-[10px] sm:text-xs font-medium">Expense</span>
                    </div>
                    <p className="text-white text-lg sm:text-xl lg:text-2xl font-bold">
                      {loading ? "..." : formatCurrency(stats.monthlyExpense)}
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <TrendingUp size={14} className="text-indigo-300 sm:w-4 sm:h-4" />
                      </div>
                      <span className="text-white/70 text-[10px] sm:text-xs font-medium">Investment</span>
                    </div>
                    <p className="text-white text-lg sm:text-xl lg:text-2xl font-bold">
                      {loading ? "..." : formatCurrency(totalInvestment)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================= */}
            {/* ACTION BUTTONS */}
            {/* ======================= */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={() => openAddModal("expense")}
                className={`
                px-4 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-sm
                transition-all duration-200 hover:scale-[0.98] active:scale-95
                ${isDarkMode
                    ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'}
              `}>
                <span className="flex items-center justify-center gap-2">
                  <span className="text-lg">−</span> Add Expense
                </span>
              </button>

              <button
                onClick={() => openAddModal("income")}
                className={`
                px-4 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-sm
                transition-all duration-200 hover:scale-[0.98] active:scale-95
                ${isDarkMode
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}
              `}>
                <span className="flex items-center justify-center gap-2">
                  <span className="text-lg">+</span> Add Income
                </span>
              </button>
            </div>

            {/* ======================= */}
            {/* SPENDING BY CATEGORY */}
            {/* ======================= */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Spending by Category
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {loading ? (
                  <div className="col-span-full flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-[#15734C] border-t-transparent rounded-full" />
                  </div>
                ) : stats.categoryBreakdown?.length > 0 ? (
                  stats.categoryBreakdown.map((cat) => {
                    const Icon = categoryIcons[cat._id] || CreditCard;
                    const color = categoryColors[cat._id] || "#6b7280";
                    const total = stats.categoryBreakdown.reduce((sum, c) => sum + c.total, 0);
                    const percentage = total > 0 ? ((cat.total / total) * 100).toFixed(0) : 0;

                    return (
                      <div
                        key={cat._id}
                        className="p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer bg-[#111111] border border-[#15734C]/20 hover:border-[#15734C]/40 hover:shadow-lg hover:shadow-[#15734C]/10 hover:scale-[1.02] active:scale-95 group"
                      >
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Icon size={22} style={{ color }} className="sm:w-6 sm:h-6" />
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-center mb-1 truncate text-white">
                          {cat._id}
                        </h3>
                        <p className="text-base sm:text-lg font-bold text-center mb-1 text-[#10b981]">
                          ₹{cat.total.toLocaleString()}
                        </p>
                        <p className="text-xs text-center font-bold text-rose-400">
                          {percentage}%
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12 bg-[#111111] rounded-2xl border border-[#15734C]/20">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[#15734C]/20">
                      <PieChart size={28} className="text-[#15734C]" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">No spending data</p>
                    <p className="text-xs text-gray-500">Start adding expenses to see category breakdown</p>
                  </div>
                )}
              </div>
            </div>

            {/* ======================= */}
            {/* ANALYTICS SECTION (Desktop Only) */}
            {/* ======================= */}
            <div className="hidden lg:grid lg:grid-cols-2 gap-4 lg:gap-6">

              {/* Bar Chart - Monthly Expenses */}
              <ChartCard
                title="Monthly Expenses"
                subtitle="Income vs Expense comparison"
                isDarkMode={isDarkMode}
                headerRight={
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#15734C] to-[#10b981]" />
                      <span className="text-xs font-medium text-gray-400">Income</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-rose-500 to-red-500" />
                      <span className="text-xs font-medium text-gray-400">Expense</span>
                    </div>
                  </div>
                }
              >
                <div className="flex items-end gap-3 h-52 lg:h-64 overflow-x-auto pb-2">
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="animate-spin w-6 h-6 border-2 border-[#15734C] border-t-transparent rounded-full" />
                    </div>
                  ) : stats.monthlyTrend?.length > 0 ? (
                    stats.monthlyTrend.map((month, index) => (
                      <div key={index} className="flex-1 min-w-10 flex flex-col items-center gap-3">
                        <div className="w-full flex gap-1 items-end justify-center h-40 lg:h-48">
                          <div
                            className="flex-1 max-w-5 rounded-t-lg bg-linear-to-t from-[#15734C] to-[#10b981] transition-all duration-300 hover:from-[#10b981] hover:to-[#15734C] cursor-pointer shadow-lg shadow-[#15734C]/20"
                            style={{ height: `${Math.max(((month.income || 0) / maxTrend) * 100, 4)}%` }}
                            title={`Income: ₹${month.income?.toLocaleString()}`}
                          />
                          <div
                            className="flex-1 max-w-5 rounded-t-lg bg-linear-to-t from-rose-500 to-rose-400 transition-all duration-300 hover:from-rose-400 hover:to-rose-300 cursor-pointer shadow-lg shadow-rose-500/20"
                            style={{ height: `${Math.max(((month.expense || 0) / maxTrend) * 100, 4)}%` }}
                            title={`Expense: ₹${month.expense?.toLocaleString()}`}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500">
                          {month._id?.month || month.month}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                      <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center bg-[#15734C]/20">
                        <TrendingUp size={28} className="text-[#15734C]" />
                      </div>
                      <p className="text-sm font-bold text-white mb-1">No data available</p>
                      <p className="text-xs text-gray-500">Add transactions to see trends</p>
                    </div>
                  )}
                </div>
              </ChartCard>

              {/* Pie Chart - Category Distribution */}
              <ChartCard
                title="Category-wise Expense"
                subtitle="Spending distribution"
                isDarkMode={isDarkMode}
              >
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Pie */}
                  <div
                    className="w-36 h-36 lg:w-40 lg:h-40 rounded-full shrink-0 transition-transform duration-300 hover:scale-105 cursor-pointer"
                    style={{
                      backgroundImage: `conic-gradient(${generatePieSegments()})`,
                      boxShadow: 'inset 0 0 0 24px #111111'
                    }}
                  />

                  {/* Legend */}
                  <div className="flex-1 w-full space-y-2 max-h-48 overflow-y-auto">
                    {loading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin w-5 h-5 border-2 border-[#15734C] border-t-transparent rounded-full" />
                      </div>
                    ) : stats.categoryBreakdown?.length > 0 ? (
                      stats.categoryBreakdown.map((cat) => {
                        const color = categoryColors[cat._id] || "#6b7280";
                        const total = stats.categoryBreakdown.reduce((sum, c) => sum + c.total, 0);
                        const percentage = total > 0 ? ((cat.total / total) * 100).toFixed(0) : 0;
                        return (
                          <div key={cat._id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all duration-200 hover:bg-[#15734C]/10 group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/10" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium truncate text-gray-400 group-hover:text-white transition-colors">{cat._id}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-[#15734C]/20 text-[#10b981]">{percentage}%</span>
                              <span className="text-sm font-bold text-white">
                                {formatCurrency(cat.total)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-[#15734C]/20">
                          <PieChart size={24} className="text-[#15734C]" />
                        </div>
                        <p className="text-sm font-bold text-white mb-1">No categories</p>
                        <p className="text-xs text-gray-500">Add expenses to see distribution</p>
                      </div>
                    )}
                  </div>
                </div>
              </ChartCard>
            </div>

            {/* ======================= */}
            {/* RECENT TRANSACTIONS */}
            {/* ======================= */}
            <div>
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-xl font-bold text-white">
                  Recent Transactions
                </h2>
                <Link
                  to="/all-transactions"
                  className="text-sm lg:text-base font-bold text-[#10b981] hover:text-white transition-colors"
                >
                  View All
                </Link>
              </div>

              <div className="rounded-2xl lg:rounded-3xl overflow-hidden bg-[#111111] border border-[#15734C]/20">
                {/* Transaction Rows */}
                <div className="divide-y divide-[#15734C]/10">
                  {loading ? (
                    <div className="px-5 py-16 text-center">
                      <div className="animate-spin w-6 h-6 mx-auto border-2 border-[#15734C] border-t-transparent rounded-full" />
                    </div>
                  ) : filteredTransactions?.length > 0 ? (
                    filteredTransactions.slice(0, 5).map((tx) => {
                      const Icon = categoryIcons[tx.category] || CreditCard;
                      const color = categoryColors[tx.category] || "#6b7280";

                      return (
                        <div
                          key={tx._id}
                          className="px-4 sm:px-5 lg:px-6 py-4 lg:py-5 flex items-center gap-4 lg:gap-5 cursor-pointer transition-all duration-300 hover:bg-[#15734C]/5 group"
                        >
                          {/* Icon */}
                          <div
                            className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${color}20` }}
                          >
                            <Icon size={20} style={{ color }} className="lg:w-6 lg:h-6" />
                          </div>

                          {/* Description & Date */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm lg:text-base truncate text-white">
                              {tx.type === "income" ? "income" : tx.name}
                            </p>
                            <p className="text-xs lg:text-sm mt-1 text-gray-500">
                              <span className="text-[10px] lg:text-xs px-2 py-0.5 lg:py-1 rounded-lg font-bold uppercase tracking-wider bg-[#15734C]/20 text-white/80 mr-2">{tx.category}</span>
                              {formatDate(tx.date)}
                            </p>
                          </div>

                          {/* Amount + Plus Button */}
                          <div className="flex items-center gap-3 lg:gap-4">
                            <p className={`font-bold text-base lg:text-lg shrink-0 ${tx.type === "income" ? 'text-[#10b981]' : 'text-rose-400'}`}>
                              {tx.type === "income" ? '+' : '-'}₹{tx.amount?.toLocaleString()}
                            </p>
                            <button
                              onClick={() => openAddModal(tx.type)}
                              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 bg-[#15734C]/20 hover:bg-[#15734C]/30 transition-all duration-300 hover:scale-110"
                            >
                              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-5 py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[#15734C]/20">
                        <List size={28} className="text-[#15734C]" />
                      </div>
                      <p className="text-sm font-bold text-white mb-1">
                        {searchQuery ? 'No matching transactions' : 'No transactions yet'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {searchQuery ? 'Try a different search term' : 'Click "Add" to create your first transaction'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#0a0a0a]/80 backdrop-blur-xl">
          <div className="rounded-[2rem] shadow-2xl shadow-[#15734C]/20 w-full max-w-xl lg:max-w-2xl overflow-hidden border bg-[#111111] border-[#15734C]/30 animate-in fade-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#15734C]/20 bg-gradient-to-r from-[#15734C]/10 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white shadow-lg shadow-[#15734C]/30">
                  <Plus size={24} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#10b981] font-bold mb-0.5">New Entry</p>
                  <h3 className="text-xl font-bold text-white">Add Transaction</h3>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }}
                className="w-10 h-10 rounded-xl bg-[#15734C]/20 flex items-center justify-center text-[#10b981] hover:bg-[#15734C]/30 hover:scale-110 transition-all duration-300">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                {/* Name Field */}
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <FileText size={14} />
                    Transaction Name
                  </label>
                  <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Coffee at Starbucks"
                    className="w-full border rounded-xl px-4 py-3.5 text-sm font-medium bg-[#0a0a0a] border-[#15734C]/30 text-white placeholder-gray-500 focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20 focus:outline-none transition-all"
                  />
                </div>

                {/* Category Field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <Tag size={14} />
                    Category
                  </label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="w-full border rounded-xl px-4 py-3.5 text-sm font-medium bg-[#0a0a0a] border-[#15734C]/30 text-white focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20 focus:outline-none transition-all cursor-pointer">
                    {categoryConfig.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* Amount Field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <IndianRupee size={14} />
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#15734C]">₹</span>
                    <input name="amount" type="number" value={form.amount} onChange={handleChange} required min="1" placeholder="0"
                      className="w-full border rounded-xl pl-8 pr-4 py-3.5 text-sm font-medium bg-[#0a0a0a] border-[#15734C]/30 text-white focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Date Field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <Calendar size={14} />
                    Date
                  </label>
                  <input name="date" type="date" value={form.date} onChange={handleChange} required
                    className="w-full border rounded-xl px-4 py-3.5 text-sm font-medium bg-[#0a0a0a] border-[#15734C]/30 text-white focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20 focus:outline-none transition-all cursor-pointer"
                  />
                </div>

                {/* Type Field */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <ArrowUpDown size={14} />
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {["expense", "income"].map(t => (
                      <button key={t} type="button" onClick={() => setForm(prev => ({ ...prev, type: t }))}
                        className={`py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${form.type === t
                          ? (t === "income"
                            ? 'bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30'
                            : 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30')
                          : 'bg-[#0a0a0a] border border-[#15734C]/30 text-gray-400 hover:border-[#15734C]/60 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Method Field */}
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-[#10b981] text-[10px] font-bold uppercase tracking-widest">
                    <CreditCard size={14} />
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {["UPI", "Card", "Cash", "Bank Transfer"].map(m => (
                      <button key={m} type="button" onClick={() => setForm(prev => ({ ...prev, method: m }))}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${form.method === m
                          ? 'bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30'
                          : 'bg-[#0a0a0a] border border-[#15734C]/30 text-gray-400 hover:border-[#15734C]/60 hover:text-white'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-4 border-t border-[#15734C]/20">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#15734C] to-[#10b981] hover:from-[#10b981] hover:to-[#15734C] shadow-lg shadow-[#15734C]/30 hover:shadow-[#15734C]/50 transition-all duration-300 active:scale-95">
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
