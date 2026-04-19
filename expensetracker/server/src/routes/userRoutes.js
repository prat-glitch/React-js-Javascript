const userRoutes = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    registerUser,
    loginUser,
    verifyToken,
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteAccount
} = require('../controllers/userController');

// Authentication routes (public)
userRoutes.post('/register', registerUser);
userRoutes.post('/login', loginUser);
userRoutes.get('/verify-token', verifyToken);

// Protected routes - require authentication
// Get user profile
userRoutes.get('/:id', protect, getUserProfile);

// Update user profile
userRoutes.put('/:id', protect, updateUserProfile);

// Change password
userRoutes.put('/:id/password', protect, changePassword);

// Soft delete account
userRoutes.delete('/:id', protect, deleteAccount);

module.exports = userRoutes;
