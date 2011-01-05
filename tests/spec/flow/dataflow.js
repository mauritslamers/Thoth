var Thoth = require('../../../lib/Thoth').Thoth;
var sys = require('sys');

var APIRequests = require('../../testdata/APIRequests');
var createAPIRequest = APIRequests.createAPIRequest;
var StoreRequests = require('../../testdata/StoreRequests');
var Constants = require('../../../lib/core/Constants');
var Model = require('../../testdata/Model');

describe("Thoth data flow tests", function() {
  
  describe("Thoth create data flow test", function() {
    var junctionTableName = function(sideOne,sideTwo){
       return [sideOne,sideTwo].sort().join("_");
    };

    
    it("a create request should make the proper record data in the store", function() {
      
      var Server = Thoth.Server.create({ port: 8060, store: Thoth.MemStore.create() });
      Server.start();
      
      var cb = jasmine.createSpy();
      var req = APIRequests.createAPIRequest(Constants.ACTION_CREATE);
      Server.onCreate(req,StoreRequests.userData,cb);
      var rec = Thoth.copy(req.createRecord.record);
      //expect(cb).wasCalled();
      expect(Server.store._tables[req.createRecord.bucket][req.createRecord.key]).toEqual(rec);
    });
    
    it("a create request should make the proper relation data in the store", function() {
      var Server = Thoth.Server.create({ port: 8059, store: Thoth.MemStore.create() });
      Server.start();
      
      var cb = jasmine.createSpy();
      var req = APIRequests.createAPIRequest(Constants.ACTION_CREATE);
      Server.onCreate(req,StoreRequests.userData,cb);
      
      //expect(cb).toBeCalled();
      var rec = Thoth.copy(req.recordData);
      
      //two relations expected: firstname_test and lastname_test 
      var modelBucket = req.createRecord.bucket;
      var relOneBucket = req.createRecord.relations[0].bucket;
      var relTwoBucket = req.createRecord.relations[1].bucket;
      
      var relationOneBucket = junctionTableName(modelBucket,relOneBucket);
      var relationTwoBucket = junctionTableName(modelBucket,relOneBucket);
      
      Thoth.log('store tables inspect: ' + Thoth.inspect(Server.store._tables));
      expect(Server.store._tables[relationOneBucket]).toBeDefined();
      expect(Server.store._tables[relationTwoBucket]).toBeDefined();
      
    });
  });
});