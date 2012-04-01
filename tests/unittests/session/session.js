var base = require('../../testbase');
var assert = base.assert;
var sessionTests = base.vows.describe("Session Module tests");
var API = base.Thoth.API;           
var C = base.Thoth.Constants;
var sys = require('util');
var _CREATESESSIONKEY_;
var _CURRENTLASTSEEN_;

sessionTests.addBatch({
  
  // check API completeness
  'A complete sessionModule class': {
    topic: base.Thoth.Session.prototype,
    
    'should have a property sessionName': function(t){
      assert.isNull(t.sessionName);
    },
    
    'should have a property cookieExpire': function(t){
      assert.isNull(t.cookieExpire);
    },
    
    'should have a property sessionTimeout': function(t){
      assert.isNull(t.sessionTimeout);
    },
    
    'should have a store property of null': function(t){
      assert.isNull(t.store);
    },
    
    // 'should have a numberOfUsers computed property': function(t){
    //   assert.isFunction(t.prototype.numberOfUsers);
    //   assert.isTrue(t.prototype.numberOfUsers.isProperty);
    // },
    // 
    // 'should have a numberOfSessions computed property': function(t){
    //   assert.isFunction(t.prototype.numberOfSessions);
    //   assert.isTrue(t.prototype.numberOfSessions.isProperty);
    // },
    'should have session functions': function(t){
      assert.isFunction(t.checkSession);
      assert.isFunction(t.createSession);
      assert.isFunction(t.destroySession);
    },
    
    'should have all functions for storing data in the session': function(t){
      assert.isFunction(t.storeBucketKey);
      assert.isFunction(t.storeRecords);
      assert.isFunction(t.storeQuery);
      assert.isFunction(t.storeRequest);
    },
    
    'should have all functions for deleting data from the session': function(t){
      assert.isFunction(t.deleteQuery);
      assert.isFunction(t.deleteRecords);
      assert.isFunction(t.deleteBucketKey);
    },
    
    'should have all functions for the requestQueue': function(t){
      assert.isFunction(t.queueRequest);
      assert.isFunction(t.retrieveRequestQueue);
    },
    
    'should have the getEligableUserSessions function': function(t){
      assert.isFunction(t.getEligableUserSessions);
    },
    
    'should have the _storeQueryInCache function': function(t){
      assert.isFunction(t._storeQueryInCache);
    },
    
    'should have the _removeQueryFromCache function': function(t){
      assert.isFunction(t._removeQueryFromCache);
    }
    
  },
  
  'an instantiated session module': {
    topic: base.Thoth.Session.create(),
    
    'should have the default values for sessionName, cookieExpire and sessionTimeout': function(t){
      assert.equal(t.sessionName, 'Thoth');
      assert.equal(t.cookieExpire, 31);
      assert.equal(t.sessionTimeout,15);
    },
    
    'should have a DiskStore as store': function(t){
      assert.isTrue(SC.instanceOf(t.store,base.Thoth.DiskStore));
    },
    
    'should init the disk store with a filename containing the sessionName': function(t){
      assert.include(t.store.filename,t.sessionName);
    }
    
  }
  
})
.addBatch({
  'testing the helpers': {
    topic: base.Thoth.Session.create(), // needs data...
    
    '_timeoutInMs should return the correct amount': function(t){
      // 15*60*1000 => 
      assert.equal(t.get('_timeoutInMs'),900000); 
    },
    
    '_createStoreRequest should return a valid storeRequest': function(t){
      var req = t._createStoreRequest('testbucket','testkey',C.ACTION_REFRESH);
      assert.equal(req.bucket,'session');
      assert.equal(req.key,'testbucket_testkey');
      assert.equal(req.requestType, C.ACTION_REFRESH);
      assert.isTrue(SC.instanceOf(req,base.Thoth.API.StoreRequest));
    },
    
    '_createStoreRequest should return nothing is bucket is missing': function(t){
      var req = t._createStoreRequest(null,'testkey',C.ACTION_REFRESH);
      assert.isUndefined(req);
    }    
  }
})
.addBatch({
  'the query cache': {
    topic: function(){
      var ses = base.Thoth.Session.create();
      return ses;
    },
    
    'should': {
      topic: function(ses){
        ses._storeQueryInCache('testsesKey','test','test = {test}', {test: 'test'});
        ses._storeQueryInCache('testsesKey2','test','test = {test}', {test:'test'}); 
        ses._storeQueryInCache('testsesKey','test','test = {test}', {test: 'test1'});
        ses._storeQueryInCache('testsesKey','test2', 'test = {test}', {test: 'test'});
        ses._storeQueryInCache('testsesKey','test3'); // catch all
        ses._storeQueryInCache('testsesKey','test4', 'test_id = 1');
        return ses;
      },
      
      'store multiple sessionKeys in one object in the right spot': function(t){
        //sys.log('arguments: ' + sys.inspect(arguments));
        assert.isObject(t._queryCache['test']);
        assert.isObject(t._queryCache['test']['test = {test}']);
        assert.isObject(t._queryCache['test']['test = {test}']['{"test":"test"}']);
        assert.isArray(t._queryCache['test']['test = {test}']['{"test":"test"}'].sessionKeys);
        assert.lengthOf(t._queryCache['test']['test = {test}']['{"test":"test"}'].sessionKeys, 2);
        assert.isObject(t._queryCache['test']['test = {test}']['{"test":"test"}'].query);
        
      },
      
      'store a query with different parameters in a separate object': function(t){
        assert.isObject(t._queryCache['test']['test = {test}']['{"test":"test1"}']);
        assert.isArray(t._queryCache['test']['test = {test}']['{"test":"test1"}'].sessionKeys);
        assert.lengthOf(t._queryCache['test']['test = {test}']['{"test":"test1"}'].sessionKeys,1);
        assert.isObject(t._queryCache['test']['test = {test}']['{"test":"test1"}'].query);        
      },
      
      'store a query with different bucket in a separate object': function(t){
        assert.isObject(t._queryCache['test2']);
        assert.isObject(t._queryCache['test2']['test = {test}']);
        assert.isObject(t._queryCache['test2']['test = {test}']['{"test":"test"}']);
        assert.isArray(t._queryCache['test2']['test = {test}']['{"test":"test"}'].sessionKeys);
        assert.lengthOf(t._queryCache['test2']['test = {test}']['{"test":"test"}'].sessionKeys,1);
        assert.isObject(t._queryCache['test2']['test = {test}']['{"test":"test"}'].query);        
      },
      
      'store a fetch all query with special markers': function(t){
        assert.isObject(t._queryCache['test3']);
        assert.isObject(t._queryCache['test3']['_ALLCONDS_']);
        assert.isObject(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_']);
        assert.isArray(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_'].sessionKeys);
        assert.lengthOf(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_'].sessionKeys,1);
        assert.isObject(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_'].query);
      },
      
      'create a fetch all SC.Query without conditions and parameters': function(t){
        assert.isUndefined(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_'].query.conditions);
        assert.isUndefined(t._queryCache['test3']['_ALLCONDS_']['_ALLPARAMS_'].query.parameters);        
      },
      
      'store a query without a parameter object with special markers': function(t){
        assert.isObject(t._queryCache['test4']);
        assert.isObject(t._queryCache['test4']['test_id = 1']);
        assert.isObject(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_']);
        assert.isArray(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_'].sessionKeys);
        assert.lengthOf(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_'].sessionKeys,1);
        assert.isObject(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_'].query);        
      },
      
      'create a SC.Query without a parameter object when none is given': function(t){
        assert.equal(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_'].query.conditions,'test_id = 1');
        assert.isUndefined(t._queryCache['test4']['test_id = 1']['_ALLPARAMS_'].query.parameters);
      }
    }
  }
})
.addBatch({
  'creating a session': {
    topic: function(){
      //first delete the test.js file 
      try {
        require('fs').unlinkSync(base.Thoth.getRootPath()+'/tmp/test.js');
      }
      catch(e){
        // do nothing if file doesn't exist...
      }
      
      var ses = base.Thoth.Session.create({
        store: base.Thoth.DiskStore.create({ filename: 'test.js'}) // create a temporary file, not mess with standards
      });
      return ses;
    },
    
    'should': {
      topic: function(ses){
        ses.createSession({
          user: 'testuser',
          role: 'teacher'
        },this.callback); // with user data
      },
      
      'should give a record with the correct data': function(data){
        //sys.log('arguments: ' + sys.inspect(arguments));
        assert.isObject(data);
        assert.strictEqual(data.username,'testuser');
        //assert.strictEqual(data.sessionKey,_CREATESESSIONKEY_);
        assert.isString(data.sessionKey);
        _CREATESESSIONKEY_ = data.sessionKey;
        assert.deepEqual(data.userData,{ user: 'testuser', role: 'teacher' });
        assert.isTrue(data.lastSeen < new Date().getTime());
        _CURRENTLASTSEEN_ = data.lastSeen;
        assert.isArray(data.queries);
        assert.isEmpty(data.queries);
        assert.isObject(data.bucketKeys);
        assert.isEmpty(data.bucketKeys);
        assert.isArray(data.requestQueue);
        assert.isEmpty(data.requestQueue);
      },
      
      // 'return a sessionKey': function(t){
      //         assert.isString(t);
      //         assert.isTrue(t.length === 33);
      //         _CREATESESSIONKEY_ = t; // save for later
      //       },
      
      'and': {
        topic: function(rec,ses){
          //return {ses: ses, key: key}; // need some mechanism to have both items in the test
          return ses;
        },
        
        'the key should be in Session._sessionKeys': function(t){
          assert.include(t._sessionKeys, _CREATESESSIONKEY_);
        },
        
        'the contents of the session data': {
          topic: function(t){
            var me = this;
            var req = t._createStoreRequest('testuser',_CREATESESSIONKEY_,C.ACTION_REFRESH);
            t.store.refreshRecord(req,{},this.callback);
          },
          
          'should have the correct data': function(data){
            assert.isObject(data);
            assert.isObject(data.refreshResult);
            var rec = data.refreshResult;
            assert.strictEqual(rec.username,'testuser');
            assert.strictEqual(rec.sessionKey,_CREATESESSIONKEY_);
            assert.deepEqual(rec.userData,{ user: 'testuser', role: 'teacher' });
            assert.isTrue(rec.lastSeen < new Date().getTime());
            assert.isArray(rec.queries);
            assert.isEmpty(rec.queries);
            assert.isObject(rec.bucketKeys);
            assert.isEmpty(rec.bucketKeys);
            assert.isArray(rec.requestQueue);
            assert.isEmpty(rec.requestQueue);
          }
        },
        
        'checking the session': {
          topic: function(t){
            t.checkSession({ user: 'testuser', sessionKey: _CREATESESSIONKEY_}, this.callback);
          },
          
          'should return true': function(val){
            assert.isObject(val); // get userdata
            assert.equal(val.user, 'testuser');
            assert.equal(val.sessionKey, _CREATESESSIONKEY_);
            assert.equal(val.role, 'teacher');
          },
          
          'should update the lastSeen value': {
            topic: function(obj,t){
              var req = t._createStoreRequest('testuser',_CREATESESSIONKEY_,C.ACTION_REFRESH);
              t.store.refreshRecord(req,{},this.callback);
            },
            
            'to a newer value': function(data){
              sys.log('arguments to lastSeen: ' + sys.inspect(arguments));
              assert.isTrue(data.refreshResult.lastSeen > _CURRENTLASTSEEN_);
            }
          },
          
          'and then deleting the session': {
            topic: function(obj,t){
              t.destroySession('testuser',_CREATESESSIONKEY_,this.callback);
            },
            
            'the callback should give true': function(val){
              assert.isTrue(val);
            },
            
            'the session record': {
              topic: function(rec,rec2,t){
                var req = t._createStoreRequest('testuser',_CREATESESSIONKEY_,C.ACTION_REFRESH);
                t.store.refreshRecord(req,{},this.callback);
              },
              
              'should not exist anymore': function(data){
                assert.isNull(data);
              }
            }
          }
        }
      }
    }
  }
})
.addBatch({
  'When': {
    topic: function(){
      //first delete the test.js file 
      try {
        require('fs').unlinkSync(base.Thoth.getRootPath()+'/tmp/test.js');
      }
      catch(e){
        // do nothing if file doesn't exist...
      }
      
      var ses = base.Thoth.Session.create({
        store: base.Thoth.DiskStore.create({ filename: 'test.js'}) // create a temporary file, not mess with standards
      });
      return ses;      
    },
    
    'creating a session': {
      topic: function(ses){
        ses.createSession({
          user: 'testuser',
          role: 'teacher'
        },this.callback); // with user data
      },
      
      'the callback should give a record with a sessionKey': function(data){
        assert.isString(data.sessionKey);
        _CREATESESSIONKEY_ = data.sessionKey;
      },
      
      'and storing': {
        
        'a bucket key in it': {
          topic: function(ses){
            ses.storeBucketKey('testuser',_CREATESESSIONKEY_,'test','test1');
            var req = ses._createStoreRequest('testuser',_CREATESESSIONKEY_,C.ACTION_REFRESH);
            ses.store.refreshRecord(req,{},this.callback);
          },
          
          'the session record for the user should contain it': function(data){
            assert.isArray(data.bucketkeys['test']);
            assert.includes(data.bucketkeys['test'],'test1'); 
          }
        }
      }
    }    
    
  }
  
})
// .addBatch({
//   'registering data in a session': {
//     topic: function(){
//       var ses = base.Thoth.Session.create({
//         store: base.Thoth.DiskStore.create({ filename: 'test.js'}) // create a temporary file, not mess with standards
//       });
//       return ses;      
//     },
//     
//     'should': {
//       topic: function(ses){
//         
//       }
//     }
//   }
// })
.run();
