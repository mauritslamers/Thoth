if(!global.SC) require('./core/sc/runtime/core');
require('./core/sc/query');
var sys = require('sys');

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
Thoth.RPCHooks = require('./core/RPCHooks').RPCHooks;
Thoth.Policies = require('./core/Policies').Policies;
Thoth.PolicyModel = require('./core/PolicyModel').PolicyModel;

// add some nice functions from sys
Thoth.log = sys.log;
Thoth.inspect = sys.inspect;

Thoth.copy = function(obj){
  if(!obj) return obj;
  var ret = {}, i;
  for(i in obj){
    if(typeof obj[i] === 'object'){
      ret[i] = Thoth.copy(obj[i]); //recursive copy of nested objects
    } 
    else ret[i] = obj[i];
  }
  return ret;
};

exports.Thoth = Thoth;