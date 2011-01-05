var Thoth = require('../../../lib/Thoth').Thoth;
var sys = require('sys');

var APIRequests = require('../../testdata/APIRequests');
var createAPIRequest = APIRequests.createAPIRequest;


var StoreRequests = require('../../testdata/StoreRequests');
var createStoreRequest = StoreRequests.createStoreRequest;
var userData = StoreRequests.userData;
var Constants = require('../../../lib/core/Constants');
var API = require('../../../lib/core/API');

describe('Thoth API and testdata tests', function(){
  
  describe("checking presence of API functions", function() {
    it("createAPIRequest should exist", function() {
      expect(API.createAPIRequest).toBeDefined();      
    });

    it("createStoreRequest should exist", function() {
      expect(API.createStoreRequest).toBeDefined();
    });
    
    it("createDataReply should exist", function() {
      expect(API.createDataReply).toBeDefined();
    });
    
    it("hasInconsistency should exist", function() {
      expect(API.hasInconsistency).toBeDefined();
    });
    
    it("createErrorReply should exist", function() {
      expect(API.createErrorReply).toBeDefined();
    });
  });
  
  describe("checking presence of testdata functions", function() {
    it("createAPIRequest should exist", function() {
      expect(createAPIRequest).toBeDefined();
    });
    
    it("createStoreRequest should exist", function() {
      expect(StoreRequests.createStoreRequest).toBeDefined();
    });
    
    it("userData on storeRequests should exist", function(){
      expect(StoreRequests.userData).toBeDefined();
    })
  });
  
  describe("comparing validity of requests", function() {
    it("API to Store should be equal in both API as testdata", function() {
      var req = createAPIRequest(Constants.ACTION_CREATE);
      var expectedResult = API.createStoreRequest(req.createRecord,userData,Constants.ACTION_CREATE);
      expect(StoreRequests.createStoreRequest(Constants.ACTION_CREATE)).toEqual(expectedResult);
    });
    
    it("Store to API should be equal in both API as testdata", function() {
      var req = createStoreRequest(Constants.ACTION_CREATE);
      var expectedResult = API.createAPIRequest(req,Constants.ACTION_CREATE,APIRequests.returnData);
      expect(createAPIRequest(Constants.ACTION_CREATE)).toEqual(expectedResult);
    });
    
    it("API.getPrimaryKey should return test1", function() {
      var req = createStoreRequest(Constants.ACTION_CREATE);
      expect(API.getPrimaryKey(req)).toEqual('test1');
    });
    
    it("consistentModelData should not trigger hasInconsistency", function() {
      var req = createStoreRequest(Constants.ACTION_CREATE);
      //Thoth.log('consistent Store Request: ' + Thoth.inspect(req));
      //Thoth.log('result from hasInconsistency: ' + API.hasInconsistency(req));
      expect(API.hasInconsistency(req)).toEqual(false);
    });
    
    it("inconsistentModelData should trigger hasInconsistency ", function() {
      var req = createStoreRequest(Constants.ACTION_CREATE,true);
      expect(API.hasInconsistency(req)).toEqual(true);
    });
  });
  
});



