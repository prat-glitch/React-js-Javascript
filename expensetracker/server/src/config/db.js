const mongoose = require('mongoose');

const connectdb = async() => {
    try {
        const mongoUri = process.env.MONGO_URI;
        
        if (!mongoUri) {
            console.error('ERROR: MONGO_URI is not defined in environment variables');
            return;
        }

        await mongoose.connect(mongoUri);
        console.log("MongoDB connected successfully");
        console.log("Database:", mongoose.connection.name);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        // Don't exit process in serverless environment
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
}

module.exports = connectdb;