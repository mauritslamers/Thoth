sc_require('controllers/ONRDataSource');

Meetme.ONRXHRPollingDataSource = Meetme.ONRDataSource.extend({
   
   ONRHost: 'localhost',
   
   ONRPort: '8080',
   
   ONRURL: '/socket.io/xhr-polling',
   
   authenticationPane: false,
   
   send: function(data){
      // check whether
      console.log('ONRXHRPollingDataSource: trying to send: ' + JSON.stringify(data));
		//this._sendXhr = this._request('send', 'POST');
		//this._sendXhr.setRequestHeader('User',this._user);
		//this._sendXhr.setRequestHeader('sessionKey',this._sessionKey);
      //data = JSON.stringify(data);
		//this._sendXhr.send('data=' + encodeURIComponent(data));
		var dataToSend = 'data='+ encodeURIComponent(JSON.stringify(data));
		SC.Request.postUrl(this.ONRURL,dataToSend).async().header('user',this._user).header('sessionkey',this._sessionKey).send();
	},
	
	authRequest: function(user,passwd,passwdIsMD5){
	   // for XHRPolling an authRequest is a normal REST POST request
	   var url = this.getHost() + '/auth';
	   //var baseRequest = {auth:{ user: user, passwd: passwd, passwdIsMD5: passwdIsMD5}};
	   var baseRequest = { user: user, passwd: passwd };
	   this._user = user;
      if(this.sessionKey) baseRequest.sessionKey = this.sessionKey; // resume the session if possible
      console.log('sending auth request to ' + url);
      /*
      var req = this.getRequest(this._isXDomain());
      console.log('getting request: ' + req);
      req.open('POST', url); // adjust the url here...
      req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
      var me = this;
      req.onreadystatechange = function(){
			var status;
			if (this.readyState == 4){
				this.onreadystatechange = function(){};
				try { status = this.status; } catch(e){}
				if (status == 200){
				   // setup the xhr polling
               me.connectXHRPolling();
				}
			}
		};
		req.send(JSON.stringify(baseRequest)); */
		
		SC.Request.postUrl('/auth',baseRequest).json().notify(this,this._authRequestCallback,this).send();
   },
   
   
   _authRequestCallback: function(response, dataSource){
       console.log('response from the auth request: ' + response);
       if (SC.ok(response)) {
          var cookie = document.cookie;
          if(cookie){
             // split at = sign and get the second value
             var sessionKey=cookie.split("=")[1];
             // now set the session info
             this._sessionKey = sessionKey;
             this.isConnected = YES;
             this.isAuthenticated = YES;
             // now do the setup of the XHRPolling
             dataSource.connectXHRPollingSC();
             // now do the authSuccessCallback
             //dataSource.authSuccessCallback();
             dataSource.send({ fetch: { bucket:'bird', returnData: { requestKey: 'baaaaaaaaal'}}});
          }

        }
        if(response.isError) console.log(response);
    },
   

	disconnect: function(){
		if (this._xhr){
			this._xhr.onreadystatechange = this._xhr.onload = function(){};
			this._xhr.abort();
		}            
		if (this._sendXhr) this._sendXhr.abort();
		this._onClose();
		this._onDisconnect();
	},

	_request: function(url, method, multipart){
		var req = this.getRequest(this._isXDomain());
		if (multipart) req.multipart = true;
		var tmpURI = ['http://',this.getConnectUrl()].join('');
		console.log('tmpURI = ' + tmpURI);
		req.open(method || 'GET', tmpURI); // adjust the url here...
		if (method == 'POST'){
			req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
		}
		return req;
	},
   
   getRequest: function(xdomain){
		if ('XDomainRequest' in window && xdomain) return new XDomainRequest();
		if ('XMLHttpRequest' in window) return new XMLHttpRequest();

		try {
			var a = new ActiveXObject('MSXML2.XMLHTTP');
			return a;
		} catch(e){}

		try {
			var b = new ActiveXObject('Microsoft.XMLHTTP');
			return b;      
		} catch(error){}

		return false;
	},
	
	XHRCheck: function(){
		try {
			if (this.getRequest()) return true;
		} catch(e){}
		return false;
	},	
	
	type: 'xhr-polling',

	connect: function(store,callback){
	   // setup the first connection and set the long polling action in motion
	   // ONR wants to do auth first, even if auth is not set up...
	   // this way we can get a session key, so ONR knows who we are...
	   
	   this.store = store;
	   // set up the first connection
	   if(!callback && this.authenticationPane){
	      // if no callback, show the authentication Pane
	      this.showLoginPane();
	   }
	   else {
	      // do the callback
	      callback();
	   }
   },
   
   connectXHRPolling: function(){
		this._xhr = this._request(+ new Date(), 'GET');
		this._xhr.setRequestHeader('User',this._user);
		this._xhr.setRequestHeader('sessionKey',this._sessionKey);
		var me = this;
		if ('onload' in this._xhr){
		   console.log('XHR Polling: found onload');
			this._xhr.onload = function(){
			   var dataHandler = me.createOnMessageHandler();
				if (this.responseText.length) dataHandler(this.responseText);
				me.connectXHRPolling(); // reinit the connection
			};
		} else {
		   console.log('XHR Polling: didn\'t find onload');
			this._xhr.onreadystatechange = function(){
				var status;
				if (me._xhr.readyState == 4){
					me._xhr.onreadystatechange = function(){};
					try { status = me._xhr.status; } catch(e){}
					if (status == 200){
					   var dataHandler = me.createOnMessageHandler();
						if (me._xhr.responseText.length) dataHandler(me._xhr.responseText);
						me.connectXHRPolling(); // reinit the connection
					}
				}
			};	
		}
		this._xhr.send();      
   },

   // can I do the same with an SC request?
   connectXHRPollingSC: function(){

      SC.Request.getUrl('socket.io/xhr-polling').async()
         .header('User',this._user)
         .header('sessionKey',this._sessionKey)
         .json()
         .notify(this,this.handleXHRPolling,this)
         .send();
   },
   
   handleXHRPolling: function(response,dataSource){
      if(SC.ok(response)){
         var dataHandler = dataSource.createOnMessageHandler();
         var msg = response.get('body');
         dataHandler(msg);
         dataSource.connectXHRPollingSC();
      }
      console.log('current status: ' + response.status);
   },

   onXHRResult: function(response,dataSource){
      if(SC.ok(response)){
         SC.RunLoop.begin();
         var dataHandler = dataSource.createOnMessageHandler();
         dataHandler(response.data);
         SC.RunLoop.end();
      }
   }

	
});

