var base = require('../../testbase');
var assert = base.assert;
var testStoreRequest = base.vows.describe("API StoreRequest tests");
var API = base.Thoth.API;           
var C = base.Thoth.Constants;
var sys = require('util');

var inconsistentData = {
  bucket: 'test',
  key: '513',
  primaryKey: 'test1',
  properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
  relations: [{ propertyName: 'firstname', type: 'toMany', bucket: 'firstname'},
              { propertyName: 'lastname', type: 'toOne', bucket: 'lastname'}],
  record: { test1: 'test1', test2: 123 }
};

testStoreRequest.addBatch({
  
  "a store Request should": {
    topic: function(){ return API.StoreRequest; },
    
    'contain an isConsistent computed property': function(t){
      assert.isFunction(t.prototype.isConsistent);
      assert.isTrue(t.prototype.isConsistent.isProperty);
    },
    
    'contain a clientId computed property': function(t){
     assert.isFunction(t.prototype.clientId);
     assert.isTrue(t.prototype.clientId.isProperty);
    },
    
    'throw an error when inited without a request type': function(t){
      assert.throws(function(){ t.create(); }, Error);
    },
    
    'throw an error when inited with a request type but without a valid schema': function(t){
      assert.throws(function(){ t.create({ requestType: 'stupidrequest'}); }, Error);
    },
    
    'should not throw an error when inited with a proper request type': function(t){
      assert.doesNotThrow(function(){
        t.create({ requestType: C.ACTION_FETCH });
      },Error);  
    }
  },
  
  'a fetch store request without data': {
    topic: API.StoreRequest.create({ requestType: C.ACTION_FETCH }),
    
    'should always be consistent': function(t){
      assert.isTrue(t.get('isConsistent'));
    },
    
    'should return undefined for recordData': function(t){
      assert.isUndefined(t.get('recordData'));
    },
    
    'should return undefined for clientId': function(t){
      assert.isUndefined(t.get('clientId'));
    }
  },
  
  'a create store request with inconsistent data': {
    topic: API.StoreRequest.create(inconsistentData,{requestType: C.ACTION_CREATE}),
    
    'should be inconsistent': function(t){
      assert.isFalse(t.get('isConsistent'));
    },
    
    'should still return the original json': function(t){
      assert.deepEqual(t.get('json'),inconsistentData);
    }
  }
  
});                                                                                                          

testStoreRequest.run();