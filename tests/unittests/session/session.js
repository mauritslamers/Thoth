var base = require('../../testbase');
var assert = base.assert;
var sessionTests = base.vows.describe("Session Module tests");
var API = base.Thoth.API;           
var C = base.Thoth.Constants;
var sys = require('util');

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
      //ses.start();
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
// .addBatch({
//   'creating a session': {
//     topic: function(){
//       var ses = base.Thoth.Session.create({
//         store: base.Thoth.DiskStore.creates({ filename: 'test.js'}) // create a temporary file, not mess with standards
//       });
//       ses.start();
//       return ses;
//     },
//     
//     'should': {
//       topic: function(ses){
//         return ses.createSession(); // with user data
//       },
//       
//       'return a sessionKey': function(t){
//         assert.isString(t);
//         assert.lengthOf(t,32);
//       },
//       
//       'and': {
//         topic: function(key,ses){
//           return {ses: ses, key: key}; // need some mechanism to have both items in the test
//         },
//         
//         'the key should be in Session._sessionKeys': function(t){
//           assert.include(t.ses._sessionKeys, t.key);
//         },
//         
//         'the contents of the session data': {
//           topic: function(t){
//             var req = t._createStoreRequest('session',t.key,C.ACTION_REFRESH);
//             t.ses.store.refreshRecord(req,{},this.callback);
//           },
//           
//           'should have the correct data': function(data){
//             
//           }
//         }
//       }
//     }
//   }
// })
// .addBatch({
//   'registering data in a session': {
//     topic: function(){
//       var ses = base.Thoth.Session.create({
//         store: base.Thoth.DiskStore.create({ filename: 'test.js'}) // create a temporary file, not mess with standards
//       });
//       ses.start();
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