describe('Thoth Server test', function(){
  
  var createFakeStore = function(spy){
    return { // a fake store to send the storeRequest to the callback
      createRecord: function(storeRequest,clientId,cb){
        spy(storeRequest);
      },
    
      updateRecord: function(storeRequest,clientId,cb){      
        spy(storeRequest);
      },
    
      deleteRecord: function(storeRequest,clientId,cb){
        spy(storeRequest);
      },
    
      fetch: function(storeRequest,clientId,cb){
        spy(storeRequest);
      },
    
      refreshRecord: function(storeRequest,clientId,cb){
        spy(storeRequest);
      }
    };
  };
  
  describe('Thoth on handlers test', function(){
    // fake a request by a socket client and check the proper callback
  
    /*
    { refreshRecord: { bucket: '', key: '', returnData: {} }} 
    { fetch: { bucket: '', conditions: '', parameters: {}, returnData: {} }}
    { createRecord: { bucket: '', record: {}, returnData: {} }}
    { updateRecord: { bucket: '', key: '', record: {}, returnData: {} }}
    { deleteRecord: { bucket: '', key: '', returnData: {} }}
    
    // returned by the server as answer to a client request
    { fetchResult: { bucket: '', records: [], returnData: {} }}
    { createRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }
    { updateRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }
    { deleteRecordResult: { bucket: '', key: '', returnData: {} } }
    { refreshRecordResult: { bucket: '', key: '', record: {}, returnData: {} } }

    // returned by the server when the request was denied based on policy
    { fetchError:   { errorCode: 0, returnData: {} }}
    { createRecordError:  { errorCode: 0, returnData: {} }}
    { updateRecordError:  { errorCode: 0, returnData: {} }}
    { deleteRecordError:  { errorCode: 0, returnData: {} }}
    { refreshRecordError: { errorCode: 0, returnData: {} }}
    
    { fetch: { 
        bucket: '', conditions:'', parameters: '', 
        relations: [ { propertyName: '', type: 'toOne', bucket: ''}, { propertyName: '', type: 'toMany', bucket: ''}]}}
    
     */
    
    it('Server has on* handlers', function(){
      var Server = Thoth.Server.create({ store: createFakeStore() });
      expect(Server.onFetch).toBeDefined();
      expect(Server.onRefresh).toBeDefined();
      expect(Server.onCreate).toBeDefined();
      expect(Server.onUpdate).toBeDefined();
      expect(Server.onDelete).toBeDefined();
    });
    
    it('onFetch storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  

      Server.onFetch(createAPIRequest(Constants.ACTION_FETCH),userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_FETCH));
    });
    
    it('onRefresh storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  

      Server.onRefresh(createAPIRequest(Constants.ACTION_REFRESH),userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_REFRESH));
    });
    
    it('onCreate storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  
      var req = createStoreRequest(Constants.ACTION_CREATE);
      var apiReq = createAPIRequest(Constants.ACTION_CREATE);
      Server.onCreate(apiReq,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(req);
    });

    it('onUpdate storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  

      Server.onUpdate(createAPIRequest(Constants.ACTION_UPDATE),userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_UPDATE));
    });    

    it('onDelete storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  
      var apiReq = createAPIRequest(Constants.ACTION_DELETE);
      //Thoth.log('onDelete storeReq test: apiReq' + Thoth.inspect(apiReq));
      Server.onDelete(apiReq,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_DELETE));
    });

  });
  
  describe("Testing Server behaviour with inconsistent requests", function(){
    
    
    // onFetch is currently disabled but is in here to be enabled when fetch requests can contain inconsistencies
    xit("onFetch should call the callback with an error", function() {
      var storeSpy = jasmine.createSpy();
      var Server = Thoth.Server.create({store: createFakeStore(storeSpy)});
      
      var cb = jasmine.createSpy();
      Server.onFetch(createAPIRequest(Constants.ACTION_FETCH,YES),userData,cb);
      var reply = API.createErrorReply(Constants.ACTION_FETCH,Constants.ERROR_DATAINCONSISTENCY,APIRequests.returnData);
      expect(cb).toHaveBeenCalledWith(reply);
      expect(storeSpy).not.toHaveBeenCalled();
    });
    // onRefresh obviously doesn't contain a record, so it is in here when something
    xit("onRefresh should call the callback with an error", function() {
      var storeSpy = jasmine.createSpy();
      var Server = Thoth.Server.create({store: createFakeStore(storeSpy)});

      var cb = jasmine.createSpy();
      var req = createAPIRequest(Constants.ACTION_REFRESH,YES);
      Server.onRefresh(req,userData,cb);
      var reply = API.createErrorReply(Constants.ACTION_REFRESH,Constants.ERROR_DATAINCONSISTENCY,APIRequests.returnData);
      Thoth.log('request: ' + Thoth.inspect(req,YES,10));
      expect(cb).toHaveBeenCalledWith(reply);
      expect(storeSpy).not.toHaveBeenCalled();
    });
    
    it("onCreate should call the callback with an error", function() {
      var storeSpy = jasmine.createSpy();
      var Server = Thoth.Server.create({store: createFakeStore(storeSpy)});      
      
      var cb = jasmine.createSpy();
      Server.onCreate(createAPIRequest(Constants.ACTION_CREATE,YES),userData,cb);
      var reply = API.createErrorReply(Constants.ACTION_CREATE,Constants.ERROR_DATAINCONSISTENCY,APIRequests.returnData);
      expect(cb).toHaveBeenCalledWith(reply);
      expect(storeSpy).not.toHaveBeenCalled();
    }); 
    
    it("onUpdate should call the callback with an error", function() {
      var storeSpy = jasmine.createSpy();
      var Server = Thoth.Server.create({store: createFakeStore(storeSpy)});      
      
      var cb = jasmine.createSpy();
      Server.onUpdate(createAPIRequest(Constants.ACTION_UPDATE,YES),userData,cb);
      var reply = API.createErrorReply(Constants.ACTION_UPDATE,Constants.ERROR_DATAINCONSISTENCY,APIRequests.returnData);
      expect(cb).toHaveBeenCalledWith(reply);
      expect(storeSpy).not.toHaveBeenCalled();
    });

    it("onDelete should call the callback with an error", function() {
      var storeSpy = jasmine.createSpy();
      var Server = Thoth.Server.create({store: createFakeStore(storeSpy)});      
      
      var cb = jasmine.createSpy();
      Server.onDelete(createAPIRequest(Constants.ACTION_DELETE,YES),userData,cb);
      var reply = API.createErrorReply(Constants.ACTION_DELETE,Constants.ERROR_DATAINCONSISTENCY,APIRequests.returnData);
      expect(cb).toHaveBeenCalledWith(reply);
      expect(storeSpy).not.toHaveBeenCalled();
    }); 
      
  });
  
  
});

/*
Spies props

callCount: returns number of times spy was called

mostRecentCall.args: returns argument array from last call to spy.

argsForCall[i] returns arguments array for call i to spy.



it('should test async call') {
  spyOn(Klass, 'asyncMethod');
  var callback = jasmine.createSpy();

  Klass.asyncMethod(callback);
  expect(callback).not.toHaveBeenCalled();

  var someResponseData = 'foo';
  Klass.asyncMethod.mostRecentCall.args[0](someResponseData);
  expect(callback).toHaveBeenCalledWith(someResponseData);

});

it('shows asynchronous test', function(){
  setTimeout(function(){
    expect('second').toEqual('second');
    asyncSpecDone();
  }, 1);
  expect('first').toEqual('first');
  asyncSpecWait();
});
*/