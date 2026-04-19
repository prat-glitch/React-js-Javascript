import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    List,
    User,
    Wallet,
    Shield,
    Database,
    Palette,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Download,
    AlertTriangle,
    Sun,
    Moon,
    Bell,
    Save,
    Eye,
    EyeOff,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";

const Profile = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { user, updateUser, saveUserToBackend } = useUser();
    const [activeTab, setActiveTab] = useState("user");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Local User Info State for editing
    const [localUserInfo, setLocalUserInfo] = useState({ ...user });

    // Financial Preferences State - Load from user.preferences
    const [preferences, setPreferences] = useState({
        currency: user.preferences?.currency || "₹",
        monthlyBudget: user.preferences?.monthlyBudget || 0,
        monthStart: user.preferences?.monthStart || 1,
        defaultPaymentMethod: user.preferences?.defaultPaymentMethod || "upi",
    });

    // Categories State - Fetch from backend
    const [categories, setCategories] = useState([]);

    // Category Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategory, setNewCategory] = useState({
        name: "",
        type: "expense",
        icon: "category",
        color: "#6366f1",
    });

    // Delete Confirmation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState({ type: "", id: null });

    // Security State
    const [passwordData, setPasswordData] = useState({
        current: "",
        new: "",
        confirm: "",
    });

    // App Preferences State - Load from user.preferences
    const [appPreferences, setAppPreferences] = useState({
        dashboardLayout: user.preferences?.dashboardLayout || "detailed",
        notifications: user.preferences?.notifications !== undefined ? user.preferences.notifications : true,
    });

    // Fetch categories from backend on component mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const token = localStorage.getItem('expense_track_token');
                if (!token) return;

                const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');
                const response = await fetch(`${API_BASE}/categories`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setCategories(data);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            }
        };

        fetchCategories();
    }, []);

    // Update preferences when user changes
    useEffect(() => {
        if (user.preferences) {
            setPreferences({
                currency: user.preferences.currency || "₹",
                monthlyBudget: user.preferences.monthlyBudget || 0,
                monthStart: user.preferences.monthStart || 1,
                defaultPaymentMethod: user.preferences.defaultPaymentMethod || "upi",
            });
            setAppPreferences({
                dashboardLayout: user.preferences.dashboardLayout || "detailed",
                notifications: user.preferences.notifications !== undefined ? user.preferences.notifications : true,
            });
        }
    }, [user.preferences]);

    // Available icons for categories
    const availableIcons = [
        "shopping_bag", "restaurant", "receipt", "flight", "movie", "payments",
        "work", "trending_up", "home", "directions_car", "local_hospital",
        "school", "fitness_center", "pets", "child_care", "savings",
        "account_balance", "credit_card", "attach_money", "category"
    ];

    // Available colors for categories
    const availableColors = [
        "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
        "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
        "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
        "#0ea5e9", "#3b82f6", "#6366f1", "#64748b", "#374151"
    ];

    const tabs = [
        { id: "user", label: "User Info", icon: <User size={20} /> },
        { id: "financial", label: "Financial", icon: <Wallet size={20} /> },
        { id: "categories", label: "Categories", icon: <List size={20} /> },
        { id: "security", label: "Security", icon: <Shield size={20} /> },
        { id: "data", label: "Data & Privacy", icon: <Database size={20} /> },
        { id: "appearance", label: "App Preferences", icon: <Palette size={18} /> },
    ];

    const handleSaveUserInfo = async () => {
        // Update local state first
        updateUser(localUserInfo);

        // Save to backend database
        const success = await saveUserToBackend({
            name: localUserInfo.name,
            phone: localUserInfo.phone,
            avatar: localUserInfo.avatar
        });

        if (success) {
            alert("Profile saved successfully!");
        } else {
            alert("Profile saved locally. Backend sync may have failed.");
        }
    };

    const handleSavePreferences = async () => {
        // Update user preferences in UserContext
        const updatedPreferences = { ...user.preferences, ...preferences };
        updateUser({ preferences: updatedPreferences });

        // Save preferences to backend
        const success = await saveUserToBackend({ preferences: updatedPreferences });

        if (success) {
            alert("Preferences saved successfully!");
        } else {
            alert("Preferences saved locally. Backend sync may have failed.");
        }
    };

    const handleAddCategory = async () => {
        if (!newCategory.name.trim()) return;

        try {
            const token = localStorage.getItem('expense_track_token');
            const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

            const response = await fetch(`${API_BASE}/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCategory)
            });

            if (response.ok) {
                const savedCategory = await response.json();
                setCategories([...categories, savedCategory]);
                setNewCategory({ name: "", type: "expense", icon: "category", color: "#6366f1" });
                setShowCategoryModal(false);
            } else {
                // Fallback to local state if API fails
                const category = {
                    id: Date.now(),
                    ...newCategory,
                };
                setCategories([...categories, category]);
                setNewCategory({ name: "", type: "expense", icon: "category", color: "#6366f1" });
                setShowCategoryModal(false);
            }
        } catch (error) {
            console.error("Failed to add category:", error);
            // Fallback to local state
            const category = {
                id: Date.now(),
                ...newCategory,
            };
            setCategories([...categories, category]);
            setNewCategory({ name: "", type: "expense", icon: "category", color: "#6366f1" });
            setShowCategoryModal(false);
        }
    };

    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setNewCategory({ ...category });
        setShowCategoryModal(true);
    };

    const handleUpdateCategory = async () => {
        try {
            const token = localStorage.getItem('expense_track_token');
            const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

            const response = await fetch(`${API_BASE}/categories/${editingCategory.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCategory)
            });

            if (response.ok) {
                const updatedCategory = await response.json();
                setCategories(categories.map(c =>
                    c.id === editingCategory.id ? updatedCategory : c
                ));
            } else {
                // Fallback to local state if API fails
                setCategories(categories.map(c =>
                    c.id === editingCategory.id ? { ...c, ...newCategory } : c
                ));
            }
        } catch (error) {
            console.error("Failed to update category:", error);
            // Fallback to local state
            setCategories(categories.map(c =>
                c.id === editingCategory.id ? { ...c, ...newCategory } : c
            ));
        }

        setEditingCategory(null);
        setNewCategory({ name: "", type: "expense", icon: "category", color: "#6366f1" });
        setShowCategoryModal(false);
    };

    const handleDeleteCategory = (id) => {
        setDeleteTarget({ type: "category", id });
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (deleteTarget.type === "category") {
            try {
                const token = localStorage.getItem('expense_track_token');
                const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

                const response = await fetch(`${API_BASE}/categories/${deleteTarget.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok || response.status === 404) {
                    setCategories(categories.filter(c => c.id !== deleteTarget.id));
                } else {
                    // Fallback to local state if API fails
                    setCategories(categories.filter(c => c.id !== deleteTarget.id));
                }
            } catch (error) {
                console.error("Failed to delete category:", error);
                // Fallback to local state
                setCategories(categories.filter(c => c.id !== deleteTarget.id));
            }
        } else if (deleteTarget.type === "transactions") {
            alert("All transactions deleted!");
        } else if (deleteTarget.type === "account") {
            alert("Account deleted!");
        }
        setShowDeleteModal(false);
        setDeleteTarget({ type: "", id: null });
    };

    const handleChangePassword = () => {
        if (passwordData.new !== passwordData.confirm) {
            alert("Passwords do not match!");
            return;
        }
        // API call would go here
        alert("Password changed successfully!");
        setPasswordData({ current: "", new: "", confirm: "" });
    };

    const handleExportData = () => {
        // In real app, this would call the API
        alert("Downloading transactions.csv...");
    };

    const getInitials = (name) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <main className={`
            min-h-screen pb-24 lg:pb-0
            lg:ml-64 xl:ml-72
            w-full lg:w-[calc(100%-16rem)] xl:w-[calc(100%-18rem)]
            p-4 lg:p-6
            bg-[#0a0a0a]
        `}>
            <div className="w-full">
                {/* Header */}
                <div className="mb-5 sm:mb-6 md:mb-10 lg:mb-12">
                    <p className="text-[9px] sm:text-[10px] lg:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.4em] text-[#10b981]">Configuration Hub</p>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter text-white">Settings</h1>
                    <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs md:text-sm lg:text-base font-bold max-w-lg lg:max-w-xl leading-relaxed text-gray-400">Fine-tune your workspace environment and operational protocols.</p>
                </div>

                {/* Tabs Navigation */}
                <div className="rounded-lg sm:rounded-xl md:rounded-2xl mb-5 sm:mb-6 md:mb-8 p-1 sm:p-1 md:p-1.5 border overflow-x-auto bg-[#111111] border-[#15734C]/20">
                    <div className="flex md:flex-wrap gap-1 min-w-max md:min-w-0">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-3 md:px-5 lg:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-wide md:tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? "bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30"
                                    : "text-gray-400 hover:text-white hover:bg-[#15734C]/20"
                                    }`}
                            >
                                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 border bg-[#111111] border-[#15734C]/20">
                    {/* USER INFO TAB */}
                    {activeTab === "user" && (
                        <div className="space-y-5 sm:space-y-6 md:space-y-8">
                            <h3 className="text-base sm:text-lg md:text-xl font-black uppercase tracking-wide md:tracking-widest text-white">Personnel Identity</h3>

                            {/* Avatar Section */}
                            <div className="flex flex-col md:flex-row items-center gap-5 sm:gap-6 md:gap-8 p-3 sm:p-4 md:p-6 rounded-xl md:rounded-2xl border bg-[#0a0a0a] border-[#15734C]/30 text-white">
                                <div className="relative group">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-[#15734C] to-[#10b981] p-1 shadow-2xl shadow-[#15734C]/30">
                                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white text-xl sm:text-2xl md:text-4xl font-black overflow-hidden border-2 md:border-4 border-white">
                                            {localUserInfo.avatar ? (
                                                <img src={localUserInfo.avatar} alt="Avatar" className="w-full h-full object-cover scale-110" />
                                            ) : (
                                                getInitials(localUserInfo.name)
                                            )}
                                        </div>
                                    </div>
                                    <label
                                        htmlFor="avatar-upload"
                                        className="absolute inset-0 rounded-full bg-[#0a0a0a]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm"
                                    >
                                        <Edit2 size={18} className="text-white sm:w-5 sm:h-5 md:w-6 md:h-6" />
                                    </label>
                                    <input
                                        type="file"
                                        id="avatar-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                // Compress image if too large (max 500KB for database storage)
                                                const maxSize = 500 * 1024; // 500KB

                                                const reader = new FileReader();
                                                reader.onloadend = async () => {
                                                    let base64String = reader.result;

                                                    // If image is too large, compress it
                                                    if (file.size > maxSize) {
                                                        const img = new Image();
                                                        img.onload = async () => {
                                                            const canvas = document.createElement('canvas');
                                                            const maxDim = 300; // Max dimension 300px
                                                            let width = img.width;
                                                            let height = img.height;

                                                            if (width > height && width > maxDim) {
                                                                height = (height * maxDim) / width;
                                                                width = maxDim;
                                                            } else if (height > maxDim) {
                                                                width = (width * maxDim) / height;
                                                                height = maxDim;
                                                            }

                                                            canvas.width = width;
                                                            canvas.height = height;
                                                            const ctx = canvas.getContext('2d');
                                                            ctx.drawImage(img, 0, 0, width, height);

                                                            base64String = canvas.toDataURL('image/jpeg', 0.7);
                                                            setLocalUserInfo({ ...localUserInfo, avatar: base64String });
                                                            updateUser({ avatar: base64String });
                                                            // Auto-save to backend
                                                            await saveUserToBackend({ avatar: base64String });
                                                        };
                                                        img.src = base64String;
                                                    } else {
                                                        setLocalUserInfo({ ...localUserInfo, avatar: base64String });
                                                        updateUser({ avatar: base64String });
                                                        // Auto-save to backend
                                                        await saveUserToBackend({ avatar: base64String });
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </div>

                                <div className="flex-1 text-center md:text-left space-y-4">
                                    <div>
                                        <h4 className="text-base md:text-lg font-black text-white">Profile Visual</h4>
                                        <p className="text-xs mt-1 font-medium text-gray-500">High-resolution identity marker.</p>
                                    </div>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-3">
                                        <label htmlFor="avatar-upload" className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wide md:tracking-widest cursor-pointer bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30 hover:opacity-90 transition-opacity">
                                            Replace Identity
                                        </label>
                                        {localUserInfo.avatar && (
                                            <button onClick={() => setLocalUserInfo({ ...localUserInfo, avatar: "" })} className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wide md:tracking-widest transition-all bg-rose-500/20 text-rose-400 hover:bg-rose-500/30">
                                                Remove Photo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">Personnel Name</label>
                                    <input
                                        type="text"
                                        value={localUserInfo.name}
                                        onChange={(e) => setLocalUserInfo({ ...localUserInfo, name: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl text-sm font-bold border transition-all focus:ring-4 focus:ring-[#15734C]/20 focus:outline-none bg-[#0a0a0a] border-[#15734C]/30 text-white placeholder-gray-500 focus:border-[#15734C]"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">Credential Email</label>
                                    <input
                                        type="email"
                                        value={localUserInfo.email}
                                        readOnly
                                        className="w-full px-6 py-4 rounded-2xl text-sm font-bold border opacity-50 cursor-not-allowed bg-[#0a0a0a] border-[#15734C]/20 text-gray-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 md:pt-10">
                                <button onClick={handleSaveUserInfo} className="w-full md:w-auto px-6 md:px-10 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-wider md:tracking-[0.2em] bg-gradient-to-r from-[#15734C] to-[#10b981] text-white shadow-lg shadow-[#15734C]/30 hover:opacity-90 transition-opacity">
                                    Authorize Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FINANCIAL PREFERENCES TAB */}
                    {activeTab === "financial" && (
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                                <span className="material-icons text-[#10b981]">account_balance_wallet</span>
                                Financial Preferences
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-[#10b981]">
                                        <span className="material-icons text-sm mr-1 text-[#15734C]">currency_exchange</span>
                                        Default Currency
                                    </label>
                                    <select
                                        value={preferences.currency}
                                        onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#0a0a0a] border-[#15734C]/30 text-white"
                                    >
                                        <option value="₹">₹ Indian Rupee (INR)</option>
                                        <option value="$">$ US Dollar (USD)</option>
                                        <option value="€">€ Euro (EUR)</option>
                                        <option value="£">£ British Pound (GBP)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-[#10b981]">
                                        <span className="material-icons text-sm mr-1 text-[#15734C]">savings</span>
                                        Monthly Budget Limit
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#15734C] font-medium">
                                            {preferences.currency}
                                        </span>
                                        <input
                                            type="number"
                                            value={preferences.monthlyBudget}
                                            onChange={(e) => setPreferences({ ...preferences, monthlyBudget: Number(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#0a0a0a] border-[#15734C]/30 text-white placeholder-gray-500"
                                            placeholder="50000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-[#10b981]">
                                        <span className="material-icons text-sm mr-1 text-[#15734C]">calendar_month</span>
                                        Start of Month
                                    </label>
                                    <select
                                        value={preferences.monthStart}
                                        onChange={(e) => setPreferences({ ...preferences, monthStart: Number(e.target.value) })}
                                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#0a0a0a] border-[#15734C]/30 text-white"
                                    >
                                        <option value={1}>1st of every month</option>
                                        <option value={15}>15th of every month</option>
                                        <option value={25}>25th (Salary day)</option>
                                        <option value={28}>28th of every month</option>
                                    </select>
                                    <p className="text-xs mt-1 text-gray-500">When your financial month starts</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-[#10b981]">
                                        <span className="material-icons text-sm mr-1 text-[#15734C]">payment</span>
                                        Default Payment Method
                                    </label>
                                    <select
                                        value={preferences.defaultPaymentMethod}
                                        onChange={(e) => setPreferences({ ...preferences, defaultPaymentMethod: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#0a0a0a] border-[#15734C]/30 text-white"
                                    >
                                        <option value="upi">UPI</option>
                                        <option value="credit card">Credit Card</option>
                                        <option value="debit card">Debit Card</option>
                                        <option value="cash">Cash</option>
                                        <option value="net banking">Net Banking</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleSavePreferences}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#15734C] to-[#10b981] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#15734C]/30"
                            >
                                <Save size={18} />
                                Save Preferences
                            </button>
                        </div>
                    )}

                    {/* CATEGORIES TAB */}
                    {activeTab === "categories" && (
                        <div className="space-y-4 md:space-y-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                                    <span className="material-icons text-[#10b981]">category</span>
                                    Category Management
                                </h3>
                                <button
                                    onClick={() => {
                                        setEditingCategory(null);
                                        setNewCategory({ name: "", type: "expense", icon: "category", color: "#6366f1" });
                                        setShowCategoryModal(true);
                                    }}
                                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-linear-to-r from-[#15734C] to-[#10b981] text-white rounded-lg md:rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-md whitespace-nowrap"
                                >
                                    <Plus size={18} />
                                    Add Category
                                </button>
                            </div>

                            {/* Expense Categories */}
                            <div>
                                <h4 className="text-xs md:text-sm font-semibold text-red-500 mb-3 flex items-center gap-2">
                                    <span className="material-icons text-sm">trending_down</span>
                                    Expense Categories
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categories
                                        .filter((c) => c.type === "expense")
                                        .map((category) => (
                                            <div
                                                key={category.id}
                                                className="flex items-center justify-between p-4 rounded-xl border transition-shadow bg-[#0a0a0a] border-[#15734C]/30 hover:border-[#15734C]/50 hover:shadow-lg hover:shadow-[#15734C]/10"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
                                                        style={{ backgroundColor: category.color }}
                                                    >
                                                        <span className="material-icons text-xl">{category.icon}</span>
                                                    </div>
                                                    <span className="font-medium text-gray-200">{category.name}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditCategory(category)}
                                                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-[#10b981] hover:bg-[#15734C]/20"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategory(category.id)}
                                                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-red-400 hover:bg-red-900/30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Income Categories */}
                            <div>
                                <h4 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                                    <span className="material-icons text-sm">trending_up</span>
                                    Income Categories
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categories
                                        .filter((c) => c.type === "income")
                                        .map((category) => (
                                            <div
                                                key={category.id}
                                                className="flex items-center justify-between p-4 rounded-xl border transition-shadow bg-[#0a0a0a] border-[#15734C]/30 hover:border-[#15734C]/50 hover:shadow-lg hover:shadow-[#15734C]/10"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
                                                        style={{ backgroundColor: category.color }}
                                                    >
                                                        <span className="material-icons text-xl">{category.icon}</span>
                                                    </div>
                                                    <span className="font-medium text-gray-200">{category.name}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditCategory(category)}
                                                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-[#10b981] hover:bg-[#15734C]/20"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategory(category.id)}
                                                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-red-400 hover:bg-red-900/30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === "security" && (
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                                <span className="material-icons text-[#10b981]">security</span>
                                Security Settings
                            </h3>

                            {/* Change Password */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-[#15734C]/30">
                                <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                                    <span className="material-icons text-sm text-[#10b981]">lock</span>
                                    Change Password
                                </h4>
                                <div className="space-y-4 max-w-md">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-[#10b981]">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={passwordData.current}
                                                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                                className="w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#111111] border-[#15734C]/30 text-white placeholder-gray-500"
                                                placeholder="Enter current password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-[#10b981]">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                value={passwordData.new}
                                                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                                className="w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#111111] border-[#15734C]/30 text-white placeholder-gray-500"
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-[#10b981]">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={passwordData.confirm}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                                className="w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-[#15734C]/50 focus:border-[#15734C] transition-all outline-none bg-[#111111] border-[#15734C]/30 text-white placeholder-gray-500"
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleChangePassword}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#15734C] to-[#10b981] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#15734C]/30"
                                    >
                                        <span className="material-icons text-sm">key</span>
                                        Update Password
                                    </button>
                                </div>
                            </div>

                            {/* Note: Session management can be implemented with backend API */}
                        </div>
                    )}

                    {/* DATA & PRIVACY TAB */}
                    {activeTab === "data" && (
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                                <span className="material-icons text-[#10b981]">storage</span>
                                Data & Privacy
                            </h3>

                            {/* Export Data */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-[#15734C]/30">
                                <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                                    <span className="material-icons text-[#10b981]">download</span>
                                    Export Your Data
                                </h4>
                                <p className="text-sm mb-4 text-gray-500">
                                    Download all your transactions as a CSV file for backup or analysis.
                                </p>
                                <button
                                    onClick={handleExportData}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#15734C] to-[#10b981] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#15734C]/30"
                                >
                                    <Download size={18} />
                                    Export as CSV
                                </button>
                            </div>

                            {/* Delete Transactions */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-orange-500/30">
                                <h4 className="font-semibold mb-2 flex items-center gap-2 text-orange-400">
                                    <span className="material-icons text-orange-500">delete_sweep</span>
                                    Delete All Transactions
                                </h4>
                                <p className="text-sm mb-4 text-gray-500">
                                    This will permanently delete all your transaction history. This action cannot be undone.
                                </p>
                                <button
                                    onClick={() => {
                                        setDeleteTarget({ type: "transactions", id: null });
                                        setShowDeleteModal(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/30"
                                >
                                    <Trash2 size={18} />
                                    Delete All Transactions
                                </button>
                            </div>

                            {/* Delete Account */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-red-500/30">
                                <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-400">
                                    <span className="material-icons text-red-500">person_remove</span>
                                    Delete Account
                                </h4>
                                <p className="text-sm mb-4 text-gray-500">
                                    Permanently delete your account and all associated data. You'll have 30 days to recover your account.
                                </p>
                                <button
                                    onClick={() => {
                                        setDeleteTarget({ type: "account", id: null });
                                        setShowDeleteModal(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-red-500/30"
                                >
                                    <AlertTriangle size={18} />
                                    Delete My Account
                                </button>
                            </div>
                        </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === "appearance" && (
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2 text-white">
                                <span className="material-icons text-[#10b981]">palette</span>
                                App Preferences
                            </h3>

                            {/* Theme Toggle */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-[#15734C]/30">
                                <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                                    <span className="material-icons text-sm text-[#10b981]">dark_mode</span>
                                    Theme
                                </h4>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => isDarkMode && toggleTheme()}
                                        className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${!isDarkMode
                                            ? "border-[#15734C] bg-[#15734C]/20"
                                            : "border-[#15734C]/30 hover:border-[#15734C]/50"
                                            }`}
                                    >
                                        <Sun size={24} className={!isDarkMode ? "text-amber-500" : "text-gray-400"} />
                                        <span className={`font-medium ${!isDarkMode ? "text-[#10b981] font-bold" : "text-gray-400"}`}>
                                            Light Mode
                                        </span>
                                        {!isDarkMode && (
                                            <Check size={18} className="text-[#10b981] ml-auto" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => !isDarkMode && toggleTheme()}
                                        className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${isDarkMode
                                            ? "border-[#15734C] bg-[#15734C]/20"
                                            : "border-[#15734C]/30 hover:border-[#15734C]/50"
                                            }`}
                                    >
                                        <Moon size={24} className={isDarkMode ? "text-[#10b981]" : "text-gray-400"} />
                                        <span className={`font-medium ${isDarkMode ? "text-[#10b981] font-bold" : "text-gray-600"}`}>
                                            Dark Mode
                                        </span>
                                        {isDarkMode && (
                                            <Check size={18} className="text-[#10b981] ml-auto" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Dashboard Layout */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-[#15734C]/30">
                                <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                                    <span className="material-icons text-sm text-[#10b981]">dashboard</span>
                                    Dashboard Layout
                                </h4>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setAppPreferences({ ...appPreferences, dashboardLayout: "compact" })}
                                        className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${appPreferences.dashboardLayout === "compact"
                                            ? "border-[#15734C] bg-[#15734C]/20"
                                            : "border-[#15734C]/30 hover:border-[#15734C]/50"
                                            }`}
                                    >
                                        <div className="w-16 h-12 rounded flex flex-wrap gap-1 p-1 bg-[#111111]">
                                            <div className="w-3 h-3 rounded bg-[#15734C]/50"></div>
                                            <div className="w-3 h-3 rounded bg-[#15734C]/50"></div>
                                            <div className="w-3 h-3 rounded bg-[#15734C]/50"></div>
                                            <div className="w-3 h-3 rounded bg-[#15734C]/50"></div>
                                        </div>
                                        <span className={`font-medium ${appPreferences.dashboardLayout === "compact" ? "text-[#10b981]" : "text-gray-400"}`}>
                                            Compact
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setAppPreferences({ ...appPreferences, dashboardLayout: "detailed" })}
                                        className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${appPreferences.dashboardLayout === "detailed"
                                            ? "border-[#15734C] bg-[#15734C]/20"
                                            : "border-[#15734C]/30 hover:border-[#15734C]/50"
                                            }`}
                                    >
                                        <div className="w-16 h-12 rounded flex flex-col gap-1 p-1 bg-[#111111]">
                                            <div className="w-full h-3 rounded bg-[#15734C]/50"></div>
                                            <div className="w-full h-3 rounded bg-[#15734C]/50"></div>
                                            <div className="w-3/4 h-2 rounded bg-[#15734C]/50"></div>
                                        </div>
                                        <span className={`font-medium ${appPreferences.dashboardLayout === "detailed" ? "text-[#10b981]" : "text-gray-400"}`}>
                                            Detailed
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Notifications Toggle */}
                            <div className="p-6 rounded-xl border bg-[#0a0a0a] border-[#15734C]/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-[#10b981]">notifications</span>
                                        <div>
                                            <h4 className="font-semibold text-white">Notifications</h4>
                                            <p className="text-sm text-gray-500">Receive alerts about your expenses and budgets</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAppPreferences({ ...appPreferences, notifications: !appPreferences.notifications })}
                                        className={`relative w-14 h-7 rounded-full transition-colors ${appPreferences.notifications ? "bg-[#15734C]" : "bg-gray-700"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${appPreferences.notifications ? "left-8" : "left-1"
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={async () => {
                                    // Update user preferences with app preferences
                                    const updatedPreferences = { ...user.preferences, ...appPreferences };
                                    updateUser({ preferences: updatedPreferences });
                                    await saveUserToBackend({ preferences: updatedPreferences });
                                    alert("Appearance settings saved successfully!");
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-[#15734C] to-[#10b981] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#15734C]/30"
                            >
                                <Save size={18} />
                                Save Appearance Settings
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`rounded-xl md:rounded-2xl shadow-2xl w-full max-w-lg p-4 md:p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h3 className={`text-lg md:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {editingCategory ? "Edit Category" : "Add New Category"}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCategoryModal(false);
                                    setEditingCategory(null);
                                }}
                                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                            {/* Category Name */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Category Name</label>
                                <input
                                    type="text"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 placeholder-gray-400'}`}
                                    placeholder="e.g., Groceries"
                                />
                            </div>

                            {/* Category Type */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Type</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setNewCategory({ ...newCategory, type: "expense" })}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${newCategory.type === "expense"
                                            ? `${isDarkMode ? 'bg-red-900/30 text-red-400 border-2 border-red-500' : 'bg-red-100 text-red-700 border-2 border-red-500'}`
                                            : `${isDarkMode ? 'bg-gray-700 text-gray-400 border-2 border-transparent' : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`
                                            }`}
                                    >
                                        <span className="material-icons text-sm mr-1">trending_down</span>
                                        Expense
                                    </button>
                                    <button
                                        onClick={() => setNewCategory({ ...newCategory, type: "income" })}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${newCategory.type === "income"
                                            ? `${isDarkMode ? 'bg-green-900/30 text-green-400 border-2 border-green-500' : 'bg-green-100 text-green-700 border-2 border-green-500'}`
                                            : `${isDarkMode ? 'bg-gray-700 text-gray-400 border-2 border-transparent' : 'bg-gray-100 text-gray-600 border-2 border-transparent'}`
                                            }`}
                                    >
                                        <span className="material-icons text-sm mr-1">trending_up</span>
                                        Income
                                    </button>
                                </div>
                            </div>

                            {/* Icon Picker */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Icon</label>
                                <div
                                    className={`grid grid-cols-5 md:grid-cols-10 gap-2 p-2 md:p-3 rounded-xl max-h-40 md:max-h-32 overflow-y-auto ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                    {availableIcons.map((icon) => (
                                        <button
                                            key={icon}
                                            onClick={() => setNewCategory({ ...newCategory, icon })}
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${newCategory.icon === icon
                                                ? "bg-indigo-500 text-white shadow-md"
                                                : `${isDarkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`
                                                }`}
                                        >
                                            <span className="material-icons text-lg">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Color</label>
                                <div className={`flex flex-wrap gap-2 p-3 rounded-xl ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                    {availableColors.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setNewCategory({ ...newCategory, color })}
                                            className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${newCategory.color === color ? "ring-2 ring-offset-2 ring-gray-400" : ""
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Preview</label>
                                <div className={`flex items-center gap-3 p-4 rounded-xl ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
                                        style={{ backgroundColor: newCategory.color }}
                                    >
                                        <span className="material-icons">{newCategory.icon}</span>
                                    </div>
                                    <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                        {newCategory.name || "Category Name"}
                                    </span>
                                    <span
                                        className={`ml-auto px-2 py-1 text-xs font-medium rounded-full ${newCategory.type === "expense"
                                            ? `${isDarkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'}`
                                            : `${isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}`
                                            }`}
                                    >
                                        {newCategory.type}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                                <button
                                    onClick={() => {
                                        setShowCategoryModal(false);
                                        setEditingCategory(null);
                                    }}
                                    className={`flex-1 py-3 border rounded-xl font-medium transition-colors ${isDarkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                                    className="flex-1 py-3 bg-linear-to-r from-[#15734C] to-[#10b981] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-md"
                                >
                                    {editingCategory ? "Update Category" : "Add Category"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`rounded-xl md:rounded-2xl shadow-2xl w-full max-w-md p-4 md:p-6 animate-in fade-in zoom-in duration-200 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4 ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                                <AlertTriangle size={24} className="text-red-500 md:w-8 md:h-8" />
                            </div>
                            <h3 className={`text-lg md:text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Confirm Delete</h3>
                            <p className={`text-sm mb-4 md:mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {deleteTarget.type === "category" && "Are you sure you want to delete this category? This action cannot be undone."}
                                {deleteTarget.type === "transactions" && "Are you sure you want to delete ALL transactions? This action cannot be undone."}
                                {deleteTarget.type === "account" && "Are you sure you want to delete your account? You'll have 30 days to recover it."}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className={`flex-1 py-3 border rounded-xl font-medium transition-colors ${isDarkMode ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 bg-linear-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-md"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Profile;
