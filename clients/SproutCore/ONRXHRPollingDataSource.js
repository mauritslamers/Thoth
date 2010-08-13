sc_require('controllers/ONRDataSource');

SC.ONRXHRPollingDataSource = SC.ONRDataSource.extend({
   
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
		SC.Request.postUrl(this.ONRURL,dataToSend).async().header('user',this.user).header('sessionkey',this.sessionKey).send();
	},
	
	authRequest: function(user,passwd,passwdIsMD5){
	   // for XHRPolling an authRequest is a normal REST POST request
	   var url = this.getHost() + '/auth';
	   //var baseRequest = {auth:{ user: user, passwd: passwd, passwdIsMD5: passwdIsMD5}};
	   var baseRequest = { user: user, passwd: passwd };
	   this.user = user;
      if(this.sessionKey) baseRequest.sessionKey = this.sessionKey; // resume the session if possible
      console.log('sending auth request to ' + url);
		
		SC.Request.postUrl('/auth',baseRequest).json().notify(this,this._authRequestCallback,this).send();
		// it would be nice to add some extra notifications here, in case the server is down etc...
   },
   
   
   _authRequestCallback: function(response, dataSource){
       console.log('response from the auth request: ' + response);
       if (SC.ok(response)) {
          var cookie = document.cookie;
          if(cookie){
             // split at = sign and get the second value
             var sessionKey=cookie.split("=")[1];
             // now set the session info
             this.sessionKey = sessionKey;
             this.isConnected = YES;
             this.isAuthenticated = YES;
             // now do the setup of the XHRPolling
             dataSource.connectXHRPollingSC();
             // now do the authSuccessCallback
             if(dataSource.authSuccessCallback){
                console.log('calling authSuccessCallback');
                dataSource.get('authSuccessCallback')();   
             }
             else console.log('ONR XHR Polling: no authSuccessCallback set');
             //dataSource.send({ fetch: { bucket:'bird', returnData: { requestKey: 'baaaaaaaaal'}}});
          }

        }
        if(response.isError) console.log(response);
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

   connectXHRPollingSC: function(){
      SC.Request.getUrl('socket.io/xhr-polling').async()
         .header('user',this.user)
         .header('sessionkey',this.sessionKey)
         .json()
         .notify(this,this.handleXHRPolling,this)
         .send();
   },
   
   handleXHRPolling: function(response,dataSource){
      SC.RunLoop.begin();
      if(SC.ok(response)){
         var dataHandler = dataSource.createOnMessageHandler();
         var data = response.get('body');
         if(data !== ""){
            var eventData = { data: response.get('body') }; // overcome the event based dataHandler
            dataHandler(eventData);            
         }
         dataSource.connectXHRPollingSC();
      }
      console.log('current status: ' + response.status);
      SC.RunLoop.end();
   },

   onXHRResult: function(response,dataSource){
      if(SC.ok(response)){
         
         var dataHandler = dataSource.createOnMessageHandler();


      }
   }

	
});

