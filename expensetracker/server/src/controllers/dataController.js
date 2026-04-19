const Transaction = require('../models/transactionsmodel');
const Category = require('../models/category');

// Export data as CSV
const exportData = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userid: req.params.userid })
            .populate('categoryid', 'name type')
            .sort({ date: -1 });

        // Generate CSV content
        let csvContent = 'Date,Amount,Type,Category,Description,Payment Method\n';

        transactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString();
            const category = t.categoryid ? t.categoryid.name : 'Unknown';
            const description = (t.description || '').replace(/,/g, ';');
            csvContent += `${date},${t.amount},${t.type},${category},"${description}",${t.paymentmetod}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
        res.send(csvContent);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete all transactions for a user
const deleteAllTransactions = async (req, res) => {
    try {
        const result = await Transaction.deleteMany({ userid: req.params.userid });
        res.json({
            message: 'All transactions deleted successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    exportData,
    deleteAllTransactions
};
