/*
module to create a central spot to create all kinds of API calls,
such as storeRequest creation and the creation of API calls
*/
var Tools = require('./Tools');
var Constants = require('./Constants');

exports.getPrimaryKey = function(storeRequest){
  var ret,
      rec = storeRequest.recordData;
  
  ret = storeRequest.primaryKey? storeRequest.primaryKey: null; // if primaryKey defined, use that
  if(rec){   //check if record data in storeRequest
    ret = (!ret && rec.key)? 'key': null;
    ret = (!ret && rec.id)? 'id': null;
  }
  //still null?, return key
  return ret || 'key';
};

exports.createAPIRequest = function(storeRequest,action){
  
  var ret;
  var baseReq = {
    bucket: Tools.copy(storeRequest.bucket),
    primaryKey: Tools.copy(storeRequest.primaryKey),
    properties: Tools.copy(storeRequest.properties),
    relations: Tools.copy(storeRequest.relations),
    returnData: Tools.copy(storeRequest.returnData)
  };
  
  switch(action){
    case Constants.ACTION_FETCH: 
      baseReq.conditions = Tools.copy(storeRequest.conditions);
      baseReq.parameters = Tools.copy(storeRequest.parameters);
      ret = { fetch: baseReq };
      break;
    case Constants.ACTION_REFRESH: 
      baseReq.key = Tools.copy(storeRequest.key);
      ret = { refreshRecord: baseReq };
      break;
    case Constants.ACTION_CREATE: 
      baseReq.key = Tools.copy(storeRequest.key);
      baseReq.record = Tools.copy(storeRequest.recordData);
      ret = { createRecord: baseReq };
      break;
    case Constants.ACTION_UPDATE: 
      baseReq.key = Tools.copy(storeRequest.key);
      baseReq.record = Tools.copy(storeRequest.recordData);
      ret = { updateRecord: baseReq };
      break;      
    case Constants.ACTION_DELETE: 
      baseReq.key = Tools.copy(storeRequest.key);
      baseReq.record = Tools.copy(storeRequest.recordData);
      ret = { deleteRecord: baseReq };
      break;
  }
  return ret;
};

exports.createStoreRequest = function(APIRequest,userData,action){
  var ret = {
    bucket: Tools.copy(APIRequest.bucket),
    primaryKey: Tools.copy(APIRequest.primaryKey),
    action: action,
    userData: Tools.copy(userData),
    properties: Tools.copy(APIRequest.properties),
    relations: Tools.copy(APIRequest.relations)
  };
  
  switch(action){
    case Constants.ACTION_FETCH: 
      ret.conditions = Tools.copy(APIRequest.conditions);
      ret.parameters = Tools.copy(APIRequest.parameters);
      break;
    case Constants.ACTION_REFRESH: 
      ret.key = APIRequest.key;
      break;
    case Constants.ACTION_CREATE: 
      ret.key = Tools.copy(APIRequest.key);
      ret.recordData = Tools.copy(APIRequest.record);
      break;
    case Constants.ACTION_UPDATE: 
      ret.key = Tools.copy(APIRequest.key);
      ret.recordData = Tools.copy(APIRequest.record);
      break;
    case Constants.ACTION_DELETE: 
      ret.key = Tools.copy(APIRequest.key);
      ret.recordData = Tools.copy(APIRequest.record);
      break;
  }
  return ret;
};

/*
fetchResult: { 
   bucket: fetchinfo.bucket, 
   records: records, 
   returnData: fetchinfo.returnData
}

var ret = { refreshRecordResult: { bucket: refreshRec.bucket, key: rec.key, record: rec, returnData: refreshRec.returnData } };
{createRecordResult: {record: rec, returnData: createRec.returnData}}
{deleteRecordResult: { bucket: bucket, key: key, record: record, returnData: deleteRec.returnData}}
{updateRecordResult: {record: record, returnData: updateRec.returnData}}
*/

exports.createDataReply = function(storeRequest,action,data){ // data = object with either recordData in it or a relationSet
  var baseReply = {};
  var ret = {};
  
  if(!data) return null; // no data reply without data
  if(!data.recordData && !data.relationSet) return null; // force a proper data obj
  
  if(data.recordData) baseReply.bucket = storeRequest.bucket;
  if(data.relationSet) baseReply.relationSet = data.relationSet;
  
  baseReply.returnData = storeRequest.returnData; // always assign returnData

  switch(action){
    case Constants.ACTION_FETCH:
      baseReply.records = data.recordData;
      ret.fetchResult = baseReply;
      break;
    case Constants.ACTION_REFRESH:
      baseReply.key = storeRequest.key;
      baseReply.record = data.recordData;
      ret.refreshRecordResult = baseReply;
      break;
    case Constants.ACTION_CREATE:
      baseReply.record = data.recordData;
      ret.createRecordResult = baseReply;
      break;
    case Constants.ACTION_DELETE: 
      baseReply.key = storeRequest.key;
      baseReply.record = data.recordData;
      ret.deleteRecordResult = baseReply;
      break;
    case Constants.ACTION_UPDATE: 
      baseReply.record = data.recordData;
      ret.updateRecordResult = baseReply;
      break;
  }
  return ret;
};

exports.createErrorReply = function(action,error,returnData){
  var ret, msg;
  
  switch(error){
    case Constants.ERROR_DENIEDONPOLICY: msg = 'Denied on policy'; break;
    case Constants.ERROR_DATAINCONSISTENCY: msg = "Inconsistency in request"; break;
    default: msg = "Undefined error";
  }
  
  switch(action){
    case Constants.ACTION_FETCH: 
      ret = { fetchError: { errorCode: error, message: msg, returnData: returnData }}; 
      break;
    case Constants.ACTION_REFRESH: 
      ret = { refreshRecordError: { errorCode: error, message: msg, returnData: returnData }}; 
      break;
    case Constants.ACTION_CREATE: 
      ret = { createRecordError: { errorCode: error, message: msg, returnData: returnData }}; 
      break;
    case Constants.ACTION_DELETE: 
      ret = { deleteRecordError: { errorCode: error, message: msg, returnData: returnData }};
      break;
    case Constants.ACTION_UPDATE: 
      ret = { updateRecordError: { errorCode: error, message: msg, returnData: returnData }}; 
      break;
    default: 
      ret = { undefinedError: { errorCode: error, message: msg, returnData: returnData }};//whoops?
  }
  return ret;
};