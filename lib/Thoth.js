if(!global.SC) require('./core/sc/runtime/core');
require('./core/sc/query');

//create main object
var Thoth = SC.Object.create({
  NAMESPACE: 'Thoth',
  VERSION: '0.1.0'
});

// require other basic classes
Thoth.SocketListener = require('./core/SocketListener').SocketListener;
Thoth.UserCache = require('./core/UserCache').UserCache;
Thoth.Auth = require('./core/Auth').Auth;
Thoth.FileAuth = require('./FileAuth').FileAuth;
Thoth.Session = require('./core/Session').Session;
Thoth.Store = require('./core/Store').Store;
Thoth.MemStore = require('./core/MemStore').MemStore;
Thoth.DiskStore = require('./core/DiskStore').DiskStore;
Thoth.Server = require('./core/Server').Server;

exports.Thoth = Thoth;