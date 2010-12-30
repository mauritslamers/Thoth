// Requests as they occur from ThothSC towards Thoth and from Thoth towards ThothSC

var fakeModel = require('./Model').modelData;
var returnData = { returnKey: 'test14' }; 

exports.returnData = returnData;

exports.fetchRequest = { 
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

exports.refreshRequest = {
  refreshRecord: {
    bucket: fakeModel.bucket,
    key: fakeModel.key,
    primaryKey: fakeModel.primaryKey,
    properties: fakeModel.properties,
    relations: fakeModel.relations,
    returnData: returnData
  }
};

exports.createRequest = {
  createRecord: {
    bucket: fakeModel.bucket,
    key: fakeModel.key,
    primaryKey: fakeModel.primaryKey,
    record: fakeModel.record,
    properties: fakeModel.properties,
    relations: fakeModel.relations,
    returnData: returnData
  }
};

exports.updateRequest = {
  updateRecord: {
    bucket: fakeModel.bucket,
    key: fakeModel.key,
    primaryKey: fakeModel.primaryKey,
    record: fakeModel.record,
    properties: fakeModel.properties,
    relations: fakeModel.relations,
    returnData: returnData
  }
};

exports.deleteRequest = {
  deleteRecord: {
    bucket: fakeModel.bucket,
    key: fakeModel.key,
    primaryKey: fakeModel.primaryKey,
    record: fakeModel.record,
    properties: fakeModel.properties,
    relations: fakeModel.relations,
    returnData: returnData
  }
};