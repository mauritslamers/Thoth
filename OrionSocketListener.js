var url = require('url');
var sys = require('sys');
require('./OrionSocketClient');
require('./OrionSocketWSClient');
var transports = {};

/* 
   this websocket listener and client code is based on the socket-io-node code 
   http://github.com/LearnBoost/Socket.IO-node.git by 
*/

/*
 information about a few special requests objects:
 The idea about the requests is that it should be easy to extend them 
 while keeping compatability with standard clients
 
 
 AUTH request:
 { auth: { user: '', passwd: '', passwdIsMD5: false, sessionKey:'' }}
 
 AUTH response if successfull
 
 { authSuccess: { user: '', sessionKey: '' }}
 
 AUTH error:
 
 { authError: { errorMsg: '' }}
 
 The sessionKey property in the auth request is intended to be used as a re-authentication after an interrupted
 connection. In that case the application didn't reload, so only wants to have all updated stuff.
 When the session was still active, the sessionKey returned by the authSuccess is the same as the old one,
 giving the client a way to check whether it has to reload the entire data set, or can expect an update
 of all changes...
 
 LOGOUT:
 { logout: { user: '', sessionKey: '' }}

 let's also add a data messages for sending data from the server to the client and vice versa
 
 DATA requests:
 { refresh: { bucket: '', key: ''}}
 { fetch: { bucket: '', conditions: '' }} 
 { create: { bucket: '', record: {} }}
 { update: { bucket: '', key: '', record: {} }}
 { delete: { bucket: '', key: ''}}

  These requests are two way, in the sense that the server can send these requests to the client,
  and vice versa. It makes sense to have a type field in the record to make sure the client
  can find back the recordType

*/

