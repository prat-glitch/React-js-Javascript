import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("expense_track_user");
        return savedUser ? JSON.parse(savedUser) : {
            name: "",
            email: "",
            phone: "",
            avatar: "",
            preferences: {}
        };
    });

    // Listen for storage changes (from AuthContext login)
    useEffect(() => {
        const handleStorageChange = () => {
            const savedUser = localStorage.getItem("expense_track_user");
            if (savedUser) {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
            }
        };

        // Listen for custom event when user logs in
        window.addEventListener('userLoggedIn', handleStorageChange);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('userLoggedIn', handleStorageChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem("expense_track_user", JSON.stringify(user));
    }, [user]);

    // Update user in state and localStorage
    const updateUser = useCallback((newData) => {
        setUser(prev => ({ ...prev, ...newData }));
    }, []);

    // Sync user from localStorage (called after login)
    const syncUserFromStorage = useCallback(() => {
        const savedUser = localStorage.getItem("expense_track_user");
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    // Save user profile to backend database
    const saveUserToBackend = async (userData) => {
        try {
            const token = localStorage.getItem('expense_track_token');
            if (!token || !user.id) return false;

            const response = await fetch(`${API_BASE}/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                const updatedUser = await response.json();
                // Update local state with response from server
                setUser(prev => ({
                    ...prev,
                    name: updatedUser.name || prev.name,
                    phone: updatedUser.phone || prev.phone,
                    avatar: updatedUser.avatar || prev.avatar,
                    preferences: updatedUser.preferences || prev.preferences
                }));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to save user to backend:", error);
            return false;
        }
    };

    // Fetch latest user data from backend
    const refreshUser = async () => {
        try {
            const token = localStorage.getItem('expense_track_token');
            if (!token) return;

            const response = await fetch(`${API_BASE}/users/verify-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.user) {
                    setUser({
                        id: data.user.id,
                        name: data.user.name,
                        email: data.user.email,
                        phone: data.user.phone || "",
                        avatar: data.user.avatar || "",
                        preferences: data.user.preferences || {}
                    });
                }
            }
        } catch (error) {
            console.error("Failed to refresh user:", error);
        }
    };

    return (
        <UserContext.Provider value={{ user, updateUser, saveUserToBackend, refreshUser, syncUserFromStorage }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};
