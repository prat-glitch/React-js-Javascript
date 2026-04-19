const mongoose = require('mongoose');

// Category Budget Schema - for individual category allocations
const categoryBudgetSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    categoryName: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 }
});

// Main Budget Schema
const budgetSchema = new mongoose.Schema({
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    totalBudget: { type: Number, required: true, default: 0 },
    categoryBudgets: [categoryBudgetSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure one budget per user per month/year
budgetSchema.index({ userid: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);