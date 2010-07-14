SC.OrionNodeRiakDataSource = SC.DataSource.extend({
   
   _webSocket: null, // the websocket object will be stored here
   
   _user: '',
   
   _sessionKey: '',
   
   OrionNodeRiakHost: 'localhost',
   
   OrionNodeRiakURL: '/socket.io/websocket',
   
   wsConnect: function(){
      var wsURL = ['ws://',this.OrionNodeRiakHost,this.OrionNodeRiakURL].join("");
      this._webSocket = new WebSocket(wsURL);
      // register callbacks
      this._webSocket.onopen = this.createOnOpenHandler();
      this._webSocket.onmessage = this.createOnMessageHandler();
      this._webSocket.onerror = this.createOnErrorHandler();
      this._webSocket.onclose = this.createOnCloseHandler();
   },
   
   /*
     Dealing with websockets is a bit different from using the normal
     callbacks such as AJAX requests. Normally you know the callback belonging to your request is the 
     only one that will be called. With websockets you just don't know in what order
     the answers to the requests will arrive...
     
     To ease that problem the OrionNodeRiak API allows to send along some data identifying your request.
     Included in this datasource is an implementation of this.
     
     You need to add a property called bucket to your model definition, containing the bucket where the information
     should be stored...
     
   */
   
   createOnMessageHandler: function(){
      var me = this;
      return function(event){
         // first of all: try to parse the data, 
         // whether websocket is the best way to do binary data... 
         // if there is any binary data, there will be trouble...
         if(event.data){
            console.log("data in event: " + event.data);
            var messages = JSON.parse(event.data);
            if(messages){
               // check if messages is an array, if not, make one
               var data = (messages instanceof Array)? messages: [messages]; 
               for(var i=0, len = data.length;i<len;i++){
                  var message = data[i];
                  //console.log('processing message: ' + JSON.stringify(message));
                  // use special handlers for special messages
                  // it would be nice if this could be done using a switch, but no clue on that
                  // should or could be done
                  // there are a number of messages to intercept, such as authSuccess, authError
                  if(message.authSuccess){
                     me.onAuthSuccess.call(me,message.authSuccess);
                     return;
                  }
                  if(message.authError){
                     me.onAuthError.call(me,message.authError);
                     return;
                  } 
                  if(message.logoutSuccess){
                     me.onLogoutSuccess.call(me,message.logoutSuccess);
                     return; 
                  } 
                  // assume the others are data messages
                  me.onDataMessage.call(me,message); //default
               } // end for
            }  
            else console.log("Received information from the server that couldn't be parsed");
         } // otherwise ignore
      };
   },
   
   createOnErrorHandler: function(){
      var me = this;
      return function(event){
         console.log('MyonError: ' + event.toString());
      };      
   },
   
   createOnCloseHandler: function(event){
      var me = this;
      return function(event){
         console.log('MyonClose: ' + event.toString());
         // don't throw away existing user and session information
         me.isConnected = false;
      };      
   },
   
   authRequest: function(user,passwd,passwdIsMD5){
      if(this.isConnected){
         var baseRequest = {auth:{ user: user, passwd: passwd, passwdIsMD5: passwdIsMD5}};
         if(this.sessionKey) baseRequest.auth.sessionKey = this.sessionKey; // resume the session if possible
         this.send(baseRequest);
      }
      else console.log('Cannot send an authentication request because there is no active connection');
   },
   
   refreshRequest: function(bucket,key){
      this.send({ refreshRecord: { bucket: bucket, key: key}});
   },
   
   createRequest: function(bucket,data){
     this.send({ createRecord: { bucket: bucket, record: data}}); 
   },
   
   fetchRequest: function(bucket){
      this.send({ fetch: { bucket: bucket}}); 
   },
   
   onAuthSuccess: function(data){
      // function called when authorisation has been completed successfully
      console.log('onAuthSuccess called on ' + this);
      this.user = data.user;
      this.sessionKey = data.sessionKey;
   },
   
   onAuthError: function(data){
      // function called when authorisation has gone awry for some reason
      var errorMsg = data.authError.errorMsg;
      alert('Authentication error: ' + errorMsg);
      console.log('Authentication error: ' + errorMsg);
   },
   
   onLogoutSuccess: function(data){
      // function called when logout has been successfull
      // remove user and session information
      this.user = undefined;
      this.sessionKey = undefined; 
   },
   
   /*
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
   
   onDataMessage: function(data){
      // function called when a data message has arrived
      // this is the part where interaction with the store comes into play
      // let's create handlers for every type of action ...
      // if you need extra calls, add 'em here
      if(data.createRecord) this.onPushedCreateRecord(data);
      if(data.updateRecord) this.onPushedUpdateRecord(data);
      if(data.deleteRecord) this.onPushedDeleteRecord(data);
      if(data.fetchResult) this.onFetchResult(data);
      if(data.createRecordResult) this.onCreateRecordResult(data);
      if(data.updateRecordResult) this.onUpdateRecordResult(data);
      if(data.deleteRecordResult) this.onDeleteRecordResult(data);
      if(data.refreshRecordResult) this.onRefreshRecordResult(data);
   },
   
   onPushedCreateRecord: function(data){
      // function to process the creation of a record in the store with the pushed data by the server
      // used when a different user creates a record of which the current user should know
   },
   
   onPushedUpdateRecord: function(data){
      // function to update a change in a record in the store with pushed data by the server
      // used when a different user updates a record of which the current user should know
      
   },
   
   onPushedDeleteRecord: function(data){
      // function to delete a record in the store with pushed data by the server
      // used when a different user deletes a record of which the current user should know
      
   },
   
   onFetchResult: function(data){
      // function to process the fetch data returned from a fetch call
   },
   
   onCreateRecordResult: function(data){
      // function to process the data from the server when a createRecord call has been made to the server
   },
   
   onUpdateRecordResult: function(data){
      // function to process the data from the server when an updateRecord call has been made to the server      
   },
   
   onRefreshRecordResult: function(data){
      // function to process the data from the server when a refreshRecord call has been made to the server
   },
   
   onDeleteRecordResult: function(data){
      // function to process the data from the server when a deleteRecord call has been made to the server      
   }
   
   /*
      The data source should be able to automatically convert relations into multiple calls to the 
      back end...
   
   */
   
   fetch: function(store,query){
      var rectype = query.get('recordType');
      if(rectype && query.isRemote()){
         if(!this.isConnected) return NO; // for the moment return no when the connection is lost, maybe queuing queries is an option??
         
         // we have to pry out the relations 
      }
      
   },
   
   refreshRecord: function(){
      
   },
   
   createRecord: function(){
      
   },
   
   updateRecord: function(){
      
   },
   
   deleteRecord: function(){
      
   }
   
   
});