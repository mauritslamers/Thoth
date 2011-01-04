var Thoth = require('../../lib/Thoth').Thoth;

var StoreRequests = require('../testdata/StoreRequests');
var Constants = require('../../lib/core/Constants');
var Model = require('../testdata/Model');

describe('MemStore tests', function(){
  
  var MemStore;
  
  describe('Pretest checks', function(){
    it('Thoth exists and has loaded', function(){
      expect(Thoth).toBeDefined();
    });
    
    it("StoreRequests exists and has loaded", function() {
      expect(StoreRequests).toBeDefined();
    });
    
    it("Model exists and has been loaded", function() {
      expect(Model).toBeDefined();
    });
    
    it("Thoth has copy function", function() {
      expect(Thoth.copy).toBeDefined();
    });
    
    it("modeldata has record", function() {
      expect(Model.modelData).toBeDefined();
      expect(Model.modelData.record).toBeDefined();
    });    

  });
  
  describe('MemStore API test', function(){
    
    var MemStore = Thoth.MemStore.create();
    
    it("MemStore has start", function() {
      expect(MemStore.start).toBeDefined();
    });
    
    it("MemStore has createDBRecord", function() {
      expect(MemStore.createDBRecord).toBeDefined();
    });
    
    it("MemStore has updateDBRecord", function() {
      expect(MemStore.updateDBRecord).toBeDefined();
    });
    
    it("MemStore has refreshDBRecord", function() {
      expect(MemStore.refreshDBRecord).toBeDefined();
    });
    
    it("MemStore has deleteDBRecord", function() {
      expect(MemStore.deleteDBRecord).toBeDefined();
    });
    
    it("MemStore has fetchDBRecords", function() {
      expect(MemStore.fetchDBRecords).toBeDefined();
    });
  });
  
  describe("MemStore internals test", function() {
    beforeEach(function(){
      MemStore = Thoth.MemStore.create();    
      MemStore.start(); 
    });

    it('MemStore loads correctly', function(){
      expect(MemStore).toBeDefined();    
    });

    it('tables exists and is an object', function(){
      expect(MemStore._tables).toBeDefined();
      expect(MemStore._tables).toEqual({});
    });

    it("counters exists and is an object", function() {
      expect(MemStore._counters).toBeDefined();
      expect(MemStore._counters).toEqual({});
    });    
  });
  
  describe("MemStore create data consistency tests", function() {
    
    beforeEach(function(){
      MemStore = Thoth.MemStore.create();
      MemStore.start();
    });
    
    it("creating a record should alter MemStore._tables", function() {
      MemStore.createDBRecord(StoreRequests.createStoreRequest(Constants.ACTION_CREATE), StoreRequests.userData);
      expect(MemStore._tables[Model.modelData.bucket]).toBeDefined();
    });
    
    it("creating a record should alter MemStore _counters", function() {
      MemStore.createDBRecord(StoreRequests.createStoreRequest(Constants.ACTION_CREATE), StoreRequests.userData);
      expect(MemStore._counters[Model.modelData.bucket]).toBeDefined();
    });
    
    it("creating a record should call the callback with a key", function() {
      var cb = jasmine.createSpy();
      var storeReq = StoreRequests.createStoreRequest(Constants.ACTION_CREATE);
      var rec = StoreRequests.createStoreRequest(Constants.ACTION_CREATE).recordData;
      
      delete storeReq.recordData[storeReq.primaryKey];
      delete storeReq.recordData.id;
      delete storeReq.recordData.key;
      delete storeReq.key;
      rec.key = 1; // new record should get key 1
      rec.id = 1;
      rec[storeReq.primaryKey] = 1;
      MemStore.createDBRecord(storeReq,StoreRequests.userData,cb);
      expect(cb).toHaveBeenCalledWith(rec);
    });
    
    it("the record data in a create request should be the same as the hash in _tables", function() {
      var rec = StoreRequests.createStoreRequest(Constants.ACTION_CREATE).recordData;
      var storeReq = StoreRequests.createStoreRequest(Constants.ACTION_CREATE);
      MemStore.createDBRecord(storeReq,StoreRequests.userData);
      var recInTables = MemStore._tables[storeReq.bucket][storeReq.key];
      expect(recInTables).toEqual(rec);
    });
  });
  
  describe("MemStore refreshRecord data integrity tests", function() {

    var rec = Thoth.copy(Model.modelData.record);
    rec.id = rec[StoreRequests.createStoreRequest(Constants.ACTION_CREATE).primaryKey];
    rec.key = rec.id;
              
    beforeEach(function(){
      MemStore = Thoth.MemStore.create();
      MemStore.start();
      var storeReq = Thoth.copy(StoreRequests.createStoreRequest(Constants.ACTION_CREATE));
      MemStore.createDBRecord(storeReq,StoreRequests.userData);
    });
    
    it("refreshDBRecord should return the same data as went in", function() {
      var cb = jasmine.createSpy();
      MemStore.refreshDBRecord(StoreRequests.createStoreRequest(Constants.ACTION_REFRESH),StoreRequests.userData,cb);
      expect(cb).toHaveBeenCalledWith(rec);
    });
  });
});