var http = require('http'), 
    url = require('url'),
    fs = require('fs'),
    sys = require('sys');

var querystring = require('querystring'), // for session key parsing
    Session = require('./Session').Session,
    SocketListener = require('./SocketListener').SocketListener,
    Policies = require('./Policies').Policies,
    MemStore = require('./MemStore').MemStore,
    DiskStore = require('./DiskStore').DiskStore,
    Constants = require('./Constants'),
    API = require('./core/API'),
    RPCHooks = require('./RPCHooks');

/*
The idea behind this Node.js ThothServer is to have a node-js server
that is reached using a apache proxy to overcome same-origin-policy trouble

The way requests are handled is more or less the same as a normal REST interface,
that is that the websocket connection uses a format that is comparable to the http requests:

{"get":"model/id"}
{"post":"model"}
{"put":"model/id"}
{"delete":"model/id"}


*/
exports.Server = SC.Object.extend({
   
   port: 8080,
   
   REPL: NO,
   
   RESTOnly: false,
   
   URLPrefix: null,  // what prefix to expect to REST requests, for example /REST, very useful when Thoth is behind a proxy
   
   allowXHRPolling: true,
   
   forceAuth: true, // the socket clients haven't been written in such a way atm that changing this to false does anything...
   
   forceMD5Auth: false,
   
   authModule: null,
   
   policyModule: null,
   
   sessionModule: null, 
   
   rpcModule: null, 
   
   store: null, // place to bind the store / data source to
   
   tempStore: null, // place to bind the temporary store type to, defaults to memstore, inited when the server is started
   
   debug: false, // show debug messages
   
   // ==============================
   // = Init and startup functions =
   // ==============================

   socketIO: null,
   
   socketIOBuffer: [],
   
   server: null,
         
   _startServer: function(){
      this.server = http.createServer(this.createHTTPHandler(this));
      this.server.listen(this.port);
      sys.puts("Listening on port " + this.port);
   },
   
   init: function(){
     this.URLPrefix = '/thoth'; // setting a default value when an instance is made
     arguments.callee.base.apply(this, arguments); // have super called afterwards to be able to override the default URLPrefix
   },

   start: function(){
      sys.puts('Starting ThothServer');

      // set up temporary store if not setup in config
      if(!this.tempStore) this.tempStore = MemStore.create();
      // set up session Module if not set up in config
      if(!this.sessionModule) this.sessionModule = Session.create();
      
      // start the server
      this._startServer();
      
      // allow stores to setup running conditions
      if(this.tempStore.start) this.tempStore.start(); 
      if(this.store.start) this.store.start(); 

      if(!this.RESTOnly){
         this._attachSocketListener();
      }
      if(this.REPL){
        this._repl = require('repl');
        this._repl.start().context.myServer = this;
      }           
   },
   
   _attachSocketListener: function(){
      var json = JSON.stringify;
      var me = this;
      //this.socketIO = socketIoServer.listen(this.server, {
      //sys.puts("server before socketio init: " + this.server);
      
      // first create because we need to able to refer to it later, as start() doesn't return the object
      this.socketIO = SocketListener.create({ThothServer: this }); 
      this.socketIO.start(this.server,{
        onClientConnect: function(client){
           //sys.puts("onClientConnect in ThothServer called");
           // no particular action needed here...
        },

        onClientDisconnect: function(client){
           //sys.puts("onClientDisconnect in ThothServer called");
           // client disconnects, probably also no action needed here...
        },

        onClientMessage: function(message, client){
           sys.puts("onClientMessage in ThothServer called with message: " + JSON.stringify(message));
           var userData = client.userData;
           userData.sessionKey = client.sessionKey;
           var returnFunction = function(data){
              me.socketIO.sendData(userData,data);  // the socket listener takes care of queueing
           };
           if(message.fetch) me.onFetch.call(me,message,userData,returnFunction);
           if(message.refreshRecord) me.onRefresh.call(me,message,userData,returnFunction);
           if(message.createRecord) me.onCreate.call(me,message,userData,returnFunction);
           if(message.updateRecord) me.onUpdate.call(me,message,userData,returnFunction);
           if(message.deleteRecord) me.onDelete.call(me,message,userData,returnFunction);
           if(message.rpcRequest) me.onRPCRequest.call(me,message,userData,returnFunction);
        }
        
      });
   },   

   createHTTPHandler: function(serverObj){
      var me = this;
      return function(request, response){
         var path = url.parse(request.url).pathname;
         if(this.debug) sys.log('ThothServer: got a request for path: ' + path);
         if(me.URLPrefix){ // subtract the URLPrefix from the URL
            if(path.slice(0,me.URLPrefix.length) === me.URLPrefix){
               path = path.slice(me.URLPrefix.length, path.length);
            }
         }
         var method = request.method;
         if(path === '/'){
           if(this.debug){
             response.writeHead(200, {'Content-Type': 'text/html'});
             response.write("request URL: " + request.url + "<br>");
             response.write("request path: " + path + "<br>");
             response.end();             
           }
           else this.send404(response);
         }
         else { // path is anything else as '/'
            var resource = path.slice(1);
            if(serverObj.forceAuth){   
               // make sure that the user is authenticated, 
               // but only after we found out the current request doesn't turn out to be an auth request
               if(method === 'POST' && resource == 'auth'){ // force auth with posting
                  sys.log('ThothServer: receiving an AUTH request on the REST side');
                  var authdata = "";
                  request.addListener("data", function(chunk){ // gather data
                     authdata += chunk;
                  });
                  request.addListener("end", function(){ // finished gathering data, call AUTH
                     serverObj.AUTH(request,authdata,response);
                  });
               }
               else { // if not an auth request, check whether the user has a session
                  //sys.puts(sys.inspect(request));
                  if(resource.indexOf('rpc') !== 0){ // allow non-auth requesting of rpc data
                     var receivedCookieHeader = request.headers['cookie'];
                     var receivedUserName = request.headers['username'];
                     //sys.puts('cookieHeader received: ' + receivedCookieHeader);
                     if(receivedCookieHeader && receivedUserName){
                        //check the session
                        var hasSession = serverObj.sessionModule.checkSession(receivedUserName,receivedCookieHeader);
                        if(!hasSession){
                           response.writeHead(403, {'Content-Type':'text/html'});
                           response.write('Not logged in, invalid cookie'); // this can be much more fancy of course!
                           response.end();                        
                           return;
                        } // do nothing else, let flow continue to the switch(method) below
                     }
                     else {
                        response.writeHead(403, {'Content-Type':'text/html'});
                        response.write('Not logged in, no cookie information found'); // this can be much more fancy of course!
                        response.end(); 
                        return;
                     }                     
                  }
               }
            }
            // handle all normal requests
            switch(method){
               case 'GET': 
                  if(resource.indexOf('rpc'=== 0)){
                     serverObj.RPC(request,resource,response);
                  }
                  else {
                     serverObj.GET(request,response); 
                  }
                  break;
               case 'POST': 
                  var postdata = "";
                  request.addListener("data", function(chunk){ // gather data
                     postdata += chunk;
                  });
                  request.addListener("end", function(){ // finished gathering, call post
                     serverObj.POST(request,postdata,response);
                  });
                  break;
               case 'PUT':
                  var putdata = "";
                  request.addListener("data", function(chunk){ //gather data
                     putdata += chunk;
                  });
                  request.addListener("end", function(){
                     serverObj.PUT(request,putdata,response); // finish gathering, call put
                  });
                  break;
               case 'DELETE': 
                  var deletedata = "";
                  request.addListener("data", function(chunk){ //gather data
                     deletedata += chunk;
                  });
                  request.addListener("end", function(){
                     serverObj.DELETE(request,deletedata,response); // finish gathering, call delete
                  });
                  break;  
            }               
         }
      };
   },

   
   // function to get the URLPrefix with a leading slash, even if the user has omitted it
   getURLPrefix: function(){
     var pref = this.URLPrefix,
         ret = (pref[0] === '/')? pref: '/' + pref;
     return ret;
   },
   
   send404: function(res){
      res.writeHead(404);
      res.write('404');
      res.end();
   },
   
// ===========================
// = REST Handling functions =
// ===========================   
   
   RPC: function(request,resource,response){
      // RPC accepts a JSON object { rpcRequest: { cacheKey: ''}}
      // call the RPC 
      // split the cacheKey from the resource
      sys.log("ThothServer: RPC called");
      var resourceInfo = resource.split('/');
      if(resourceInfo && (resourceInfo.length===2)){
         var cacheKey = resourceInfo[1];
         if(cacheKey && this.rpcModule){
            var me = this;
            var cb = function(mimeType,data){
               if(mimeType && data){
                  response.writeHead(200, {'Content-Type': mimeType });
                  response.write(data,'binary');
                  response.end();
               }
               else me.send404(response); // force the end of the response if nothing can be found?              
            };
            sys.log('ThothServer: about to call rpcRetrieve on rpcModule');
            this.rpcModule.rpcRetrieve(cacheKey, cb);
         }
      }
   },
   
   AUTH: function(request,data,response){
      // when succesfully authenticated, send back a set-cookie header
      // a standard PHP session start answers with the following headers on the auth request
      /* 
      Date  Fri, 02 Jul 2010 20:14:48 GMT
      Server  Apache
      Expires Thu, 19 Nov 1981 08:52:00 GMT
      Cache-Control no-store, no-cache, must-revalidate, post-check=0, pre-check=0
      Pragma  no-cache
      Set-Cookie  Thoth_loginproto=teacher; expires=Mon, 02-Aug-2010 20:14:48 GMT
      Vary  Accept-Encoding
      Content-Encoding  gzip
      Content-Length  661
      Keep-Alive  timeout=15, max=200
      Connection  Keep-Alive
      Content-Type  text/html
      */
     
      var givenCookieHeader = request.headers.Cookie;
      // data should be json stuff
      var dataObj = JSON.parse(data);
      var me = this;
      var callback = function(authResult){
        if(authResult){
          // successfull auth
          // need to get the user data into the session info somehow
          var newCookieHeader = me.sessionModule.createSession(authResult);
          response.writeHead(200, {'Content-Type': 'text/html', 'Set-Cookie':newCookieHeader });
          var sessionInfoObj = querystring.parse(newCookieHeader,';','=');
          var receivedSessionKey = sessionInfoObj[me.sessionModule.sessionName];
          response.write(JSON.stringify({sessionCookie: receivedSessionKey}));
       }
       else {
          response.writeHead(200, {'Content-Type': 'text/html'});
          response.write("<br/>auth result: " + authResult);
          //response.write('<br/>received cookie: ' + givenCookieHeader);
       }
       response.end();         
    };
    this.authModule.checkAuth(dataObj.user, dataObj.passwd,false,callback);    
  },
   
  GET: function(request,response){
    var me = this;
    var path = url.parse(request.url).pathname;
    var resource = path.slice(1); // return the entire string except the first character (being a "/")
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write('ThothServer: GET: received resource: ' + resource);
    response.end();
  },
   
  POST: function(request,data,response){
    //response.writeHead(200, {'Content-Type': 'text/html'});
    //response.write("request URL: " + request.url + "<br>");
    //response.write("request path: " + path + "<br>");
    //sys.puts(sys.inspect(request));
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write('received data: ' + data);
    response.end();
  },
   
  PUT: function(request,data,response){
   sys.log('Thoth Server: The REST command PUT has not been implemented');      
  },
   
  DELETE: function(request,data,response){
   sys.log('Thoth Server: The REST command DELETE has not been implemented');
  },

// ==========================================
// = Methods for registering temporary urls =
// ==========================================
  
  // this function registers temporary resources, for example for RPC or file anonymising purposes
  // bucket = resource, key is the resource id, 
  // limit contains a limit for which the url will be available. How that limit is parsed depends on the limitType.
  // limitType is either 'num' (number of times retrievable, 0 for unlimited access) or 'datetime' (timestamp: var t = new Date(); datetime = t.toString();)
  // data is the data to return, but what the server returns depends on the actual request depends on mimetype.
  // if datatype is 'application/json' it will return the data directly, if the mimetype is anything else, it will 
  // assume data contains an file path or url and will return the data in that file with the given mimetype
  // if shouldAnonymize is true, and mimeType is a digital file, it will make up a fake file name
  // returns true when saved.
  registerTemporaryURL: function(bucket,key,data,mimeType,limit,limitType,shouldAnonymize){
    if(!this.tempStore){
      sys.log('Thoth Server: unable to register temporary url because there is no temporary store??');
      return false;
    }
    // the temporary url will be stored in the temp store with tempURL as bucket and the expected resource as key
    var record = {
      data: data,
      mimeType: mimeType,
      limit:limit,
      limitType: limitType,
      shouldAnonymize: shouldAnonymize
    };
    this.tempStore.createDBRecord(this._createTempURLStoreRequest(bucket,key,record));
  },
  
  // This function will check whether the requested url fits any registered temporary url and handle the request.
  // if no temporary url has been found, it will call the callback with the original request and response
  getTemporaryURL: function(request,response,callback){
    var me = this;
    var path = url.parse(request.url).pathname;
    if(this.URLPrefix && (path.indexOf(this.URLPrefix) === 0)){ // slice off url prefix if exists
      path = path.slice(this.URLPrefix.length);
    }
    
    var resource = (path[0] === '/')? path.slice(1): path; // remove the first character if it is a "/" 
    var parts = resource.split('/'); 
    if(parts.length === 2){ // if not, someone is playing with us... and we should ignore it
      var bucket = parts[0];
      var key;
      
      if(parts[1].indexOf('?') > 0) key = parts[1].split('?')[0];
      else key = parts[1]; // only get the key and ignore any URL parameters if present

      this.tempStore.refreshDBRecord(this._createTempURLStoreRequest(bucket,key),function(rec){
        if(rec){ // something found, so parse it
          if(me._checkTempURLValidity.call(me,bucket,key,rec)){ // function auto-updates tempStore
            // valid url, so give out info
            me._respondToTempURL.call(me,rec,response);
            return;
          }  
        }
        callback(request,response);
      });
    }
  },
  
  _respondToTempURL: function(record,response){
    if(record){ // just in case
      switch(record.mimeType){
        case 'application/json': 
            response.writeHead(200, {'Content-Type': record.mimeType });
            response.write(record.data);
            response.end();
          break;
        default: // assume a digital file
          fs.readFile(record.data,'binary',function(err,data){
            if(err){
              sys.log('ThothServer: tmpURL: trying to send file, but encountered error while reading file');
              me.send404(response);
            } 
            else {
              response.writeHead(200, {'Content-Type': record.mimeType });
              response.write(data,'binary');
              response.end();
            }
          });
      }
    }
  },
  
  // function to check the validity of the record and update the information if necessary, or destroy the record
  // returns true when valid, or false when invalid
  _checkTempURLValidity: function(bucket,key,record){
    if(record){
      var ret = false;
      switch(record.limitType){
        case 'num': 
          if(record.limit > 1){
            record.limit -= 1;
            this.tempStore.updateDBRecord(this._createTempURLStoreRequest(bucket,key,record));
          }
          if(record.limit === 1){
            this.tempStore.deleteDBRecord(this._createTempURLStoreRequest(bucket,key)); // remove if == 1            
          }
          if(record.limit < 0){
            this.tempStore.deleteDBRecord(this._createTempURLStoreRequest(bucket,key)); // remove if smaller than 0, because someone is playing us            
          }
          ret = true;
          break;
        case 'datetime':
          var now = new Date(),
              recTimeStamp = new Date(record.limit),
              diff = now - recTimeStamp;
          
          if(diff < 0){ // restriction time passed, so remove rec
            this.tempStore.deleteDBRecord(this._createTempURLStoreRequest(bucket,key)); // remove 
          }
          else ret = true;
          break;
        default: ret = false;
      }
      return ret;
    } 
    else return false;
  },
  
  _createTempURLStoreRequest: function(bucket,key,record){
    var newKey = [bucket,key].join('/');
    var storeRequest = {
      bucket: 'tempURL',
      key: newKey,
      recordData: record
    };
    return storeRequest;        
  },
  
  destroyTemporaryURL: function(bucket,key){
    if(!this.tempStore){
      sys.log('Thoth Server: unable to destroy temporary url because there is no temporary store??');
      return false;
    }

    this.tempStore.deleteDBRecord(this._createTempURLStoreRequest(bucket,key));
  },
   
// ==================================
// = Methods used by SocketClients =  
// ==================================

// make sure you use these functions when you are writing a REST interface that should interact with the socket clients!  



   /*
   DATA requests:
   { refreshRecord: { bucket: '', key: '', returnData: {} }} 
   { fetch: { bucket: '', conditions: '', parameters: {}, returnData: {} }}
   { createRecord: { bucket: '', record: {}, returnData: {} }}
   { updateRecord: { bucket: '', key: '', record: {}, returnData: {} }}
   { deleteRecord: { bucket: '', key: '', returnData: {} }}
   
   // the fetch call has the option of passing the conditions and parameters of a query
   // records will be filtered based on it
   
   // most properties are self explanatory, but returnData needs some explanation on its own.
   // return data is an object that can be delivered along side the request and which is
   // returned by the server in the answer to that request. This helps the client side identifying 
   // what request was answered exactly.
   
   // returned by the server as answer to a client request
   { fetchResult: { bucket: '', records: [], returnData: {} }}
   { createRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }
   { updateRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }
   { deleteRecordResult: { bucket: '', key: '', returnData: {} } }
   { refreshRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }
   
   // returned by the server when the request was denied based on policy
   { fetchError:   { errorCode: 0, returnData: {} }}
   { createRecordError:  { errorCode: 0, returnData: {} }}
   { updateRecordError:  { errorCode: 0, returnData: {} }}
   { deleteRecordError:  { errorCode: 0, returnData: {} }}
   { refreshRecordError: { errorCode: 0, returnData: {} }}
   
   errorCodes: (defined in lib/core/Constants.js)
   0 - Access denied on policy
   1 - Action denied on data inconsistency
   
   */


   
   /*
   
   Message handling: these functions should be more or less the same for both REST and websocket
   interfaces... That is, a rest update should be forwarded to all connected websocket clients
   That means that the onFetch method doesn't speak to the client itself, but should only 
   return the data from the db request
   
   it may actually be a nice idea to only have this function called as a callback after 
   a call. We don't have to deal with relations anyway, so we don't need to do pre-dbcall checks
   The only thing is that in order to update session data about queries etc we need access to the
   original request, which is very easy to do...
   
   While using this kind of function as fetch, there is no problem with pre-db checks,
   but if we want to be able to o pre-db checks like model-value record validation
   this scheme wouldn't work
   
   what if the request is pushed to the onFetch with a callback function to call at the end of the 
   run? That seems to be a better idea...
   
   the callback only needs to be called with one parameter, being the data to send
   
   The handlers need to return the data in the proper format, as described above.
   The handlers also need to check for connections on socketio.
   
   Hmm, that last idea just feels wrong... actually, you would rather have a separate function do the 
   socket io checking..., even all listeners checking
   that function should ask all listeners what clients (authenticatedClients) they have and what session 
   ids they have
   Then we can get to the session data cache, ask it whether the present record fits the past of the client,
   and if yes, go back to the listener, check whether a connection exists (or even do if before checking the
   session data) and send it when a connection exists, or push it to the data cache
   
   There is one issue yet to be solved and that is that the current checking only returns yes or no,
   but not what kind of action would be appropriate... 
   
   I just realised that by choosing the data calls as I did I almost forced the server into having to know
   what kind of action the client should perform on the data... especially the create vs update seems
   It seems to be wiser to have that decision made by the client whether a record is created or updated..
   Deletion though should be marked clearly.
   On the other side, the server already knows what records the client has.
   So, let's have the answer by the server cache decide what needs to happen with
   
   The start of the flow should most definitely be here... There is only the question of the case
   in which multiple types of client need to be kept up to date... The best seems to be an array
   of listener objects which need to be checked...
   
   */


   /*
      While working on the data source it turns out that doing all the relations on the client side makes things very 
      complicated. Still it feels wrong to have to define models in two different places. 
      So the idea now is to send a relation graph from the client to the server to have the server reply in a few different messages
      Of course it is not a complete relation graph, but just a relation graph of a specific model
      
      The fetch request becomes something like this:
      
      { fetch: { bucket: '', conditions:'', parameters: '', 
                  relations: [ { propertyName: '', type: 'toOne', bucket: ''}, { propertyName: '', type: 'toMany', bucket: ''}]}}
      
      From this data the server can create a set of messages to be sent to the client
      The client can know beforehand how many messages to receive (one for the main record data, and one for each relation)
      
      the answer of the server will be:
      
      - a normal fetchResult
      - { fetchResult: { relationSet: [ { bucket: '', keys: [''], propertyName: '', data: {} } ], returnData: { requestKey: ''}}} 
         where:
            - bucket is the bucket the request belongs to
            - keys is the set of keys for which the relation data is contained in data
            - propertyname is the name of the toOne or toMany property
            - data is the set of keys describing the relation, associative array by key
            - requestKey is the key of the original request
         
      It could turn out to be very useful if the set of storeKeys are stored in the data source as it would speed up 
      processing of the relation data
      
      We need to think about a way to generate the junction table fields, something like [bucketname,"key"].join("_")
      We also need a way to name the junction bucket/table, the best option seems to be the combination of both bucket names
      in alphabetised order. 
   */
   
   /*
   the storeRequest is an object with the following layout:
   { bucket: '', 
     key: '', // not used by fetch
     primaryKey: '', // the property name containing the primary key for a certain record / model
     action: '', // action performed by the request: create, update, refresh, or destroy
     client: '', // all client data 
     properties: [ { key: '', type: ''}],
     conditions: '', // not used by the individual record functions (create,refresh,update,delete)
     parameters: {}, // not used by the individual record functions (create,refresh,update,delete)
     relations: [ 
        { bucket: '', type: 'toOne', propertyName: '' }, 
        { bucket: '', type: 'toMany', propertyName: ''} 
     ] 
   } */
   
   // central place to create a storeRequest, also does consistency checks
   _createStoreRequest: function(requestData,userData,action){
     var rec = requestData.record;
     var primKey = requestData.primaryKey;
     var ret = {
       action: action,
       bucket: requestData.bucket,
       key: requestData.key,
       primaryKey: requestData.primaryKey,
       userData: userData,
       recordData: requestData.record,
       conditions: requestData.conditions,
       parameters: requestData.parameters,
       properties: requestData.properties,
       relations: requestData.relations
     };
     //  consistency check
     if(rec){
       //primaryKey value on record and key value on the request should be the same.
       ret = (primKey && (rec[primKey] !== ret.key))? null: ret;
       // if primaryKey exists and a key and id exist, they should all contain the same value
       ret = (primKey && rec.id && rec.key && rec[primKey] && (rec[primKey] !== rec.id) && (rec[primKey] !== rec.key))? null: ret; 
     }
     return ret;
   },
   
   // create a standard reply object for a specific error
   _createErrorReply: function(action,error, returnData){
     var ret, msg;
     
     switch(error){
       case Constants.ERROR_DENIEDONPOLICY: msg = 'Denied on policy'; break;
       case Constants.ERROR_DATAINCONSISTENCY: msg = "Inconsistency in request"; break;
       default: msg = "Undefined error";
     }
     
     switch(action){
       case Constants.ACTION_FETCH: ret = { fetchError: { errorCode: error, message: msg, returnData: returnData }}; break;
       case Constants.ACTION_REFRESH: ret = { refreshRecordError: { errorCode: error, message: msg, returnData: returnData }}; break;
       case Constants.ACTION_CREATE: ret = { createRecordError: { errorCode: error, message: msg, returnData: returnData }}; break;
       case Constants.ACTION_DELETE: ret = { deleteRecordError: { errorCode: error, message: msg, returnData: returnData }};break;
       case Constants.ACTION_UPDATE: ret = { updateRecordError: { errorCode: error, message: msg, returnData: returnData }}; break;
       default: ret = { undefinedError: { errorCode: error, message: msg, returnData: returnData }};//whoops?
     }
     return ret;
   },

   onFetch: function(message,userData,callback){
      // the onFetch function is called to do the back end call and return the data
      // as there is no change in the data, the only thing it needs to do versus
      // the server cache is to update the server cache with the records the current
      // client / sessionKey combination requested.
      // this function uses a callback to return the result of the fetch so the function can
      // be used as you would like...

      //sys.log('Server.onFetch called');
      
      var fetchinfo = message.fetch; 
      var me = this;
      var clientId = [userData.user,userData.sessionKey].join("_");
      var storeRequest = this._createStoreRequest(fetchinfo,userData,'fetch');
      
      if(!storeRequest){
        callback(this._createErrorReply(Constants.ACTION_FETCH,Constants.ERROR_DATAINCONSISTENCY,fetchinfo.returnData));
        return; 
      }
      
      // first define the function. The idea is that no policy is the same as always allow
      // so the function is defined as if there is always a policy system, so it can be
      // used as a policyModule callback

      var sendRecordData = function(records){ // the policy module takes care of handling record arrays, so we can expect an array of 
         // properly adjusted records...
         // store the records and the queryinfo in the clients session (if the conditions are not there, the session function 
         // will automatically convert it into a bucket only query)
         me.sessionModule.storeRecords(userData.user,userData.sessionKey,records);
         me.sessionModule.storeQuery(userData.user,userData.sessionKey,fetchinfo.bucket,fetchinfo.conditions,fetchinfo.parameters);
         // send off the data
         sys.log('Sending dataset for bucket ' + fetchinfo.bucket);
         callback({ 
            fetchResult: { 
               bucket: fetchinfo.bucket, 
               records: records, 
               returnData: fetchinfo.returnData
            }
         });
      };

      var fetchRequest = function(policyResponse){
         if(policyResponse){ // if any of YES or "retry"
            me.store.fetch(storeRequest,clientId,function(data){ 
               /*
               We need to be aware that in case of relations this function is not only called for the record results
               but also called once for every relation.
               The difference is that a normal result is an object { recordResult: [records]}
               and the relations are returned as a { relationSet: { }}
               */
               // in case the policyResponse is "retry", we need to re-evaluate the policy
               if(data.recordResult){
                  if(policyResponse === 'retry'){
                     me.policyModule.checkPolicy(storeRequest,data.recordResult,sendRecordData);
                  }
                  else {
                     sendRecordData(data.recordResult);
                  }
               }
               if(data.relationSet){
                  // in case of a relationSet, don't do policyChecks...
                  // if the policyChecks are implemented properly even the ids of the records couldn't lead to  leaking data
                  sys.log('Sending relationset for bucket ' + fetchinfo.bucket);
                  callback({
                     fetchResult: {
                        relationSet: [ data.relationSet ],
                        returnData: fetchinfo.returnData
                     }
                  });
               } // end if(data.relationSet)
            });   
         } // end if(policyResponse)
         else {
            // not allowed... what to do? add a response option? {fetchError: { error: 'not allowed', returnData: fetchinfo.returnData}} ?
            callback(me._createErrorReply(Constants.ACTION_FETCH, Constants.ERROR_DENIEDONPOLICY,fetchinfo.returnData));
            //sys.log('Whoops... not allowed and no response to the client?');
         }
      };
      
      // now do the actual data check
      if(this.policyModule){
         this.policyModule.checkPolicy(storeRequest,null,fetchRequest);
      }       
      else {
         fetchRequest(YES);
      }
   },
   
   onRefresh: function(message,userData,callback){
      // the onRefresh function is called to do the back end call and return the
      // data. As there is probably no change in data, we don't have to let
      // other clients know. For consistency, let's store the record in the session
      // information anyway to update the timestamp, maybe it can have some nice 
      // purpose in the future
      sys.log("ThothServer onRefresh called");
      var refreshRec = message.refreshRecord;
      var storeRequest = this._createStoreRequest(refreshRec,userData,Constants.ACTION_REFRESH);
      if(!storeRequest){
        callback(this._createErrorReply(Constants.ACTION_REFRESH,Constants.ERROR_DATAINCONSISTENCY,refreshRec.returnData));
        return;
      } 
      
      var me = this;
      var clientId = [userData.user,userData.sessionKey].join("_");
      if(refreshRec.bucket && refreshRec.key){
         
         var sendRecordData = function(rec){
            me.sessionModule.storeBucketKey(userData.user,userData.sessionKey, refreshRec.bucket, rec.key);
            var ret = { refreshRecordResult: { bucket: refreshRec.bucket, key: rec.key, record: rec, returnData: refreshRec.returnData } };
            callback(ret);
         };
         
         var refreshAction = function(policyResponse){
            if(policyResponse){ // either 'retry' or YES on first attempt
               me.store.refreshRecord(storeRequest,clientId,function(val){ 
                  // this function can be called with different results: with record data and with relations
                  var ret, relSet;
                  if(val.refreshResult){
                     var rec = val.refreshResult;
                     if(policyResponse === 'retry'){
                        me.policyModule.checkPolicy(storeRequest,rec,sendRecordData);
                     }
                     else {
                        sendRecordData(rec);
                     }
                  }
                  if(val.relationSet){
                     relSet = (val.relationSet instanceof Array)? val.relationSet: [val.relationSet]; // make it into an array if it isn't one already
                     ret = { refreshRecordResult: { relationSet: relSet, returnData: refreshRec.returnData }};
                     callback(ret);
                  }
               });            
            
            }
            else {
               callback(me._createErrorReply(Constants.ACTION_REFRESH, Constants.ERROR_DENIEDONPOLICY,refreshRec.returnData));
            }
         }; // end refreshAction
         
         if(this.policyModule){
            this.policyModule.checkPolicy(storeRequest,storeRequest.recordData,refreshAction);
         }
         else {
            refreshAction(YES);
         }
      }
      else {
        sys.log("ThothServer received an invalid refreshRecord call:");
        sys.log("The offending message is: " + JSON.stringify(message)); 
      } 
   },
   
   distributeChangesTwo: function(storeRequest, originalUserData){
     var me = this, 
         matchingUserSessions,
         action = storeRequest.action;
     
     var performDistributeOrQueue = function(request,userData){
       var result = me.socketIO.updateAuthenticatedClient(userData.user,userData.sessionKey,request);
       if(result){ // update clients session
          me.sessionModule.storeBucketKey(userData.user,userData.sessionKey,request.bucket,request.key);
       }
       else { // not sent to the client, push it to the request Queue
          me.sessionModule.queueRequest(userData.user,userData.sessionKey,request);
       }
     };
     
     var determineActionType = function(sessionInfo){
       var curUser = sessionInfo.user,
           curSessionKey = sessionInfo.sessionKey,
           curMatchType = sessionInfo.matchType,
           whatToDo = action + curMatchType;

       // matrix: action - matchType
       // actions that matter: ACTION_CREATE, ACTION_UPDATE, ACTION_DELETE
       // matchTypes are 'bucketkey' and 'query'
       // Constants.DISTRIBUTE_QUERY
       // Constants.DISTRIBUTE_BUCKETKEY           
           
       switch(whatToDo){
         case (Constants.ACTION_CREATE+Constants.DISTRIBUTE_BUCKETKEY): break;
         case (Constants.ACTION_CREATE+Constants.DISTRIBUTE_QUERY): break;
         case (Constants.ACTION_UPDATE+Constants.DISTRIBUTE_BUCKETKEY): break;
         case (Constants.ACTION_UPDATE+Constants.DISTRIBUTE_QUERY): break;
         case (Constants.ACTION_DELETE+Constants.DISTRIBUTE_BUCKETKEY): break;
         case (Constants.ACTION_DELETE+Constants.DISTRIBUTE_QUERY): break;
         default: sys.log('Distribute records: default whatToDO should not happen at all. Major error!!');
       } 
           
     }
     // matchingUserSessions should use storeRequest  
     var matchingUserSessions = this.sessionModule.getMatchingUserSessionsForRecord(record);
     

     
   },
   
   
   distributeChanges: function(record,action,originalUser,originalSessionKey){
      // function to actually distribute a change in the database.
      // the record contains the new data, the action contains the original action by the client
      // the actions are "create","update","delete"... Depending on what the session cache tells us
      // ("bucketkey" or "query") and the action, server side requests will be made to the client.
      // the server doesn't expect any confirmation back! 
      // the function will not distribute the changes to the originalUser/sessionKeyCombination

      //sys.puts(" matching User sessions: " + sys.inspect(matchingUserSessions));
      
      /* 
      lets make a scheme of what action and what match type what server side request should be
      
      create:
         - bucketkey: highly unlikely and rather problematic... in this case the server should generate a warning...
                      The only case I can think of this happening is the delete action of a client results in 
                      a newly creation of the same record by another client... it still stinks...
         - query: this is very likely. in this case the server should send a createRecord message to the client
                  and update the sessionData of the client
         
      update: 
         - bucketkey: highly likely, in this case the server should send an updateRecord message to the client
         - query: rather peculiar, but might be possible... in this case send a createRecord message to the client,
                  if a record like this already exists on the client, it should consider it an update...
                  the use case here actually is less peculiar than originally thought:
                  it could be that some property has changed (or even permissions?)
                  which makes it match an existing query
                  
      delete:
         - bucketkey: likely, in this case the server should send a deleteRecord message to the client
         - query: rather peculiar... in this case the server shouldn't do anything, because the record doesn't exist at the 
                  client anyway
                  
      
      When the request is queued, we don't need to do anything else...
      as soon as the connection is restored, all actions will be sent to the client and the sessionCache updated.
      */      
      var matchingUserSessions = this.sessionModule.getMatchingUserSessionsForRecord(record);
      //sys.puts("Found " + matchingUserSessions.length + " matching user session for record " + JSON.stringify(record) + " and action " + action);
      var curUser, curSessionKey, curMatchType, result, createRequest;
      var me=this; // needed because everything below is inside a forEach
      matchingUserSessions.forEach(function(sessionInfo){
         curUser = sessionInfo.user;
         curSessionKey = sessionInfo.sessionKey;
         curMatchType = sessionInfo.matchType;
         //sys.puts("Current user: " + curUser);
         //sys.puts("current sessionKey: " + curSessionKey);
         //sys.puts("Current matchtype: " + curMatchType);
         if(curSessionKey !== originalSessionKey){
            switch(action){
               case 'create': 
                  if(curMatchType == 'bucketkey'){ // whoops??, just create a server side error message for now
                     sys.puts("The combination of a newly created record that matches a bucket/key combination for a different user hasn't been implemented yet.");
                  }
                  if(curMatchType == 'query'){ // send a createRecord request to the client and update the clients sessions
                     createRequest =  {createRecord: { bucket: record.bucket, key: record.key, record: record}};
                     result = me.socketIO.updateAuthenticatedClient(curUser,curSessionKey,createRequest);
                     if(result){ // update clients session
                        me.sessionModule.storeBucketKey(curUser,curSessionKey,record.bucket,record.key);
                     }
                     else { // not sent to the client, push it to the request Queue
                        me.sessionModule.queueRequest(curUser,curSessionKey,createRequest);
                     }
                  }
                  break;
               case 'update':
                  if(curMatchType == 'bucketkey'){ // send an updateRecord request to the client and update the clients session
                     var updateRequest = { updateRecord: { bucket: record.bucket, key: record.key, record: record}};
                     result = me.socketIO.updateAuthenticatedClient(curUser,curSessionKey,updateRequest);
                     if(result){
                        me.sessionModule.queueRequest(curUser,curSessionKey,record.bucket,record.key);
                     }
                     else {
                        me.sessionModule.queueRequest(curUser,curSessionKey,updateRequest);
                     }
                  }
                  if(curMatchType == 'query'){ // send a createRecord request to the client and update the clients session
                     createRequest =  {createRecord: { bucket: record.bucket, key: record.key, record: record}};
                     result = me.socketIO.updateAuthenticatedClient(curUser,curSessionKey,createRequest);
                     if(result){
                        // update clients session
                        me.sessionModule.storeBucketKey(curUser,curSessionKey,record.bucket,record.key);
                     }
                     else {
                        // not sent to the client, push it to the request Queue
                        me.sessionModule.queueRequest(curUser,curSessionKey,createRequest);
                     }
                  }
                  break;
               case 'delete':
                  if(curMatchType == 'bucketkey'){
                     // send a delete request to the client and update the clients session
                     var deleteRequest = { deleteRecord: { bucket: record.bucket, key: record.key, record: record}};
                     result = me.socketIO.updateAuthenticatedClient(curUser,curSessionKey,deleteRequest);
                     if(result){
                        // update clients session
                        me.sessionModule.deleteBucketKey(curUser,curSessionKey,record.bucket,record.key);
                     }
                     else {
                        // not sent to the client, push it to the request Queue
                        me.sessionModule.queueRequest(curUser,curSessionKey,createRequest);
                     }                  
                  }
                  if(curMatchType == 'query'){
                     // do nothing
                  }
                  break;
               default: // whoops?? 
                  sys.log("ThothServer: This is the default action catcher on the distribution. Seeing this error is NOT good!");
                  break;
            }                     
         }    
      });   // end forEach matchingSessions
   },
   
   // as a side note: I started first with the REST interface, so that is not part of the Listeners
   // and in essence it seems not to be necessary if the socketIO listener also can do the other types of 
   // client as is the concept of socket-io...
   // so there should be only one listener...
   
   onCreate: function(message,userData,callback){
      var createRec = message.createRecord;
      var storeRequest = this._createStoreRequest(createRec,userData,'create');
      if(!storeRequest){
        callback(this._createErrorReply(Constants.ACTION_CREATE,Constants.ERROR_DATAINCONSISTENCY,createRec.returnData));
        return;
      }
      
      var clientId = [userData.user,userData.sessionKey].join("_");
      var me = this;
      if(storeRequest.bucket && clientId){
         // create lambda function to be able to do both policy and non-policy
         var createAction = function(policyResponse){
            if(policyResponse){ // either YES or adjusted record
               var rec = (policyResponse === YES)? storeRequest.recordData: policyResponse;
               storeRequest.recordData = rec;
               me.store.createRecord(storeRequest,clientId,
                  function(rec){
                     rec = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,rec): rec;
                     me.sessionModule.storeBucketKey(userData.user,userData.sessionKey,rec.bucket, rec.key);
                     // first update the original client and then update the others
                     callback({createRecordResult: {record: rec, returnData: createRec.returnData}});
                     
                     me.distributeChanges(rec,"create",userData.user,userData.sessionKey);
                  }
               );
            }
            else {
               // to be filled in with a not allowed kind of response
               callback(me._createErrorReply(Constants.ACTION_CREATE, Constants.ERROR_DENIEDONPOLICY,createRec.returnData));           
            }     
         };
      
         if(this.policyModule){
            this.policyModule.checkPolicy(storeRequest,storeRequest.recordData,createAction);
         }
         else {
            createAction(YES);
         }
      }
   },
   
   /*
      the record handling atm is very much based on what is in the record (like the bucket and key)
      It might be wise to change the system here a bit, resulting in not touching the record data at all
      but using the storeRequest instead
   */
   
   onUpdate: function(message,userData,callback){
     var updateRec = message.updateRecord;
     var storeRequest = this._createStoreRequest(updateRec,userData,'update');
     if(!storeRequest){
       callback(this._createErrorReply(Constants.ACTION_UPDATE,Constants.ERROR_DATAINCONSISTENCY,updateRec.returnData));
       return;
     }
     var clientId = [userData.user,userData.sessionKey].join("_");
     var me = this;
     if(storeRequest.bucket && storeRequest.key && clientId){
        var updateAction = function(policyResponse){
           if(policyResponse){
              me.store.updateRecord(storeRequest,clientId,
                 function(record){
                    record = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,record): record;
                    // the relation set is already on the record
                    var ret = {updateRecordResult: {record: record, returnData: updateRec.returnData}};
                    sys.log('ThothServer: sending updateRecordResult: ' + JSON.stringify(ret));
                    callback(ret); 
                    me.distributeChanges(record,"update",userData.user,userData.sessionKey);
                 }
              );                         
           }
           else {
              // we need to do something about this callback issue
              callback(me._createErrorReply(Constants.ACTION_UPDATE, Constants.ERROR_DENIEDONPOLICY,updateRec.returnData));
           }
        };
        
        if(this.policyModule){
           this.policyModule.checkPolicy(storeRequest,storeRequest.recordData,updateAction);
        }
        else {
           updateAction(YES);
        }
     }
   },
   
   onDelete: function(message,userData,callback){
      var deleteRec = message.deleteRecord;
      var bucket = deleteRec.bucket;
      var key = deleteRec.key;
      var record = deleteRec.record; // this must be here, as we need the record data to distribute...
      // assign the bucket and key of the request to the record if they don't exist already... 
      // we need the bucket and key on the record in order to be able to distribute 
      if(!record.bucket && bucket) record.bucket = bucket; 
      if(!record.key && key) record.key = key;

      var clientId = [userData.user,userData.sessionKey].join("_");
      var me = this;
      if(bucket && key && clientId && record){ 
         var storeRequest = this._createStoreRequest(deleteRec,userData,Constants.ACTION_DELETE);
         if(!storeRequest){
           callback(this._createErrorReply(Constants.ACTION_DELETE,Constants.ERROR_DATAINCONSISTENCY,deleteRec.returnData));
           return;
         }
         var destroyAction = function(policyResponse){
            if(policyResponse){
               me.store.deleteRecord(storeRequest, clientId, function(val){
                  me.sessionModule.deleteBucketKey(userData.user,userData.sessionKey,bucket,key);
                  callback({deleteRecordResult: { bucket: bucket, key: key, record: record, returnData: deleteRec.returnData}});
                  me.distributeChanges(record,"delete",userData.user,userData.sessionKey);
               });
            }
            else {
              callback(me._createErrorReply(Constants.ACTION_DELETE, Constants.ERROR_DENIEDONPOLICY,deleteRec.returnData));
            }
         };
         if(this.policyModule){
            this.policyModule.checkPolicy(storeRequest,storeRequest.recordData,destroyAction);
         }
         else {
            destroyAction(YES);
         }
      }
      else {
        callback(this._createErrorReply(Constants.ACTION_DELETE,Constants.ERROR_DATAINCONSISTENCY,deleteRec.returnData));         
        sys.log("Server: Trying to destroy record without providing the proper record data!");
        return;
      }
   },
   
   onRPCRequest: function(message,userdata,callback){
      sys.log("ThothServer: onRPCRequest called");
      if(this.rpcModule){
         var rpcRequest = message.rpcRequest;
         if(rpcRequest){
            sys.log("ThothServer: received RPC request from client: " + userdata.username);
            var fn = rpcRequest.functionName;
            var params = rpcRequest.params;
            this.rpcModule.callRPCFunction(fn,params,function(data){
               data.rpcResult.returnData = rpcRequest.returnData;
               callback(data);
            });
         }
      }
   }
   
   
   
});



