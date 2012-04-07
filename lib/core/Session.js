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
//     sessionKey: '',
//     userData: {},
//     lastSeen: new Date().getTime(),
//     queries: [], // objects of { bucket: 'bucket', conditions: "", parameters: jsonified parameters }
//     bucketkeys: {
//       bucket: [keys]
//     },
//     requestQueue: [] // objects of { evt: '', data: {} }
//   }
// }
// 
// The session manager also keeps a series of SC.Query instances around to check records against for distribution.
// These instances are shared among users to save memory
// 
// Important to realise is t

var querystring = require('querystring'); // for session key parsing
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
  // the callback signature is (err,userdata), where data === false when no
  checkSession: function(userData, callback){ // checking session 
    var timeout = this.get('_timeoutInMs');
    var user = userData.user, sesKey;
    var me = this;
    
    sesKey = userData.isCookie? this.sessionKeyFor(userData.sessionKey): userData.sessionKey;
    this._sessionRecordFor(user,sesKey,function(err,rec){
      var now = new Date().getTime();
      var request;
      if(!rec){
        callback(err,false); 
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
        //sys.log('Session created: calling the callback with: ' + sys.inspect(rec));
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
          else {
            me._storeQueryInCache(sessionKey,bucket,conditions,parameters);
          }
          if(callback) callback(err,ret);
        });
      }
      else if(callback) callback(err,sesrec);
    });
  },
  
  storeStoreRequest: function(user,sessionKey,storeRequest){
    if(!storeRequest) return;
    if(storeRequest.requestType === Constants.ACTION_FETCH){ // fetch, take conditions and parameters
      this.storeQuery(user,sessionKey,storeRequest.bucket,storeRequest.conditions,storeRequest.parameters);
    }
    if(storeRequest.records){
      this.storeRecords(user,sessionKey,storeRequest,storeRequest.records);
    } 
  },
  
  deleteBucketKey: function(user,sessionKey,bucket,key,callback){
    var me = this;
    if(!(user && sessionKey && bucket && key)) return;
    this._sessionRecordFor(user,sessionKey,function(err,sesrec){
      if(err) return;
      if(sesrec.bucketKeys[bucket]){
        sesrec.bucketKeys[bucket] = sesrec.bucketKeys[bucket].without(key);
        me._updateSessionRecord(user,sessionKey,sesrec,function(err,rec){
          if(callback) callback(err,rec);
        });
      }
    });
  },
  
  deleteRecords: function(user,sessionKey,storeRequest,records,callback){
    
  },
  
  deleteQuery: function(user,sessionKey,bucket,conditions,parameters){
    
  },
  
  queueRequest: function(user,sessionKey,event,data,callback){
    var me = this;
    if(user && sessionKey && event && data){
      this._sessionRecordFor(user,sessionKey,function(err,sesrec){
        if(err) return;
        if(!sesrec.requestQueue) sesrec.requestQueue = [];
        sesrec.requestQueue.push({
          evt: event,
          data: data
        });
        me._updateSessionRecord(user,sessionKey,sesrec,function(err,rec){
          if(callback) callback(err,rec);
        });
      });
    }
  },
  
  retrieveRequestQueue: function(user,sessionKey,callback){
    var me = this;
    if(user && sessionKey && callback){
      this._sessionRecordFor(user,sessionKey,function(err,sesrec){
        if(err) callback(new Error('no sesrec'));
        else {
          callback(err,sesrec.requestQueue);
          delete sesrec.requestQueue;
          me._updateSessionRecord(user,sessionKey,sesrec);
        }
      });
    }
  },
  
  // function called when a change has been made: so on create, update or delete.
  // in: storeRequest
  // out: array of {user: curUser, sessionKey: curUserInfo.sessionKeys[j], matchType: isMatch}
  // where matchType is either Constants.DISTRIBUTE_BUCKETKEY or Constants.DISTRIBUTE_QUERY
  // callback signature: (err,result)
  findEligableUserSessions: function(storeRequest,callback){
    var ret = [], req, bucket, key, record, me = this;
    if(!storeRequest) return;
    
    // the matching takes place in three stages:
    // - bucketkey => if the request matches a bucket-key combination the user is subscribed to
    // - query => if the request matches a query the current user is subscribed to
    // - relation => if the requests relation data matches a bucket key combination the user is subscribed to
    //               this should _not_ try to match queries, because you don't want relations being sent around
    //               for records that are not explicitly retrieved by an application.
    bucket = storeRequest.bucket;
    key = storeRequest.key;
    record = storeRequest.record;  
    
    if(!record){
      callback([]);
      return; // record should always be available
    } 
    
    var queryMatcher = function(sesq){
      if(!me._queryCache[bucket]) return false;
      if(!me._queryCache[bucket][sesq.conditions]) return false;
      if(!me._queryCache[bucket][sesq.conditions][sesq.parameters]) return false;
      var ret = me._queryCache[bucket][sesq.conditions][sesq.parameters].query.contains(record);
      // sys.log('query parameters: ' + sys.inspect(me._queryCache[bucket][sesq.conditions][sesq.parameters].query.parameters));
      // sys.log('query conditions: ' + me._queryCache[bucket][sesq.conditions][sesq.parameters].query.conditions);
      // sys.log('record: ' + sys.inspect(record));
      // sys.log('query matcher returning ' + ret);
      return ret;
    };
    
    var relationsMatcher = function(sesrec){
      return function(r){
        var keys = (r.keys instanceof Array)? r.keys: [r.keys];
        return keys.some(function(k){
          //sys.log('relation matcher: matching bucket ' + r.bucket + ' and key: ' + k);
          return (sesrec.bucketKeys[r.bucket] && sesrec.bucketKeys[r.bucket].contains(k));
        });
      };
    };

    var processSession = function(sesrec){
      if(sesrec.bucketKeys[bucket] && sesrec.bucketKeys[bucket].contains(key)){
        return { user: sesrec.username, sessionKey: sesrec.sessionKey, matchType: Constants.DISTRIBUTE_BUCKETKEY};
      }
      if(sesrec.queries.some(queryMatcher)){
        return { user: sesrec.username, sessionKey: sesrec.sessionKey, matchType: Constants.DISTRIBUTE_QUERY};
      }
      if(storeRequest.relations && storeRequest.relations.some(relationsMatcher(sesrec))){
        return { user: sesrec.username, sessionKey: sesrec.sessionKey, matchType: Constants.DISTRIBUTE_BUCKETKEY};
      }
    };

    var matcher = function(err,ret){
      var recs, result;
      if(err || !ret.recordResult){
        sys.log('Session: error fetching all records for distribution eligibility matching.');
        return;
      }
      recs = ret.recordResult;
      result = recs.map(processSession).without(undefined);
      callback(err,result);
    };
    
    req = API.StoreRequest.create({ bucket: 'session', requestType: Constants.ACTION_FETCH });
    this.store.fetch(req,{},matcher);
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
  _purgeOldSessions: function(callback){
    // do a fetch, then destroy sessions which are due
    var timeout = this.get('_timeoutInMs');
    var me = this;
    var _count = 0;
    var _numpurges = 0;
    var f = function(){
      _count += 1;
      if(callback && _count === _numpurges) callback();
    };
    var req = API.StoreRequest.create({ bucket: 'session', requestType: Constants.ACTION_FETCH });
    this.store.fetch(req,{},function(err,result){
      var recs;
      var now = new Date().getTime();
      if(result.recordResult){
        //sys.log('_purge: result ' + sys.inspect(result));
        recs = result.recordResult.filter(function(sesrec){
          //sys.log('Now: %@, sesrec.lastSeen %@, timeout %@ now-lastseen %@'.fmt(now,sesrec.lastSeen,timeout,(now-sesrec.lastSeen)));
          if((now - sesrec.lastSeen) > timeout) return true;
        });
        //sys.log('after filter: ' + sys.inspect(recs));
        _numpurges = recs.get('length');
        if(_numpurges > 0){
          recs.forEach(function(rec){
            sys.log('destroying timed out session for ' + rec.username + ' with sk: ' + rec.sessionKey);
            me.destroySession(rec.username,rec.sessionKey, f);
          });          
        } 
        else if(callback) callback();
      }
    });
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
    var me = this;
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
      me._purgeOldSessions();
      me._purger = SC.Timer.schedule({
        target: me,
        action: '_purgeOldSessions',
        interval: 30000,
        repeats: true
      });
    });
  
  }  
  
});

