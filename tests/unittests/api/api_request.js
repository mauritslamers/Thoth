var base = require('../../testbase');
var assert = base.assert;
var testAPIRequest = base.vows.describe("API APIRequest tests");
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

testAPIRequest.addBatch({
  
  "an API Request should": {
    topic: function(){ return API.APIRequest; },
    
    'contains an isConsistent computed property': function(t){
      assert.isFunction(t.prototype.isConsistent);
      assert.isTrue(t.prototype.isConsistent.isProperty);
    },
    
    'throw an error when inited without a request type': function(t){
      assert.throws(function(){ t.create(); }, Error);
    },
    
    'throw an error when inited with a request type but without a valid schema': function(t){
      assert.throws(function(){ t.create({ requestType: 'stupidrequest'}); }, Error);
    }, 
    
    'throw an error when inited with a proper request type but without a source': function(t){
      assert.throws(function(){ t.create({ requestType: C.ACTION_FETCH }); });
    },
    
    'should not throw an error when inited with a proper request type and source': function(t){
      assert.doesNotThrow(function(){
        t.create({ requestType: C.ACTION_FETCH, source: C.SOURCE_REST });
      },Error);  
    }
    
  },
  
  'a fetch store request without data': {
    topic: API.StoreRequest.create({ requestType: C.ACTION_FETCH, source: C.SOURCE_REST }),
    
    'should always be consistent': function(t){
      assert.isTrue(t.get('isConsistent'));
    },
    
    'should return undefined for recordData': function(t){
      assert.isUndefined(t.get('recordData'));
    }
  },
  
  'a create api request with inconsistent data': {
    topic: API.APIRequest.create(inconsistentData,{requestType: C.ACTION_CREATE, source: C.SOURCE_REST }),
    
    'should be inconsistent': function(t){
      assert.isFalse(t.get('isConsistent'));
    },
    
    'should still return the original json': function(t){
      assert.deepEqual(t.get('json'),inconsistentData);
    }
  },
  
  'calling the APIRequests from function': {
    topic: function(){ return API.APIRequest; },
  
    'with no data should return undefined': function(t){
      assert.isUndefined(t.from());
    },
    
    'with inconistent data should return undefined': function(t){
      assert.isUndefined(t.from(inconsistentData, { source: C.SOURCE_REST, requestType: C.ACTION_CREATE }));
    }
  } 
  
});                                                                                                          

testAPIRequest.run();