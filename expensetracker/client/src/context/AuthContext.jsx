import React, { createContext, useContext, useState, useEffect } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, '');

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    // Check if user is already logged in on mount and verify token
    useEffect(() => {
        const verifyAuth = async () => {
            const token = localStorage.getItem("expense_track_token");
            
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                // Verify token with backend and get fresh user data
                const response = await fetch(`${API_BASE}/users/verify-token`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // Normalize user data - ensure both id and _id exist
                    const normalizedUser = {
                        ...data.user,
                        id: data.user.id || data.user._id,
                        _id: data.user._id || data.user.id
                    };
                    // Update localStorage with fresh user data from database
                    localStorage.setItem("expense_track_user", JSON.stringify(normalizedUser));
                    setCurrentUser(normalizedUser);
                    setIsAuthenticated(true);
                } else {
                    // Token invalid, clear storage
                    localStorage.removeItem("expense_track_token");
                    localStorage.removeItem("expense_track_user");
                    setIsAuthenticated(false);
                    setCurrentUser(null);
                }
            } catch (error) {
                console.error("Auth verification failed:", error);
                // Keep existing data if server is unreachable
                const savedUser = localStorage.getItem("expense_track_user");
                if (savedUser) {
                    try {
                        const user = JSON.parse(savedUser);
                        // Normalize user data
                        const normalizedUser = {
                            ...user,
                            id: user.id || user._id,
                            _id: user._id || user.id
                        };
                        setCurrentUser(normalizedUser);
                        setIsAuthenticated(true);
                    } catch (e) {
                        // Invalid JSON, clear storage
                        localStorage.removeItem("expense_track_user");
                        localStorage.removeItem("expense_track_token");
                    }
                }
            }
            
            setLoading(false);
        };

        verifyAuth();
    }, []);

    const login = (token, user) => {
        // Normalize user data - ensure both id and _id exist
        const normalizedUser = {
            ...user,
            id: user.id || user._id,
            _id: user._id || user.id
        };
        
        localStorage.setItem("expense_track_token", token);
        localStorage.setItem("expense_track_user", JSON.stringify(normalizedUser));
        setCurrentUser(normalizedUser);
        setIsAuthenticated(true);
        
        // Dispatch event to notify UserContext to sync
        window.dispatchEvent(new Event('userLoggedIn'));
    };

    const logout = () => {
        localStorage.removeItem("expense_track_token");
        localStorage.removeItem("expense_track_user");
        setCurrentUser(null);
        setIsAuthenticated(false);
        // Redirect to login page
        window.location.href = "/login";
    };

    const updateCurrentUser = (userData) => {
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem("expense_track_user", JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ 
            isAuthenticated, 
            loading, 
            currentUser,
            login, 
            logout,
            updateCurrentUser 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
