const transactionRoutes = require("express").Router();
const { protect } = require("../middlewares/authMiddleware");
const {
    createTransaction,
    getallTransactions,
    getTransactionsByUser,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    getTransactionStats
} = require("../controllers/Transactionscontroller");

// All routes require authentication
// Get all transactions for authenticated user
transactionRoutes.get('/', protect, getallTransactions);

// Get transaction statistics for authenticated user
transactionRoutes.get('/stats', protect, getTransactionStats);

// Get transactions by user ID
transactionRoutes.get("/user/:userid", protect, getTransactionsByUser);

// Get single transaction by ID
transactionRoutes.get("/:id", protect, getTransactionById);

// Create a new transaction
transactionRoutes.post("/", protect, createTransaction);

// Update transaction
transactionRoutes.put("/:id", protect, updateTransaction);

// Delete transaction
transactionRoutes.delete("/:id", protect, deleteTransaction);

module.exports = transactionRoutes;
