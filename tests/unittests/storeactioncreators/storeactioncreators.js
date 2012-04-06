var base = require('../../testbase');
var assert = base.assert;
var storeaction = base.vows.describe("Storeactioncreators tests");
var API = base.Thoth.API;           
var C = base.Thoth.Constants;
var sys = require('util');

storeaction.addBatch({
  'kit is complete when': {
    topic: function(){
      return base.Thoth.Server.prototype;
    },
    
    'it contains the API functions': function(t){
      assert.isFunction(t.createStoreAction);
    }
  },
  
  'the createStoreAction function should': {
    topic: function(){
      return base.Thoth.Server.create({
        store: {}
      });
    },
    
    'when given a fetch API call': {
      topic: function(server){
        var me = this;
        var apiRequest = API.APIRequest.create({
          bucket: 'test',
          source: C.SOURCE_SOCKETIO,
          requestType: C.ACTION_FETCH
        });
        return server.createStoreAction(apiRequest, { user: 'test', sessionKey: 'testSesKey' }, 'testcb');
      },
      
      'should return a function': function(t){
        assert.isFunction(t);
      },
      
      'should return a function that when invoked': {
        topic: function(f,server){
          var me = this;
          server.store.fetch = function(storereq,ud,callb){
            me.callback(null,{storeReq: storereq, ud: ud, callb: callb});
          };
          f(true);
        },
        
        'should call the store fetch function with the proper data': function(t){
          assert.isObject(t.storeReq);
          assert.equal(t.storeReq.bucket,'test');
          assert.equal(t.ud,'test_testSesKey');
          assert.isFunction(t.callb);
        }
      }
    }
  }
})
.run();