const express = require('express');
const cors = require('cors');
const ImageKit = require('imagekit');

const app = express();

// ✅ Use CORS to allow requests from your frontend
app.use(cors({
  origin: 'http://localhost:5173', // 👈 match your frontend URL
  methods: ['GET'],
}));

// ===========================================
// Add your ImageKit.io credentials here 🔒
// ===========================================
const imagekit = new ImageKit({
  publicKey: 'public_QNONAWZ6yKSuzoKyG1Ruo3u8cX8=',   // ✅ replace with your public key
  privateKey: 'private_9gkBFb3WHZjPeNMYvPVnN83vk8k=',               // ⚠️ keep secret, never put in frontend
  urlEndpoint: 'https://ik.imagekit.io/prat123/',    // ✅ replace with your ImageKit URL endpoint
});

// ✅ Authentication endpoint for frontend
app.get('/auth', (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.status(200).json(authParams);  // return JSON (frontend expects JSON)
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Failed to get auth params' });
  }
});

// ✅ Start backend server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
});
