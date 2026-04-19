import React, { useState, useRef, useEffect } from "react";
import {
  Search, Filter, ChevronDown, MoreHorizontal, Plus, Download, Trash2, Edit3,
  ShoppingCart, Car, CreditCard, Utensils, Briefcase, Plane,
  List, Target, Sun, Moon, Bell,
  Calendar, X, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Zap, Film, Heart, Gift, Gamepad2, Wifi, Phone, CalendarDays,
  FileText, Tag, IndianRupee, ArrowUpDown
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('expense_track_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Category configurations
const categoryConfig = {
  "Shopping": { icon: ShoppingCart, color: "bg-[#15734C]", textColor: "text-[#15734C]", bgLight: "bg-[#15734C]/10", bgDark: "bg-[#15734C]/20" },
  "Food": { icon: Utensils, color: "bg-orange-500", textColor: "text-orange-600", bgLight: "bg-orange-50", bgDark: "bg-orange-900/40" },
  "Transport": { icon: Car, color: "bg-blue-500", textColor: "text-blue-600", bgLight: "bg-blue-50", bgDark: "bg-blue-900/40" },
  "Travel": { icon: Plane, color: "bg-cyan-500", textColor: "text-cyan-600", bgLight: "bg-cyan-50", bgDark: "bg-cyan-900/40" },
  "Bills": { icon: Zap, color: "bg-amber-500", textColor: "text-amber-600", bgLight: "bg-amber-50", bgDark: "bg-amber-900/40" },
  "Entertainment": { icon: Film, color: "bg-pink-500", textColor: "text-pink-600", bgLight: "bg-pink-50", bgDark: "bg-pink-900/40" },
  "Healthcare": { icon: Heart, color: "bg-red-500", textColor: "text-red-600", bgLight: "bg-red-50", bgDark: "bg-red-900/40" },
  "Salary": { icon: Briefcase, color: "bg-emerald-500", textColor: "text-emerald-600", bgLight: "bg-emerald-50", bgDark: "bg-emerald-900/40" },
  "Investment": { icon: TrendingUp, color: "bg-green-500", textColor: "text-green-600", bgLight: "bg-green-50", bgDark: "bg-green-900/40" },
  "Gifts": { icon: Gift, color: "bg-rose-500", textColor: "text-rose-600", bgLight: "bg-rose-50", bgDark: "bg-rose-900/40" },
  "Gaming": { icon: Gamepad2, color: "bg-indigo-500", textColor: "text-indigo-600", bgLight: "bg-indigo-50", bgDark: "bg-indigo-900/40" },
  "Internet": { icon: Wifi, color: "bg-teal-500", textColor: "text-teal-600", bgLight: "bg-teal-50", bgDark: "bg-teal-900/40" },
  "Phone": { icon: Phone, color: "bg-[#15734C]", textColor: "text-[#15734C]", bgLight: "bg-[#15734C]/10", bgDark: "bg-[#15734C]/20" },
  "Other": { icon: CreditCard, color: "bg-gray-500", textColor: "text-gray-600", bgLight: "bg-gray-50", bgDark: "bg-gray-800/40" }
};

// Generate last 12 months
const generateMonthOptions = () => {
  const months = [];
  const currentDate = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    // Use local date format to avoid timezone issues
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      value,
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
  }
  return months;
};

const DropdownFilter = ({ label, value, options, onChange, icon: Icon, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const isActive = value !== "All" && value !== "thisMonth";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border font-bold text-sm transition-all duration-300 min-w-36 ${isActive
          ? 'bg-[#15734C]/20 border-[#15734C]/50 text-[#10b981]'
          : 'bg-[#0a0a0a] border-[#15734C]/30 text-gray-400 hover:border-[#15734C]/50 hover:text-white'
          }`}
      >
        {Icon && <Icon size={14} className={isActive ? 'text-[#10b981]' : 'text-[#15734C]'} />}
        <span className="flex-1 text-left truncate">{selectedOption?.label || label}</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-48 rounded-xl border shadow-xl z-50 overflow-hidden bg-[#111111] border-[#15734C]/30 animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ${value === option.value
                  ? 'bg-[#15734C]/20 text-[#10b981]'
                  : 'text-gray-400 hover:bg-[#15734C]/10 hover:text-white'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AllTransactions = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("thisMonth");
  const [selectedDate, setSelectedDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: "Shopping",
    amount: "",
    type: "expense",
    method: "UPI",
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch transactions from backend
  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/transactions`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use local date to match with transaction filtering
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const monthOptions = [
    { value: "thisMonth", label: "This Month" },
    { value: "All", label: "All Time" },
    ...generateMonthOptions()
  ];

  const categoryOptions = [
    { value: "All", label: "All Categories" },
    ...Object.keys(categoryConfig).map(cat => ({ value: cat, label: cat }))
  ];

  const methodOptions = [
    { value: "All", label: "All Methods" },
    { value: "UPI", label: "UPI" },
    { value: "Card", label: "Card" },
    { value: "Cash", label: "Cash" },
    { value: "Bank Transfer", label: "Bank Transfer" }
  ];

  const typeOptions = [
    { value: "All", label: "All Types" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" }
  ];

  const getInitials = (name) => {
    return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDateObj = new Date(tx.date);
    // Use local date to avoid timezone issues
    const txYear = txDateObj.getFullYear();
    const txMonthNum = txDateObj.getMonth() + 1; // 0-indexed
    const txDay = txDateObj.getDate();
    const txMonth = `${txYear}-${String(txMonthNum).padStart(2, '0')}`;
    const txDate = `${txYear}-${String(txMonthNum).padStart(2, '0')}-${String(txDay).padStart(2, '0')}`;
    
    const matchesSearch = tx.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || tx.category === selectedCategory;
    const matchesMethod = selectedMethod === "All" || 
      tx.paymentmethod?.toLowerCase() === selectedMethod.toLowerCase();
    const matchesType = selectedType === "All" || tx.type === selectedType;
    
    let matchesMonth = true;
    if (selectedMonth === "thisMonth") {
      matchesMonth = txMonth === currentMonth;
    } else if (selectedMonth !== "All") {
      matchesMonth = txMonth === selectedMonth;
    }
    
    const matchesDate = !selectedDate || txDate === selectedDate;
    
    return matchesSearch && matchesCategory && matchesMethod && matchesType && matchesMonth && matchesDate;
  });

  const totalIncome = filteredTransactions
    .filter(tx => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = filteredTransactions
    .filter(tx => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const clearFilters = () => {
    setSelectedCategory("All");
    setSelectedMethod("All");
    setSelectedType("All");
    setSelectedMonth("thisMonth");
    setSelectedDate("");
    setSearchTerm("");
  };

  const hasActiveFilters = selectedCategory !== "All" || selectedMethod !== "All" || selectedType !== "All" || selectedMonth !== "thisMonth" || selectedDate || searchTerm;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
    setEditingTransaction(null);
  };

  const handleEdit = (tx) => {
    const txDate = new Date(tx.date);
    const dateStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
    setForm({
      name: tx.name,
      category: tx.category,
      amount: tx.amount,
      type: tx.type,
      method: tx.paymentmethod || "UPI",
      date: dateStr
    });
    setEditingTransaction(tx);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingTransaction 
        ? `${API_BASE}/transactions/${editingTransaction._id}`
        : `${API_BASE}/transactions`;
      const method = editingTransaction ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(form)
      });
      
      if (response.ok) {
        await fetchTransactions();
        resetForm();
        setShowModal(false);
      }
    } catch (error) {
      console.error(editingTransaction ? "Failed to update transaction:" : "Failed to create transaction:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await fetch(`${API_BASE}/transactions/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await fetchTransactions();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("No transactions to export");
      return;
    }

    const headers = ["Name", "Category", "Amount", "Type", "Method", "Date"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(tx => 
        [
          `"${tx.name}"`,
          tx.category,
          tx.amount,
          tx.type,
          tx.paymentmethod,
          new Date(tx.date).toISOString().split('T')[0]
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <main className={`
      min-h-screen pb-24 lg:pb-0
      lg:ml-64 xl:ml-72
      w-full lg:w-[calc(100%-16rem)] xl:w-[calc(100%-18rem)]
      transition-colors duration-300 
      ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
    `}>
      {/* Top Header - Desktop Only */}
      <div className={`hidden lg:flex px-4 lg:px-6 py-4 items-center justify-between border-b sticky top-0 z-30 ${isDarkMode ? 'bg-[#0a0a0a]/90 border-[#15734C]/20 backdrop-blur-xl' : 'bg-[#0a0a0a]/95 border-[#15734C]/10'}`}>
        <div />
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-[#15734C]/10 text-slate-600 hover:bg-[#15734C]/20'}`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center bg-[#15734C]/10 hover:bg-[#15734C]/20 transition-colors">
            <Bell size={20} className={isDarkMode ? 'text-slate-400' : 'text-[#10b981]'} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#15734C] rounded-full ring-2 ring-[#0a0a0a]" />
          </div>
          <Link to="/profile">
            <div className={`w-10 h-10 rounded-xl overflow-hidden ring-2 ${isDarkMode ? 'ring-slate-700' : 'ring-[#15734C]/20'}`}>
              {user?.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" alt="User" />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white text-sm font-medium">
                  {getInitials(user?.name || "User")}
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>

      <div className="w-full px-4 py-5 lg:px-6 lg:py-6 space-y-5 lg:space-y-6">
          {/* Page Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-white">
                Transactions
              </h2>
              <p className="text-sm lg:text-base mt-1 text-[#10b981]/70">
                Manage your financial records
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 sm:px-5 lg:px-6 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl font-bold text-sm lg:text-base transition-all duration-300 bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30 hover:shadow-[#15734C]/50 hover:scale-105 active:scale-95"
            >
              <Plus size={16} className="lg:w-5 lg:h-5" />
              <span className="hidden xs:inline">Add New</span>
              <span className="xs:hidden">Add</span>
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl p-5 lg:p-6 border transition-all duration-300 bg-[#111111] border-[#15734C]/20 hover:border-[#15734C]/40 hover:shadow-lg hover:shadow-[#15734C]/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-[#15734C] to-[#10b981] flex items-center justify-center">
                  <ArrowUpRight size={18} className="text-white lg:w-6 lg:h-6" />
                </div>
                <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-[#10b981]">Income</p>
              </div>
              <p className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white">₹{totalIncome.toLocaleString()}</p>
            </div>
            <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl p-5 lg:p-6 border transition-all duration-300 bg-[#111111] border-[#15734C]/20 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
                  <ArrowDownLeft size={18} className="text-white lg:w-6 lg:h-6" />
                </div>
                <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-rose-400">Expense</p>
              </div>
              <p className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white">₹{totalExpense.toLocaleString()}</p>
            </div>
            <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl p-5 lg:p-6 border transition-all duration-300 xs:col-span-2 lg:col-span-1 bg-[#111111] border-[#15734C]/20 hover:border-[#15734C]/40 hover:shadow-lg hover:shadow-[#15734C]/10">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center ${totalIncome - totalExpense >= 0 ? 'bg-gradient-to-br from-[#15734C] to-[#10b981]' : 'bg-gradient-to-br from-rose-500 to-red-500'}`}>
                  <TrendingUp size={18} className="text-white lg:w-6 lg:h-6" />
                </div>
                <p className={`text-xs lg:text-sm font-bold uppercase tracking-widest ${totalIncome - totalExpense >= 0 ? 'text-[#10b981]' : 'text-rose-400'}`}>Balance</p>
              </div>
              <p className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white">
                ₹{(totalIncome - totalExpense).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl p-5 lg:p-6 border bg-[#111111] border-[#15734C]/20">
            <div className="flex items-center justify-between mb-4 lg:mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-[#15734C]/20 flex items-center justify-center">
                  <Filter size={16} className="text-[#10b981] lg:w-5 lg:h-5" />
                </div>
                <span className="text-sm lg:text-base font-bold text-white">Filters</span>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs lg:text-sm font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                  <X size={14} /> Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
              <div className="col-span-2 sm:col-span-1 lg:col-span-2 flex items-center gap-2.5 px-4 py-3 rounded-xl lg:rounded-2xl border bg-[#0a0a0a] border-[#15734C]/30 focus-within:border-[#15734C] focus-within:ring-2 focus-within:ring-[#15734C]/20 transition-all">
                <Search size={16} className="text-[#15734C]" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent outline-none flex-1 text-sm lg:text-base text-white placeholder-gray-500 font-medium"
                />
              </div>

              <DropdownFilter label="Month" value={selectedMonth} options={monthOptions} onChange={setSelectedMonth} icon={Calendar} isDarkMode={isDarkMode} />
              <DropdownFilter label="Category" value={selectedCategory} options={categoryOptions} onChange={setSelectedCategory} icon={Target} isDarkMode={isDarkMode} />
              <DropdownFilter label="Method" value={selectedMethod} options={methodOptions} onChange={setSelectedMethod} icon={CreditCard} isDarkMode={isDarkMode} />
              <DropdownFilter label="Type" value={selectedType} options={typeOptions} onChange={setSelectedType} icon={TrendingUp} isDarkMode={isDarkMode} />

              {/* Date Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm transition-all duration-300 ${selectedDate
                    ? 'bg-[#15734C]/20 border-[#15734C]/50 text-[#10b981]'
                    : 'bg-[#0a0a0a] border-[#15734C]/30 text-gray-400 hover:border-[#15734C]/50 hover:text-white'
                    }`}
                >
                  <CalendarDays size={14} className={selectedDate ? 'text-[#10b981]' : 'text-[#15734C]'} />
                  <span className="truncate text-sm">{selectedDate || "Pick Date"}</span>
                </button>
                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-2 p-4 rounded-xl border shadow-xl z-50 bg-[#111111] border-[#15734C]/30 animate-in fade-in zoom-in-95 duration-200">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
                      className="px-4 py-2.5 rounded-xl border text-sm font-medium bg-[#0a0a0a] border-[#15734C]/30 text-white focus:border-[#15734C] focus:outline-none"
                    />
                    {selectedDate && (
                      <button onClick={() => { setSelectedDate(""); setShowDatePicker(false); }} className="w-full mt-3 py-2 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                        Clear Date
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="rounded-xl sm:rounded-2xl lg:rounded-3xl border overflow-hidden bg-[#111111] border-[#15734C]/20">
            <div className="px-5 lg:px-6 py-4 border-b border-[#15734C]/20 flex items-center justify-between bg-gradient-to-r from-[#15734C]/10 to-transparent">
              <span className="text-xs sm:text-sm lg:text-base font-bold text-[#10b981] uppercase tracking-widest">
                {loading ? "Loading..." : `${filteredTransactions.length} Records`}
              </span>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm transition-all duration-300 bg-[#15734C]/20 text-[#10b981] hover:bg-[#15734C]/30 border border-[#15734C]/30 hover:border-[#15734C]/50">
                <Download size={14} className="lg:w-4 lg:h-4" />
                Export CSV
              </button>
            </div>

            <div className="divide-y divide-[#15734C]/10">
              {loading ? (
                <div className="px-5 py-12 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-[#15734C] border-t-transparent rounded-full mx-auto" />
                </div>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const config = categoryConfig[tx.category] || categoryConfig["Other"];
                  const IconComponent = config.icon;

                  return (
                    <div key={tx._id} className="px-5 lg:px-6 py-4 lg:py-5 flex items-center gap-4 lg:gap-5 transition-all duration-300 hover:bg-[#15734C]/5 group">
                      <div className={`w-11 h-11 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 ${config.bgDark} text-white transition-transform group-hover:scale-110`}>
                        <IconComponent size={18} className="lg:w-6 lg:h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm lg:text-base text-white truncate">{tx.name}</p>
                        </div>
                        <div className="flex items-center gap-2 lg:gap-3 mt-1">
                          <span className={`text-[10px] lg:text-xs px-2 lg:px-3 py-0.5 lg:py-1 rounded-lg font-bold uppercase tracking-wider ${config.bgDark} text-white/80`}>
                            {tx.category}
                          </span>
                          <span className="text-[10px] lg:text-xs text-gray-500 font-medium">• {tx.paymentmethod}</span>
                          <span className="text-[10px] lg:text-xs text-gray-500 font-medium">• {formatDate(tx.date)}</span>
                        </div>
                      </div>

                      <p className={`text-base lg:text-lg font-bold shrink-0 ${tx.type === "income" ? 'text-[#10b981]' : 'text-rose-400'}`}>
                        {tx.type === "income" ? '+' : '-'}₹{tx.amount.toLocaleString()}
                      </p>

                      <button onClick={() => handleEdit(tx)} className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl transition-all duration-300 shrink-0 text-gray-500 hover:text-[#10b981] hover:bg-[#15734C]/20">
                        <Edit3 size={16} className="lg:w-5 lg:h-5" />
                      </button>

                      <button onClick={() => handleDelete(tx._id)} className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl transition-all duration-300 shrink-0 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10">
                        <Trash2 size={16} className="lg:w-5 lg:h-5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-5 py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[#15734C]/20">
                    <List size={28} className="text-[#15734C]" />
                  </div>
                  <p className="font-bold text-base text-white mb-1">No transactions found</p>
                  <p className="text-sm text-gray-500">Click "Add New" to create your first transaction</p>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#0a0a0a]/80 backdrop-blur-xl">
          <div className="rounded-[2rem] shadow-2xl shadow-[#15734C]/20 w-full max-w-xl overflow-hidden border bg-[#111111] border-[#15734C]/30 animate-in fade-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#15734C]/20 bg-gradient-to-r from-[#15734C]/10 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white shadow-lg shadow-[#15734C]/30">
                  {editingTransaction ? <Edit3 size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#10b981] font-bold mb-0.5">{editingTransaction ? 'Update Entry' : 'New Entry'}</p>
                  <h3 className="text-xl font-bold text-white">{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h3>
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
                    {Object.keys(categoryConfig).map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                  {editingTransaction ? 'Save Changes' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default AllTransactions;
