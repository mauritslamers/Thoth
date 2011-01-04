var Thoth = require('../../../lib/Thoth').Thoth;
var sys = require('sys');

var APIRequests = require('../../testdata/APIRequests');
var createAPIRequest = APIRequests.createAPIRequest;

var Model = require('../../testdata/Model');
var StoreRequests = require('../../testdata/StoreRequests');
var createStoreRequest = StoreRequests.createStoreRequest;
var userData = StoreRequests.userData;
var Constants = require('../../../lib/core/Constants');
var API = require('../../../lib/core/API');

describe("Store tests", function() {
  
  var createFakeStore = function(spy,relationSpy,shouldCallCallbacks){
    var ret = Thoth.Store.create({
      createDBRecord: function(storeRequest,clientId,callback){
        spy(storeRequest);
        if(shouldCallCallbacks && callback) callback(storeRequest.recordData);
      },
      updateDBRecord: function(storeRequest,clientId,callback){
        spy(storeRequest);
        if(shouldCallCallbacks && callback) callback(storeRequest.recordData);
      },
      fetchDBRecords: function(storeRequest,clientId,callback){
        spy(storeRequest);
        if(shouldCallCallbacks && callback){
          callback([Model.consistentModelData.record]);
        } 
      },
      refreshDBRecord: function(storeRequest,clientId,callback){
        spy(storeRequest);
        if(shouldCallCallbacks && callback) callback(Model.consistentModelData.record);
      },
      deleteDBRecord: function(storeRequest,clientId,callback){
        spy(storeRequest);
        if(shouldCallCallbacks && callback) callback();
      },
      createRelation: function(storeRequest,record,relation,clientId,callback){
        relationSpy(relation);
        if(shouldCallCallbacks && callback){
          callback(Model.relations[relation.bucket]);
        } 
      },
      updateRelation: function(storeRequest,record,relation,clientId,callback){
        relationSpy(relation);
        if(shouldCallCallbacks && callback){
          callback(Model.relations[relation.bucket]);
        }
      },
      destroyRelation: function(storeRequest,record,relation,clientId,callback){
        relationSpy(relation);
        if(shouldCallCallbacks && callback){
          callback(Model.relations[relation.bucket]);
        }
      },
      fetchRelation: function(storeRequest,record,relation,clientId,callback){
        relationSpy(relation);
        if(shouldCallCallbacks && callback){
          callback(Model.relations[relation.bucket]);
        }
      }
    });
    return ret;    
  };
  
  describe("fetch tests", function() {
    
    it("should call fetchDBRecords", function() {
      var spy = jasmine.createSpy();
      var store = createFakeStore(spy);
      var req = createStoreRequest(Constants.ACTION_FETCH);
      store.fetch(req,StoreRequests.userData, function(){ return; }); // fetch needs a callback
      expect(spy).toHaveBeenCalledWith(req);
    });
    
    it("should call callback when data is returned", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var cb = jasmine.createSpy();
      var req = createStoreRequest(Constants.ACTION_FETCH);
      store.fetch(req,StoreRequests.userData,cb);      
      expect(spy).toHaveBeenCalledWith(req);
      expect(cb).toHaveBeenCalledWith({recordResult : [Model.consistentModelData.record]});
    });
    
    it("should call fetchRelation with the proper relation data when data is returned", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_FETCH);
      store.fetch(req,StoreRequests.userData,function(){ return; });
      expect(spy).toHaveBeenCalledWith(req);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[0]);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[1]);
    });
    
  });
  
  describe("createRecord tests", function() {
    it("should call createDBRecord", function() {
      var spy = jasmine.createSpy();
      var store = createFakeStore(spy);
      var req = createStoreRequest(Constants.ACTION_CREATE);
      store.createRecord(req,StoreRequests.userData,function(){ return;});
      expect(spy).toHaveBeenCalledWith(req);
    });
    
    it("should call the callback", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_CREATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.createRecord(req,StoreRequests.userData,cb);
      //expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
    });
  });
  
  describe("updateRecord tests", function() {
    
  });
  
  describe("refreshRecord tests", function() {
    
  });
  
  describe("deleteRecord tests", function() {
    
  });
  
});