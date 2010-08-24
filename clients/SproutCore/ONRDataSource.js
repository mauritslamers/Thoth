/*
The OrionNodeRiak Datasource:

An attempt to achieve some goals:
- only have to define models once
- websocket connections
- automatic relations, which can be configured to use junction tables
- trying to work out the idea that most of the time relations are changed, 
  so try to find the changes and only update those
- Riak features a nice way to deal with the lost update problem, which is to send back the "offending" records
  and let the user decide... This is quite a complex feature to implement, but it is absolutely doable.
  While this is a very very interesting feature, the first goal is to implement a "normal" system


There are a few conditions that need to be in place to make this work:
- if relations should be resolved automatically, both the toOne and toMany relations should have a 
  through parameter containing the name of the bucket storing the relation
  (The current implementation of automatic relations on the server don't require this. Every relation is done
  using a junction table/bucket of which the name is automatically generated out of the related models)
- every model needs a bucket parameter to be able to fetch records in the first place and
  to be able to handle server initiated updates. The server cannot know how the models are called
  on the client side, so the bucket name is the only unique value the system can rely on.

*/

/*
 This data source has a built-in authentication dialog.
 you can show it by calling showLoginPane()
 
 When the authentication fails, the data source also shows a error message on a pane.
 You can override this behaviour by providing your own showErrorMessage function.

*/

// basic version without traffic specific stuff


