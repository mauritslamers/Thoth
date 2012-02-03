var testbase = require('../../testbase');
var assert = testbase.assert;
var Thoth = testbase.Thoth;
var junctionrelationstest = testbase.vows.describe("junction relations relation tests");
var createRequest = require('./test_data').createRequest;
var FakeStore = require('./fake_store').FakeStore;

var store = FakeStore.create({
  automaticRelations: true
});

var testRequest = function(req,cb){
  var APIReq = Thoth.APIRequest.from(req);
  var storeReq = Thoth.StoreRequest.from(APIReq);
  
};

junctionrelationstest.addBatch({
  
}).run();