global.OrionSocketListener = SC.Object.extend(process.EventEmitter.prototype, {
   
   // we need to have a reference to the OrionServer instance to pass it on to the
   // clients to be able to communicate with the session stuff. 
   OrionServer: null, 
                     
   setOption: OrionSocketClient.prototype.setOption, // copy these functions off the orionsocketclient prototype
   
   setOptions: OrionSocketClient.prototype.setOptions, 
   
   authenticatedClients: [], // array of authenticated clients
   
   unAuthenticatedClients: [], // array of clients not yet authenticated
	
	options: {
		origins: '*:*',
		resource: 'socket.io',
		//transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		transports: ['websocket'],
		transportOptions: {},
		log: function(message){
			require('sys').log(message);
		}
	},
  
  start: function(server, options){
      sys.puts("Server: " + server);
		var self = this;
		process.EventEmitter.call(this);
		this.server = server;
		this.setOptions(options);
		this.clients = [];
		this.clientsIndex = {};
		
		var listeners = this.server.listeners('request');
		this.server.removeAllListeners('request');
		
		this.server.addListener('request', function(req, res){
			if (self.check(req, res)) return;
			for (var i = 0; i < listeners.length; i++) {
				listeners[i].call(this, req, res);
			}
		});
		
		this.server.addListener('upgrade', function(req, socket, head){
			if (!self.check(req, socket, true, head)){
				socket.destroy();
			}
		});
		
		/* this imports all the available transports, but as we are hacking, throw it out and work around it
		this.options.transports.forEach(function(t){
			if (!(t in transports)){
				transports[t] = require('./transports/' + t)[t];
				if (transports[t].init) transports[t].init(this);
			} 
		}, this); */
		transports['websocket'] = OrionSocketWSClient; // override the websocket 
		
		this.options.log('socket.io ready - accepting connections');
  },

	broadcast: function(message, except){
		for (var i = 0, l = this.clients.length; i < l; i++){
			if (this.clients[i] && (!except || [].concat(except).indexOf(this.clients[i].sessionId) == -1)){
				this.clients[i].send(message);
			}
		}
		return this;
	},

	check: function(req, res, httpUpgrade, head){
		var path = url.parse(req.url).pathname, parts, cn;
		if (path.indexOf('/' + this.options.resource) === 0){	
			parts = path.substr(1).split('/');
			if (parts[2]){
				cn = this._lookupClient(parts[2]);
				if (cn){
					cn._onConnect(req, res);
				} else {
					req.connection.end();
					this.options.log('Couldnt find client with session id "' + parts[2] + '"');
				}
			} else {
				this._onConnection(parts[1], req, res, httpUpgrade, head);
			}
			return true;
		}
		return false;
	},
	
	_lookupClient: function(sid){
		return this.clientsIndex[sid];
	},
	
	/* 
	   ok... socket-io-server stores the clients based on the session id
	   which is a nice idea... the problem however is that it messes with authentication
	   so, what should happen is that the client should only be able to register 
	   when authenticated...
	*/
	
	_onClientConnect: function(client){
		if (!(client instanceof OrionSocketClient) || !client.handshaked){
			return this.options.log('Invalid client');
		}
		
		//client.i = this.clients.length; // this stinks.. because if a client disconnects the array doesn't scale
		this.unAuthenticatedClients.push(client); // store the client in the unAuthenticated clients
		//this.clients.push(client); // just storing the client?
		//this.clientsIndex[client.sessionId] = client; // this stores the client by sessionId, which we don't do yet
		//this.options.log('Client '+ client.sessionId +' connected');
		sys.puts("new unauthenticated client connected");
		this.emit('clientConnect', client); // create the onClientConnect event
	},
	
	_authRequest: function(data, client){
	   // this function combines a few things: actual auth and in case the aut isn't successful, it 
	   // returns an appropriate error message to the client
	   var OrionServer = this.OrionServer;
	   if(OrionServer){
	      var authModule = OrionServer.authModule;
	      var sessionModule = OrionServer.sessionModule;
	      if(authModule && sessionModule){
	         var user = data.auth.user;
	         var passwd = data.auth.passwd;
	         var passwdIsMD5 = data.auth.passwdIsMD5;
	         var receivedSessionKey = data.auth.sessionKey;
	         if(user && passwd){
	            var authresult = authModule.checkAuth(user,passwd,passwdIsMD5);
	            if(authresult){
	               // positive auth, request sessionkey
	               // interesting experiment: does array.indexOf(obj) still find our client object
	               // even with extra info put on it? SC should... 
	               
	               // we need to take into account that a user authenticates again after a disconnection
	               // in that case, the authentication request should contain the "old" session key
	               // to be able to resume the previous actions and to update the client accordingly
	               // with data still in store
	               var sessionKeyOnly = YES;
	               if(receivedSessionKey){
	                  // check session
	                  var sessionExists = sessionModule.checkSession(user,receivedSessionKey,sessionKeyOnly);
	                  // if sessionExists for the sessionkey, set the session key of the client to the receivedSessionKey
	                  client.sessionKey = sessionExists? receivedSessionKey: sessionModule.createSession(user,sessionKeyOnly);
	               }
	               else client.sessionKey = sessionModule.createSession(user,sessionKeyOnly);
	               // session key set
	               client.isAuthenticated = YES;
	               client.user = user; // set the user
	               // move the client object from the unAuthenticatedClients to the authenticatedClients
	               this.unAuthenticatedClients.removeObject(client);
	               this.authenticatedClients.push(client);
	               this._authSuccessMsg(client); // send the user the session key
	               return YES; 
	            }
	            else {
	               this._authErrorMsg(client, "Invalid username and password combination");
	               return NO;
	            }
	         }
	         else{
	            this._authErrorMsg(client, "Either the username or password was not found in the authentication request");
	            return NO;
	         }
	      }
	      else {
	         this._authErrorMsg(client, "The server seems to be configured without authentication or session module.");
	         return NO;
	      }
	   }
	   else {
	      this._authErrorMsg(client,"The Websocket server has not been configured properly for authentication requests");
	      return NO;
	   }	   
	},
	
	_authErrorMsg: function(client, msg){
	   client.send({ authError: { errorMsg: msg }});
	},
	
	_authSuccessMsg: function(client){
	   client.send({ authSuccess: { user: client.user, sessionKey: client.sessionKey}});
	},
	
	_logoutRequest: function(data, client){
	   // check session info on the client
	   var sessionKey = client.sessionKey;
      // checking the sessionKey in the data against the client.sessionKey seems overkill...
	   if(sessionKey){
   	   // if there is any, call the logout function on the sessionModule
   		this.OrionServer.sessionModule.logout(client.user,sessionKey,true); // true because sessionKeyOnly info
   		// remove user and sessionKey information on the client object
   		client.user = undefined;
   		client.sessionKey = undefined;
   		// move the client from the authenticatedClients to the unAuthenticatedClients
   		this.authenticatedClients.removeObject(client);
   		this.unAuthenticatedClients.push(client);
   		// send the client a confirmation
   		client.send({ logoutSuccess: {}});
	   }
	   // if there is no sessionKey, ignore the request
	   
	   // after successful logout, don't destroy the connection
	   // let it exist so the client can decide what to do
	},
	
	_onClientMessage: function(data, client){
	   // this is called before the actual OrionServer callback is called.
	   // here we should intercept any authentication request
	   // data should already be JSON objects..
	   if(data.auth){
	      // we have an authorisation request 
         this._authRequest(data,client); // let _authRequest handle it..
         return; // end func here
	   }
	   if(data.logout){
	      this._logoutRequest(data,client);
	   }
	   else {  // if not auth, forward the request
   		this.emit('clientMessage', data, client);	      
	   }
	},
	
	_onClientDisconnect: function(client){
	   // if a client disconnects, remove the object from either authenticated or unAuthenticatedClients
	   this.authenticatedClients.removeObject(client);
	   this.unAuthenticatedClients.removeObject(client);
	   //this.options.log('Client '+ client.sessionId +' disconnected');		
		this.emit('clientDisconnect', client);
	},
	
	// new connections (no session id)
	_onConnection: function(transport, req, res, httpUpgrade, head){
	   sys.puts("OrionSocketListener: _onConnection");
	   sys.puts("index of transport: " + this.options.transports.indexOf(transport));
	   sys.puts("httpUpgrade: " + httpUpgrade);
	   sys.puts("transports[transport].httpUgrade: " + transports[transport].httpUpgrade);
	   sys.puts("transports[transport].prototype.httpUgrade: " + transports[transport].prototype.httpUpgrade);
		if (this.options.transports.indexOf(transport) === -1 || (httpUpgrade && !transports[transport].prototype.httpUpgrade)){
			httpUpgrade ? res.destroy() : req.connection.destroy();
			sys.puts('Illegal transport "'+ transport +'"');
			return;
		}
		this.options.log('Initializing client with transport "'+ transport +'"');
		var client = transports[transport].create({ OrionServer: this.OrionServer });
		client.start(this, req, res, this.options.transportOptions[transport], head);
	}
  
});
