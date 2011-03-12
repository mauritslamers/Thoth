/* 
It turns out that while socket-io-server works quite nice, it is very hard to integrate into ThothServer
So, a SC version of the server seems to be a must for some rather annoying reason

*/
var url = require('url');
var sys = require('sys');

exports.SocketClient = SC.Object.extend({

	ThothServer: null, // we need a direct reference to the ThothServer object for session key stuff

	options: {},

	isConnected: null, // flag to know whether we have a connection

	isAuthenticated: null, // flag to know whether this connection is authenticated and consequently allowed to receive data

	sessionKey: null,  // property to be able to store the session info, to enable 
	//the same user to do both websocket as other types of requests

	user: null, // the user name of the connected and authenticated user

	userData: null, // the user data as known to the authentication system

	setOption: function(key, value){
		this.options[key] = value;
		//object.merge(this.options, key, value);
		return this;
	},

	setOptions: function(options){
		for (var key in options) {
			this.setOption(key, options[key]);
		}
		if (this.addListener){
			var first_lower = function(full, first){
				return first.toLowerCase();
			};

			// Automagically register callbacks if the varname starts with on
			for (var i in this.options){				
				if (!(/^on[A-Z]/).test(i) || typeof this.options[i] !== 'function') {
					continue;
				}
				this.addListener(i.replace(/^on([A-Z])/, first_lower), this.options[i]);
				this.options[i] = null;
			}
		}
		return this;
	},

	start: function(listener, req, res, options, head){
		this.listener = listener;
		this.setOptions(options);
		this.connections = 0;
		this.isConnected = false;
		this.upgradeHead = head;
		this._onConnect(req, res);
	},

	send: function(message){
		if (!this.isConnected || !(this.connection.readyState === 'open' || this.connection.readyState === 'writeOnly')) {
			sys.log("whoops? trying to send something without an open connection, and it hasn't been caught by ThothServer...? This is not good!");
		}
		else {
			//sys.log("ThothSocketClient: sending message to this._write");
			this._write(JSON.stringify([message]));
		}
	},

	_onMessage: function(data){
		//sys.puts('ThothSocketClient._onMessage called with data: ' + sys.inspect(data));
		try {
			var messages = JSON.parse(data);
		} catch(e){
			return this.listener.options.log('Bad message received from client ' + this.sessionId + " with data: " + JSON.stringify(data));
		}
		// messages can be either an object or an array, so in case of an array, 
		// call the callback on the listener with one object/message at a time.
		// the listener callback will check for authentication requests and if there is none
		// call the ThothServer callback 
		messages = (messages instanceof Object)? [messages]: messages; // if messages isn't an array yet, make it one
		// call the listeners _onClientMessage with every object in messages
		for (var i=0,l=messages.length;i<l;i++){
			this.listener._onClientMessage(messages[i], this);
		}		
	},

	_onConnect: function(req, res){
		var self = this;
		this.request = req;
		this.response = res;
		this.connection = this.request.connection;
		if (this._disconnectTimeout) {
			clearTimeout(this._disconnectTimeout);
		}
	},

	_payload: function(){
		var payload = [];

		this.connections++;
		this.isConnected = true;

		this.handshaked = true;    

		if (payload.length) {
			this._write(JSON.stringify({messages: payload}));
		}
		//sys.log("ThothSocketClient: This.connections " + this.connections);
		if (this.connections === 1) {
			this.listener._onClientConnect(this);
		}
	},

	_onClose: function(){
		sys.log("ThothSocketClient: _onClose called");
		var self = this;
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
		}
		this.isConnected = false;
		var timeOutFunc = function(){
			self._onDisconnect();
		};
		this._disconnectTimeout = setTimeout(timeOutFunc, this.options.closeTimeout);
	},

	_onDisconnect: function(){	
		sys.log('ThothSocketClient: _onDisconnect called');
		if (!this.finalized){
			this._writeQueue = [];
			this.connected = false;
			this.finalized = true;
			if (this.handshaked) {
				this.listener._onClientDisconnect(this);
			}
		}
		else {
			sys.log('Thoth SocketClient: Oops, client disconnect without finalized?');
			if(this.handshaked){
				this.listener._onClientDisconnect(this);
			}
		}
	},

	_verifyOrigin: function(origin){
		var parts = url.parse(origin), origins = this.listener.options.origins;
		return origins.indexOf('*:*') !== -1 ||
		origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
		origins.indexOf(parts.host + ':*') !== -1 ||
		origins.indexOf('*:' + parts.port) !== -1;
	}

});