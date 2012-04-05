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
    },
    
    'it has a internal attachHandlers function': function(t){
      assert.isFunction(t._attachHandlers);
    },
    
    'it has a start function': function(t){
      assert.isFunction(t.start);
    }
  }
})
.addBatch({
  'authWrapper': {
    topic: function(){
      var s = base.Thoth.SocketIO.create();
      s.__TESTCLIENT = {
        handshake: {}
      };
      return s;
    },
    
    'should': {
      topic: function(socket){
        return socket._authWrapper(socket.__TESTCLIENT);
      },
      
      'return a function': function(t){
        assert.isFunction(t);
      },
      
      'return a function which when called with only a username': {
        topic: function(authwr,socket){
          var me = this;
          socket.__TESTCLIENT.emit = function(event,data){
            me.callback(null, { evt: event, data: data });
          };
          socket.authModule = {};
          socket.sessionModule = {};
          authwr({ user: 'testuser' });
        },
        
        'should call the clients emit function with an authError': function(t){
          assert.isObject(t);
          assert.isString(t.evt);
          assert.isObject(t.data);
          assert.isString(t.data.errorMsg);
          assert.equal(t.evt, 'authError');
        }
      },
      
      'return a function which when called with both a username and a password': {
        topic: function(authwr,socket){
          var me = this;
          // socket.__TESTCLIENT.emit = function(event,data){
          //             me.callback(null, { evt: event, data: data });
          //           };
          socket.authModule = {
            checkAuth: function(userdata){
              me.callback(null,userdata);
            }
          };
          socket.sessionModule = {};
          authwr({ user: 'testuser',passwd: 'test' });
        },        
        
        'should call the authentication module with the provided data': function(t){
          assert.isObject(t);
          assert.isString(t.user);
          assert.isString(t.passwd);
          assert.equal(t.user,'testuser');
          assert.equal(t.passwd, 'test');
        }
      },
      
      'return a function which when called with both a username and a password which auth succesfully': {
        topic: function(authwr,socket){
          var me = this;
          socket.authModule = {
            checkAuth: function(userdata,callback){
              callback({ user: userdata.user, role: 'testrole'});
            }
          };
          socket.sessionModule = {
            createSession: function(userdata,callback){
              me.callback(null,userdata);
            }
          };
          authwr({ user: 'testuser',passwd: 'test' });          
        },
        
        'should call the session module to create a session': function(t){
          assert.isObject(t);
          assert.isString(t.user);
          assert.isString(t.role);
          assert.equal(t.user,'testuser');
          assert.equal(t.role,'testrole');
        }
      },
      
      'return a function which when called with both a username and a password which auth succesfully and create a new session': {
        topic: function(authwr,socket){
          var me = this;
          socket.authModule = {
            checkAuth: function(userdata,callback){
              callback({ user: userdata.user, role: 'testrole'});
            }
          };
          socket.sessionModule = {
            createSession: function(userdata,callback){
              callback(null, { username: userdata.user, userData: userdata, sessionKey: 'testSessionKey'});
            }
          };
          socket.__TESTCLIENT.emit = function(evt,data){
            me.callback(null,{evt: evt, data: data});
          };
          authwr({ user: 'testuser',passwd: 'test' });          
        },
        
        'should call the clients emit function with a success': function(t){
          assert.isString(t.evt);
          assert.equal(t.evt,'authSuccess');
          assert.isObject(t.data);
          assert.isString(t.data.user);
          assert.isString(t.data.sessionKey);
          assert.equal(t.data.user,'testuser');
          assert.equal(t.data.sessionKey,'testSessionKey');
        }
      }
    }
  }
})

.run();