let aboutMessage = 'Issue Tracker API v1.0';
const { mustBeSignedIn } = require('./auth.js');

function setMessage(_, { message }) {
  aboutMessage = message;
  return aboutMessage;
}

function getMessage() {
  return aboutMessage;
}

module.exports = { getMessage, setMessage: mustBeSignedIn(setMessage) };
