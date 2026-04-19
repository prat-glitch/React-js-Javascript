const express = require('express');
require('dotenv').config();  // Load .env FIRST

const connectdb = require('./src/config/db');
const cors = require('cors');

// Routes
const transactionRoutes = require('./src/routes/Transactionroutes');
const userRoutes = require('./src/routes/userRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const dataRoutes = require('./src/routes/dataRoutes');
const budgetRoutes = require('./src/routes/budgetRoutes');

const app = express();

// --- CORS Configuration (Simplified for Vercel) ---
app.use((req, res, next) => {
  // Allow all origins (or specify your frontend domain)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS method
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Connect to MongoDB (non-blocking) ---
connectdb().catch(err => console.error('DB connection error:', err));

// --- Test Route ---
app.get('/', (req, res) => {
    res.json({ 
        message: 'Expense Tracker API is running',
        status: 'OK',
        endpoints: {
            transactions: '/api/transactions',
            users: '/api/users',
            categories: '/api/categories',
            data: '/api/data',
            budgets: '/api/budgets'
        }
    });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// --- API Routes ---
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/budgets', budgetRoutes);

// Global error handler - ensure CORS headers on errors too
app.use((err, req, res, next) => {
    // Set CORS headers
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;

// Only listen when not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
