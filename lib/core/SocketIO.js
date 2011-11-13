/* attempt at wrapping LearnBoost/socket.io as SC modules for Thoth */

/*
var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')

app.listen(80);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

*/

/*
How SocketIO is wrapped for Thoth:
- sio has an authentication mechanism, which is similar to the method used for reconnection already used by Thoth
- it doesn't work for a new request, so we should still allow the client to exist, though it should not be set
  authenticated.

When authenticated, thoth puts a thothAuth property on the handshake data. This is also the flag used on all other sockets.

*/
var sys = require('util') || require('sys');
var SIO = require('socket.io');

exports.SocketIO = SC.Object.extend({
  
  ThothServer: null,
  
  _socketio: null,
  
  onClientMessage:  null,
  
  _handlers: null,
  
  _authWrapper: function(client){
    var authMod = this.ThothServer.authModule;
    var sesMod = this.ThothServer.sessionModule;
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
            client.emit('authSuccess', {user: client.user, sessionKey: sK });
            // now replay the waiting commands, if any
            if(client.Thoth_msgBuffer && client.Thoth_msgBuffer.length>0){
              client.Thoth_msgBuffer.forEach(function(m){
                sys.log('replaying buffer. sending event: ' + m.event);
                client.$emit(m.event,m.data);
              });
            }
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
    var i,h= this._handlers;
    var me = this;
    var forceAuthentication = this.ThothServer.forceAuthentication;
    var sesMod = this.ThothServer.sessionModule;
    if(!h) return;
    // cb is the function sending back the data. it takes the first property of the object and uses that as the event
    var cb = function(data){ // perhaps later as event,data ?
      for(var l in data){
        if(data.hasOwnProperty(l)){
          client.emit(l,data[l]);
        }
      }
    };


    /* 
    function to create a lambda function calling the proper Thoth calls
    This function checks the session on every call. 
    Socket.IO has some nasty habit, in the sense that it will send the first message in it's buffer
    When the server has been down, the clients user data is not available anymore, until the session has been
    rechecked. At the same time, we don't want to lose the command given. So, we buffer the request in the client, 
    until a reauth has been given. As this is of course a candidate for a DDOS, so we probably have to limit this...
    
    */
    var handlerCaller = function(event,handler){ //if(message.fetch) me.onFetch.call(me,message,userData,returnFunction);
      var sesKeyOnly = true;
      
      return function(data){
        var user, sK;
        SC.RunLoop.begin();
        //sys.log('receiving a request. forceAuthentication : ' + forceAuthentication);
        // session check if authentication is obligatory...
        if(forceAuthentication){
          //sys.log('forceAuthentication is true, so checking client.userData: ' + sys.inspect(client.userData));
          if(!client.userData){
            // buffer 
            if(!client.Thoth_msgBuffer) client.Thoth_msgBuffer = [];
            client.Thoth_msgBuffer.push({ event: event, data: data});
            if(client.Thoth_msgBuffer.length > 50){ 
              sys.log('Thoth message buffer on client exceeded 50 commands... this is a problem!');
            }
          }
          else {
            user = client.userData.user;
            sK = client.userData.sessionKey;
            sys.log('checking session...');
            sesMod.checkSession(user,sK,sesKeyOnly,function(hasSession,userData){
              //sys.log('return call from session check. client has a session? ' + sys.inspect(hasSession));
              //sys.log('userdata is : ' + sys.inspect(userData));
              //if(hasSession) handler.call(context,data,{ user: user, sessionKey: sK},cb);
              if(hasSession) handler.call(context,data,userData,cb);
            });
          }
          
          
          // if(client.userData){
          // }
          // else {
          //   client.emit('notAuthenticated', { errorMsg: "not authenticated" });
          //   client.destroy();            
          // }
        }
        else {
          handler.call(context,data,client.userData,cb);        
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
    var me = this;
    sys.log('adjusting socketio config...');
    sio.configure(function(){
      sys.log('setting resource to ' + sioUrl);
      sio.set('resource',sioUrl);
      sio.set('log level',2);
    });
  },
  
  start: function(httpserver){
    var sio = SIO.listen(httpserver);
    var me = this;
    var sesMod = this.ThothServer.sessionModule;
    var authMod = this.ThothServer.authModule;
    
    this._setupSocketIOConfig(sio);
    
    var runlooper = function(s,mode){
      return function(){
        SC.RunLoop.begin();
        if(mode === 'connect'){
          sys.log('client has connected...');        
          //s.emit("message",{ status: "Welcome!"});
        }
        else {
          sys.log('client has disconnected...');
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
        if(c.userData && (c.userData.sessionKey === sessionKey) && (c.user === user)) ret.push(c);
      }
    }

    if(ret.length > 0) return ret[0];
    return false;
  },
  
  sendDataTo: function(user,sessionKey,dataToSend){
		var i, client = this.clientFor(user, sessionKey);
		if(client){
		  this._emitToClient(client,dataToSend);
		  return true;
		}
		return false;
  },
  
  
  _emitToClient: function(client,data){
    if(!client) return;
    if(this.ThothServer.debug) sys.log('SocketListener: sending data to client: ');
	  for(var i in data){
	    if(data.hasOwnProperty(i)){
  	    sys.log('sending a ' + i);
	      client.emit(i,data[i]);
	    }
	  }
  },
  
  _sendRequestQueue: function(user,sessionKey){
    var client = this.clientFor(user,sessionKey);
    var sesMod = this.ThothServer.sessionModule;
    if(client){
      sesMod.retrieveRequestQueue(user,sessionKey,function(queue){
			  if(queue && (queue instanceof Array) && (queue.length > 0)){
			    queue.forEach(function(data){
			      this._emitToClient(client,data);
		      },this);
			  }
      },this);
    }
	}
  
  
  
});


