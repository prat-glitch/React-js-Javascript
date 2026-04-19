import React from "react";
import { Link } from "react-router-dom";
import {
    User,
    Mail,
    Phone,
    Edit2,
    Settings,
    Wallet,
    Shield,
} from "lucide-react";

import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";

const ProfileOverview = () => {
    const { isDarkMode } = useTheme();
    const { user } = useUser();

    const getInitials = (name) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const quickActions = [
        {
            icon: <User size={18} />,
            label: "Edit Profile",
            link: "/settings",
        },
        {
            icon: <Wallet size={18} />,
            label: "Financial",
            link: "/settings",
        },
        {
            icon: <Shield size={18} />,
            label: "Security",
            link: "/settings",
        },
    ];

    return (
        <main className={`
            min-h-screen pb-24 lg:pb-0
            lg:ml-64 xl:ml-72
            w-full lg:w-[calc(100%-16rem)] xl:w-[calc(100%-18rem)]
            p-4 lg:p-6
            ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
        `}>
            <div className="max-w-3xl mx-auto">
                {/* Profile Header Card */}
                <div className={`p-6 sm:p-8 lg:p-10 xl:p-12 rounded-2xl sm:rounded-3xl mb-6 lg:mb-8 shadow-lg ${isDarkMode ? 'bg-linear-to-br from-[#0f5a3b] to-[#15734C]' : 'bg-linear-to-br from-[#15734C] to-[#10b981]'}`}>
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 lg:gap-8">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl font-bold shadow-xl border-2 sm:border-4 border-white/20">
                                {user.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt="Avatar"
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    getInitials(user.name)
                                )}
                            </div>
                            <Link
                                to="/settings"
                                className="absolute -bottom-1 -right-1 w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                            >
                                <Edit2 size={16} className={`lg:w-5 lg:h-5 ${isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]'}`} />
                            </Link>
                        </div>

                        {/* User Info */}
                        <div className="text-center sm:text-left text-white flex-1 space-y-2 lg:space-y-3">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold">{user.name}</h1>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 lg:gap-6 text-xs sm:text-sm lg:text-base text-white/80">
                                <span className="flex items-center gap-1.5 lg:gap-2 justify-center sm:justify-start">
                                    <Mail size={14} className="lg:w-5 lg:h-5" />
                                    <span className="truncate max-w-[180px] sm:max-w-none">{user.email}</span>
                                </span>
                                {user.phone && (
                                    <span className="flex items-center gap-1.5 lg:gap-2 justify-center sm:justify-start">
                                        <Phone size={14} className="lg:w-5 lg:h-5" />
                                        {user.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-md bg-[#111111] border border-[#15734C]/30">
                    <div className="px-5 lg:px-6 py-4 lg:py-5 border-b border-[#15734C]/20 bg-[#0a0a0a]">
                        <h2 className="text-sm lg:text-base font-semibold flex items-center gap-2 text-white">
                            <Settings size={18} className="lg:w-5 lg:h-5 text-[#10b981]" />
                            Quick Settings
                        </h2>
                    </div>
                    <div className="divide-y divide-[#15734C]/20">
                        {quickActions.map((item, index) => (
                            <Link
                                key={index}
                                to={item.link}
                                className="flex items-center justify-between p-4 sm:p-5 lg:p-6 transition-colors hover:bg-[#15734C]/10"
                            >
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl flex items-center justify-center bg-[#15734C]/20 text-[#10b981]">
                                        {item.icon}
                                    </div>
                                    <span className="font-medium text-sm lg:text-base text-gray-200">{item.label}</span>
                                </div>
                                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ProfileOverview;
