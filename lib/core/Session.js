// ThothSession class: to keep track of logged in users and to have timeouts checked
// 
// The session module's tasks are:
// - keeping records of active users
// - identify to whom distribution should take place
// - queue requests when a user cannot be reached...
// 
// A session consists of a user record:
// store['session']
//   sessionKey: {
//     user: '',
//     lastSeen: new Date().getTime(),
//     queries: [], // objects of { bucket: 'bucket', conditions: "", parameters: jsonified parameters }
//     bucketkeys: {
//       bucket: [keys]
//     },
//     requestQueue: []
//   }
// }
// 
// The session manager also keeps a series of SC.Query instances around to check records against for distribution.
// These instances are shared among users to save memory
// 
// Important to realise is t

var querystring = require('querystring'); // for session key parsing
var UserCache = require('./UserCache').UserCache;
var DiskStore = require('./DiskStore').DiskStore;
var Tools = require('./Tools');
var sys = Tools.sys;
var API = require('./API');
var Constants = require('./Constants');

// constants to be used for a catch all query
var ALLCONDS = '_ALLCONDITIONS_';
var ALLPARAMS = "_ALLPARAMETERS_";


exports.Session = SC.Object.extend({
  // API
  
  sessionName: null, // set with a string
  
  cookieExpire: null, // days before the cookie expires (for REST)
  
  sessionTimeout: null, // minutes before the session expires 
  
  // backend to use for storing sessions to disk, by default DiskStore will be used
  // IMPORTANT: when you are _not_ using the default DiskStore, you need to make sure there is a cache in memory
  // to prevent a hefty delay in the performance of the sessionModule.
  // This can be easily prevented by using the WrapperStore to use a MemStore and your store simultaneously.
  // The resource used by the sessionModule is 'session'
  store: null, 
  
  // checking, creating and destroying sessions
  // just like createSession: if you are sending a cookie string as sessioninfo, 
  // set isCookie: true on the userData object
  checkSession: function(userData, callback){ // checking session 
    var timeout = this.get('_timeoutInMs');
    var user = userData.user, sesKey;
    var me = this;
    
    sesKey = userData.isCookie? this.sessionKeyFor(userData.sessionKey): userData.sessionKey;
    this._sessionRecordFor(user,sesKey,function(err,rec){
      var now = new Date().getTime();
      var request;
      if(!rec){
        callback(new Error('session not found')); //null? TEST!
      }
      else {
        if((now - rec.lastSeen) > timeout){ // timeout, so destroy
          me.destroySession(user,sesKey,function(err,success){
            if(!success) sys.log('Session: major error, not able to destroy sessions');
          });
          if(callback) callback(err,false); // tell not found after deletion...
        }
        else {
          rec.lastSeen = now;
          me._updateSessionRecord(user,sesKey,rec,function(err,rec){ 
            var userData = rec.userData;
            userData.sessionKey = sesKey; // let the userdata have the sessionkey
            if(callback) callback(null,userData); // userdata === has session...
          });
        }
      }
    });
    
  },
  
  // userData is an object
  // if you want createSession to return a cookie string, 
  // set 'isCookie' to true in the userData object
  createSession: function(userData,callback){ // create a new session
    var user = userData.user,
        sessionName = this.sessionName,
        expDate = new Date(),
        now = new Date().getTime(),
        me = this, newSessionKey,
        rec,sr;
    
    if(!userData.user) return false;    
    // recursive function to make sure we have a unique sessionKey
    // chance is very slim it will happen but better safe than sorry
    var createSessionKey = function(){
      var key = Tools.generateSessionKey();
      if(!me._sessionKeys[key]) return key;
      else return createSessionKey();
    };
    
    newSessionKey = createSessionKey();
    rec = { 
      username: user, 
      sessionKey: newSessionKey,
      userData: userData, // extra info on user, such as roles or permissions
      lastSeen: now, 
      queries: [], bucketKeys: {}, requestQueue: []
    };
    sr = this._createStoreRequest(user,newSessionKey,Constants.ACTION_CREATE,rec);
    this.store.createRecord(sr, {}, function(err,rec){
      if(!rec){
        sys.log('Session: major error, not able to create records in the session store');
        if(callback) callback(new Error('Not able to create a record...'));
      } 
      else {
        sys.log('Session created for user ' + user + ' and sessionKey: ' + newSessionKey);
        if(callback) callback(null,rec);
      }
    }); // we should be able to catch errors here, because this would be severe...
    this._sessionKeys.push(newSessionKey); // should evaluate to true
    
    if(userData.isCookie){
      expDate.setDate(expDate.getDate() + this.cookieExpire);
      return sessionName + '=' + newSessionKey + '; expires=' + expDate.toString();
    }
    else return newSessionKey;
  },
  
  destroySession: function(user,sessionKey,callback){ // destroy session, when logging out for example
    var me = this;
    this._sessionRecordFor(user,sessionKey,function(err,rec){
      var delreq;
      if(!rec){
        sys.log('Session: error... cannot retrieve session for user ' + user + ' and sessionKey ' + sessionKey);
        if(callback) callback(new Error("error... cannot retrieve session for user ' + user + ' and sessionKey ' + sessionKey"), false);
      } 
      else {
        rec.queries.forEach(function(q){
          me._removeQueryFromCache(sessionKey, q.bucket, q.conditions, q.parameters);
        });
        // now delete the record
        delreq = me._createStoreRequest(user,sessionKey,Constants.ACTION_DELETE,rec);
        me.store.deleteRecord(delreq,{},function(err,success){
          if(err) sys.log('Session: error cannot delete session for user ' + user + ' and sessionKey ' + sessionKey);
          if(callback) callback(err,true);
        });
        me._sessionKeys = me._sessionKeys.without(sessionKey);
      }
    });
  },
  
  // communicating with user sessions
  // use this function to store a single record
  storeBucketKey: function(user,sessionKey,bucket,key,callback){
    if(!(user && sessionKey)) return;
    var me = this;
    this._sessionRecordFor(user,sessionKey,function(err,rec){
      if(!err){
        if(!rec.bucketKeys[bucket]) rec.bucketKeys[bucket] = [];
        rec.bucketKeys[bucket].push(key);
        me._updateSessionRecord(user,sessionKey,rec, function(err,rec){
          if(err) sys.log("Session: error when updating bucketkey information for user " + user + " and sessionKey " + sessionKey);
          if(callback) callback(err,rec);
        });
      }
    });
  },
  
  storeRecords: function(user,sessionKey,storeRequest,records,callback){
    var me = this;
    var primKey = storeRequest.get('primaryKey');
    var bucket = storeRequest.get('bucket');
    if(!primKey) return;
    if(!records) return;
    if(!(user && sessionKey)) return;
    this._sessionRecordFor(user,sessionKey,function(err,sesrec){
      if(err) return;
      if(!sesrec.bucketKeys[bucket]) sesrec.bucketKeys[bucket] = [];
      records.forEach(function(rec){
        if(rec && rec[primKey]){
          sesrec.bucketKeys[bucket].push(rec[primKey]);
        }
      });
      me._updateSessionRecord(user,sessionKey,sesrec,function(err,rec){
        if(err) sys.log("Session: error when bulk updating bucketkey information for user " + user + " and sessionKey " + sessionKey);
        if(callback) callback(err,rec);        
      });
    });
  },
  
  storeQuery: function(user,sessionKey,bucket,conditions,parameters,callback){
    // this function can be called without conditions and or parameters, meaning a fetch all
    var me = this;
    if(!bucket) return; // don't store anything without a bucket...
    var conds = conditions || ALLCONDS;
    var params = parameters? JSON.stringify(parameters): ALLPARAMS;
    if(!(user && sessionKey)) return;
    this._sessionRecordFor(user,sessionKey,function(err,sesrec){
      if(err) return;
      var existing = sesrec.queries.filter(function(q){
        if(q && q.bucket === bucket && q.conditions === conds && q.parameters === params){
          return true;
        }
        else return false;
      });
      if(existing.length === 0){
        sesrec.queries.push({
          bucket: bucket,
          conditions: conds,
          parameters: params
        });
        me._updateSessionRecord(user,sessionKey,sesrec,function(err,ret){
          if(err) sys.log('Session: error in updating the session record after a storeQuery');
          if(callback) callback(err,ret);
        });
      }
      else if(callback) callback(err,sesrec);
    });
  },
  
  storeRequest: function(user,sessionKey,storeRequest){
    
  },
  
  deleteBucketKey: function(user,sessionKey,bucket,key){
    
  },
  
  deleteRecords: function(user,sessionKey,records){
    
  },
  
  deleteQuery: function(user,sessionKey,conditions,parameters){
    
  },
  
  queueRequest: function(user,sessionKey,event,data){
    
  },
  
  retrieveRequestQueue: function(user,sessionKey,callback){
    
  },
  
  getEligableUserSessions: function(storeRequest){
    
  },

  

  // =============
  // = queryCache =
  // =============


  // format
  // _queryCache[bucket][conditions][stringified parameters] = {
  //    sessionkeys: [] // session keys subscribed to this query
  //    query: query object
  // }
  _queryCache: null,
  
  _storeQueryInCache: function(sessionKey,bucket,conditions,parameters){
    var q, 
        b = bucket,
        c = conditions || ALLCONDS,
        p = parameters? JSON.stringify(parameters): ALLPARAMS;
        
    if(!this._queryCache[b]) this._queryCache[b] = {};
    if(!this._queryCache[b][c]) this._queryCache[b][c] = {};
    if(!this._queryCache[b][c][p]) this._queryCache[b][c][p] = { sessionKeys: [], query: null };
    if(!this._queryCache[b][c][p].query){
      q = SC.Query.create({ conditions: conditions, parameters: parameters });
      q.parse();
      this._queryCache[b][c][p].query = q;
    }
    this._queryCache[b][c][p].sessionKeys.push(sessionKey);
  },
  
  _removeQueryFromCache: function(sessionKey,bucket,conditions,parameters){
    var q, 
        b = bucket,
        c = conditions || ALLCONDS,
        p = parameters? JSON.stringify(parameters): ALLPARAMS;
        
    if(this._queryCache[b] && this._queryCache[b][c] && this._queryCache[b][c][p]){
      this._queryCache[b][c][p].sessionKeys = this._queryCache[b][c][p].sessionKeys.without(sessionKey);
      if(this._queryCache[b][c][p].sessionKeys.length === 0){ // destroy query and all the objects up...
        delete this._queryCache[b][c][p].sessionKeys;
        delete this._queryCache[b][c][p].query;
        delete this._queryCache[b][c][p];
        if(Object.keys(this._queryCache[b][c]).length === 0) delete this._queryCache[b][c];
        if(Object.keys(this._queryCache[b]).length === 0) delete this._queryCache[b];
      }
    }// else ignore
  },
  
  
  _sessionKeys: null,
  
  // function to clean out sessions that have passed their timeout
  _purgeOldSessions: function(){
    // do a fetch, then destroy sessions which are due
    
  },
  
  _sessionKeyFrom: function(sessionInfo){
    var sessionName = this.sessionName;
    var sInfoObj = querystring.parse(sessionInfo,';','=');
    return sInfoObj[sessionName];
  },
  
  _timeoutInMs: function(){
    return this.sessionTimeout * 60 * 1000;
  }.property('sessionTimeout').cacheable(),
  
  _createStoreRequest: function(username,sessionKey,action,record){
    if(username && sessionKey && action){
      return API.StoreRequest.create({
        bucket: 'session',
        key: [username,sessionKey].join("_"),
        requestType: action,
        record: record
      });
    }
  },
  
  _sessionRecordFor: function(username,sessionKey,callback){
    var req = this._createStoreRequest(username,sessionKey,Constants.ACTION_REFRESH);
    this.store.refreshRecord(req,{},function(err,data){
      if(!err && data){
        callback(null,data.refreshResult);
      } 
      else callback(err,data);
    });
  },
  
  _updateSessionRecord: function(username,sessionKey,record,callback){
    var req = this._createStoreRequest(username,sessionKey,Constants.ACTION_UPDATE,record);
    this.store.updateRecord(req,{},callback);
  },
  
  init: function(){
    var filename;
    
    arguments.callee.base.apply(this,arguments);
    this._queryCache = {};
    this._sessionKeys = [];
    if(!this.cookieExpire) this.cookieExpire = 31;
    if(!this.sessionName) this.sessionName = 'Thoth';
    if(!this.sessionTimeout) this.sessionTimeout = 15;
    // try to load previously existing records, take the sessionKeys and add to this._sessionKeys
    if(!this.store){
      filename = this.sessionName + '_sessionData.js';
      this.store = DiskStore.create({ autoRestore: true, useAutoIncrementIndex: false, filename: filename });
    }
    this.store.start(this,function(){
      // callback for reading back data into memory
    });
  }  
  
});



