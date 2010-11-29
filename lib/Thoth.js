if(!global.SC) require('./sc/runtime/core');
require('./sc/query');

//create main object
var Thoth = SC.Object.create({
  NAMESPACE: 'Thoth',
  VERSION: '0.1.0'
});

// require other basic classes
Thoth.SocketListener = require('./SocketListener').SocketListener;
Thoth.UserCache = require('./UserCache').UserCache;
Thoth.Auth = require('./Auth').Auth;
Thoth.FileAuth = require('./FileAuth').FileAuth;
Thoth.Session = require('./Session').Session;
Thoth.Store = require('./Store').Store;
Thoth.Server = require('./Server').Server;

exports.Thoth = Thoth;