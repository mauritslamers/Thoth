var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var C = Thoth.Constants;
var junctionrelationstest = testbase.vows.describe("junction relations relation tests");
var createRequest = require('./test_data').createRequest;
var FakeStore = require('./fake_store').FakeStore;

var stores = [];

var makeStoreReq = function(data){
  var APIReq = Thoth.APIRequest.from(data);
  return Thoth.StoreRequest.from(APIReq);
};

var getStoreWith = function(cb){
  var store = FakeStore.create({
    cb: function(sr,client,callback){
      cb(null,sr);
    }
  });
  stores.push(store);
  return store;
};

var emptyFunc = function(){};

junctionrelationstest.addBatch({
  'fetch requests': {
    'for relations with isNested': {
      topic: function(){
        var data = createRequest(C.ACTION_FETCH);
        var store = getStoreWith(this.callback);
        data.relations[0].type = 'toOne';
        data.relations[0].propertyName = 'exam';
        data.relations[0].isNested = true;
        store.fetch(data,'test',emptyFunc);
      },
      
      'should call fetchDBRecords for the main record': function(sr){
        assert.strictEqual(sr.bucket,'student');
      }
    }
  }
}).run();