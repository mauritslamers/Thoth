// Data for storeRequests
var modelData = require('./Model');
var returnData = require('./APIRequests').returnData;
var Constants = require('../../lib/core/Constants');
var Tools = require('../../lib/core/Tools');

var userData = { user: 'testUser', sessionKey: 'test14' };

exports.userData = userData;

exports.createStoreRequest = function(action,inconsistencyFlag){
  var model = inconsistencyFlag? modelData.inconsistentModelData: modelData.consistentModelData;
  var ret = {
    bucket: Tools.copy(model.bucket),
    primaryKey: Tools.copy(model.primaryKey),
    action: action,
    userData: Tools.copy(userData),
    properties: Tools.copy(model.properties),
    relations: Tools.copy(model.relations)
  }
  
  switch(action){
    case Constants.ACTION_FETCH: 
      ret.conditions = Tools.copy(model.conditions);
      ret.parameters = Tools.copy(model.parameters);
      break;
    case Constants.ACTION_REFRESH: 
      ret.key = model.key;
      break;
    case Constants.ACTION_CREATE: 
      ret.key = Tools.copy(model.key);
      ret.recordData = Tools.copy(model.record);
      break;
    case Constants.ACTION_UPDATE: 
      ret.key = Tools.copy(model.key);
      ret.recordData = Tools.copy(model.record);
      break;
    case Constants.ACTION_DELETE: 
      ret.key = Tools.copy(model.key);
      ret.recordData = Tools.copy(model.record);
      break;
  }
  return ret;
};
