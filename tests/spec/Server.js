var Thoth = require('../../lib/Thoth').Thoth;
var sys = require('sys');

describe('Thoth Server test', function(){

  var userData = { user: 'testUser', sessionKey: 'test14' };

  var fakeModel = {
    bucket: 'test',
    key: '513',
    primaryKey: 'test1',
    conditions: 'test = {test}', 
    parameters: { test: 'test' },
    properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
    relations: [{ propertyName: 'test3', type: 'toMany', bucket: 'test3'},
                { propertyName: 'test4', type: 'toOne', bucket: 'test4'}],
    record: { test1: 'test1', test2: 123 }
  };

  var returnData = { returnKey: 'test14' }; 

  var fetchRequest = { 
    fetch: { 
      bucket: fakeModel.bucket,
      primaryKey: fakeModel.primaryKey,
      conditions: fakeModel.conditions,
      parameters: fakeModel.parameters,
      properties: fakeModel.properties,
      relations: fakeModel.relations,
      returnData: returnData
    }
  };

  var fetchStoreRequest = { 
     bucket: fakeModel.bucket, 
     action: 'refresh',
     primaryKey: fakeModel.primaryKey,
     userData: userData,
     conditions: fakeModel.conditions, 
     parameters: fakeModel.parameters,
     properties: fakeModel.properties,
     relations: fakeModel.relations 
  };
  
  var refreshRequest = {
    refreshRecord: {
      bucket: fakeModel.bucket,
      key: fakeModel.key,
      primaryKey: fakeModel.primaryKey,
      properties: fakeModel.properties,
      relations: fakeModel.relations
    }
  };

  var refreshStoreRequest = { 
     bucket: fakeModel.bucket, 
     primaryKey: fakeModel.primaryKey,
     action: 'refresh',
     userData: userData,
     key: fakeModel.key,
     properties: fakeModel.properties,
     relations: fakeModel.relations
  };

  var createRequest = {
    createRecord: {
      bucket: fakeModel.bucket,
      key: fakeModel.key,
      primaryKey: fakeModel.primaryKey,
      record: fakeModel.record,
      relations: fakeModel.relations
    }
  };

  var createStoreRequest = { 
     bucket: fakeModel.bucket, 
     key: fakeModel.key,
     primaryKey: fakeModel.primaryKey,
     action: 'create',
     userData: userData,
     recordData: fakeModel.record,
     relations: fakeModel.relations
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

      Server.onFetch(fetchRequest,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(fetchStoreRequest);
    });
    
    it('onRefresh storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  

      Server.onRefresh(refreshRequest,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(refreshStoreRequest);
    });
    
    it('onCreate storeRequest test', function(){
      var cb = jasmine.createSpy();
      var Server = Thoth.Server.create({ store: createFakeStore(cb) });  

      Server.onCreate(createRequest,userData,function(){ return; });
      expect(cb).toHaveBeenCalledWith(createStoreRequest);
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