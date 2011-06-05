/*globals process*/
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


DATA requests:
{ refreshRecord: { bucket: '', key: ''}}
{ fetch: { bucket: '', conditions: '', returnData: {} }} 
{ createRecord: { bucket: '', record: {}, returnData: {} }}
{ updateRecord: { bucket: '', key: '', record: {}, returnData: {} }}
{ deleteRecord: { bucket: '', key: '', returnData: {} }}

// most properties are self explanatory, but returnData needs some explanation on its own.
// return data is an object that can be delivered along side the request and which is
// returned by the server in the answer to that request. This helps the client side identifying 
// what request was answered exactly.

// returned by the server as answer to a client request
{ fetchResult: { bucket: '', records: [], returnData: {} }}
{ createRecordResult: {}, returnData: {} }
{ updateRecordResult: {}, returnData: {} }
{ deleteRecordResult: {}, returnData: {} }
{ refreshRecordResult: {}, returnData: {} }

  

*/

var url = require('url');
var sys = require('sys');
var transports = {};
var SocketClient = require('./SocketClient').SocketClient;
var SocketWSClient = require('./SocketWSClient').SocketWSClient;
var SocketXHRPollingClient = require('./SocketXHRPollingClient').SocketXHRPollingClient;

exports.SocketListener = SC.Object.extend(process.EventEmitter.prototype, {
   
   // we need to have a reference to the ThothServer instance to pass it on to the
   // clients to be able to communicate with the session stuff. 
   ThothServer: null, 
                     
   setOption: SocketClient.prototype.setOption, // copy these functions off the Thothsocketclient prototype
   
   setOptions: SocketClient.prototype.setOptions, 
   
   authenticatedClients: [], // array of authenticated clients
   
   unAuthenticatedClients: [], // array of clients not yet authenticated
	
	options: {
		origins: '*:*',
		socketPrefix: 'socket.io', // no leading slash!!
		//transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		transports: ['websocket','xhr-polling'],
		transportOptions: {},
		log: function(message){
			require('sys').log(message);
		}
	},
  
	sendData: function(userData,dataToSend){
		// send function to be used for all clients...
		// first get the client fitting the user data and then send the dataToSend
		var client = this.getClientBySessionKey(userData.sessionKey);
		if(client && client.isConnected){
		  if(this.ThothServer.debug) sys.log('SocketListener: sending data to client: ');
			client.send(dataToSend);
		}
		else {
		  if(this.ThothServer.debug) sys.log('queueing request...');
			// not connected or client dead for some reason, store it on the user cache
			this.ThothServer.sessionModule.queueRequest(userData.user,userData.sessionKey,dataToSend);
		}

	},
  
  start: function(server, options){
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
		
		transports['websocket'] = SocketWSClient; // override the websocket 
		transports['xhr-polling'] = SocketXHRPollingClient; // provide the xhr polling client
		
		this.options.log('Thoth socket.io ready - accepting connections');
   },

	check: function(req, res, httpUpgrade, head){
		var path = url.parse(req.url).pathname, 
		    urlPrefix = this.ThothServer.getURLPrefix(),
		    socketPrefix = (this.options.socketPrefix[0] == '/')? this.options.socketPrefix: '/' + this.options.socketPrefix,
		    parts, cn, numparts,protocol,
		    checkpath = urlPrefix? [urlPrefix,socketPrefix].join(""): socketPrefix;
		    
		    //sys.log('SocketListener check:');
		    //sys.log('path: ' + path);
		    //sys.log('checkpath: ' + checkpath);
		    
		if (path.indexOf(checkpath) === 0){	
			parts = path.substr(1).split('/');
			//sys.log('checkpath found, parts is: ' + JSON.stringify(parts));
			numparts = parts.length;
			protocol = parts[numparts-1];
			//sys.log('protocol: ' + protocol);
			if (protocol) this._onConnection(protocol, req, res, httpUpgrade, head);
			else {
				req.connection.end();
			  this.options.log('Couldn\'t find client with protocol id "' + parts[numparts-1] + '"');
			}
			return true;
		}
		return false;
	},
	
	/* 
	   ok... socket-io-server stores the clients based on the session id
	   which is a nice idea... the problem however is that it messes with authentication
	   so, what should happen is that the client should only be able to register 
	   when authenticated...
	*/
	
	_onClientConnect: function(client){
		if (!(client instanceof SocketClient) || !client.handshaked){
			return this.options.log('Invalid client');
		}
		if(client.isAuthenticated){
         this.authenticatedClients.push(client);
         //this._sendRequestQueue(client);
		}
		else {
		   this.unAuthenticatedClients.push(client); // store the client in the unAuthenticated clients   
		   if(this.ThothServer.debug) sys.log("ThothSocketListener: new unauthenticated client connected");
		}
		//client.i = this.clients.length; // this stinks.. because if a client disconnects the array doesn't scale
		
		//this.clients.push(client); // just storing the client?
		//this.clientsIndex[client.sessionId] = client; // this stores the client by sessionId, which we don't do yet
		//this.options.log('Client '+ client.sessionId +' connected');
		this.emit('clientConnect', client); // create the onClientConnect event
	},

	_authRequest: function(data, client){
		// this function combines a few things: actual auth and in case the auth isn't successful, it 
		// returns an appropriate error message to the client
		sys.log('authRequest received');
		var ThothServer = this.ThothServer;
		if(ThothServer){
			var authModule = ThothServer.authModule;
			var sessionModule = ThothServer.sessionModule;
			if(authModule && sessionModule){
				var user = data.auth.user;
				var passwd = data.auth.passwd;
				var passwdIsMD5 = data.auth.passwdIsMD5;
				var receivedSessionKey = data.auth.sessionKey;
				var application = data.auth.application;
				if(user && passwd){
					var me = this;
					var authCallback = function(authresult){
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
								sessionModule.checkSession(user,receivedSessionKey,sessionKeyOnly, function(hasSession){
								  client.sessionKey = hasSession? receivedSessionKey: sessionModule.createSession(authresult,sessionKeyOnly);
								});
							}
							else client.sessionKey = sessionModule.createSession(authresult,sessionKeyOnly);
							// session key set
							client.isAuthenticated = YES;
							client.user = user; // set the user
							client.userData = authresult; // set all user data
							// move the client object from the unAuthenticatedClients to the authenticatedClients
							me.unAuthenticatedClients.removeObject(client);
							me.authenticatedClients.push(client);
							me._authSuccessMsg(client); // send the user the session key
							// now send the client the request queue, if it exists
							me._sendRequestQueue(client);
							if(me.ThothServer.debug) sys.log("ThothSocketListener: Client " + client.user + " authenticated, sessionKey: " + client.sessionKey);
						}
						else {
							me._authErrorMsg(client, "Invalid username and password combination");
						}	               
					}; // end auth callback function
					authModule.checkAuth(user,passwd,passwdIsMD5,authCallback,application);
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
	
	_sendRequestQueue: function(client){
		if(client){
			var sessionModule = this.ThothServer.sessionModule;
			sessionModule.retrieveRequestQueue(client.user,client.sessionKey,function(queue){
			  if(queue && (queue instanceof Array) && (queue.length > 0)){
			    client.send(queue);
			  }
			  
			});			
		}
	},

	_logoutRequest: function(data, client){
		// check session info on the client
		var sessionKey = client.sessionKey;
		// checking the sessionKey in the data against the client.sessionKey seems overkill...
		if(sessionKey){
			// if there is any, call the logout function on the sessionModule
			this.ThothServer.sessionModule.logout(client.user,sessionKey,true); // true because sessionKeyOnly info
			// remove user and sessionKey information on the client object
			client.user = undefined;
			client.sessionKey = undefined;
			client.isAuthenticated = NO;
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
		// this is called before the actual ThothServer callback is called.
		// here we should intercept any authentication request
		// data should already be JSON objects..
		if(data.auth){
			// we have an authorisation request 
			this._authRequest(data,client); // let _authRequest handle it..
			return; // end func here
		}
		if(data.logout){
			this._logoutRequest(data,client); 
			return;
		}
		if(client.isAuthenticated) this.emit('clientMessage', data, client);	      	      
	},
	
	_onClientDisconnect: function(client){
		sys.log('ThothSocketListener: _onClientDisconnect called for client with name ' + client.user + " and sessionKey " + client.sessionKey);
		// if a client disconnects, remove the object from either authenticatedClients or unAuthenticatedClients
		this.authenticatedClients.removeObject(client);
		this.unAuthenticatedClients.removeObject(client);
		//this.options.log('Client '+ client.sessionId +' disconnected');		
		this.emit('clientDisconnect', client);
	},

	// new connections (no session id)
	_onConnection: function(transport, req, res, httpUpgrade, head){
		//sys.puts("ThothSocketListener: _onConnection");
		if (this.options.transports.indexOf(transport) === -1 || (httpUpgrade && !transports[transport].prototype.httpUpgrade)){
			if(httpUpgrade) res.destroy();
			else req.connection.destroy();
			sys.puts('Illegal transport "'+ transport +'"');
			return;
		}
		this.options.log('Initializing client with transport "'+ transport +'"');
		var client = transports[transport].create({ ThothServer: this.ThothServer });
		client.start(this, req, res, this.options.transportOptions[transport], head);
		//sys.log("unAuthenticated clients: " + sys.inspect(this.unAuthenticatedClients));
	},
	
	getClientBySessionKey: function(sessionKey){
		// return the client inside the authenticatedClients having the given sessionKey
		// it turns out it is possible to have multiple authenticatedClients with the same sessionKey
		// because of POST requests etc, so try to return one that is connected, if not return the last
		// disconnected client
		
		var authClients = this.authenticatedClients;
		var numclients = authClients.length;
		var curClient;
		//console.log('num of clients: ' + numclients);
		for(var i=0;i<numclients;i+=1){
			curClient = (authClients[i].sessionKey == sessionKey)? authClients[i]: curClient;
			if(curClient && curClient.isConnected) return curClient;
		}
		if(!curClient) return NO;// return no if no client exists
		else return curClient;// else return the last disconnected client
	},

	updateAuthenticatedClient: function(user,sessionKey,request){
		// function to update a connected client with the given request
		// while it seems a nice idea to do the session info update here, 
		// it is better to do this in the ThothServer part as we have the
		// data on what kind of request has been made...
		var client = this.getClientBySessionKey(sessionKey);
		if(client && client.isConnected && client.isAuthenticated && (client.user == user) && (client.sessionKey == sessionKey)){ // better be safe than sorry
			client.send(request);
			return YES;
		}
		return NO;
	}
	
  
});
