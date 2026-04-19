const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    getBudget,
    saveBudget,
    getSavingsAnalysis,
    deleteBudget
} = require('../controllers/budgetController');

// All routes require authentication
// Get budget for a month/year
router.get('/', protect, getBudget);

// Get savings analysis
router.get('/analysis', protect, getSavingsAnalysis);

// Create or update budget
router.post('/', protect, saveBudget);

// Delete budget
router.delete('/:month/:year', protect, deleteBudget);

module.exports = router;
