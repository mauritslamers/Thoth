
/*
The way this is be implemented is that the client first has to perform a NORMAL post request to the REST
interface of Thoth. This way the client can get a sessionKey (given out on authentication or not, depending on the authentication settings)
With this sessionKey, Thoth can identify the client in the XHRPolling system, so successive posts can be done to the XHRPolling side and the server
will answer via the open GET request connection

*/

var qs = require('querystring');
var sys = require('sys');
var SocketClient = require('./SocketClient').SocketClient;

exports.SocketXHRPollingClient = SocketClient.extend({
	
	closeTimeout: 1000,
	
	duration: 30000,
		
	_onConnect: function(req, res){
	   //sys.log('XHRPolling _onConnect: req method = ' + req.method);
		var me = this, body = '';

      // we need to make sure there is a valid sessionKey
      //sys.log('req headers: ' + sys.inspect(req.headers));
      var user = req.headers.user;
      var sessionKey = req.headers.sessionkey;
      var sessionModule = this.ThothServer.sessionModule; // our way to the session info
      var hasSession = false;
      if(user && sessionKey){
         //sys.log('XHRPolling: trying to get the session check');
         hasSession = sessionModule.checkSession(user,sessionKey,true);
      } 
			sys.log('XHRPolling: request attempt with user: ' + user + ' and sessionKey: ' + sessionKey + '. Session found: ' + hasSession);
			if((!user && !sessionKey) && !hasSession){ // force an end to the connection when the proper info is not here...
				res.writeHead(200);
				res.write('not ok');
				sys.log('XHRPolling: closing connection because client didn\'t provide a user name or session cookie, or no proper session');
				res.end();
				this._onClose();
				return;
			}      

      this.user = user;
      this.sessionKey = sessionKey;
      this.isAuthenticated = YES;
      this.userData = sessionModule.getUserData(user);
      
		switch (req.method){
			case 'GET':
			   //this.__super__(req, res);
			   arguments.callee.base.apply(this, arguments); 

			   this.request = req;
   		   this.response = res;
   	     this.connection = this.request.connection;
   	      // session stuff in place:

      	   //sys.log('XHRPolling: payload about to be run');
      	   this._payload(YES); // already authenticated    	   

      		if (this._disconnectTimeout) {
      			clearTimeout(this._disconnectTimeout);
      		} 
				
				this._closeTimeout = setTimeout(function(){
				   sys.log('closing the connection by timeOut...');
					me._write('');
				}, this.duration);
				this.sendRequestQueue(); // in case there is a queue, send it
				break;				
			case 'POST':
				req.addListener('data', function(message){
					body += message;
				});
				req.addListener('end', function(){
				   //sys.log("ONRXHRPolling End of POST Request...");
					try {
						var msg = qs.parse(body);
						//sys.log("XHRPolling POST received with data: " + JSON.stringify(msg));
						me._onMessage(msg.data);
						me.isConnected = NO;
            me.isAuthenticated = NO; // quickly disengage the current connection
					} catch(e){}
					res.writeHead(200);
					res.write('ok');
					sys.log('XHRPollingClient: Closing connection after POST');
					res.end();
					me._onClose();
				});
				break;
		}		
	},
	
	_write: function(message){
	   //sys.log("ONRXHRPolling: _write called");
		if (this._closeTimeout) {
			clearTimeout(this._closeTimeout);
		}
		var msgLength = unescape(encodeURIComponent(message)).length;
		var headers = {
			'Content-Type': 'application/json; charset=UTF-8', 
			//'Content-Encoding': 'utf8',
			//'Content-Length': message.length
			'Content-Length': msgLength
		};
		// https://developer.mozilla.org/En/HTTP_Access_Control
	//	sys.log('XHRPolling: this.request.headers ' + sys.inspect(this.request.headers));
	//	sys.lof('XHRPolling: verify origin: ' + this._verifyOrigin(this.request.headers.origin));
		if (this.request.headers.origin && this._verifyOrigin(this.request.headers.origin)) {
			headers['Access-Control-Allow-Origin'] = this.request.headersorigin;
			if (this.request.headers.cookie) {
				headers['Access-Control-Allow-Credentials'] = 'true';
			}
		}
		else {
		   //sys.log("XHRPolling: header check failed...");
		}
		this.response.writeHead(200, headers);
		this.response.write(message);
		this.response.end();
		this._onClose();
		//this.emit('close');
		//sys.log('SOCKETXHR: Closing connection after write');
	},
	
	sendRequestQueue: function(){
	   // try to detect whether a request queue exists for the current user...
	   // this function is run on a different location as the authentication (which is normally used)
	   // takes place somewhere else...
	   
	   var user = this.user;
	   var sessionKey = this.sessionKey;
	   var queue = this.ThothServer.sessionModule.retrieveRequestQueue(user,sessionKey);
	   if(queue && (queue instanceof Array) && (queue.length > 0)){
	      //console.log('Sending user ' + user + ' the request queue: ' + JSON.stringify(queue));
	      this._write(JSON.stringify(queue));
	   }
	}
	
});