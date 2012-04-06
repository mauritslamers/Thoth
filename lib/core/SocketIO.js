/*globals Buffer*/

var sys = require('./Tools').sys;
var API = require('./API');
var Constants = require('./Constants');
var SIO;

exports.SocketIO = SC.Object.extend({
  
  ThothServer: null, // to hook up the Server
  
  authModule: null, // to talk to the authentication module
  
  sessionModule: null, // to talk to the sessionModule
  
  _socketio: null, // to hook up the actual socket.io server
  
  _handlers: null, // to store the handlers for certain events...
  
  _authWrapper: function(client){
    var me = this;
    
    var createSesCB = function(err,sesrec){
      if(err) return;
      client.handshake.THOTH_sessionKey = sesrec.sessionKey;
      client.handshake.sessionKey = sesrec.sessionKey;
      client.handshake.THOTH_isAuthenticated = true;
      client.user = sesrec.username;
      client.userData = sesrec.userData;
      client.userData.sessionKey = sesrec.sessionKey;
      client.emit('authSuccess', { user: client.user, sessionKey: sesrec.sessionKey });
      // now set up the session heart beat, as hooking up to socket.io seems difficult
      client.sessionChecker = function(){
        me.sessionModule.checkSession({ user: sesrec.username, sessionKey: sesrec.sessionKey},function(err,hasSession){ return; });
      };
      client.sessionCheckTimer = SC.Timer.schedule({
        target: client,
        interval: 15000,
        action: 'sessionChecker',
        repeats: true
      });
    };
    
    var authSuccess = function(msg){
      sys.log('authSuccess: ' + sys.inspect(msg));
      var user = msg.user;
      var sessionKey = msg.sessionKey;
      if(sessionKey){ // try resume
        me.sessionModule.checkSession(msg,function(err,sesrec){
          if(!sesrec){
            me.sessionModule.createSession(msg,createSesCB);
          }
          else {
            createSesCB(null,sesrec);
            me._sendRequestQueue(sesrec.username,sesrec.sessionKey);
          }
        });
      }
      else me.sessionModule.createSession(msg,createSesCB);
    };
    
    return function(msg){
      if(!client.handshake.THOTH_isAuthenticated){ // only do something when not authenticated
        if(me.authModule && me.sessionModule){ // only try to auth when modules exist
          if(!msg.user || !msg.passwd) {
            client.emit('authError', { errorMsg: "Either the username or password was not found in the authentication request" });
            return;
          }
          me.authModule.checkAuth(msg,function(authResult){
            if(authResult) authSuccess(authResult);
            else client.emit('authError', { errorMsg: "Invalid username and password combination" });
          });
        }
        else client.emit('authError', {errorMsg: "The server seems to be configured without authentication or session module." })
      }
      else {
        //sys.log('client.handshake.Thoth_isAuthenticated found...');
      }
    };
  },
  
  _reauthWrapper: function(client){
    var me = this;
    
    var reauthSuccess = function(sesrec){
      client.userData = sesrec.userData;
      client.user = sesrec.username;
      client.handshake.THOTH_sessionKey = sesrec.sessionKey;
      client.handshake.THOTH_isAuthenticated = true;
      client.emit('authSuccess', {user: client.user, sessionKey: sesrec.sessionKey });
      me._sendRequestQueue(sesrec.username,sesrec.sessionKey); // send request queue
      // now replay the waiting commands, if any
      if(client.Thoth_msgBuffer && client.Thoth_msgBuffer.length>0){
        client.Thoth_msgBuffer.forEach(function(m){
          sys.log('replaying buffer. sending event: ' + m.event);
          client.emit(m.event,m.data);
        });
      }
      
      client.sessionChecker = function(){
        me.sessionModule.checkSession({ user: sesrec.username, sessionKey: sesrec.sessionKey},function(hasSession){ return; });      
      };
      client.sessionCheckTimer = SC.Timer.schedule({
        target: client,
        interval: 15000,
        action: 'sessionChecker',
        repeats: true
      });      
    };
    
    return function(data){  // re-authenticate... 
      if(data.user && data.sessionKey && me.sessionModule) { // perhaps also check password?
        sys.log("valid data, checking session for " + data.user + " with sk " + data.sessionKey);
        me.sessionModule.checkSession(data,function(err,sesrec){
          if(sesrec) reauthSuccess(sesrec);
          else client.emit('authFailure', { errorMsg: "No session found"});
        });      
      }
      else {
        client.emit('authError', { errorMsg: "No session found"});
        sys.log('Attempt to reauthenticate without proper data or absent session module');
      }
    };
  },
  
  _logoutWrapper: function(client){
    var me = this;
    
    return function(data){
    	var user = data.user,
  				sessionKey = data.sessionKey,
  				client = me.clientFor(user,sessionKey),
  				skOnly = true;

  		if(client && (client.user === user) && (client.sessionKey === sessionKey)){
  			//success
  			// find session
  			me.sessionModule.checkSession(user,sessionKey,skOnly,function(err,sesrec){
  			  sys.log('ThothServer: logout of user ' + user + ' successful');
  			  if(sesrec){
  				  me.sessionModule.destroySession(user,sessionKey);
  			  }
  			  client.sessionCheckTimer.invalidate();
  			  client.handshake.THOTH_isAuthenticated = false;
  			  //if(callback) callback({logoutSuccess: {} }); // even if no session, still logout
  			  client.emit("logoutSuccess", {});
  			});
  		}
  		else {
  			//failure
  			sys.log('ThothServer: Error on logout of user ' + user);
  			//if(callback) callback({logoutError: { errorMessage: 'Inconsistency in logout request'}});
  		}
    };
    
  },
  
  on: function(event,handler){
    if(!this._handlers) this._handlers = {};
    this._handlers[event] = handler;
  },
  
  _attachHandlers: function(client,context){
    var i, h = this._handlers;
    var me = this;
    var forceAuthentication = this.ThothServer.forceAuthentication;
    var sesMod = this.ThothServer.sessionModule;
    
    if(!h) return;
    // cb is the function sending back the data. it takes the first property of the object and uses that as the event
    var cb = function(evt,data){ // perhaps later as event,data ?     
      var json;
      if(!data && evt){
        sys.log('Thoth SocketIO: a function is calling the clients callback (send) function, but it uses a deprecated parameter list...');
        for(var l in evt){
          if(data.hasOwnProperty(l)){
            client.emit(l,evt[l]);
          }
        }        
      }
      else {
        if(evt){
          json = (SC.typeOf(data) === 'object')? data.get('json'): data;
          client.emit(evt,json);
        }
        else sys.log('socketIO is asked to send something, but no event is defined...'); 
      }
    };


    /* 
    function to create a lambda function calling the proper Thoth calls
    This function checks the session on every call. 
    Socket.IO has some nasty habit, in the sense that the client will send the first message in its buffer 
    on reconnect. This causes a problem, because when the server has been down, the clients user data is not 
    available anymore, until the session has been rechecked. We don't want to lose this first message because of 
    the missing userdata, so we buffer the request in the client, until a reauth has been given. 
    At the moment this is not limited, but as it is a possible DDOS option, we will need to limit this in 
    the future
    
    */
    var handlerCaller = function(event,handler){ //if(message.fetch) me.onFetch.call(me,message,userData,returnFunction);
      var sesKeyOnly = true;
      
      return function(data){
        //sys.log('receiving something through socketio...');
        var retData, errorReply,apiRequest;
            
            
        SC.RunLoop.begin();
        if(!API.APISCHEMAS[event]){
          sys.log('Receiving an event for which no schema is found... ' + event);
          errorReply = retData? API.ErrorReply.from(Constants.ERROR_FAILEDJSONSCHEMA,retData): { error: "Request failed JSON schema."};
          client.emit((event + "_error"),errorReply);
          return;
        } 
        apiRequest = API.APIRequest.from(data, Constants.SOURCE_SOCKETIO, event);
        if(!apiRequest){
          sys.log("Dropping API request because it fails the JSON Schema test...");
          retData = data.returnData;
          errorReply = retData? API.ErrorReply.from(Constants.ERROR_FAILEDJSONSCHEMA,retData): { error: "Request failed JSON schema."};
          client.emit((event + "_error"),errorReply);
          return;
        }

        // session check if authentication is obligatory...
        if(forceAuthentication){
          if(!client.userData){ // buffer 
            if(!client.Thoth_msgBuffer) client.Thoth_msgBuffer = [];
            client.Thoth_msgBuffer.push({ event: event, data: data });
            if(client.Thoth_msgBuffer.length > 50){ 
              sys.log('Thoth message buffer on client exceeded 50 commands... this is a problem!');
            }
          }
          else {
            sesMod.checkSession(client.userData,function(err,sesrec){
              if(sesrec) handler.call(context,apiRequest,sesrec.userData);
            });
          }
        }
        else {
          handler.call(context,apiRequest,client.userData);        
        }
        SC.RunLoop.end();
      };
    };
    
    for(i in h){ // assign the handlers
      if(h.hasOwnProperty(i)){
        client.removeAllListeners(i); // first remove listeners if there are any
        client.on(i,handlerCaller(i,h[i])); // then (re)assign
      }
    }
  },
  
  _setupSocketIOConfig: function(sio){
    var sioUrl = "/" + this.ThothServer.URLPrefix + '/socket.io';
    var sesMod = this.ThothServer.sessionModule;
    var behindProxy = this.ThothServer.isBehindProxy;
    var me = this;
    sys.log('adjusting socketio config...');
    sio.configure(function(){
      sys.log('setting resource to ' + sioUrl);
      sio.set('resource',sioUrl);
      sio.set('log level',2);
      
      // hack to allow Socket.io to work behind a nginx or lighttpd proxy

      if(behindProxy){
        var path = require('path');
        var HTTPPolling = require(path.join(
          path.dirname(require.resolve('socket.io')),'lib', 'transports','http-polling')
        );
        var XHRPolling = require(path.join(
          path.dirname(require.resolve('socket.io')),'lib','transports','xhr-polling')
        );
        
        XHRPolling.prototype.doWrite = function(data) {
          HTTPPolling.prototype.doWrite.call(this);
          var headers = {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Content-Length': (data && Buffer.byteLength(data)) || 0
          };
        
          if (this.req.headers.origin) {
            headers['Access-Control-Allow-Origin'] = '*';
            if (this.req.headers.cookie) {
              headers['Access-Control-Allow-Credentials'] = 'true';
            }
          }
        
          this.response.writeHead(200, headers);
          this.response.write(data);
          this.log.debug(this.name + ' writing', data);
        };        
      }

    });
  },
  
  start: function(httpserver){
    SIO = require('socket.io');   
    var sio = SIO.listen(httpserver);
    var me = this;
    var sesMod = this.sessionModule;
    var authMod = this.authModule;
    if(!(sesMod && authMod)) sys.log('no sessionModule or authentication Module found...!');
    this._setupSocketIOConfig(sio);
    
    var runlooper = function(s,mode){
      return function(c){ // c also contains mode... 
        SC.RunLoop.begin();
        if(mode === 'connect'){
          sys.log('client has connected...');        
        }
        else {
          sys.log('client has disconnected...');
          if(!s.sessionCheckTimer) sys.log('trying to disable the session check timer, but cannot find it');
          else s.sessionCheckTimer.invalidate();
        }
        SC.RunLoop.end();
      };
    };    
    
    var socketWrapper = function(socket){
      me._attachHandlers(socket,me.ThothServer); // thothserver as context for handlers
      socket.on('connect',runlooper(socket,'connect'));
      socket.on('disconnect',runlooper(socket,'disconnect'));
      socket.on('auth',me._authWrapper.call(me,socket));
      socket.on('reauth',me._reauthWrapper.call(me,socket));
      socket.on('logOut',me._logoutWrapper.call(me,socket));
    };
    sio.sockets.on('connection', socketWrapper);
    
    this._socketio = sio;
  },
  
  clientFor: function(user,sessionKey){
    var i, ret = [];
    var s,c;
    if(!user || !sessionKey) sys.log('SocketIO.js; clientFor(): Warning: trying to look up a client (for distribution?) without a user or sessionKey?');

    if(!this._socketio) return false;
    s = this._socketio.sockets.sockets;
    for(i in s){
      if(s.hasOwnProperty(i)){
        c = s[i];
        if(c.userData && (c.userData.sessionKey === sessionKey) && (c.userData.user === user)) ret.push(c);
      }
    }

    if(ret.length > 0) return ret[0];
    return false;
  },
  
  sendDataTo: function(user,sessionKey,event,dataToSend){
		var i, client = this.clientFor(user, sessionKey);
		var sesMod = this.sessionModule;
		if(client){
		  this._emitToClient(client,event,dataToSend);
		  return true;
		}
		else {
		  sesMod.queueRequest(user,sessionKey,event,dataToSend);
		}
		return false;
  },
  
  emitTo: function(userData,event,data){
    var sesMod = this.sessionModule;
    var client = this.clientFor(userData.user, userData.sessionKey);
    var json = (SC.typeOf(data) === 'object')? data.get('json'): data;
    if(client){
      //sys.log('event: ' + event + ", data: " + sys.inspect(json));
      client.emit(event,json);
    }
    else {
      sesMod.queueRequest(userData.user,userData.sessionKey,event,data);
    }
    // else send to session?
  },
  
  _emitToClient: function(client,event,data){
    if(!client){ 
      if(this.debug) sys.log('_emitToClient: ERROR sending to client! ' + event);
      return;
    } 
    if(this.ThothServer.debug) sys.log('SocketIO: sending data to client: ');
    if(!data && event){
      // old
  	  for(var i in data){
  	    if(data.hasOwnProperty(i)){
    	    //sys.log('sending a ' + i);
  	      client.emit(i,data[i]);
  	    }
  	  }      
    }
    else {
      //sys.log('event: ' + event + ", data: " + sys.inspect(data));
      client.emit(event,data);
    } 
  },
  
  _sendRequestQueue: function(user,sessionKey){
    var me = this;
    var client = this.clientFor(user,sessionKey);
    var sesMod = this.sessionModule;
    if(client){
      sesMod.retrieveRequestQueue(user,sessionKey,function(queue){
			  if(queue && (queue instanceof Array) && (queue.length > 0)){
			    queue.forEach(function(data){
			      me._emitToClient(client,data.event,data.data);
		      });
			  }
      });
    }
	}
  
  
  
});


