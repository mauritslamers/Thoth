var base = require('../../testbase');
var assert = base.assert;
var socketioTests = base.vows.describe("Socket.IO Module tests");
var API = base.Thoth.API;           
var C = base.Thoth.Constants;
var sys = require('util');

socketioTests.addBatch({
  'If the socket.io module is complete': {
    topic: base.Thoth.SocketIO.prototype,
    
    'it has a ThothServer property of null ': function(t){
      assert.isNull(t.ThothServer);
    },
    
    'it has an internal property for a socket.io ref': function(t){
      assert.isNull(t._socketio);
    },
    
    'it has an internal property for tracking handlers': function(t){
      assert.isNull(t._handlers);
    },
    
    'it has an authentication wrapper': function(t){
      assert.isFunction(t._authWrapper);
    },
    
    'it has an reauthentication wrapper': function(t){
      assert.isFunction(t._reauthWrapper);
    },
    
    'it has a logout wrapper': function(t){
      assert.isFunction(t._logoutWrapper);
    },
    
    'it has a event registering function': function(t){
      assert.isFunction(t.on);
    }
  }
})

.run()