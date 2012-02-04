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
    topic: function(){
      var store = getStoreWith(this.callback);
      
      var sR = makeStoreReq(createRequest())
      store.fetchRelation()
    }
  }
}).run();