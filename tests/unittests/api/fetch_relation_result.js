var base = require('../../testbase');
var assert = base.assert;
var test = base.vows.describe("API FetchRelationResult tests");
var API = base.Thoth.API;
var sys = require('util');

var reldata =  { test: 1 };
var retData = { test2: 3 };               

test.addBatch({  
  
  'fetchRelationResult': {
    
    topic: function(){ return API.FetchRelationResult; },
    
    'should have a from function': function(t){
      assert.isFunction(t.from);
    }
    
  },
  
  'creating a fetchRelationResult object using .from': {
    
    topic: function(){
      return API.FetchRelationResult.from(reldata, retData);
    },
    
    'should give back the relation data in an array': function(t){
      var relSet = t.get('relationSet');
      assert.isArray(relSet);  
      assert.strictEqual(relSet.length,1);
      assert.deepEqual(relSet[0],reldata);
    },
    
    'should give back the correct returnData': function(t){
      assert.deepEqual(retData,t.get('returnData'));
    }
  }
  
});

test.run();