// Data for storeRequests
var fakeModel = require('./Model').modelData;
var returnData = require('./APIRequests').returnData;


var userData = { user: 'testUser', sessionKey: 'test14' };

exports.userData = userData;

exports.fetchStoreRequest = { 
   bucket: fakeModel.bucket, 
   action: 'refresh',
   primaryKey: fakeModel.primaryKey,
   userData: userData,
   conditions: fakeModel.conditions, 
   parameters: fakeModel.parameters,
   properties: fakeModel.properties,
   relations: fakeModel.relations 
};

exports.refreshStoreRequest = { 
   bucket: fakeModel.bucket, 
   primaryKey: fakeModel.primaryKey,
   action: 'refresh',
   userData: userData,
   key: fakeModel.key,
   properties: fakeModel.properties,
   relations: fakeModel.relations
};

exports.createStoreRequest = { 
   bucket: fakeModel.bucket, 
   key: fakeModel.key,
   primaryKey: fakeModel.primaryKey,
   action: 'create',
   userData: userData,
   recordData: fakeModel.record,
   properties: fakeModel.properties,
   relations: fakeModel.relations
};

exports.updateStoreRequest = { 
   bucket: fakeModel.bucket, 
   key: fakeModel.key,
   primaryKey: fakeModel.primaryKey,
   action: 'update',
   userData: userData,
   recordData: fakeModel.record,
   properties: fakeModel.properties,
   relations: fakeModel.relations
};  

exports.deleteStoreRequest = { 
   bucket: fakeModel.bucket, 
   key: fakeModel.key,
   primaryKey: fakeModel.primaryKey,
   action: 'destroy',
   userData: userData,
   recordData: fakeModel.record,
   properties: fakeModel.properties,
   relations: fakeModel.relations
};