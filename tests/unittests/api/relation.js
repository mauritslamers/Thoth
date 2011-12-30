var base = require('../../testbase');
var assert = base.assert;
var relationTest = base.vows.describe("API relation tests");
var API = base.Thoth.API;
var sys = require('util');

relationTest.addBatch({
  
  "a inited relation": {
    topic: API.Relation.create(),
    
    "should have a schema": function(t){
      assert.isObject(t.schema);
    },
    
    "should have a fieldnames list": function(t){
      assert.isArray(t.fieldnames);
      assert.isNotEmpty(t.fieldnames);
    }
  }
  
});

relationTest.run();