SC.ONRDataSource = SC.DataSource.extend({
   /*
     =====
     User configurable properties
     =====
   */
   
   ONRHost: null,
   
   ONRPort: null,
   
   ONRURL: null,
   
   authSuccessCallback: null, 
   
   authenticationPane: null,
   
   /*
     ========
     WebSocket stuff   
     ========
   */
   
   user: '',
   
   sessionKey: '',
   
   store: null, // a reference to the store where the (forced) updates need to be sent
         
   connect: function(store,callback){ // we need the store to direct the push traffic to
      throw("ONRDatasource connect: You are using the basic data source without traffic specification...");
   },
   
   _isXDomain: function(){
		return this.ONRHost !== document.domain; // include the port number??
	},
   
   getHost: function(){
      return this.ONRPort? [this.ONRHost,this.ONRPort].join(":") : this.ONRHost;
   },
   
   getConnectUrl: function(){
      return [this.getHost(),this.ONRURL].join("");   
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
   send: function(val){
      throw("ONRDatasource send: You are using the basic data source without traffic specification...");
   },
   
   _pane: null,
   _paneCallback: null,
   
   showErrorMessage: function(message,callback){
      var me = this;
      var sheet = SC.SheetPane.create({
         layout: { width:350, height: 150, centerX: 0 },
         contentView: SC.View.extend({
            layout: { top: 0, right: 0, bottom: 0, left: 0 },
            childViews: "questionLabel okButton".w(),

            questionLabel: SC.LabelView.design({
               layout: { top: 30, height: 75, width: 300, centerX: 0 },
               textAlign: SC.ALIGN_CENTER,
               value: message
            }),

            okButton: SC.ButtonView.design({
               layout: { bottom: 20, height: 25, width: 100, centerX: 0 },
               title: 'Ok',
               isDefault: YES,
               action: 'closeErrorMessage',
               target: me
            })
         })
      });
      this._pane = sheet;
      this._callback = callback;
      sheet.append();
   },
   
   closeErrorMessage: function(){
      this._pane.remove();
      this._pane = null; 
      var callback = this._callback;
      if(callback){
         this._callback = null;
         callback.call(this);         
      }
   },
   
   showLoginPane: function(){
      var me = this;
      var sheet = SC.SheetPane.create({
         layout: { width:400, height: 200, centerX: 0 },
         contentView: SC.View.extend({
            layout: { top: 0, right: 0, bottom: 0, left: 0 },
            childViews: "loginHeaderLabel usernameLabel passwordLabel usernameInput passwordInput cancelButton loginButton".w(),

            loginHeaderLabel: SC.LabelView.design({
               layout: { height: 25, width: 250, bottom: 150, centerX: 0 },
               textAlign: SC.ALIGN_CENTER,
               value: 'Please fill in your login information'
            }),

            usernameLabel: SC.LabelView.design({
               layout: { height: 25, width: 150, bottom: 100, centerX: -120 },
               textAlign: SC.ALIGN_CENTER,
               value: 'User name:'
            }),

            passwordLabel: SC.LabelView.design({
               layout: { height: 25, width: 150, bottom: 100, centerX: 35 },
               textAlign: SC.ALIGN_CENTER,
               value: 'Password:'
            }),               
            
            usernameInput: SC.TextFieldView.design({
              layout: { height: 25, width: 150, bottom: 80, centerX: -80 },
              hint: 'Username...',
              isPassword: NO,
              isTextArea: NO
            }),
            
            passwordInput: SC.TextFieldView.design({
              layout: { height: 25, width: 150, bottom: 80, centerX: 80 },
              hint: 'Password...',
              isPassword: YES,
              isTextArea: NO
            }),
            
            cancelButton: SC.ButtonView.design({
              layout: { height: 25, width: 100, bottom: 20, centerX: 80 },
              title: 'Annuleren',
              action: 'closeLoginPane',
              target: me
            }),
            
            loginButton: SC.ButtonView.design({
              layout: { height: 25, width: 100, bottom: 20, centerX: -80 },
              title: 'Login',
              action: 'attemptLogin',
              target: me,
              isDefault: YES
            })
         })
      });
      
      this._pane = sheet;
      sheet.append();
   },
   
   closeLoginPane: function(){
      this._pane.remove();
      this._pane = null;
   },
   
   attemptLogin: function(){
      var username = this._pane.contentView.usernameInput.value;
      var passwd = this._pane.contentView.passwordInput.value;
      this.closeLoginPane();
      this.authRequest(username,passwd);
   },
   
   createOnOpenHandler: function(callback){ // to create an onOpen callback
      var me = this;
      return function(event){
         me.isConnected = true;
         //me.test();
         callback();
         return;
      };
   },

   createOnMessageHandler: function(){
      var me = this;
      return function(event){
         //console.log('onMessageHandler: called with ' + JSON.stringify(event));
         // first of all: try to parse the data, 
         // whether websocket is the best way to do binary data... 
         // if there is any binary data, there will be trouble...
         if(event.data){
            var messages = (SC.typeOf(event.data) === SC.T_STRING)? JSON.parse(event.data): event.data;
            //console.log("data in event: " + event.data);
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
      var me = this;
      var sendAuthRequest = function(){
         var baseRequest = {auth:{ user: user, passwd: passwd, passwdIsMD5: passwdIsMD5}};
         if(me.sessionKey) baseRequest.auth.sessionKey = me.sessionKey; // resume the session if possible
         me.send(baseRequest);
      };
      
      if(!this.isConnected){
         this.connect(me.store,sendAuthRequest);
      }
      else sendAuthRequest();
   },
   
   refreshRequest: function(bucket,key){
      this.send({ refreshRecord: { bucket: bucket, key: key}});
   },
   
   createRequest: function(bucket,data){
     this.send({ createRecord: { bucket: bucket, record: data}}); 
   },
   
   
   onAuthSuccess: function(data){
      // function called when authorisation has been completed successfully
      //console.log('onAuthSuccess called on ' + this);
      this.user = data.user;
      this.sessionKey = data.sessionKey;
      //alert("onAuthSuccess!");
      this.authSuccessCallback();
   },
   
   onAuthError: function(data){
      // function called when authorisation has gone awry for some reason
      var errorMsg = data.errorMsg;
      console.log('Authentication error: ' + errorMsg);
      this.showErrorMessage(errorMsg,this.showLoginPane);
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
      console.log("Received data message: " + JSON.stringify(data));
      data = (data instanceof Array)? data[0]: data; // make sure we are dealing with an object
      if(data.createRecord) this.onPushedCreateRecord(data);
      if(data.updateRecord) this.onPushedUpdateRecord(data);
      if(data.deleteRecord) this.onPushedDeleteRecord(data);
      if(data.fetchResult) this.onFetchResult(data);
      if(data.createRecordResult) this.onCreateRecordResult(data);
      if(data.updateRecordResult) this.onUpdateRecordResult(data);
      if(data.deleteRecordResult) this.onDeleteRecordResult(data);
      if(data.refreshRecordResult) this.onRefreshRecordResult(data);
      if(data.fetchError) this.onFetchError(data);
      if(data.refreshRecordError) this.onRefreshRecordError(data);
      if(data.createRecordError) this.onCreateRecordError(data);
      if(data.updateRecordError) this.onUpdateRecordError(data);
      if(data.deleteRecordError) this.onDeleteRecordError(data);
      if(data.rpcResult) this.onRPCResult(data);
      if(data.rpcError) this.onRPCError(data);
   },
   
   _rpcRequestCache: null,
   
   rpcRequest: function(functionName,params,callback){
      // generate an RPC request to ONR
      var cacheKey = this._createRequestCacheKey();
      if(!this._rpcRequestCache) this._rpcRequestCache = {};
      if(!this._rpcRequestCache[cacheKey]) this._rpcRequestCache[cacheKey] = { callback: callback };
      this.send( { rpcRequest: { functionName: functionName, params: params, returnData: { rpcCacheKey: cacheKey } }}); 
   },
   
   onRPCResult: function(data){
      if(!this._rpcRequestCache) throw "ONRDataSource: received an RPC onRPC result but no request has been sent";
      else {
         var rpcResult = data.rpcResult;
         if(rpcResult){
            var cacheKey = rpcResult.returnData.cacheKey;
            this._rpcRequestCache[cacheKey].callback(rpcResult);
         }
         else throw "ONRDataSource: received an invalid rpcResult message";
      }
   },
   
   onRPCError: function(data){
      if(!this._rpcRequestCache) throw "ONRDataSource: received an RPC onRPC error but no request has been sent";
      else {
         var rpcError = data.rpcError;
         var cacheKey = rpcError.returnData.cacheKey;
         this._rpcRequestCache[cacheKey].callback(rpcError);
      }
   },
   
   /*
      =====
      WebSocket Push callbacks
      =====
   */
   
   onPushedCreateRecord: function(data){
      // function to process the creation of a record in the store with the pushed data by the server
      // used when a different user creates a record of which the current user should know
      var createRequest = data.createRecord;
      console.log("onPushedUpdateRecord called with: " + data);
      var bucket = createRequest.bucket, key = createRequest.key;
      var rectype = this._recordTypeCache[bucket];
      //var relations = createRequest.relations; // cannot recall whether this is actually necessary ... 
      //var recordToCreate = relations? this._processRelationSet([createRequest.record],relations)
      //pushRetrieve: function(recordType, id, dataHash, storeKey) {
      var storeKey = this.store.pushRetrieve(rectype,key,createRequest.record); // this also depends on ONR setting id to the Riak key!!
      if(!storeKey){
         // oops... the store didn't allow storing this record...
         // unclear what to do in this case
         // let's do an alert for the time being
         alert("The server has tried to push a createRecord request to your application, but isn't allowed to store it");
      }
   },
   
   onPushedUpdateRecord: function(data){
      // function to update a change in a record in the store with pushed data by the server
      // used when a different user updates a record of which the current user should know
      // store.pushRetrieve
      console.log("onPushedUpdateRecord called with: " + data);
      var updateRequest = data.updateRecord;
      // the layout of the updateRecord call is similar to the updateRecordResult
      var bucket = updateRequest.bucket;
      var key = updateRequest.key;
      var rectype = this._recordTypeCache[bucket];
      var result = this.store.pushRetrieve(rectype,key,updateRequest.record); 
      if(!result){
         // we need to think of a proper way to deal with not being allowed to update a record...
         // it shouldn't happen though if the application is using nested stores...
         alert("The server has tried to update a record in your application, but wasn't allowed to do so!");
      }
   },
   
   onPushedDeleteRecord: function(data){
      // function to delete a record in the store with pushed data by the server
      // used when a different user deletes a record of which the current user should know
      // store.pushDestroy
      var deleteRequest = data.deleteRecord;
      var bucket = deleteRequest.bucket;
      var key = deleteRequest.key;
      var rectype = this._recordTypeCache[bucket];
      var result = this.store.pushDestroy(rectype,key);
      if(!result){
         alert("The server has tried to delete a record from your application, but wasn't allowed to do so!");
      }
   },
   
   
   
   /* 
      ======
      Record fetch + callback
      ======

      Loading records in batches is rather difficult, especially as in our case the relations arrive
      at a different time. 
      I contemplated two different approaches:
      1. load the records in the store as soon as they arrive, retrieve the records when the relations arrive, and
         update them accordingly.
      2. store the records temporarily until the relations arrive, add the relations to the record data and
         load the records in the store
        
      The problem with 1 is that records could already change, especially if the relations take a while to load.
      The problem with 2 is that when the relations take a while to arrive, the record data isn't available in the 
      application. Moreover, both approaches don't count on the possibility that the relations might arrive earlier.
      
      So, let's do a kind of merging of the two approaches.
      If the records arrive first, they are loaded in the store, and given the SC.BUSY_LOADING state. This makes the
      records available to the application (afaik that is) so they should be visible in the application, but they
      cannot be changed. The records are temporarily stored in the requestCache, to enable any easy update when the 
      relations arrive. In case the relations arrive first (this shouldn't happen, but you never know of course)
      the relations are stored in the requestCache instead
   
   */
   
   /*
      Ok, reading through the stores functions, we need to hack into stuff... It is not a good idea to have to change
      the state all the time from READY_CLEAN to BUSY_LOADING...
      So we need to do the record storing ourselves...
      let's create a few helper functions to do this
      
      Let's start with loadRecord and create additional ones if necessary
   */
   
   loadRecord: function(store,recordType,storeKey,dataHash,isComplete) {
      // copy this behaviour from dataSource did complete and pushRetrieve
      var id = dataHash.id || dataHash.key; // when id doesn't exist, try key
      var status, K = SC.Record;
      if(id){
         if(storeKey === undefined){
            storeKey = recordType.storeKeyFor(id); 
            status = isComplete? K.READY_CLEAN: K.BUSY_LOADING;
         } 
         else {
            // EMPTY, ERROR, READY_CLEAN, READY_NEW, READY_DIRTY, DESTROYED_CLEAN,
            // DESTROYED_DIRTY
            status = store.readStatus(storeKey);
            if (!(status & K.BUSY)) {
              throw K.BAD_STATE_ERROR; // should never be called in this state
            }

            // otherwise, determine proper state transition
            if(status===K.BUSY_DESTROYING) {
              throw K.BAD_STATE_ERROR ;
            } else {
               status = isComplete? K.READY_CLEAN : K.BUSY_LOADING ;
            }
         }
         //console.log("Writing data " + JSON.stringify(dataHash) + " with status " + status + " and storeKey: " + storeKey);
         store.writeStatus(storeKey, status) ;
         store.writeDataHash(storeKey, dataHash, status) ;

         var statusOnly = NO;
         store.dataHashDidChange(storeKey, null, statusOnly);

         return storeKey ;         
      }
      else {
         throw "Whoops, uploading a record without ID??";
      }
   },
   
   /*
    the fetch function sets a request cache object to be able to handle the return messages
    the layout of that object is as follows
    {
      store: store,
      query: query,
      numResponses: 1, // number of messages to expect
      records: [], // array of records
      storeKeys: {}, // associative array of record indexes, key is a storeKey
      recordKeys: {}, // associative array of record indexes, key is the record Key (the key of bucket-key)
      unsavedRelations: [] // array of relationSets in case relations were sent before the record data
    }
   
   */
   
   fetch: function(store,query){      
      var rectype, bucket;
      //console.log('ONRDataSource: fetch called!');
      rectype = query.get('recordType');
      if(rectype){
         bucket = rectype.prototype.bucket;
         // cache rectype by bucket
         this._recordTypeCache[bucket] = rectype;
      }
      if(rectype && query.isRemote()){
         if(!this.isConnected) return NO; // prevent loading stuff when we are not connected 
         if(!(this.user && this.sessionKey)) return NO; // prevent loading when we are not authenticated
         // build the request
         // first do the basic stuff
         var request = { fetch: { bucket: bucket }};
         var numResponses = 1; // the number of responses we expect
         // now check whether there are conditions and if yes, add them
         if(query.conditions){
            // if there are conditions we need to add them to the request
            request.fetch.conditions = query.conditions;
            request.fetch.parameters = query.parameters;
         }
         // check on relations and if there are, add them to the request
         var relationInfo = this._getRelationsArray(rectype);
         if(relationInfo){
            request.fetch.relations = relationInfo;
            numResponses += relationInfo.length;
         }
         // now add the requestCacheInfo
         var requestKey = this._createRequestCacheKey();
         this._requestCache[requestKey] = { store: store, query: query, numResponses: numResponses };
         request.fetch.returnData = { requestKey: requestKey };
         console.log('Sending fetchRequest: ' + JSON.stringify(request));
         this.send(request);      
      }
      return YES;
   },
   
   
   /*
   
   // cases: 
   // - relations arrive, but no records yet
   //   action: store relations 
   //   state:  done
   // - relations arrive, records exist, but other relations still need to arrive
   //   action: add the relations to the records in the requestCache, update the records 
   //           in the store and in the requestCache and set the record states to BUSY_LOADING
   //   status: done
   // - records arrive, and relations are still expected
   //   action: load the records in the store, store record data and the storeKeys in the requestCache and 
   //           set the record states to BUSY_LOADING
   //   status: done
   // - records arrive, relations exist and more relations still expected
   //   action: this is more or less the same as the one above, except that the relations have to be added to
   //           the record data
   // - records arrive, relations exist and no more relations are expected
   //   action: also more or less the same, only the state doesn't have to be set to BUSY_LOADING
   // - records arrive, no relations expected...
   //   action: load the records in the store, destroy the requestCache for this request
   // - relations arrive, records exist and no other relations still need to arrive
   //   action: add the relations to the record data in the requestCache, update the store with the records
   //           and destroy the requestCache for this request

   // To help us keeping the store up to date a special function is here:
   //loadRecord: function(store,recordType,storeKey,dataHash,isComplete) 
   // it can both create a record and create a partial record, based on isComplete
   // at last message we need to call dataSourceDidFetchQuery() ourselves
   // 
   // a second function is a wrapper around the previous function, and updates the cache too
   // it returns the storeKeys created, so the onFetchResult function can update the query
   */
   
   _fetchUpdateStoreAndCache: function(requestKey,store,recordType,records,isComplete) {
      if(!isComplete){
         // if not complete, create the cache info
         this._requestCache[requestKey].records = records; // save the record data in the requestCache
         this._requestCache[requestKey].storeKeys = {};
         this._requestCache[requestKey].recordKeys = {};                  
      }
      var currec,curreckey,storeKey,storeKeys = [];
      for(var i=0,len=records.length;i<len;i++){
         currec = records[i];
         curreckey = currec.key;
         storeKey = this.loadRecord(store,recordType,undefined,currec,isComplete);
         storeKeys.push(storeKey);
         if(!isComplete){ // if not complete, store the record info
            this._requestCache[requestKey].storeKeys[storeKey] = i;
            this._requestCache[requestKey].recordKeys[curreckey] = i;                     
         }
      }
      // update the recordArray the query belongs to
      // we cannot call loadQueryResults as it finishes the query, which is not what we want
      // the query is declared finished as soon as all expected responses are received (by onFetchResult)
      var recArray = store._findQuery(this._requestCache[requestKey].query, YES, NO);
      if (recArray) recArray.set('storeKeys', storeKeys);      
   },
   
   onFetchError: function(data){
      //function to handle ONR error messages for fetch
      var fetchError = data.fetchError;
      if(fetchError){
         var errorCode = fetchError.errorCode;
         var requestKey = fetchError.requestData.requestKey;
         var curRequestData = this._requestCache[requestKey];
         var message;
         switch(errorCode){
            case 0: message = "The policy settings on the server don't allow you to fetch these records"; break;
         }
         var query = curRequestData.query;
         var store = curRequestData.store;
         store.dataSourceDidErrorQuery(query);
         delete this._requestData[requestKey];
         this.showErrorMessage(message);
      }
   },
   
   onFetchResult: function(data){
      // function to process the fetch data returned from a fetch call
      // the first thing we need to do is to get the requestCacheKey, so we can have access to the data we need
      // we need to include runloop stuff, as otherwise SC cannot know this happened
      //SC.RunLoop.begin();
      var fetchinfo = data.fetchResult;
      var recordsToAdd = null;
      if(fetchinfo){ // don't do anything if no proper fetch result
         var requestKey = fetchinfo.returnData.requestKey;
         if(requestKey){ // don't do anything if no proper requestkey could be located
            // proper request Key, get the cached stuff
            var curRequestData   = this._requestCache[requestKey];
            if(!curRequestData) return; // if data is received but no store key exists anymore, ignore...
            var storeKeysInCache = curRequestData.storeKeys, // if there are store keys, records have been received previously
                unsavedRelations = curRequestData.unsavedRelations,
                isComplete,
                recordsInData = fetchinfo.records,
                relationSet = fetchinfo.relationSet,
                recordType = curRequestData.query.get('recordType'),
                store = curRequestData.store;
            if(relationSet && !storeKeysInCache){
               // no records yet received, store the relations to the unsavedRelations property, create it if it doesn exist
               if(unsavedRelations && (unsavedRelations instanceof Array)){
                   this._requestCache[requestKey].unsavedRelations = unsavedRelations.concat(relationSet);
               }
               else  this._requestCache[requestKey].unsavedRelations = relationSet; // relationSet should be an array!
               // as we received one call of the probably many: subtract one from the message to expect
               this._requestCache[requestKey].numResponses--;
               //return; // end callback
            }
            if(!storeKeysInCache && recordsInData && (recordsInData instanceof Array)){ 
               // we have a set of records, set up the record cache and load the records into the store
               // how to deal with unsavedRelations...?
               var records;
               
               // if there are unsavedRelations, merge them with the records
               if(curRequestData.unsavedRelations){
                  records = this._processRelationSet(recordsInData,curRequestData.unsavedRelations);
                  delete this._requestCache[requestKey].unsavedRelations; // delete the unsavedRelations
               }
               else {
                  records = recordsInData;
               }
               // here we have two routes: is this the last request, or isn't it? 
               // if it is, store the records in the cache
               isComplete = (curRequestData.numResponses < 2)? YES: NO; // set the record state to READY_CLEAN when this is last response            
               //   _fetchUpdateStoreAndCache: function(requestKey,store,recordType,records,isComplete) {
               this._fetchUpdateStoreAndCache(requestKey,store,recordType,records,isComplete);
               this._requestCache[requestKey].numResponses--;
            }
            if(storeKeysInCache && relationSet){
               // probably very common, get the record data and set the relations
               // this comes last on purpose, so as to be able to handle
               // messages in which BOTH parts turn out to be inside a response 
               // (future option perhaps)
               
               isComplete = (curRequestData.numResponses < 2)? YES: NO; // set the record state to READY_CLEAN when this is last response
               records = this._processRelationSet(curRequestData.records,relationSet);
               this._fetchUpdateStoreAndCache(requestKey,store,recordType,records,isComplete);
               
               this._requestCache[requestKey].numResponses--;
            } // end of storeKeysInCache && relationSet
            if(this._requestCache[requestKey].numResponses === 0){
               // last request received, clean up
               console.log("Finishing up the query stuff in Fetch");
               store.dataSourceDidFetchQuery(curRequestData.query);
               delete this._requestCache[requestKey];
            }
         }
      }
     // SC.RunLoop.end();
   },
   
   _processRelationSet: function(records,relationSet) {
      // function to parse a relationSet object and set the properties to the records
      // returns the records with the relations

      /* response body: 
       [{"fetchResult":{"relationSet": [{"bucket":"teacher",
         "keys":["MT8jQ54bZk4uLRw9VDXMmh0MznR","Sk4cDo9ZexkQZb1HmiHxr4x0pMc","2","3"],
         "propertyName":"exams",
         "data":{
            "2":["1PQVFFjFHhHwWC6noi5fBzoVzBu","4V4MrkoHAXVqre9X9x3rrYAHDVT"],
            "3":[],
            "MT8jQ54bZk4uLRw9VDXMmh0MznR":[],
            "Sk4cDo9ZexkQZb1HmiHxr4x0pMc":[]
         }
         }]}}]
      */
      
      var i,j,numrecords,numrelations, curRel, curRelData, curRec, curRecKey;
      var ret = [];
      // walk through the records one by one and look whether there are relations
      numrelations = relationSet.length;
      //console.log("trying to add " + numrelations + " relations");
      for(i=0,numrecords=records.length;i<numrecords;i++){
         curRec = records[i];
         curRecKey = curRec.key;
         for(j=0;j<numrelations;j++){
            curRel = relationSet[j];
            curRelData = curRel.data[curRecKey];
            if(curRelData){
               curRec[curRel.propertyName] = curRelData;
            }
         }// end relation parsing
         ret.push(curRec);
      }
      return ret;
   },
   
   
   // something we need to do is to create a cache of bucket and recordTypes.
   // OrionNodeRiak will only push data for records or queries fetched earlier...
   
   
   /*
      The data source should be able to automatically convert relations into multiple calls to the 
      back end...
      
      .typeClass() on a toOne or toMany returns the class of the model with which the relation is set up
      
      The largest problem is how to merge all data on the records:
      - if many-to-many both sides of the relation have to be updated 
      - if one-to-many, the many side should be a model 
      - if one-to-one
      
      
      at first though the relations have to be translated into queries
      - if many to many 
      
      while thinking out the above it occurred to me that what I intended to do isn't that easy to do 
      at the data source only... In a many to many relations, the fetch request will be only one side of that relation
      it seems quite a bit overkill to extend that fetch request to the entire graph (side one, junction table and side two)
      The only way to circumvent that without bringing over some functionality to OrionNodeRiak is to do a serie of calls.
      That is: first get all the records of the main recordType, then wait for the result, then do a request based on the
      keys of the first request...
      The problem with this approach is that it is hard to make it faster... 
      On the server side, it is possible to combine everything in one go even with a complete fetch
      
      There is of course a different way and that is to ask OrionNodeRiak to perform the actual merging of the data.
      What to choose here is mainly a case of speed... what is fastest? Or what is the easiest to make faster...
      
      What could be done is send a request in such a way that OrionNodeRiak knows what to do without having to know the entire 
      graph. In this way it can be very easy to do every relation as a junction table...
      The purpose is to allow OrionNodeRiak to automatically add an array on the records of the bucket of the 
      relations. We could add an extra object to the fetch request to clarify the exact relations...
      
      The route that seems the wisest is to have the server perform the combination... 
      Now we have to think on a method how to do that exactly
      
      the easiest way seems to be to do every relation with a junction bucket/table.
      The message that is sent to the server is something like:
      
      { fetch: { bucket: '', conditions:'', parameters: '', relations: [ { type: 'toOne', bucket: ''}, { type: 'toMany', bucket: ''}]}}
      
      the only problem here is that the server has to do a chain of callbacks to perform this action in one go, unless...
      the request is sent once and the server translates them in a series of return calls...
      the last option seems to be the most straight forward and easy to implement
      And that is how it is implemented
      
      OrionNodeRiak also supports updating relations only by omitting the record object on the request
      
      for all requests a relations array is recognised:
      relations: [ { type: 'toOne', bucket: '', propertyName: '', keys: [] }]
      
   */
      
   _requestCache: {}, //requestCache is an object (associated array) of all requests made, the format can change between request types
   
   _recordTypeCache: {}, // recordTypeCache is an object (associated array) of all record types requests have been made for
                        // its purpose is to be able to look up a record type by bucket name (forcedUpdates)
   
   // this function is more or less a duplicate of the session key generation function on the server
   _createRequestCacheKey: function(){
      // the idea for this method was copied from the php site: 
      // http://www.php.net/manual/en/function.session-regenerate-id.php#60478
      var keyLength = 32,
          keySource = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
          keySourceLength = keySource.length + 1, // we need to add one, to make sure the last character will be used in generating the key
          ret = [],
          curCharIndex = 0;
      
      for(var i=0;i<=keyLength;i++){
         curCharIndex = Math.floor(Math.random()*keySourceLength);
         ret.push(keySource[curCharIndex]);
      }
      return ret.join('');
   },
   
   /* not used...
   _getRelations: function(recordType){
      var many = [], one = [],
          curItem,
          recType;
      
      //recType = recordType.isClass? recordType: recordType.prototype; // get the class in case of an instance of the model
      recType = recordType.prototype;
      for(var i in recType){
         curItem = recType[i];
         if(curItem && curItem.kindOf && curItem.kindOf(SC.RecordAttribute)){
            if(curItem.kindOf(SC.ManyAttribute)) many.push(i);
            if(curItem.kindOf(SC.SingleAttribute)) one.push(i);
         }
      }
      if((many.length > 0) || (one.length > 0)){
         return { many: many, one: one };
      }
      else return NO; // no relations found
   },
   */
   _getRelationsArray: function(recordType) {
      var ret = [], recType, curItem;
      
      //recType = recordType.isClass? recordType: recordType.prototype; // get the class in case recordType is a record
      recType = recordType.prototype; // fix to get to the actual record type
      var oppositeRecType;
      for(var i in recType){
         curItem = recType[i];
         //console.log('parsing key ' + i);
         if(curItem && curItem.kindOf && curItem.kindOf(SC.RecordAttribute)){
            if(curItem.kindOf(SC.ManyAttribute)){
               // get the opposite record type
               oppositeRecType = curItem.typeClass().prototype;
               ret.push({ type: 'toMany', bucket: oppositeRecType.bucket, propertyName: i }); 
            } 
            if(curItem.kindOf(SC.SingleAttribute)){
               oppositeRecType = curItem.typeClass().prototype;
               var reverse = curItem.reverse;
               // check whether the reverse is a toMany
               if(reverse && oppositeRecType[reverse].kindOf(SC.ManyAttribute)){
                  ret.push({ type: 'toOne', bucket: oppositeRecType.bucket, propertyName: i}); 
               }
            } 
         }
      }
      if(ret.length > 0){
         return ret;
      }
      else return NO;
   },
   
   /* OrionNodeRiak record request api
   { refreshRecord: { bucket: '', key: '', returnData: {} }} 
   { fetch: { bucket: '', conditions: '', parameters: {}, returnData: {} }}
   { createRecord: { bucket: '', record: {}, returnData: {} }}
   { updateRecord: { bucket: '', key: '', record: {}, returnData: {} }}
   { deleteRecord: { bucket: '', key: '', returnData: {} }}
   
   { createRecordResult: {}, returnData: {} }
   { updateRecordResult: {}, returnData: {} }
   { deleteRecordResult: {}, returnData: {} }
   { refreshRecordResult: {}, returnData: {} }
   */
   
   retrieveRecord: function(store,storeKey,id){
      var recType = store.recordTypeFor(storeKey);
      var bucket = recType.prototype.bucket;
      // it is possible for the store to retrieve records not previously fetched, so we need to 
      // update the recordType cache in case we get an update in the future
      if(!this._recordTypeCache[bucket]) this._recordTypeCache[bucket] = recType;
      
      var relations = this._getRelationsArray(recType);
      var recordId = id? id: store.idFor(storeKey);
      // do we need a requestCache? Yes we do, as we need the store info, and in case of relations
      // we will receive multiple responses
      var numResponses = (relations && (relations instanceof Array))? 1 + relations.length: 1;
      var requestCacheKey = this._createRequestCacheKey();
      //console.log("Trying to refresh data of record storeKey: " + storeKey);
      this._requestCache[requestCacheKey] = { store: store, storeKey: storeKey, recordType: recType, id: recordId, numResponses: numResponses };

      if(!bucket){ // prevent doing anything if the bucket property doesn't exist
         console.log("You tried to refresh a record based on a Model that hasn't a bucket property. Forgot something?");
         return NO;
      }
      var request = { 
         refreshRecord: { 
            bucket: bucket, 
            key: recordId, 
            relations: relations, 
            returnData: { requestCacheKey: requestCacheKey }
         }
      };
      this.send(request);
      return YES;
   },
   
   onRefreshRecordError: function(data){
      //function to handle ONR error messages for fetch
      var refreshRecordError = data.refreshRecordError;
      if(refreshRecordError){
         var errorCode = refreshRecordError.errorCode;
         var requestKey = refreshRecordError.requestData.requestKey;
         var curRequestData = this._requestCache[requestKey];
         var message;
         switch(errorCode){
            case 0: message = "The policy settings on the server don't allow you to refresh this record"; break;
         }
         var storeKey = curRequestData.storeKey;
         var store = curRequestData.store;
         store.dataSourceDidError(storeKey);
         delete this._requestData[requestKey];
         this.showErrorMessage(message);
      }
   },
   
   onRefreshRecordResult: function(data){
      console.log("Received update: " + JSON.stringify(data));
      // function to process the data from the server when a refreshRecord call has been made to the server
      // we have a few cases here that are similar too the fetch request
      // we cannot just write the stuff to the store, as we have separate messages for relation stuff
      // the best we can do is save the relations if they come first
      var refreshResult = data.refreshRecordResult;
      var requestCacheKey = refreshResult.returnData.requestCacheKey;
      var curRequestCache = this._requestCache[requestCacheKey];
      var relationSet = refreshResult.relationSet;
      var unsavedRelations = curRequestCache.unsavedRelations;
      var recordData = refreshResult.record;
      var mergedData, isComplete;
      if(!curRequestCache.record && relationSet){
         // relation set arrives first, save it in the requestCache
         if(unsavedRelations && (unsavedRelations instanceof Array)){
            this._requestCache[requestCacheKey].unsavedRelations = unsavedRelations.concat(relationSet); // this is the same as fetch, but might not work            
         }
         else {
            this._requestCache[requestCacheKey].unsavedRelations = relationSet;
         }
         this._requestCache[requestCacheKey].numResponses--;
      }
      if(recordData){
         // merge the record data and relations if there are unsaved relations
         // in case of the relationset: _processRelationSet needs an array of recordData and returns an Array
         // we only have one record here, so feed it an array with one element, and only take the first element
         // from the return data.
         mergedData = unsavedRelations? this._processRelationSet([recordData],unsavedRelations)[0]: recordData;

         // store the record in the cache, to make sure that when relations and record data arrives at the same time
         // can be handled
         curRequestCache.record = mergedData;
         // now store the record data in the store
         //loadRecord: function(store,recordType,storeKey,dataHash,isComplete) {
         isComplete = (curRequestCache.numResponses < 2)? YES: NO;   
         this.loadRecord(curRequestCache.store,curRequestCache.recordType,curRequestCache.storeKey,mergedData,isComplete);
         this._requestCache[requestCacheKey].numResponses--;
      }
      if(curRequestCache.record && relationSet){
         // this is second/last on purpose, just as with fetch. It makes sure that if relations happen to arrive at the same time
         // in case the record has already arrived, and relation data is being received
         // merge the relation data with the record and update the data in the store
         mergedData = this._processRelationSet([curRequestCache.record],relationSet)[0];
         //console.log("We received a relationSet, so updating the record with the following data: " + JSON.stringify(mergedData));
         isComplete = (curRequestCache.numResponses < 2)? YES: NO;   
         this.loadRecord(curRequestCache.store,curRequestCache.recordType,curRequestCache.storeKey,mergedData,isComplete);
         this._requestCache[requestCacheKey].numResponses--;
      }
      if(this._requestCache[requestCacheKey].numResponses === 0){
         // last response received, refresh complete, remove requestCache data
         // we don't need to call dataSourceDidComplete, as the loadRecord function already does the same.
         delete this._requestCache[requestCacheKey];
      }
   },
   
   createRecord: function(store,storeKey,params){
      // create record will return only one return request
      var recType = store.recordTypeFor(storeKey);
      var dataToSend = store.readDataHash(storeKey);
      var bucket = recType.prototype.bucket;
      var relations = this._getRelationsArray(recType);
      var currel, curRelData;
      if(relations){ // in case there are relations
         // we have to process the data to remove the relation stuff
         var numRelations = relations.length;
         for(var i=0;i<numRelations;i++){
            currel = relations[i];
            curRelData = dataToSend[currel.propertyName];
            delete dataToSend[currel.propertyName];
            relations[i].keys = curRelData;
         }
         //relations separated from the record data         
      }
      // now create the request
      var requestCacheKey = this._createRequestCacheKey();
      this._requestCache[requestCacheKey] = { store: store, storeKey: storeKey, params: params };
      var returnData = { requestCacheKey: requestCacheKey };
      var request = { createRecord: { bucket: bucket, record: dataToSend, relations: relations, returnData: returnData }};
      this.send(request);
      return YES;
   },
   
   onCreateRecordError: function(data){
      //function to handle ONR error messages for fetch
      var createRecordError = data.createRecordError;
      if(createRecordError){
         var errorCode = createRecordError.errorCode;
         var requestKey = createRecordError.requestData.requestKey;
         var curRequestData = this._requestCache[requestKey];
         var message;
         switch(errorCode){
            case 0: message = "The policy settings on the server don't allow you to create this record"; break;
         }
         var storeKey = curRequestData.storeKey;
         var store = curRequestData.store;
         store.dataSourceDidError(storeKey);
         delete this._requestData[requestKey];
         this.showErrorMessage(message);
      }
   },
   
   onCreateRecordResult: function(data){
      // function to process the data from the server when a createRecord call has been made to the server
      console.log('ONR onCreateRecordResult: ' + JSON.stringify(data));
      var createRecordResult = data.createRecordResult;
      var requestCacheKey = createRecordResult.returnData.requestCacheKey;
      var requestCache = this._requestCache[requestCacheKey];
      var store = requestCache.store;
      var storeKey = requestCache.storeKey;
      var recordData = createRecordResult.record;
      store.dataSourceDidComplete(storeKey,recordData);
      // we can destroy the requestCache immediately because relations are inside the record data already, 
      // we don't even have to parse them ...
      delete this._requestCache[requestCacheKey];
   },
   
   updateRecord: function(store,storeKey,params){
      console.log('ONR data source updateRecord called');
      // function to send updates to ONR.
      // ONR supports separate relation updates from record information
      // SC doesn't at the moment, so we'll just do everything together
      // reading the updateRecord documentation: params can be provided along with the commitRecords() 
      // call to the store... So that might provide a route...
      var recType = store.recordTypeFor(storeKey);
      var dataToSend = store.readDataHash(storeKey);
      var bucket = recType.prototype.bucket;
      var key = dataToSend.key;
      var relations = this._getRelationsArray(recType);
      var currel, curRelData;
      if(relations){ // in case there are relations
          // we have to process the data to remove the relation stuff
          var numRelations = relations.length;
          for(var i=0;i<numRelations;i++){
             currel = relations[i];
             curRelData = dataToSend[currel.propertyName];
             delete dataToSend[currel.propertyName];
             relations[i].keys = curRelData;
          }
          //relations separated from the record data         
       }
       var numResponses = (relations.length>0)? 1 + relations.length: 1;
       console.log('expecting ' + numResponses + ' responses for this update');
       var requestCacheKey = this._createRequestCacheKey();
       this._requestCache[requestCacheKey] = { store: store, storeKey: storeKey, params: params, recordKey: key, numResponses: numResponses };
       var returnData = { requestCacheKey: requestCacheKey };
       var request = { updateRecord: { bucket: bucket, key: key, record: dataToSend, relations: relations, returnData: returnData }};
       this.send(request);
       return YES;
   },   

   onUpdateRecordError: function(data){
      //function to handle ONR error messages for update
      var updateRecordError = data.updateRecordError;
      if(updateRecordError){
         var errorCode = updateRecordError.errorCode;
         var requestKey = updateRecordError.requestData.requestKey;
         var curRequestData = this._requestCache[requestKey];
         var message;
         switch(errorCode){
            case 0: message = "The policy settings on the server don't allow you to update this record"; break;
         }
         var storeKey = curRequestData.storeKey;
         var store = curRequestData.store;
         store.dataSourceDidError(storeKey);
         delete this._requestData[requestKey];
         this.showErrorMessage(message);
      }
   },
   
   onUpdateRecordResult: function(data){
      console.log("Received update: " + JSON.stringify(data));
      // different implementation of the onUpdateRecordResult
      // as ONR can also return the data in one go
      // which seems the most simple and forward solution
      var updateRecordResult = data.updateRecordResult;
      var recordData = updateRecordResult.record;
      var requestCacheKey = updateRecordResult.returnData.requestCacheKey;
      var requestCache = this._requestCache[requestCacheKey];
      var store = requestCache.store;
      var storeKey = requestCache.storeKey;
      store.dataSourceDidComplete(storeKey,recordData);
      delete this._requestCache[requestCacheKey];
   },
   
   destroyRecord: function(store,storeKey,params){
      // destroy record is also a single response
      var requestCacheKey = this._createRequestCacheKey();
      var recType = store.recordTypeFor(storeKey);
      var bucket = recType.prototype.bucket;
      var recordData = store.readDataHash(storeKey);
      var key = recordData.key;
      var returnData = { requestCacheKey: requestCacheKey};
      this._requestCache[requestCacheKey] = { store: store, storeKey: storeKey, params: params };
      var relations = this._getRelationsArray(recType);
      var currel, curRelData;
      if(relations){ // in case there are relations
         // we have to process the data to remove the relation stuff
         var numRelations = relations.length;
         for(var i=0;i<numRelations;i++){
            currel = relations[i];
            curRelData = recordData[currel.propertyName];
            delete recordData[currel.propertyName];
            relations[i].keys = curRelData;
         }
         //relations separated from the record data         
      }
      var request = { deleteRecord: { bucket: bucket, key: key, record: recordData, relations: relations }};
      this.send(request);
      return YES;
   },
   
   onDeleteRecordError: function(data){
      //function to handle ONR error messages for delete
      var deleteRecordError = data.deleteRecordError;
      if(deleteRecordError){
         var errorCode = deleteRecordError.errorCode;
         var requestKey = deleteRecordError.requestData.requestKey;
         var curRequestData = this._requestCache[requestKey];
         var message;
         switch(errorCode){
            case 0: message = "The policy settings on the server don't allow you to delete this record"; break;
         }
         var storeKey = curRequestData.storeKey;
         var store = curRequestData.store;
         store.dataSourceDidError(storeKey);
         delete this._requestData[requestKey];
         this.showErrorMessage(message);
      }
   },
   
   onDeleteRecordResult: function(data){
      // function to process the data from the server when a deleteRecord call has been made to the server      
      // only one response expected
      var deleteResult = data.deleteRecordResult;
      var requestCacheKey = deleteResult.returnData.requestCacheKey;
      var requestCache = this._requestCache[requestCacheKey];
      var store = requestCache.store, storeKey = requestCache.storeKey, params = requestCache.params;
      store.dataSourceDidDestroy(storeKey);
   }
   
});

