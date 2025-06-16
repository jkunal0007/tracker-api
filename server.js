require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const { connectToDb } = require('./db.js');
const { installHandler } = require('./api_handler.js');
const { OAuth2Client } = require('google-auth-library');
const { routes, generateJWT, clearJWTToken, getUser } = require('./auth.js');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', routes);

// Add headers for cross-origin isolation
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

const corsOptions = {
  origin: 'http://localhost:8000',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight requests

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body; 

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,  
    });

    const payload = ticket.getPayload();
    const jwtToken = generateJWT(payload);
    console.log('Token:', jwtToken)
    
    res.cookie('jwt', jwtToken, {
      path: '/',
      httpOnly: true, // Better security (prevent client-side access)
      secure: false, 
      sameSite: 'None', 
    });
    console.log('Response Headers:', res.getHeaders());
    res.json({ message: 'Authenticated successfully', user: payload });
  } catch (error) {
    console.error('Error during Google authentication:', error);
    res.status(400).json({ error: 'Invalid token' });
  }
});

app.post('/api/auth/signout', async (req, res) => {
  clearJWTToken(res);
});

app.post('/api/auth/user', (req, res) => {
  const user = getUser(req);
  res.json(user);
});

installHandler(app);

const port = process.env || 3000;

(async function start() {
  try {
    await connectToDb();  
    app.listen(port, () => {
      console.log(`API server started on port ${port}`);
    });
  } catch (err) {
    console.error('Startup Error:', err);
  }
})();
