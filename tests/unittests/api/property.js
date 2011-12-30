var base = require('../../testbase');
var assert = base.assert;
var propertyTest = base.vows.describe("API property tests");
var API = base.Thoth.API;
var sys = require('util');

propertyTest.addBatch({
  
  "a inited property": {
    topic: API.Property.create(),
    
    "should have a schema": function(t){
      assert.isObject(t.schema);
    },
    
    "should have a fieldnames list": function(t){
      assert.isArray(t.fieldnames);
      assert.isNotEmpty(t.fieldnames);
    }
  }
  
});

propertyTest.run();
