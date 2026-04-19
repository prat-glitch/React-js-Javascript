const jwt = require('jsonwebtoken');
const User = require('../models/usermodel');

const JWT_SECRET = process.env.JWT_SECRET || 'expense_tracker_secret_key_2024';

// Middleware to protect routes - requires valid JWT token
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-Password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.isDeleted) {
            return res.status(401).json({ message: 'Account has been deleted' });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired, please login again' });
        }
        res.status(401).json({ message: 'Not authorized', error: error.message });
    }
};

// Optional auth - doesn't fail if no token, but attaches user if valid token exists
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.id).select('-Password');
            if (user && !user.isDeleted) {
                req.user = user;
            }
        }
        
        next();
    } catch (error) {
        // Continue without user if token is invalid
        next();
    }
};

module.exports = { protect, optionalAuth };
