// Requests as they occur from ThothSC towards Thoth and from Thoth towards ThothSC

var modelData = require('./Model');
var fakeModel = modelData.consistentModelData;
var returnData = { returnKey: 'test14' }; 
var Constants = require('../../lib/core/Constants');
var Tools = require('../../lib/core/Tools');

exports.returnData = returnData;

exports.createAPIRequest = function(action,inconsistencyFlag){
  var model = inconsistencyFlag? modelData.inconsistentModelData: modelData.consistentModelData;
  var ret;
  var baseReq = {
    bucket: Tools.copy(model.bucket),
    primaryKey: Tools.copy(model.primaryKey),
    properties: Tools.copy(model.properties),
    relations: Tools.copy(model.relations),
    returnData: Tools.copy(returnData)
  }
  
  switch(action){
    case Constants.ACTION_FETCH: 
      baseReq.conditions = Tools.copy(model.conditions);
      baseReq.parameters = Tools.copy(model.parameters);
      ret = { fetch: baseReq };
      break;
    case Constants.ACTION_REFRESH: 
      baseReq.key = Tools.copy(model.key);
      ret = { refreshRecord: baseReq };
      break;
    case Constants.ACTION_CREATE: 
      baseReq.key = Tools.copy(model.key);
      baseReq.record = Tools.copy(model.record);
      ret = { createRecord: baseReq };
      break;
    case Constants.ACTION_UPDATE: 
      baseReq.key = Tools.copy(model.key);
      baseReq.record = Tools.copy(model.record);
      ret = { updateRecord: baseReq };
      break;      
    case Constants.ACTION_DELETE: 
      baseReq.key = Tools.copy(model.key);
      baseReq.record = Tools.copy(model.record);
      ret = { deleteRecord: baseReq };
      break;
  }
  
  return ret;
}
