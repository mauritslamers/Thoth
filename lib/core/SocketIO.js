/*globals Buffer*/

var sys = require('./Tools').sys;
var API = require('./API');
var Constants = require('./Constants');
var SIO;

exports.SocketIO = SC.Object.extend({
  
  ThothServer: null,
  
  _socketio: null,
  
  onClientMessage:  null,
  
  _handlers: null,
  
  _authWrapper: function(client){
    var authMod = this.ThothServer.authModule;
    var sesMod = this.ThothServer.sessionModule;
    var me = this;
    return function(msg){
      //sys.log('auth: ' + sys.inspect(msg));
      //sys.log('arguments: ' + sys.inspect(arguments));
      if(!client.handshake.THOTH_isAuthenticated){ // only do something when not authenticated
        if(authMod && sesMod){ // only check when modules exist
          if(!msg.user || !msg.passwd) {
            client.emit('authError', "Either the username or password was not found in the authentication request");
            return;
          }
          authMod.checkAuth(msg,function(authResult){
            if(authResult){
              var usr = msg.user;
              var sK = msg.sessionKey;
              var skOnly = true;
              if(sK){// check to resume
                sesMod.checkSession(usr,sK,skOnly,function(hasSession){
                  client.handshake.THOTH_sessionKey = hasSession? sK: sesMod.createSession(authResult,skOnly);
                  if(hasSession) me._sendRequestQueue(usr,sK);
                });
              }
              else client.handshake.sessionKey = sesMod.createSession(authResult,skOnly);
              client.handshake.THOTH_isAuthenticated = true;
              client.user = usr;
              client.userData = authResult;
              client.userData.sessionKey = client.handshake.sessionKey;
              client.emit('authSuccess', { user: client.user, sessionKey: client.handshake.sessionKey });
              // now set up the session heart beat, as hooking up to socket.io seems difficult
              client.sessionChecker = function(){
                //sys.log('about to check session (timed) for user: ' + usr + ' and sessionKey: ' + client.userData.sessionKey + " and skOnly: " + skOnly);
                sesMod.checkSession(usr,client.userData.sessionKey,skOnly,function(hasSession){
                  //sys.log("Session checker running and found hasSession: " + hasSession);
                });
              };
              client.sessionCheckTimer = SC.Timer.schedule({
                target: client,
                interval: 15000,
                action: 'sessionChecker',
                repeats: true
              });
            }
            else client.emit('authError', { errorMsg: "Invalid username and password combination" });
          });
        }
        else client.emit('authError', {errorMsg: "The server seems to be configured without authentication or session module." })
      }
    };
  },
  
  _reauthWrapper: function(client){
    var sesMod = this.ThothServer.sessionModule;
    var me = this;
    return function(data){
      // re-authenticate...
      var user = data.user,
          sK = data.sessionKey,
          skOnly = true;

      sys.log('reauthWrapper called...');
      if(user && sK && sesMod) {
        sys.log("valid data, checking session for " + user + " with sk " + sK);
        sesMod.checkSession(user,sK,skOnly,function(hasSession,userData){
          sys.log('checkSession returned with hasSession object: ' + sys.inspect(hasSession));
          if(hasSession){
            //client.userData = { user: user, sessionKey: sK };
            client.userData = userData;
            client.user = user;
            client.handshake.THOTH_sessionKey = sK;
            client.handshake.THOTH_isAuthenticated = true;
            client.emit('authSuccess', {user: client.user, sessionKey: sK });
            me._sendRequestQueue(user,sK); // send request queue
            // now replay the waiting commands, if any
            if(client.Thoth_msgBuffer && client.Thoth_msgBuffer.length>0){
              client.Thoth_msgBuffer.forEach(function(m){
                sys.log('replaying buffer. sending event: ' + m.event);
                client.$emit(m.event,m.data);
              });
            }
            
            client.sessionChecker = function(){
              //sys.log('about to check session (timed) for user: ' + usr + ' and sessionKey: ' + client.userData.sessionKey + " and skOnly: " + skOnly);
              sesMod.checkSession(user,sK,skOnly,function(hasSession){
                //sys.log("Session checker running and found hasSession: " + hasSession);
              });
            };
            client.sessionCheckTimer = SC.Timer.schedule({
              target: client,
              interval: 15000,
              action: 'sessionChecker',
              repeats: true
            });
          }
          else {
            client.emit('authFailure', { errorMsg: "No session found"});
          }
        });      
      }
      else {
        client.emit('authError', { errorMsg: "No session found"});
        sys.log('Attempt to reauthenticate without proper data or absent session module');
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
          //sys.log('socketIO sending: ' + sys.inspect(json,false,2)); 
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
        var user, sK, retData, errorReply,
            apiRequest = API.APIRequest.from(data, Constants.SOURCE_SOCKETIO, event);
            
        SC.RunLoop.begin();
        if(!apiRequest){
          sys.log("Dropping API request because it fails the JSON Schema test...");
          retData = data.returnData;
          errorReply = retData? API.ErrorReply.from(Constants.ERROR_FAILEDJSONSCHEMA,retData): { error: "Request failed JSON schema."};
          client.emit((event + "_error"),errorReply);
          return;
        }

        //sys.log('receiving a request. forceAuthentication : ' + forceAuthentication);
        // session check if authentication is obligatory...
        if(forceAuthentication){
          //sys.log('forceAuthentication is true, so checking client.userData: ' + sys.inspect(client.userData));
          if(!client.userData){
            // buffer 
            if(!client.Thoth_msgBuffer) client.Thoth_msgBuffer = [];
            client.Thoth_msgBuffer.push({ event: event, data: data });
            if(client.Thoth_msgBuffer.length > 50){ 
              sys.log('Thoth message buffer on client exceeded 50 commands... this is a problem!');
            }
          }
          else {
            user = client.userData.user;
            sK = client.userData.sessionKey;
            //sys.log('checking session for data transmission...');
            sesMod.checkSession(user,sK,sesKeyOnly,function(hasSession,userData){
              //sys.log('return call from session check. client has a session? ' + sys.inspect(hasSession));
              //sys.log('userdata is : ' + sys.inspect(userData));
              //if(hasSession) handler.call(context,data,{ user: user, sessionKey: sK},cb);
              if(hasSession) handler.call(context,apiRequest,userData);
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
  
  // _onClientConnect: function(client){
  //   SC.RunLoop.begin();
  //   sys.log('client has connected...'); 
  //   SC.RunLoop.end();
  // },
  // 
  // _onClientDisconnect: function(client){
  //   SC.RunLoop.begin();
  //   sys.log('client has disconnected...');
  //   if(!client.sessionCheckTimer) sys.log('trying to disable the session check timer, but cannot find it');
  //   else client.sessionCheckTimer.invalidate();
  //   SC.RunLoop.end();    
  // },
  
  start: function(httpserver){
    SIO = require('socket.io');   
    var sio = SIO.listen(httpserver);
    var me = this;
    var sesMod = this.ThothServer.sessionModule;
    var authMod = this.ThothServer.authModule;
    
    this._setupSocketIOConfig(sio);
    
    var runlooper = function(s,mode){
      return function(c){ // c also contains mode... 
        SC.RunLoop.begin();
        //sys.log('arguments: ' + sys.inspect(s));
        if(mode === 'connect'){
          sys.log('client has connected...');        
          //s.emit("message",{ status: "Welcome!"});
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
		var sesMod = this.ThothServer.sessionModule;
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
    var sesMod = this.ThothServer.sessionModule;
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
    var client = this.clientFor(user,sessionKey);
    var sesMod = this.ThothServer.sessionModule;
    if(client){
      sesMod.retrieveRequestQueue(user,sessionKey,function(queue){
			  if(queue && (queue instanceof Array) && (queue.length > 0)){
			    queue.forEach(function(data){
			      this._emitToClient(client,data.event,data.data);
		      },this);
			  }
      },this);
    }
	}
  
  
  
});


