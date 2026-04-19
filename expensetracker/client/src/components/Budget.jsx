import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Save, Target,
  PiggyBank, TrendingUp, AlertCircle, CheckCircle, Wallet,
  ShoppingCart, Car, Utensils, Briefcase, Plane, Zap, Film, Heart, Gift,
  Gamepad2, Wifi, Phone, CreditCard, ChevronLeft, ChevronRight,
  Plus, Minus, RefreshCw, Sparkles, ChevronDown, Trash2, DollarSign,
  BarChart3, ArrowUpRight, ArrowDownRight, Calendar, Layers, Edit3
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";
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
  "Food & Dining": Utensils,
  "Transport": Car,
  "Transportation": Car,
  "Travel": Plane,
  "Bills": Zap,
  "Bills & Utilities": Zap,
  "Entertainment": Film,
  "Healthcare": Heart,
  "Health": Heart,
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
  "Food & Dining": "#f97316",
  "Transport": "#3b82f6",
  "Transportation": "#3b82f6",
  "Travel": "#06b6d4",
  "Bills": "#f59e0b",
  "Bills & Utilities": "#f59e0b",
  "Entertainment": "#ec4899",
  "Healthcare": "#ef4444",
  "Health": "#ef4444",
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

// Category Budget Input Card - Editable with delete option
const CategoryBudgetCard = ({ categoryName, budget, spent, onChange, onDelete, isDarkMode }) => {
  const Icon = categoryIcons[categoryName] || CreditCard;
  const color = categoryColors[categoryName] || "#6b7280";
  const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const remaining = budget - spent;

  const getStatusColor = () => {
    if (percentage > 100) return 'rose';
    if (percentage > 80) return 'amber';
    return 'emerald';
  };

  const statusColor = getStatusColor();

  return (
    <div className={`
      group rounded-xl sm:rounded-2xl p-4 sm:p-5 border-l-4 transition-all duration-300
      hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#15734C]/10
      bg-[#111111] border border-[#15734C]/20 hover:border-[#15734C]/40
    `}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Category Icon */}
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: isDarkMode ? `${color}20` : `${color}15` }}
        >
          <Icon size={18} className="sm:w-[22px] sm:h-[22px]" style={{ color }} />
        </div>

        {/* Category Info & Input */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h4 className={`font-semibold text-xs sm:text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {categoryName}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {spent > 0 && (
                <span className={`
                  text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium
                  ${statusColor === 'rose' && !isDarkMode ? 'bg-rose-100 text-rose-600' : ''}
                  ${statusColor === 'amber' && !isDarkMode ? 'bg-amber-100 text-amber-600' : ''}
                  ${statusColor === 'emerald' && !isDarkMode ? 'bg-emerald-100 text-emerald-600' : ''}
                  ${isDarkMode && statusColor === 'rose' ? 'bg-rose-500/20 text-rose-400' : ''}
                  ${isDarkMode && statusColor === 'amber' ? 'bg-amber-500/20 text-amber-400' : ''}
                  ${isDarkMode && statusColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                `}>
                  {percentage}% used
                </span>
              )}
              <button
                onClick={() => onDelete(categoryName)}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'hover:bg-rose-500/20 text-rose-400' : 'hover:bg-rose-100 text-rose-500'}`}
                title="Remove budget"
              >
                <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {/* Budget Input */}
          <div className="relative">
            <span className={`absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>₹</span>
            <input
              type="number"
              value={budget || ''}
              onChange={(e) => onChange(categoryName, parseFloat(e.target.value) || 0)}
              placeholder="Set budget..."
              className={`
                w-full pl-6 sm:pl-8 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium
                transition-all duration-200 outline-none
                bg-[#0a0a0a] text-white placeholder-gray-500 border border-[#15734C]/30 focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20
              `}
            />
          </div>

          {/* Spent & Remaining */}
          {budget > 0 && (
            <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
              {/* Progress Bar */}
              <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${statusColor === 'rose' ? 'bg-rose-500' :
                      statusColor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                  Spent: ₹{spent.toLocaleString()}
                </span>
                <span className={`font-medium ${remaining < 0 ? 'text-rose-500' : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                  {remaining >= 0 ? `₹${remaining.toLocaleString()} left` : `₹${Math.abs(remaining).toLocaleString()} over`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Savings Card Component
const SavingsCard = ({ title, value, subtitle, icon: Icon, color, isDarkMode, isMain = false }) => {
  const colorStyles = {
    violet: { bg: 'from-[#15734C] to-[#10b981]', text: 'text-[#15734C]', light: 'bg-[#15734C]/10' },
    emerald: { bg: 'from-emerald-400 to-teal-500', text: 'text-emerald-500', light: 'bg-emerald-100' },
    rose: { bg: 'from-rose-400 to-pink-500', text: 'text-rose-500', light: 'bg-rose-100' },
    amber: { bg: 'from-amber-400 to-orange-500', text: 'text-amber-500', light: 'bg-amber-100' }
  };

  const style = colorStyles[color] || colorStyles.violet;

  if (isMain) {
    return (
      <div className={`
        relative rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 overflow-hidden
        bg-linear-to-br ${style.bg}
      `}>
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
            <Icon size={16} className="text-white/70 sm:w-5 sm:h-5" />
            <p className="text-xs sm:text-sm font-medium text-white/70">{title}</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</p>
          {subtitle && <p className="text-xs sm:text-sm text-white/60">{subtitle}</p>}
        </div>
        <div className="absolute -right-6 -bottom-6 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/10" />
        <div className="absolute right-8 sm:right-10 bottom-1 sm:bottom-2 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className={`
      rounded-xl sm:rounded-2xl p-4 sm:p-5 border-l-4 transition-all duration-300
      hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#15734C]/10
      bg-[#111111] border border-[#15734C]/20 hover:border-[#15734C]/40 border-l-[#15734C]
    `}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`
          w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center
          ${isDarkMode ? 'bg-[#15734C]/20' : style.light}
        `}>
          <Icon size={18} className={`${isDarkMode ? 'text-[#15734C]' : style.text} sm:w-[22px] sm:h-[22px]`} />
        </div>
        <div>
          <p className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
          <p className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value}</p>
          {subtitle && <p className={`text-[10px] sm:text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

// ===========================================
// MAIN BUDGET COMPONENT
// ===========================================

const Budget = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useUser();
  const { addNotification } = useNotification();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Budget state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [totalBudget, setTotalBudget] = useState(0);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [categories, setCategories] = useState([]);
  const [spending, setSpending] = useState({});
  const [analysis, setAnalysis] = useState(null);

  // Dropdown state for adding category budgets
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');

  // Month names
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    fetchBudgetData();
  }, [selectedMonth, selectedYear]);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);

      // Fetch budget and categories
      const budgetRes = await fetch(`${API_BASE}/budgets?month=${selectedMonth}&year=${selectedYear}`, {
        headers: getAuthHeaders()
      });
      const budgetData = await budgetRes.json();

      // Fetch savings analysis
      const analysisRes = await fetch(`${API_BASE}/budgets/analysis?month=${selectedMonth}&year=${selectedYear}`, {
        headers: getAuthHeaders()
      });
      const analysisData = await analysisRes.json();

      // Default categories to ensure all are available
      const defaultCategories = [
        { _id: 'shopping', name: 'Shopping', type: 'expense' },
        { _id: 'food', name: 'Food', type: 'expense' },
        { _id: 'transport', name: 'Transport', type: 'expense' },
        { _id: 'travel', name: 'Travel', type: 'expense' },
        { _id: 'bills', name: 'Bills', type: 'expense' },
        { _id: 'entertainment', name: 'Entertainment', type: 'expense' },
        { _id: 'healthcare', name: 'Healthcare', type: 'expense' },
        { _id: 'salary', name: 'Salary', type: 'income' },
        { _id: 'investment', name: 'Investment', type: 'expense' },
        { _id: 'gifts', name: 'Gifts', type: 'expense' },
        { _id: 'gaming', name: 'Gaming', type: 'expense' },
        { _id: 'internet', name: 'Internet', type: 'expense' },
        { _id: 'phone', name: 'Phone', type: 'expense' },
        { _id: 'other', name: 'Other', type: 'expense' }
      ];

      // Merge API categories with defaults (avoid duplicates)
      const expenseCategories = budgetData.categories || [];
      const existingNames = expenseCategories.map(c => c.name.toLowerCase());
      const mergedCategories = [
        ...expenseCategories,
        ...defaultCategories.filter(dc => !existingNames.includes(dc.name.toLowerCase()))
      ];
      setCategories(mergedCategories);
      setSpending(budgetData.spending || {});

      // Set existing budget data
      if (budgetData.budget) {
        setTotalBudget(budgetData.budget.totalBudget || 0);
        const budgetMap = {};
        budgetData.budget.categoryBudgets?.forEach(cb => {
          budgetMap[cb.categoryName] = cb.amount;
        });
        setCategoryBudgets(budgetMap);
      } else {
        setTotalBudget(0);
        setCategoryBudgets({});
      }

      setAnalysis(analysisData);

      // Check for category threshold alerts (80%)
      if (analysisData.categoryAnalysis) {
        analysisData.categoryAnalysis.forEach(cat => {
          if (cat.percentage >= 80) {
            const message = cat.percentage >= 100
              ? `Note: You have exceeded your budget for ${cat.categoryName}!`
              : `Reminder: You've used ${cat.percentage}% of your budget for ${cat.categoryName}.`;
            addNotification('warning', message);
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch budget data:", error);
      addNotification('error', 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryBudgetChange = (categoryName, amount) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [categoryName]: amount
    }));
  };

  const handleAddCategoryBudget = () => {
    if (selectedCategory && newBudgetAmount) {
      setCategoryBudgets(prev => ({
        ...prev,
        [selectedCategory]: parseFloat(newBudgetAmount) || 0
      }));
      setSelectedCategory('');
      setNewBudgetAmount('');
      setIsDropdownOpen(false);
    }
  };

  const handleDeleteCategoryBudget = (categoryName) => {
    setCategoryBudgets(prev => {
      const updated = { ...prev };
      delete updated[categoryName];
      return updated;
    });
  };

  // Get categories that don't have a budget yet
  const availableCategories = categories.filter(cat => !categoryBudgets.hasOwnProperty(cat.name));

  // Get categories that have budgets set
  const budgetedCategories = Object.keys(categoryBudgets).filter(name => categoryBudgets[name] > 0);

  const handleSaveBudget = async () => {
    try {
      setSaving(true);

      // Convert categoryBudgets object to array format
      const categoryBudgetsArray = Object.entries(categoryBudgets).map(([name, amount]) => ({
        categoryName: name,
        amount: amount
      }));

      await fetch(`${API_BASE}/budgets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          totalBudget,
          categoryBudgets: categoryBudgetsArray
        })
      });

      setSaving(false);
      addNotification('success', 'Budget saved successfully!');
    } catch (error) {
      console.error("Failed to save budget:", error);
      addNotification('error', 'Failed to save budget changes');
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  };

  // Calculate totals
  const allocatedBudget = Object.values(categoryBudgets).reduce((sum, val) => sum + (val || 0), 0);
  const totalSpent = Object.values(spending).reduce((sum, val) => sum + (val || 0), 0);
  // Smart Savings = Income - Allocated Budget
  const smartSavings = (analysis?.totalIncome || 0) - allocatedBudget;

  // Helper functions
  const getInitials = (name) => {
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  const formatCurrency = (amount) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount?.toLocaleString() || 0}`;
  };

  return (
    <main className={`
      min-h-screen pb-24 lg:pb-0
      lg:ml-64 xl:ml-72
      w-full lg:w-[calc(100%-16rem)] xl:w-[calc(100%-18rem)]
      transition-colors duration-300 
      ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
    `}>
      <div className="w-full px-4 py-5 lg:px-6 lg:py-6">

        {/* Header */}
        <div className="mb-6 md:mb-8 lg:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Monthly Budget
              </h1>
              <p className={`text-sm lg:text-base mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Set your budget and track your spending
              </p>
            </div>

            {/* Month Selector */}
            <div className={`
                flex items-center gap-3 px-5 py-3 rounded-xl lg:rounded-2xl
                bg-[#111111] border border-[#15734C]/20
              `}>
              <button
                onClick={() => changeMonth('prev')}
                className={`p-2 rounded-lg lg:rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-[#15734C]/10 text-slate-500'}`}
              >
                <ChevronLeft size={20} />
              </button>
              <span className={`font-semibold min-w-28 lg:min-w-32 text-center text-base lg:text-lg ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
              <button
                onClick={() => changeMonth('next')}
                className={`p-2 rounded-lg lg:rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-[#15734C]/10 text-slate-500'}`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className={`animate-spin ${isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]'}`} size={32} />
          </div>
        ) : (
          <>
            {/* Hero Budget Card - Total Allocated Budget */}
            <div className={`
                relative rounded-3xl overflow-hidden mb-8 lg:mb-10
                bg-linear-to-br from-[#0a0a0a] via-[#151515] to-[#1a1a1a]
                border border-[#15734C]/20
              `}>
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 lg:w-80 lg:h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 lg:w-64 lg:h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="absolute top-1/2 right-1/4 w-24 h-24 lg:w-32 lg:h-32 bg-white/5 rounded-full" />

              <div className="relative z-10 p-6 md:p-8 lg:p-10 xl:p-12">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {/* Left Side - Budget Display */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Wallet size={28} className="text-white" />
                      </div>
                      <div>
                        <p className="text-white/70 text-sm font-medium flex items-center gap-2">
                          <Calendar size={14} />
                          {monthNames[selectedMonth - 1]} {selectedYear}
                        </p>
                        <h2 className="text-white text-lg font-semibold">Total Allocated Budget</h2>
                      </div>
                    </div>

                    {/* Budget Amount Display */}
                    <div className="mb-6 lg:mb-8">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white tracking-tight">
                          ₹{allocatedBudget.toLocaleString() || '0'}
                        </span>
                      </div>
                      <p className="text-white/60 text-sm lg:text-base">
                        {budgetedCategories.length > 0
                          ? `Allocated across ${budgetedCategories.length} categories`
                          : 'Add category budgets below to allocate your budget'
                        }
                      </p>
                    </div>

                    {/* Allocation Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Categories Allocated</span>
                        <span className="text-white font-medium">
                          {budgetedCategories.length} of {categories.length}
                        </span>
                      </div>
                      <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                        <div
                          className="h-full rounded-full transition-all duration-700 bg-linear-to-r from-emerald-400 to-teal-500"
                          style={{ width: `${categories.length > 0 ? (budgetedCategories.length / categories.length) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/60">
                        <span>Monthly Income: ₹{(analysis?.totalIncome || 0).toLocaleString()}</span>
                        <span>Potential Savings: ₹{Math.max(smartSavings, 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Quick Stats */}
                  <div className="lg:w-72 space-y-3">
                    {/* Income Card */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/60 text-xs font-medium">Monthly Income</p>
                          <p className="text-white text-2xl font-bold">₹{(analysis?.totalIncome || 0).toLocaleString()}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <TrendingUp size={20} className="text-emerald-300" />
                        </div>
                      </div>
                    </div>

                    {/* Savings Card */}
                    <div className={`backdrop-blur-sm rounded-2xl p-4 ${smartSavings >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/60 text-xs font-medium">Smart Savings</p>
                          <p className={`text-2xl font-bold ${smartSavings >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {smartSavings >= 0 ? '+' : '-'}₹{Math.abs(smartSavings).toLocaleString()}
                          </p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${smartSavings >= 0 ? 'bg-emerald-500/30' : 'bg-rose-500/30'
                          }`}>
                          <Sparkles size={20} className={smartSavings >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
                        </div>
                      </div>
                      <p className="text-white/50 text-xs mt-2">Income - Allocated Budget</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overview Stats Cards - Allocated Budget & Smart Savings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-8 lg:mb-10">
              {/* Total Allocated Budget Card */}
              <div className={`
                  rounded-2xl lg:rounded-3xl p-6 lg:p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
                  ${isDarkMode
                  ? 'bg-slate-800/80 hover:shadow-[#15734C]/10'
                  : 'bg-white shadow-sm hover:shadow-[#15734C]/20'}
                `}>
                <div className="flex items-center justify-between mb-4 lg:mb-5">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-[#15734C]/20' : 'bg-[#15734C]/10'}`}>
                    <Layers size={24} className={`lg:w-7 lg:h-7 ${isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]'}`} />
                  </div>
                  <span className={`text-sm lg:text-base px-3 lg:px-4 py-1.5 lg:py-2 rounded-full font-semibold ${budgetedCategories.length > 0
                      ? (isDarkMode ? 'bg-[#15734C]/20 text-[#15734C]' : 'bg-[#15734C]/10 text-[#15734C]')
                      : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')
                    }`}>
                    {budgetedCategories.length} categories
                  </span>
                </div>
                <p className={`text-sm lg:text-base font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Allocated Budget</p>
                <p className={`text-3xl lg:text-4xl xl:text-5xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  ₹{allocatedBudget.toLocaleString()}
                </p>
                <p className={`text-xs lg:text-sm mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sum of all category budgets
                </p>
              </div>

              {/* Smart Savings Card */}
              <div className={`
                  rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg overflow-hidden relative
                  ${smartSavings >= 0
                  ? (isDarkMode
                    ? 'bg-linear-to-br from-emerald-600/80 to-teal-700/80'
                    : 'bg-linear-to-br from-emerald-500 to-teal-600')
                  : (isDarkMode
                    ? 'bg-linear-to-br from-rose-600/80 to-red-700/80'
                    : 'bg-linear-to-br from-rose-500 to-red-600')
                }
                `}>
                {/* Decorative circles */}
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/5" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    {smartSavings >= 0 ? (
                      <CheckCircle size={20} className="text-white/80" />
                    ) : (
                      <AlertCircle size={20} className="text-white/80" />
                    )}
                  </div>
                  <p className="text-sm font-medium mb-1 text-white/70">Smart Savings</p>
                  <p className="text-3xl font-bold text-white">
                    {smartSavings >= 0 ? '+' : '-'}₹{Math.abs(smartSavings).toLocaleString()}
                  </p>
                  <p className="text-xs mt-2 text-white/60">
                    Income (₹{(analysis?.totalIncome || 0).toLocaleString()}) - Allocated Budget
                  </p>
                </div>
              </div>
            </div>

            {/* Smart Insights Banner */}
            {(analysis?.totalIncome > 0 || totalBudget > 0) && (
              <div className={`
                  rounded-2xl p-5 mb-8 overflow-hidden relative
                  ${smartSavings >= 0
                  ? (isDarkMode ? 'bg-linear-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/20' : 'bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200')
                  : (isDarkMode ? 'bg-linear-to-r from-rose-900/30 to-red-900/30 border border-rose-500/20' : 'bg-linear-to-r from-rose-50 to-red-50 border border-rose-200')
                }
                `}>
                <div className="flex items-start gap-4">
                  <div className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
                      ${smartSavings >= 0
                      ? (isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100')
                      : (isDarkMode ? 'bg-rose-500/20' : 'bg-rose-100')
                    }
                    `}>
                    {smartSavings >= 0 ? (
                      <PiggyBank size={24} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
                    ) : (
                      <AlertCircle size={24} className={isDarkMode ? 'text-rose-400' : 'text-rose-600'} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {smartSavings >= 0 ? '🎉 Great Financial Health!' : '⚠️ Budget Alert'}
                      </h3>
                      {smartSavings >= 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                          On Track
                        </span>
                      )}
                    </div>

                    {smartSavings >= 0 ? (
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Based on your income and allocated budget, you can save <strong className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>₹{smartSavings.toLocaleString()}</strong> this month!
                      </p>
                    ) : (
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Your allocated budget exceeds your income by <strong className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>₹{Math.abs(smartSavings).toLocaleString()}</strong>. Consider reducing your budget allocations.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Category Budgets Section */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Category Budgets
                  </h2>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Allocate your budget across different spending categories
                  </p>
                </div>
                <div className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl
                    bg-[#111111] border border-[#15734C]/20
                  `}>
                  <Layers size={16} className={isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {budgetedCategories.length} of {categories.length} allocated
                  </span>
                </div>
              </div>

              {/* Add New Category Budget - Expanded View */}
              <div className={`
                  rounded-2xl p-6 mb-6 border-2 border-dashed
                  bg-[#111111] border-[#15734C]/30
                `}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-[#15734C]/20' : 'bg-[#15734C]/10'}`}>
                    <Plus size={20} className={isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]'} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Allocate Budget</h3>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select a category and set a budget amount</p>
                  </div>
                </div>

                {/* Quick Add Form */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                  {/* Category Dropdown */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`
                          w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium
                          transition-all duration-200
                          ${isDarkMode
                          ? 'bg-slate-700/50 text-white border border-slate-600 hover:border-[#15734C]'
                          : 'bg-white text-slate-800 border border-[#15734C]/20 hover:border-[#15734C]/40 shadow-sm'}
                        `}
                    >
                      <span className={selectedCategory ? '' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}>
                        {selectedCategory || 'Select Category...'}
                      </span>
                      <ChevronDown size={18} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className={`
                          absolute z-20 w-full mt-2 py-2 rounded-xl shadow-xl max-h-60 overflow-y-auto
                          bg-[#111111] border border-[#15734C]/30
                        `}>
                        {availableCategories.length > 0 ? (
                          availableCategories.map((cat) => {
                            const Icon = categoryIcons[cat.name] || CreditCard;
                            const color = categoryColors[cat.name] || "#6b7280";
                            return (
                              <button
                                key={cat._id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(cat.name);
                                  setIsDropdownOpen(false);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                                    transition-colors text-gray-300 hover:bg-[#15734C]/20 hover:text-white
                                  `}
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: isDarkMode ? `${color}20` : `${color}15` }}
                                >
                                  <Icon size={16} style={{ color }} />
                                </div>
                                {cat.name}
                              </button>
                            );
                          })
                        ) : (
                          <p className="px-4 py-2 text-sm text-gray-500">
                            All categories have budgets
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Budget Amount Input */}
                  <div className="relative sm:w-48">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-[#15734C]">₹</span>
                    <input
                      type="number"
                      value={newBudgetAmount}
                      onChange={(e) => setNewBudgetAmount(e.target.value)}
                      placeholder="Amount"
                      className={`
                          w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium
                          transition-all duration-200 outline-none
                          bg-[#0a0a0a] text-white placeholder-gray-500 border border-[#15734C]/30 focus:border-[#15734C] focus:ring-2 focus:ring-[#15734C]/20
                        `}
                    />
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={handleAddCategoryBudget}
                    disabled={!selectedCategory || !newBudgetAmount}
                    className={`
                        flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white
                        transition-all duration-200
                        bg-linear-to-r from-[#15734C] to-[#10b981]
                        hover:from-[#0f5a3b] hover:to-[#15734C]
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>

                {/* Available Categories Grid - Always Visible */}
                {availableCategories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-3 text-[#10b981]">
                      Quick Add Categories:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map((cat) => {
                        const Icon = categoryIcons[cat.name] || CreditCard;
                        const color = categoryColors[cat.name] || "#6b7280";
                        return (
                          <button
                            key={cat._id}
                            onClick={() => {
                              setSelectedCategory(cat.name);
                              document.querySelector('input[placeholder="Amount"]')?.focus();
                            }}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                                transition-all duration-300 hover:-translate-y-0.5
                                bg-[#111111] border border-[#15734C]/20 text-gray-300 hover:bg-[#15734C]/20 hover:text-white hover:border-[#15734C]/40
                                ${selectedCategory === cat.name
                                ? 'ring-2 ring-[#15734C] ring-offset-2 ring-offset-[#0a0a0a]'
                                : ''
                              }
                              `}
                          >
                            <Icon size={14} style={{ color }} />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Existing Category Budgets Grid */}
              {budgetedCategories.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      Your Category Budgets
                    </h3>
                    <span className="text-xs text-[#10b981]">
                      Total: ₹{allocatedBudget.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {budgetedCategories.map((categoryName) => (
                      <CategoryBudgetCard
                        key={categoryName}
                        categoryName={categoryName}
                        budget={categoryBudgets[categoryName] || 0}
                        spent={spending[categoryName] || 0}
                        onChange={handleCategoryBudgetChange}
                        onDelete={handleDeleteCategoryBudget}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`
                    rounded-2xl p-10 text-center
                    bg-[#111111] border border-[#15734C]/20
                  `}>
                  <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center bg-gradient-to-br from-[#15734C]/20 to-[#10b981]/20">
                    <Target size={40} className="text-[#15734C]" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-white">No Category Budgets Yet</h3>
                  <p className="text-sm mb-4 max-w-md mx-auto text-gray-500">
                    Start by selecting categories from above to allocate your monthly budget effectively.
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-[#10b981]">
                    <Sparkles size={14} />
                    Pro tip: Allocate budgets to track spending by category
                  </div>
                </div>
              )}
            </div>

            {/* Save Button - Fixed at bottom for mobile, inline for desktop */}
            <div className={`
                sticky bottom-4 z-10 flex justify-end
                ${isDarkMode ? '' : ''}
              `}>
              <button
                onClick={handleSaveBudget}
                disabled={saving}
                className={`
                    flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white
                    transition-all duration-300
                    bg-linear-to-r from-[#15734C] via-[#10b981] to-[#0f5a3b]
                    hover:from-[#0f5a3b] hover:via-[#15734C] hover:to-[#10b981]
                    hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#15734C]/30
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                    shadow-lg shadow-[#15734C]/20
                  `}
              >
                {saving ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Save Budget</span>
                    <span className="text-white/60 text-sm ml-1">({monthNames[selectedMonth - 1]} {selectedYear})</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default Budget;
