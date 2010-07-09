/*
OrionSession class: to keep track of logged in users and to have timeouts checked
*/

if(!global.SC) require('./sc/runtime/core');

var querystring = require('querystring'); // for session key parsing
var sys = require('sys');

global.OrionSession = SC.Object.extend({
   
   sessionName: 'OrionNodeRiak', // lets choose some strange default
   
   sessionCookieExpireDuration: 31, // duration in days
   
   timeOutDuration: 15, //(timeout in minutes) 15 minutes standard 
   
   // some notes on timeOutDuration: if set too high it may choke the server as at the moment the idea is to keep
   // every user that has a session up to date regarding changes in the data, even if there is no connection
   // It may be an idea to use riak or something else as a kind of temporary storage...?

   /*
     _loggedInUsers is an object containing objects which contain information about the last time a specific user has been seen
     or heard of, and the sessionkey the user is using.
     so something like: 
     { 'user': 
         { 
            sessionKeys: [''],
            lastSeen: [], // date in milliseconds, 
            serverCache: OrionServerCache.create()
         }
     }
     
     every time a user makes contact, the current date is compared to the lastSeen date, and if the difference is larger than the 
     given timeOutDuration, the user is automatically logged out. It means the user information is removed from the 
     _loggedInUsers object which should then automatically lead to be forced to login again...
    
     a user can have more than one session key for every application that has logged in successfully. 
     sessionKeys and lastSeen are both arrays and have the same indexes.
     The sessionKey is looked up first, and the index retrieved from that is used to get the correct lastSeen data
     
   */
   
   _loggedInUsers: {},  // an object containing objects containing info

   _timeOutDurationCache: null, // to cache the calculation of timeOutDuration to milliseconds
   
   checkSession: function(user,sessionInfo,sessionKeyOnly){
      // function to check whether a user is still logged in
      // sessionInfo is the entire string of data sent by the client in the Cookie header of the request
      // it may be wise to have the user name in a http header to make session hijacking a bit more difficult
      // lets force that behaviour for the moment, and rewrite the stuff when a better way can be found
      
      // process sessionInfo
      var sessionName = this.sessionName;
      var receivedSessionKey = "";
      if(!sessionKeyOnly){
         var sessionInfoObj = querystring.parse(sessionInfo,';','=');
         receivedSessionKey = sessionInfoObj[sessionName];         
      }
      else receivedSessionKey = sessionInfo;
      
      //sys.puts(sys.inspect(sessionInfoObj));
      // returns YES or NO depending on whether the user is still logged in
      var timeout_in_ms = this._timeOutDurationCache;
      if(!timeout_in_ms){ // if there is no cache yet, create it
         timeout_in_ms = this.timeOutDuration * 60 * 1000;
         this._timeOutDurationCache = timeout_in_ms;
      }
      var curUserData = null;
      if(user){
         curUserData = this._loggedInUsers[user]; // get the user data
      }
      if(curUserData){ // if it exists, check it
         var sesKeyIndex = curUserData.sessionKeys.indexOf(receivedSessionKey);
         if(sesKeyIndex> -1){
            var lastSeen = curUserData.lastSeen[sesKeyIndex];
            var now = new Date().getTime();
            if((now - lastSeen) > timeout_in_ms){ // diff between lastseen and now too large?
               // delete user key
               this._loggedInUsers[user] = undefined;
               return NO; // 
            }
            else { // active session
               // first set the new date to now
               this._loggedInUsers[user].lastSeen = now; // update the actual user data
               return YES; // use cached data for speed.
            }
         }
         else return NO; // receivedSessionKey given does not match any known session keys
      }
      else return NO; // no user data found for received user name
   },
   
   createSession: function(user,sessionKeyOnly){
      // a function to create a user session when a user has logged in successfully
      // the function returns the set-cookie header info, or in case sessionKeyOnly is set, only the sessionKey

      // first create a session key
      var newSessionKey = this.generateSessionKey();
      // then set the user information and add to any existing stuff
      if(!this._loggedInUsers[user]){ // no existing info, create 
         this._loggedInUsers[user] = { 
            sessionKeys: [newSessionKey],
            lastSeen: [new Date().getTime()]
         };         
      }
      else { // 
         this._loggedInUsers[user].sessionKeys.push(newSessionKey);
         this._loggedInUsers[user].lastSeen.push(new Date().getTime());
      }
      var sessionName = this.sessionName;
      var expDate = new Date();
      expDate.setDate(expDate.getDate() + 31);
      var ret = sessionKeyOnly? newSessionKey: sessionName + '=' + newSessionKey + '; expires=' + expDate.toString();
      return ret;
   },
   
   generateSessionKey: function(){
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
   
   logout: function(user,sessionInfo,sessionKeyOnly){
      // function to logout a user and remove the session information
      var receivedSessionKey = "";
      if(sessionKeyOnly){
         var sessionInfoObj = querystring.parse(sessionInfo,';','=');
         receivedSessionKey = sessionInfoObj[sessionName];         
      }
      else receivedSessionKey = sessionInfo;
      var sessionName = this.sessionName;
      
      if(this._loggedInUsers[user]){
         var curSesIndex = this._loggedInUsers[user].sessionKeys.indexOf(receivedSessionKey);
         if(curSesIndex>-1){
            //key exists, remove both key and lastSeen
            this._loggedInUsers[user].sessionKeys.removeAt(curSesIndex);
            this._loggedInUsers[user].lastSeen.remoteAt(curSesIndex);
         } // sessionkey doesn't exist, ignore
      }
      // if the user doesn't exist anymore in the session info, ignore
   },
   
   // functions to pass on requests to the sessions user cache
   
   storeQuery: function(user,sessionKey,query){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.storeQuery(query);
      }
   },
   
   storeBucketKey: function(user,sessionKey,bucket,key,timestamp){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.storeBucketKey(bucket,key,timestamp);
      }
   },
   
   storeRecords: function(user,sessionKey,records){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.storeRecords(records);
      }      
   },
   
   shouldReceive: function(user,sessionKey,record){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.shouldReceive(record);
      }     
   },
   
   queueRequest: function(user,sessionKey,request){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.queueRequest(request);
      }
   },
   
   retrieveQueue: function(user,sessionKey){
      if(this._loggedInUsers && this._loggedInUsers[user] && this._loggedInUsers[user][sessionKey]){
         return this._loggedInUsers[user][sessionKey].serverCache.retrieveQueue();
      }
   }
   
});
