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
  
  var createFakeStore = function(spy,relationSpy,shouldCallCallbacks,noAutomaticRelations){
    var automaticRelations = noAutomaticRelations? false: true;
    
    var ret = Thoth.Store.create({
      automaticRelations: automaticRelations,
      
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
      destroyRelation: function(storeRequest,relation,clientId,callback){
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
    
    it("should't call fetchRelation when automatic relations is turned off", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true,true);
      var req = createStoreRequest(Constants.ACTION_FETCH);
      store.fetch(req,StoreRequests.userData,function(){ return; });
      expect(spy).toHaveBeenCalledWith(req);
      expect(relspy).not.toHaveBeenCalled();
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

    it("shouldn't call createRelation and shouldn't include the relation properties when automaticRelations is off", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true,true);
      var req = createStoreRequest(Constants.ACTION_CREATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      //var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      var rec = Thoth.copy(req.recordData);
      store.createRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
      expect(relspy).not.toHaveBeenCalled();
    });
    
    it("should call the callback and include the relation properties", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_CREATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.createRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
    });
    
    it("should call createRelation with the proper relation data", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_CREATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.createRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec); 
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[0]);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[1]);           
    });
  });
  
  describe("updateRecord tests", function() {
    it("should call updateDBRecord", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy); // relspy needs to be in here to prevent error messages
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      store.updateRecord(req,StoreRequests.userData,function(){ return;});
      expect(spy).toHaveBeenCalledWith(req);
    });

    it("shouldn't call updateRelation and shouldn't include the relation properties when automaticRelations is off", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      //var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      var rec = Thoth.copy(req.recordData);
      store.updateRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
      expect(relspy).not.toHaveBeenCalled();
    });
    
    it("should call the callback and include the relation properties", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.updateRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
    });
    
    it("should call updateRelation with the proper relation data", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.updateRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec); 
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[0]);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[1]);           
    });    
  });
  
  describe("refreshRecord tests", function() {
    it("should call refreshRecord", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy); // relspy needs to be in here to prevent error messages
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      store.refreshRecord(req,StoreRequests.userData,function(){ return;});
      expect(spy).toHaveBeenCalledWith(req);
    });

    it("shouldn't call fetchRelation when automatic relations is off", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      //var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      var rec = { refreshResult: Thoth.copy(req.recordData)};
      store.refreshRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec);
      expect(relspy).not.toHaveBeenCalled();
    });
        
    it("should call fetchRelation with the proper relation data", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      var rec = { refreshResult: Thoth.copy(req.recordData)};
      store.refreshRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalledWith(rec); 
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[0]);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[1]);                
    });   
  });
  
  describe("deleteRecord tests", function() {
    it("should call deleteRecord", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var store = createFakeStore(spy,relspy); // relspy needs to be in here to prevent error messages
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      store.deleteRecord(req,StoreRequests.userData,function(){ return;});
      expect(spy).toHaveBeenCalledWith(req);
    });

    it("shouldn't call destroyRelation when automatic relations is off", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true,true); // no callbacks with deleteRecord
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      //Thoth.log('createRecord test: ' + Thoth.inspect(req,false,10));
      //var rec = Thoth.copy(Model.consistentRecordDataWithRelations);
      store.deleteRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);     
      expect(cb).toHaveBeenCalled();
      expect(relspy).not.toHaveBeenCalled();
    });
        
    it("should call destroyRelation with the proper relation data", function() {
      var spy = jasmine.createSpy();
      var relspy = jasmine.createSpy();
      var cb = jasmine.createSpy();
      var store = createFakeStore(spy,relspy,true);
      var req = createStoreRequest(Constants.ACTION_UPDATE);
      store.deleteRecord(req,StoreRequests.userData,cb);
      expect(spy).toHaveBeenCalledWith(req);
      expect(cb).toHaveBeenCalled(); 
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[0]);
      expect(relspy).toHaveBeenCalledWith(Model.consistentModelData.relations[1]);                
    });    
  });
  
});