/*
ThothSession class: to keep track of logged in users and to have timeouts checked
*/

//if(!global.SC) require('./sc/runtime/core');

var querystring = require('querystring'); // for session key parsing
var UserCache = require('./UserCache').UserCache;
var DiskStore = require('./DiskStore').DiskStore;
var Tools = require('./Tools');
var sys = Tools.sys;
var API = require('./API');
var Constants = require('./Constants');

exports.Session = SC.Object.extend({
  
  /*
  { 
      userData: userData,
      sessionKeys: [newSessionKey],
      lastSeen: [new Date().getTime()],
      sessionData: [UserCache.create()]
   }
   
   records in the store will follow the same data, but instead of the UserCache objects
   it will have the serialised version of that object
   Any update will have to be saved though
  */
  
  /*
    { @user: 
      {
        @sessionKey: {
          userData: {}, // an object containing extra info about the user, such as roles etc
          lastSeen: new Date().getTime(),
          sessionData: (serialised version of UserCache obj)
          userCache: null // userCache is retrieved from cache and added in runtime
        }
      }
    }
  
    This is also easy to save in the database, as the bucket becomes the username, the key the sessionKey
    
    Memory leak: if sessions time out and they don't get re-asked again, the data stays behind
    we need to clean that up in some way, once every 100 login checks?
    or a check on the time, so every timeOutDuration times 2?
    see cleanUserCache
    
  */

  sessionName: 'Thoth', // lets choose some default
  
  sessionCookieExpireDuration: 31, // duration in days
  
  timeOutDuration: 15, //(timeout in minutes) 15 minutes standard
  
  store: null,
  
  _ud: { user: 'thoth', role: 'root'},
  
  _cid: 'thoth', 
  
  //_timeOutDurationCache: null, // to cache the calculation of timeOutDuration to milliseconds
  
  init: function(){
    arguments.callee.base.apply(this, arguments);
    var filename = this.sessionName + "_sessionData.js";
    if(!this.store){
      this.store = DiskStore.create({ autoRestore: true, useAutoIncrementIndex: false, filename: filename });
    }
    
    this.store.start(); // whatever is set as store, start it now
  },
  
  getKeyFromSessionInfo: function(sessionInfo){
    var sessionName = this.sessionName;
    var sInfoObj = querystring.parse(sessionInfo,';','=');
    return sInfoObj[sessionName];
  },

  timeoutInMs: function(){
    return this.timeOutDuration * 60 * 1000;
    // var timeout_in_ms = this._timeOutDurationCache;
    // if(!timeout_in_ms){ // if there is no cache yet, create it
    //    timeout_in_ms = this.timeOutDuration * 60 * 1000;
    //    this._timeOutDurationCache = timeout_in_ms;
    // }
    // return timeout_in_ms;
  }.property().cacheable(),
  
  _userCacheObjects: {},
  
  getUserCache: function(username,sessionKey){
    var cache = this._userCacheObjects;
    if(cache[username]){
      if(cache[username][sessionKey]){
        return cache[username][sessionKey];
      }
    }
    return false;
  },
  
  getUserData: function(username,sessionKey){
    var userCache = this.getUserCache(username,sessionKey);
    if(userCache){
      return userCache.userData;
    }
  },
  
  setUserCache: function(username,sessionKey,object){
    if(!this._userCacheObjects[username]) this._userCacheObjects[username] = {};
    this._userCacheObjects[username][sessionKey] = object;
  },
  
  destroyUserCache: function(username,sessionKey,object){
    if(this._userCacheObjects[username]){
      if(this._userCacheObjects[username][sessionKey]) delete this._userCacheObjects[username][sessionKey];
    }
  },
  
  cleanUserCache: function(){
    // walk through the _userCacheObjects object, find sessions that are overdue for removal
    //console.log('cleaning user cache');
    var i,j,ses,sesCount,cache = this._userCacheObjects;
    var timeOut = this.get('timeoutInMs');
    var now = new Date().getTime();
    for(i in cache){
      sesCount = 0;
      if(cache.hasOwnProperty(i)){
        ses = cache[i];
        for(j in ses){
          if(ses.hasOwnProperty(j) && ses[j].lastSeen){
            if((now - ses[j].lastSeen) > timeOut){
              this.destroySessionObject(i,j);
            } // end if timeout
          }
        }
      }
    }
  },
  
  getSessionObject: function(username, sessionKey,callback){
    var me = this;
    var sr = API.createStoreRequest({ bucket: username, key: sessionKey}, this._ud, Constants.ACTION_REFRESH);
    this.store.refreshRecord(sr,this._cid,function(response){
      var cache = me.getUserCache.call(me,username,sessionKey); // make sure this-reference is correct
      var uc, rec;
      //sys.log('SessionModule: getSessionObject gets: ' + sys.inspect(response));
      if(response){
        rec = response.refreshResult;
        if(!cache){ // if it doesn't exist, but it does in the sessionData, it should be resurrected
          uc = UserCache.create().from(rec.sessionData);
          me.setUserCache.call(me,username,sessionKey,uc);
          rec.userCache = uc;
        }
        else rec.userCache = cache;
      }
      if(callback) callback(rec);
    });
  },
  
  saveSessionObject: function(username,sessionKey,record,callback){
    // get the object, serialize and store
    var cache = record.userCache || this.getUserCache(username,sessionKey);
    var me = this;
    if(cache){
      record.sessionData = cache.toSessionData();
    }
    if(record.userCache) record.userCache = null; // prepare for storing
    //sys.log('storing session record: ' + sys.inspect(record)); 
    var sr = API.createStoreRequest({ bucket: username, key: sessionKey, record: record}, this._ud, Constants.ACTION_UPDATE);
    this.store.updateRecord(sr,this._cid,function(rec){
      me.getUserCache(username,sessionKey).lastSeen = new Date().getTime(); 
      if(callback) callback(rec);
    });
  },
  
  createSessionObject: function(username,sessionKey,userData,callback){
    var now = new Date().getTime();
    var rec = {
      username: username,
      userData: userData,
      lastSeen: now
    };
    this.setUserCache(username,sessionKey,UserCache.create({ userData: userData, lastSeen: now }));
    
    var sr = API.createStoreRequest({ bucket: username, key: sessionKey, record: rec}, this._ud, Constants.ACTION_CREATE);
    this.store.createRecord(sr, this._cid);
  },
  
  destroySessionObject: function(username,sessionKey,callback){
    //first destroy the cached object
    this.destroyUserCache(username,sessionKey);
    var sr = API.createStoreRequest({ bucket: username, key: sessionKey}, this._ud,Constants.ACTION_DELETE);
    this.store.deleteRecord(sr,this._cid, function(val){
      if(callback) callback(val);
    });
  },
  
  checkSession: function(user,sessionInfo,sessionKeyOnly,callback){
    // process sessionInfo
    var me = this;
    var sessionName = this.sessionName;
    var receivedSessionKey = !sessionKeyOnly? this.getKeyFromSessionInfo(sessionInfo): sessionInfo;
    //if(this.invokeLater) this.invokeLater('cleanUserCache'); // cleaning the session info
    this.cleanUserCache();
    
    // returns YES or NO depending on whether the user is still logged in
    var timeout_in_ms = this.get('timeoutInMs');
    this.getSessionObject(user,receivedSessionKey,function(rec){
      var lastSeen, 
          now = new Date().getTime();
      
      if(rec){
        lastSeen = rec.lastSeen;
        if((now - lastSeen) > timeout_in_ms){ // timeout, so delete session
          me.destroySessionObject.call(me,user,receivedSessionKey);
          if(callback) callback(false);
        }
        else { //active session
          rec.lastSeen = now; // update lastSeen and then save
          me.saveSessionObject.call(me,user,receivedSessionKey,rec,function(){
            var userData = rec.userData;
            userData.sessionKey = receivedSessionKey; // let the userdata have the sessionkey
            if(callback) callback(true,userData);
          });
        }
      }
      else {
        if(callback) callback(false);
      }
    });
  },
  
  createSession: function(userData,sessionKeyOnly){    
    var user = userData.user,
        newSessionKey = Tools.generateSessionKey();
    
    this.createSessionObject(user,newSessionKey,userData);
    var sessionName = this.sessionName;
    var expDate = new Date();
    expDate.setDate(expDate.getDate() + 31);
    var ret = sessionKeyOnly? newSessionKey: sessionName + '=' + newSessionKey + '; expires=' + expDate.toString();
    return ret;
  },
  
  logout: function(user,sessionInfo,sessionKeyOnly,callback){
    // function to logout a user and remove the session information
    var me = this;
    var sessionName = this.sessionName;
    var receivedSessionKey = !sessionKeyOnly? this.getKeyFromSessionInfo(sessionInfo): sessionInfo;
    
    this.destroySessionObject(user,receivedSessionKey,function(val){
      if(callback) callback(val);
    });

  },
  
  updateUserCache: function(user,sessionKey,action,callback){
    var me = this;
    this.getSessionObject(user,sessionKey,function(rec){
      if(rec && rec.userCache){
        var ret = action(rec.userCache);
        if(callback) callback(ret);
        me.saveSessionObject(user,sessionKey,rec);        
      }
      else sys.log('SesssionModule: WHOOPS? storing data on a session which has no session or usercache object?');
    });
  },
  
  storeQuery: function(user,sessionKey,bucket,conditions,parameters,callback){
    var action = function(userCache){
      return userCache.storeQuery(bucket,conditions,parameters);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },
  
  storeBucketKey: function(user,sessionKey,bucket,key,timestamp,callback){
    var action = function(userCache){
      return userCache.storeBucketKey(bucket,key,timestamp);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },
  
  storeRecords: function(user,sessionKey,bucket,primaryKey,records,callback){
    var action = function(userCache){
      return userCache.storeRecords(bucket,primaryKey,records);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },

  storeRequestData: function(storeRequest,records){
    var UD = storeRequest.get('userData'),
        user = UD.user, sK = UD.sessionKey,
        bucket = storeRequest.get('bucket'),
        primKey = storeRequest.get('primaryKey');
    
    if(storeRequest.get('requestType') === Constants.ACTION_FETCH){
      this.storeQuery(user, sK, bucket, storeRequest.get('conditions'), storeRequest.get('parameters'));
    }
    if(records){
      this.storeRecords(user,sK,bucket,primKey,records);
    }
  },
  
  deleteBucketKey: function(user,sessionKey,bucket,key,callback){
    var action = function(userCache){
      return userCache.deleteBucketKey(bucket,key);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },
  
  deleteRecords: function(user,sessionKey,records,callback){
    var action = function(userCache){
      return userCache.deleteRecords(records);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },

  queueRequest: function(user,sessionKey,request,callback){
    var action = function(userCache){
      return userCache.queueRequest(request);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },
  
  retrieveRequestQueue: function(user,sessionKey,callback){
    var action = function(userCache){
      return userCache.retrieveRequestQueue();
    };
    this.updateUserCache(user,sessionKey,action,callback);
    
    // just keep this around for now...
    //var obj = this.getSessionObject(user,sessionKey);
    //if(obj) return obj.retrieveRequestQueue();
  },
  
  // while all other functions are async with an optional callback, 
  // shouldReceive is not, because it doesn't actually change anything
  // moreover, making this function async would make the distribution
  // quite difficult, so for this function we just use the cached userCache objects
  shouldReceive: function(user,sessionKey,record){ 
    var obj = this.getUserCache(user,sessionKey);
    if(obj) return obj.shouldReceive(record);
    else return NO;
  },
  
  getEligableUserSessions: function(storeRequest){
    var i,curUser,j,userCache = this._userCacheObjects;
    var ret = [], isMatch;
    
    for(i in userCache){
      if(userCache.hasOwnProperty(i)){
        curUser = userCache[i];
        for(j in curUser){
          if(curUser.hasOwnProperty(j) && curUser[j].shouldReceive){
            isMatch = curUser[j].shouldReceive(storeRequest);
            if(isMatch) ret.push({ user: i, sessionKey: j, matchType: isMatch });
          }
        }
      }
    }
    return ret;
  }
  
  


   
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
            sessionData: [ThothUserCache.create()]
         }
     }
     
     every time a user makes contact, the current date is compared to the lastSeen date, and if the difference is larger than the 
     given timeOutDuration, the user is automatically logged out. It means the user information is removed from the 
     _loggedInUsers object which should then automatically lead to be forced to login again...
    
     a user can have more than one session key for every application that has logged in successfully. 
     sessionKeys and lastSeen are both arrays and have the same indexes.
     The sessionKey is looked up first, and the index retrieved from that is used to get the correct lastSeen data
     
   */
   
/*   
   _loggedInUsers: {},  // an object containing objects containing info
   
   _knownUsers: [], // an array containing the keys of _loggedInUsers

   
   
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
            else { // active session, first set the new date to now
               this._loggedInUsers[user].lastSeen = now; // update the actual user data
               return YES; // use cached data for speed.
            }
         }
         else return NO; // receivedSessionKey given does not match any known session keys
      }
      else return NO; // no user data found for received user name
   },
   
   getUserData: function(user){
     if(user && this._loggedInUsers[user]) return this._loggedInUsers[user].userData;
     else return false;
   },
   
   createSession: function(userData,sessionKeyOnly){
      // a function to create a user session when a user has logged in successfully
      // the function returns the set-cookie header info, or in case sessionKeyOnly is set, only the sessionKey
      //sys.log('ThothSession: userData received: ' + JSON.stringify(userData));
      var user = userData.user;
      // first create a session key
      var newSessionKey = Tools.generateSessionKey();
      // then set the user information and add to any existing stuff
      if(!this._loggedInUsers[user]){ // no existing info, create 
         //sys.log('ThothSession: no existing userdata for user: ' + user);
         this._loggedInUsers[user] = { 
            userData: userData,
            sessionKeys: [newSessionKey],
            lastSeen: [new Date().getTime()],
            sessionData: [UserCache.create()]
         }; 
         this._knownUsers.push(user);        
      }
      else { // 
         // if for some strange reason something has gone wrong during the creation of the previous object
         // make sure the stuff works anyway...
         if(this._loggedInUsers[user].sessionKeys instanceof Array){
            this._loggedInUsers[user].sessionKeys.push(newSessionKey);
         } 
         else {
            this._loggedInUsers[user].sessionKeys = [newSessionKey]; 
         }
         if(this._loggedInUsers[user].lastSeen instanceof Array){
            this._loggedInUsers[user].lastSeen.push(new Date().getTime());            
         }
         else {
            this._loggedInUsers[user].lastSeen = [new Date().getTime()];
         }
         if(this._loggedInUsers[user].sessionData instanceof Array){
            this._loggedInUsers[user].sessionData.push(UserCache.create());            
         }
         else {
            this._loggedInUsers[user].sessionData = [UserCache.create()];
         }
      }
      var sessionName = this.sessionName;
      var expDate = new Date();
      expDate.setDate(expDate.getDate() + 31);
      var ret = sessionKeyOnly? newSessionKey: sessionName + '=' + newSessionKey + '; expires=' + expDate.toString();
      return ret;
   }, 
   
   logout: function(user,sessionInfo,sessionKeyOnly){
      // function to logout a user and remove the session information
      var receivedSessionKey = "";
      var sessionName = this.sessionName;
      if(sessionKeyOnly){
         var sessionInfoObj = querystring.parse(sessionInfo,';','=');
         receivedSessionKey = sessionInfoObj[sessionName];         
      }
      else receivedSessionKey = sessionInfo;
      
      if(this._loggedInUsers[user]){
         var curSesIndex = this._loggedInUsers[user].sessionKeys.indexOf(receivedSessionKey);
         if(curSesIndex>-1){
            //key exists, remove both key and lastSeen
            this._loggedInUsers[user].sessionKeys.removeAt(curSesIndex);
            this._loggedInUsers[user].lastSeen.removeAt(curSesIndex);
         } // sessionkey doesn't exist, ignore
         // always check if there are any sessions left
         if(this._loggedInUsers[user].sessionKeys.length === 0){
            // remove the user from the _loggedInUsers as well as the knownUsers cache
            delete this._loggedInUsers[user];
            this._knownUsers.removeObject(user);
         }
      }
      // if the user doesn't exist anymore in the session info, ignore
   },
   
   
   getMatchingUserSessionsForRecord: function(storeRequest){
      // a really bad name for what this record does, but that can be changed later...
      // the purpose of the function is to check all existing session data to check whether there is a match
      // between the given record and a specific session
      // it returns an array with users and sessions and for what reason a match was found (bucketkey or query)
      //sys.puts("Running getMatchingUserSessionsForRecord with record " + JSON.stringify(record));
      
      var ret = [], 
          knownUsers = this._knownUsers,
          curSessionCache, isMatch,curUser,curUserInfo,numSessions,i,len;
      for(i=0,len=knownUsers.length;i<len;i++){
         curUser = knownUsers[i];
         if(curUser){
            curUserInfo = this._loggedInUsers[curUser];
            numSessions = curUserInfo.sessionKeys.length; // sessionKeys rules the set
            for(var j=0;j<numSessions;j++){
               //sys.puts("Probing match for user " + curUser + " with sessionKey " + curUserInfo.sessionKeys[j]);
               curSessionCache = curUserInfo.sessionData[j];
               isMatch = curSessionCache.shouldReceive(storeRequest);
               if(isMatch){
                  ret.push({user: curUser, sessionKey: curUserInfo.sessionKeys[j], matchType: isMatch});
               }
            }
         }
      }
      return ret;
   } 
   */
});
