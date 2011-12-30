var testbase = require('../testbase');
var assert = testbase.assert;

exports.testStoreAPI = function(store){
  var ret = {
    'store should have': {
      topic: store,
      'fetchDBRecords': function(s){
        assert.isFunction(s.fetchDBRecords);
      },
      'createDBRecord': function(s){
        assert.isFunction(s.createDBRecord);
      },
      'retrieveDBRecord': function(s){
        assert.isFunction(s.retrieveDBRecord);
      },
      'updateDBRecord': function(s){
        assert.isFunction(s.updateDBRecord);
      },
      'deleteDBRecord': function(s){
        assert.isFunction(s.deleteDBRecord);
      }
    }
  };
  return ret;
};

exports.testRelationsAPI = function(store){
  var ret = {
    'store with relations should have': {
      topic: store,
      
      'fetchRelation': function(s){
        assert.isFunction(s.fetchRelation);
      },
      
      'createRelation': function(s){
        assert.isFunction(s.createRelation);
      },
      
      'updateRelation': function(s){
        assert.isFunction(s.updateRelation);
      },
      
      'deleteRelation': function(s){
        assert.isFunction(s.deleteRelation);
      },
    }
  }
};
