const Category = require('../models/category');

// Get all categories for a user
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ userid: req.params.userid });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create a new category
const createCategory = async (req, res) => {
    try {
        const { name, userid, type, icon, color } = req.body;

        // Check if category with same name exists for user
        const existingCategory = await Category.findOne({ name, userid });
        if (existingCategory) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const category = new Category({
            name,
            userid,
            type,
            icon: icon || 'category',
            color: color || '#6366f1'
        });

        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update a category
const updateCategory = async (req, res) => {
    try {
        const { name, type, icon, color } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (type) updateData.type = type;
        if (icon) updateData.icon = icon;
        if (color) updateData.color = color;

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete a category
const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
