const categoryRoutes = require('express').Router();
const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');

// Get all categories for a user
categoryRoutes.get('/user/:userid', getCategories);

// Create a new category
categoryRoutes.post('/', createCategory);

// Update a category
categoryRoutes.put('/:id', updateCategory);

// Delete a category
categoryRoutes.delete('/:id', deleteCategory);

module.exports = categoryRoutes;
