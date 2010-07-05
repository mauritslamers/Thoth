/* 
It turns out that while socket-io-server works quite nice, it is very hard to integrate into OrionServer
So, a SC version of the server seems to be a must for some rather annoying reason

*/
var url = require('url');
var sys = require('sys');

global.OrionSocketClient = SC.Object.extend({

   OrionServer: null, // we need a direct reference to the OrionServer object for session key stuff
   
   options: {},
   
   connected: false, // flag to know whether we have a connection
	
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
		this.connected = false;
		this.upgradeHead = head;
		this._onConnect(req, res);
	},

	send: function(message){
	   sys.puts("Send called on OrionSocketClient with message " + sys.inspect(message));
		if (!this.connected || !(this.connection.readyState === 'open' ||
				this.connection.readyState === 'writeOnly')) {
			return this._queue(message);
		}
		
		this._write(JSON.stringify({messages: [message]}));
		return this;
	},

	broadcast: function(message){
		if (!('sessionId' in this)) {
			return this;
		}
		this.listener.broadcast(message, this.sessionId);
		return this;
	},

	_onMessage: function(data){
	   sys.puts('_onMessage called with data: ' + sys.inspect(data));
	  try {
	    var messages = JSON.parse(data);
	  } catch(e){
	    return this.listener.options.log('Bad message received from client ' + this.sessionId + " with data: " + data);
	  }
		for (var i = 0, l = messages.length; i < l; i++){
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
		this.connected = true;

		if (!this.handshaked){
			this._generateSessionId();
			payload.push(JSON.stringify({
				sessionid: this.sessionId
			}));
			this.handshaked = true;
		}

		payload = payload.concat(this._writeQueue || []);
		this._writeQueue = [];

		if (payload.length) {
			this._write(JSON.stringify({messages: payload}));
		}
		if (this.connections === 1) {
			this.listener._onClientConnect(this);
		}
	},

	_onClose: function(){
		var self = this;
		if (this._heartbeatInterval) {
			clearInterval(this._heartbeatInterval);
		}
		this.connected = false;
		this._disconnectTimeout = setTimeout(function(){
			self._onDisconnect();
		}, this.options.closeTimeout);
	},

	_onDisconnect: function(){	
		if (!this.finalized){
			this._writeQueue = [];
			this.connected = false;
			this.finalized = true;
			if (this.handshaked) {
				this.listener._onClientDisconnect(this);
			}
		}
	},

	_queue: function(message){
		if (!('_writeQueue' in this)) {
			this._writeQueue = [];
		}
		this._writeQueue.push(message);
		return this;
	},

	_generateSessionId: function(){
		if (this.sessionId) {
			return this.listener.options.log('This client already has a session id');
		}
		this.sessionId = Math.random().toString().substr(2);
		return this;
	},

	_verifyOrigin: function(origin){
		var parts = url.parse(origin), origins = this.listener.options.origins;
		return origins.indexOf('*:*') !== -1 ||
			origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
			origins.indexOf(parts.host + ':*') !== -1 ||
			origins.indexOf('*:' + parts.port) !== -1;
	}
   
   
});