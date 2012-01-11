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
    
    topic: function(){ 
      var errors = base.Thoth.Constants.ERRORS;
      assert.isArray(errors);
      var ret = errors.map(function(er){
        return API.ErrorReply.from(er,retData);
      });
      //return API.ErrorReply.from(base.Thoth.Constants.ERROR_DENIEDONPOLICY, retData ); },
      return ret;
    },
    
    'should result in a non-empty error message': function(t){
      t.forEach(function(e){
        assert.isTrue(e.get('message').length !== 0);
      });
     // assert.isTrue(t.get('message').length !== 0);
    },
    
    'should give back the correct returnData': function(t){
      t.forEach(function(e){
        assert.strictEqual(e.get('returnData'), retData);
      });
     // assert.strictEqual(t.get('returnData'), retData);
    }
    
  }
});

test.run();