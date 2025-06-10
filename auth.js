const Router = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('apollo-server-express');

let { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV !== 'production') {
    JWT_SECRET = 'tempjwtsecretfordevonly';
    console.log('Missing env var JWT_SECRET. Using unsafe dev secret');
  } else {
    console.log('Missing env var JWT_SECRET. Authentication disabled');
  }
}

const routes = new Router();
routes.use(bodyParser.json());

function generateJWT(googleAuthData) {
  if (!JWT_SECRET) {
    return { error: 'Missing JWT_SECRET. Refusing to authenticate' };
  }

  const { name, email, email_verified, given_name, family_name, picture } = googleAuthData;
  if (!email_verified) {
    return { error: 'Email is not verified. Authentication denied' };
  }

  const credentials = {
    signedIn: true,
    name,
    email,
    given_name,
    family_name,
    picture,
  };

  return jwt.sign(credentials, JWT_SECRET, { expiresIn: '1h' });
}

function getUser(req) {
  const token = req.cookies.jwt;
  if (!token) return { signedIn: false };

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    console.error('JWT verification error:', e);
    return { signedIn: false };
  }
}

function clearJWTToken(res) {
  res.clearCookie('jwt', { 
    path: '/', 
    httpOnly: true, 
    secure: false, 
    sameSite: 'None',
  });
  res.json({ status: 'ok', message: 'Signed out successfully' });
}

function mustBeSignedIn(resolver) {
  return (root, args, { user }) => {
    if (!user || !user.signedIn) {
      throw new AuthenticationError('You must be signed in');
    }
    return resolver(root, args, { user });
  };
}

module.exports = { routes, generateJWT, clearJWTToken, getUser, mustBeSignedIn };
