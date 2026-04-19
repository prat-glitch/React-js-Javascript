const dataRoutes = require('express').Router();
const {
    exportData,
    deleteAllTransactions
} = require('../controllers/dataController');

// Export user data as CSV
dataRoutes.get('/export/:userid', exportData);

// Delete all transactions for a user
dataRoutes.delete('/transactions/:userid', deleteAllTransactions);

module.exports = dataRoutes;
