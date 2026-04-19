const mongoose = require('mongoose');

const userschema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    Password: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String },
    preferences: {
        currency: { type: String, default: '₹', enum: ['₹', '$', '€', '£'] },
        monthlyBudget: { type: Number, default: 0 },
        monthStart: { type: Number, default: 1, min: 1, max: 31 },
        defaultPaymentMethod: { type: String, default: 'upi', enum: ['cash', 'credit card', 'debit card', 'upi', 'net banking'] },
        theme: { type: String, default: 'light', enum: ['light', 'dark'] },
        dashboardLayout: { type: String, default: 'detailed', enum: ['compact', 'detailed'] },
        notifications: { type: Boolean, default: true }
    },
    isDeleted: { type: Boolean, default: false },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userschema);