/*

exports.Session = SC.Object.extend({
  
  
  { 
      userData: userData,
      sessionKeys: [newSessionKey],
      lastSeen: [new Date().getTime()],
      sessionData: [UserCache.create()]
   }
   
   records in the store will follow the same data, but instead of the UserCache objects
   it will have the serialised version of that object
   Any update will have to be saved though
  
  
  
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
    
  

  sessionName: 'Thoth', // lets choose some default
  
  sessionCookieExpireDuration: 31, // duration in days
  
  timeOutDuration: 15, //(timeout in minutes) 15 minutes standard
  
  store: null,
  
  _ud: null,
  
  _cid: 'thoth', 
  
  //public API
  // Retrieve the number of sessions in memory. For statistics
  numberOfSessions: function(){
    var count = 0;
    var sesObj = this._userCacheObjects;
    var i,j;
    for(i in sesObj){
      if(sesObj.hasOwnProperty(i)){ // number of users
        for(j in sesObj[i]){
          if(sesObj[i].hasOwnProperty(j)) count += 1; // number of sessions...
        }
      }
    }
    return count;
  }.property(),

  // Retrieve the number of users in memory. For statistics  
  numberOfUsers: function(){
    var count = 0;
    var sesObj = this._userCacheObjects;
    var i;
    for(i in sesObj){
      if(sesObj.hasOwnProperty(i)){ // number of users
        count += 1;
      }
    }
    return count;    
  }.property(),  
  
  // called to check whether the user and sessionkey checks are correct
  // this function can be used with sessionInfo (REST) as well as sessionKey (socket.io), 
  // if socketio, set sessionKeyOnly to true
  checkSession: function(user,sessionInfo,sessionKeyOnly,callback){
    // process sessionInfo
    var me = this;
    var sessionName = this.sessionName;
    var receivedSessionKey = !sessionKeyOnly? this.getKeyFromSessionInfo(sessionInfo): sessionInfo;
    //if(this.invokeLater) this.invokeLater('cleanUserCache'); // cleaning the session info
    this.cleanUserCache();
    
    // returns true or false depending on whether the user is still logged in
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
  
  // create a session with the provided userdata
  // double
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

  queueRequest: function(user,sessionKey,event,request,callback){
    var action = function(userCache){
      return userCache.queueRequest(event,request);
    };
    this.updateUserCache(user,sessionKey,action,callback);
  },
  
  retrieveRequestQueue: function(user,sessionKey,callback){
    var action = function(userCache){
      return userCache.retrieveRequestQueue();
    };
    this.updateUserCache(user,sessionKey,action,callback);
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
  
  
  //Internals
  
  _userCacheObjects: null,
  
  
  
  //_timeOutDurationCache: null, // to cache the calculation of timeOutDuration to milliseconds
  
  init: function(){
    arguments.callee.base.apply(this, arguments);
    var filename = this.sessionName + "_sessionData.js";
    var me = this;
    
    // set basic settings:
    if(!this._ud) this._ud = { user: 'thoth', role: 'root'}
    this._userCacheObjects = {};
    
    if(!this.store){
      this.store = DiskStore.create({ autoRestore: true, useAutoIncrementIndex: false, filename: filename });
    }
    this.store.start(this, function(){
      var sr = API.StoreRequest.create({ bucket: 'session', requestType: Constants.ACTION_FETCH});
      me.store.fetch(sr,me._ud,function(recs){
        if(recs && recs.fetchResult){
          recs.fetchResult.forEach(function(rec){
            var prKeyVal, splits, uc, usr, sesKey;
            prKeyVal = rec['id'] || rec['key'];
            splits = prKeyVal.split("_");
            usr = splits[0]; sesKey = splits[1];
            uc = UserCache.create().from(rec.sessionData);
            me.setUserCache.call(me,usr,sesKey,uc);
            rec.userCache = uc;
          });
        }
      });
    });// whatever is set as store, start it now
    
    SC.Timer.schedule({
      target: this,
      action: 'cleanUserCache',
      interval: 30000,
      repeats: true
    });
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
    if(!this._userCacheObjects[username]){
      this._userCacheObjects[username] = {};
    } 
    this._userCacheObjects[username][sessionKey] = object;
  },
  
  destroyUserCache: function(username,sessionKey,object){
    if(this._userCacheObjects[username]){
      if(this._userCacheObjects[username][sessionKey]){
        this._userCacheObjects[username][sessionKey].destroy();
        delete this._userCacheObjects[username][sessionKey];
      } 
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
  
  _createStoreRequest: function(username,sessionKey,action,record){
    if(username && sessionKey && action){
      return API.StoreRequest.create({
        bucket: 'session',
        key: [username,sessionKey].join("_"),
        requestType: action,
        record: record
      });
    }
  },

  getSessionObject: function(username, sessionKey,callback){
    var me = this;
    var sr = this._createStoreRequest(username,sessionKey,Constants.ACTION_REFRESH);
    this.store.refreshRecord(sr,this._cid,function(response){
      var cache = me.getUserCache.call(me,username,sessionKey); // make sure this-reference is correct
      var uc, rec;
      if(response){
        rec = response.refreshResult;
        if(!cache){ // if it doesn't exist, but it does in the sessionData on the back end, it should be resurrected
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
    var sr = this._createStoreRequest(username,sessionKey,Constants.ACTION_UPDATE,record);
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
    
    var sr = this._createStoreRequest(username,sessionKey,Constants.ACTION_CREATE,rec);
    this.store.createRecord(sr, this._cid);
  },
  
  destroySessionObject: function(username,sessionKey,callback){
    //first destroy the cached object
    this.destroyUserCache(username,sessionKey);
    var sr = this._createStoreRequest(username,sessionKey,Constants.ACTION_DELETE);
    this.store.deleteRecord(sr,this._cid, function(val){
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
      else sys.log('SessionModule: WHOOPS? storing data on a session which has no session or usercache object?');
    });
  },
  

  
  


   
   // some notes on timeOutDuration: if set too high it may choke the server as at the moment the idea is to keep
   // every user that has a session up to date regarding changes in the data, even if there is no connection
   // It may be an idea to use riak or something else as a kind of temporary storage...?

   
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
   
});

*/
