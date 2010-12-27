var Thoth = require('../../lib/Thoth').Thoth;

describe('Thoth Server test', function(){
  
  describe('Thoth on* handlers test', function(){
    // fake a request by a socket client and check the proper callback
    
    var Server = Thoth.Server.create();
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
    var fetchRequest = { 
      fetch: { 
        bucket: 'test', 
        primaryKey: 'test1',
        conditions: 'test', 
        parameters: { test: 'test' },
        properties: [ { key: 'test1', type: 'String'}, { key: 'test2', type: 'Number'}],
        relations: [{ propertyName: 'test3', type: 'toMany', bucket: 'test3'},
                    { propertyName: 'test4', type: 'toOne', bucket: 'test4'}],
        returnData: { returnKey: 'test14' }
      }
    };
    
    var userData = { user: 'testUser', sessionKey: 'test14' };
    
    var fetchStoreRequest = { 
       bucket: fetchRequest.fetch.bucket, 
       action: 'refresh',
       primaryKey: fetchRequest.fetch.primaryKey,
       userData: 'testUser_test14',
       conditions: fetchRequest.fetch.conditions, 
       parameters: fetchRequest.fetch.parameters,
       properties: fetchRequest.fetch.properties,
       relations: fetchRequest.fetch.relations 
    };
    
    it('onFetch callback test', function(){
      //   onFetch: function(message,userData,callback){
      spyOn(Server,'onFetch');
      var callback = jasmine.createSpy();
      Server.onFetch.mostRecentCall.args[0](fetchStoreRequest);
      expect(callback).toHaveBeenCalledWith(fetchStoreRequest);
    });
    
  });
  
  
  
  
});

/*
it('should test async call') {
  spyOn(Klass, 'asyncMethod');
  var callback = jasmine.createSpy();

  Klass.asyncMethod(callback);
  expect(callback).not.toHaveBeenCalled();

  var someResponseData = 'foo';
  Klass.asyncMethod.mostRecentCall.args[0](someResponseData);
  expect(callback).toHaveBeenCalledWith(someResponseData);

});
*/