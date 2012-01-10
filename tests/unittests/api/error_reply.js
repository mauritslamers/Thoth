var base = require('../../testbase');
var assert = base.assert;
var test = base.vows.describe("API ErrorReply tests");
var API = base.Thoth.API;
var sys = require('util');                                   

var retData = { test: 1 };

test.addBatch({
  'the ErrorReply class': {
    
    topic: function(){ return API.ErrorReply; },
    
    'should have a from function': function(t){
      assert.isFunction(t.from);
    }
    
  },
  
  'creating an error reply using the from function': {
    
    topic: function(){ return API.ErrorReply.from(base.Thoth.Constants.ERROR_DENIEDONPOLICY, retData ); },
    
    'should result in a non-empty error message': function(t){
      assert.notEmpty(t.get('message'));
    },
    
    'should give back the correct returnData': function(t){
      assert.strictEqual(t.get('returnData'), retData);
    }
    
  }
});

test.run();