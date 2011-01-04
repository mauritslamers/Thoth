var Thoth = require('../../lib/Thoth').Thoth;
var sys = require('sys');

var createAPIRequest = require('../testdata/APIRequests').createAPIRequest;
var StoreRequests = require('../testdata/StoreRequests');
var createStoreRequest = StoreRequests.createStoreRequest;
var userData = StoreRequests.userData;
var Constants = require('../../lib/core/Constants');

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

      Server.onCreate(createAPIRequest(Constants.ACTION_CREATE),userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_CREATE));
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
      Thoth.log('onDelete storeReq test: apiReq' + Thoth.inspect(apiReq));
      Server.onDelete(apiReq,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest(Constants.ACTION_DELETE));
    });

  });
  
  describe("Testing Server behaviour with inconsistent requests", function(){
    
    var Server = Thoth.Server.create();
    
    it("onFetch should call the callback with an error", function() {
      var cb = jasmine.createSpy();
      Server.onFetch(createAPIRequest(Constants.ACTION_FETCH,YES),userData,cb);
      var reply = Server._createErrorReply(Constants.ACTION_FETCH,Constants.ERROR_DATAINCONSISTENCY,StoreRequests.userData);
      expect(cb).toHaveBeenCalledWith(reply);
    });
    
    it("onRefresh should call the callback with an error", function() {
      var cb = jasmine.createSpy();
      Server.onRefresh(createAPIRequest(Constants.ACTION_REFRESH,YES),userData,cb);
      var reply = Server._createErrorReply(Constants.ACTION_REFRESH,Constants.ERROR_DATAINCONSISTENCY,StoreRequests.userData);
      expect(cb).toHaveBeenCalledWith(reply);
    });
    
    it("onCreate should call the callback with an error", function() {
      var cb = jasmine.createSpy();
      Server.onCreate(createAPIRequest(Constants.ACTION_CREATE,YES),userData,cb);
      var reply = Server._createErrorReply(Constants.ACTION_CREATE,Constants.ERROR_DATAINCONSISTENCY,StoreRequests.userData);
      expect(cb).toHaveBeenCalledWith(reply);
    }); 
    
    it("onUpdate should call the callback with an error", function() {
      var cb = jasmine.createSpy();
      Server.onUpdate(createAPIRequest(Constants.ACTION_UPDATE,YES),userData,cb);
      var reply = Server._createErrorReply(Constants.ACTION_UPDATE,Constants.ERROR_DATAINCONSISTENCY,StoreRequests.userData);
      expect(cb).toHaveBeenCalledWith(reply);
    });

    it("onDelete should call the callback with an error", function() {
      var cb = jasmine.createSpy();
      Server.onDelete(createAPIRequest(Constants.ACTION_DELETE,YES),userData,cb);
      var reply = Server._createErrorReply(Constants.ACTION_DELETE,Constants.ERROR_DATAINCONSISTENCY,StoreRequests.userData);
      expect(cb).toHaveBeenCalledWith(reply);
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