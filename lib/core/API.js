/*
module to create a central spot to create all kinds of API calls,
such as storeRequest creation and the creation of API calls
*/
var Tools = require('./Tools');
var Constants = require('./Constants');
var sys = Tools.sys;
var JSV = require('JSV').JSV;

exports.FlexObject = require('./models/FlexObject').FlexObject;
exports.Property = require('./models/Property').Property;
exports.Relation = require('./models/Relation').Relation;
exports.Request = require('./models/Request').Request;
exports.APIRequest = require('./models/APIRequest').APIRequest;
exports.StoreRequest = require('./models/StoreRequest').StoreRequest;
exports.FetchResult = require('./models/FetchResult').FetchResult;
exports.FetchRelationResult = require('./models/FetchRelationResult').FetchRelationResult;   
exports.ErrorReply = require('./models/ErrorReply').ErrorReply;

var getPrimaryKey = function(storeRequest,store){
	var ret, 
	sR = storeRequest || {},
	rec = sR.recordData;

	ret = sR.primaryKey? sR.primaryKey: null; // if primaryKey defined, use that
	if(rec){   //check if record data in storeRequest
		if(!ret && rec.key) ret = 'key';
		if(!ret && rec.id) ret = 'id';
	}

	//still null, check the caller of this function for a primaryKey property (useful for stores)
	if(store && store.primaryKey) ret = store.primaryKey;

	//still null?, return key
	if(!ret) ret = 'key';

	return ret;
};

exports.getPrimaryKey = getPrimaryKey;

exports.createAPIRequest = function(storeRequest,action,returnData){

	var ret;
	
	// application is not really needed in the API call, return data is only needed in non-distro API requests
	var baseProps = 'bucket primaryKey revision properties relations application returnData'.w(); 
	var CUDProps = 'key record'.w();
	var baseReq = Tools.copyProperties(baseProps,storeRequest,{});
	
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
  
  var baseProps = 'bucket primaryKey revision properties relations computedProperties application combineReturnCalls options'.w();
  var CUDProps = 'key recordData'.w();
  var ret = Tools.copyProperties(baseProps,APIRequest,{});
  ret.action = action;
  ret.userData = userData;

	switch(action){
		case Constants.ACTION_FETCH: 
  		ret.keys = Tools.copy(APIRequest.keys);
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

// function to check whether the store request contains inconsistencies
// It is expected that this function will be updated as the API grows
exports.hasInconsistency = function(storeRequest,store){
	var primKey = getPrimaryKey(storeRequest,store),
	rec = storeRequest.recordData;
	// we just have to check whether the storeRequest.key value and the records data primaryKey match

	if(!rec) return NO; // no use checking when no record is in the request

	if(storeRequest.key !== rec[primKey]) return YES;
	else return NO;
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
	var CRUDprops = "key revision".w();

	if(!data) return null; // no data reply without data
	if(!data.recordData && !data.relationSet) return null; // force a proper data obj

	if(data.recordData) baseReply.bucket = Tools.copy(storeRequest.bucket);
	if(data.relationSet) baseReply.relationSet = Tools.copy(data.relationSet);

	baseReply.returnData = Tools.copy(storeRequest.returnData); // always assign returnData
	

	switch(action){
		case Constants.ACTION_FETCH:
  		baseReply.records = data.recordData;
  		ret.fetchResult = baseReply;
		  break;
		case Constants.ACTION_REFRESH:
		  baseReply = Tools.copyProperties(CRUDprops,storeRequest,baseReply);
		  baseReply.record = data.recordData;
		  ret.refreshRecordResult = baseReply;
		  break;
		case Constants.ACTION_CREATE:
		  baseReply = Tools.copyProperties(CRUDprops,storeRequest,baseReply);
		  baseReply.record = data.recordData;
		  ret.createRecordResult = baseReply;
		  break;
		case Constants.ACTION_DELETE: 
		  baseReply = Tools.copyProperties(CRUDprops,storeRequest,baseReply);
		  baseReply.record = data.recordData;
		  ret.deleteRecordResult = baseReply;
		  break;
		case Constants.ACTION_UPDATE: 
      baseReply = Tools.copyProperties(CRUDprops,storeRequest,baseReply);
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
		case Constants.ERROR_RPCNOTLOADED: msg = "RPC module not loaded"; break;
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
		case Constants.ACTION_RPC:
		  ret = { rpcError: { errorCode: error, message: msg, returnData: returnData }}; 
		  break;
		default: 
			ret = { undefinedError: { errorCode: error, message: msg, returnData: returnData }};//whoops?
	}
	return ret;
};

exports.createAuthReply = function(role,sessionKey,message){
	var ret = {};
	if(sessionKey){ //success
		ret = { authSuccess: { role: role, sessionKey: sessionKey}};
	}
	else {
		//no success
		ret = { authFailure: { message: message }};
	}
	return ret;
};

// ====
// Schema definitions
// ====

//first sub schemas for properties and relations

// the schema can use extends to prevent having to define so many schemas

var propertySchema = {
  "type":"object",
  "properties": {
    "key": { "type":"string", "required":true},
    "type": {"type":"string","required":true}
  }
};

var relationSchema = {
  "type":"object",
  "properties": {
    "type":{"type":"string","required":true}, // also define an enum
    "isNested": {"type":"boolean","required":false},
    "isChildRecord": {"type":"boolean","required":false},
    "isDirectRelation": {"type":"boolean","required":false},
    "isMaster": {"type":"boolean","required":true},
    "orderBy": {"type":"string","required":false},
    "bucket": {"type":"string","required":true},
    "primaryKey": {"type":"string","required":true},
    "propertyName": {"type":"string","required": true}
  }
};

var computedPropertiesSchema = {
  "type":"object",
  "properties":{
    "computation":{"type":"string","required":true},
    "dependencies":{"type":"array","required":false, "items": {"type":"string"} }
  }
};

// now schemas for the different API requests

var baseAPIRequest =  {
  "type":"object",
  //"additionalProperties": false, // don't allow for extra unknown properties
  "properties": {
    "bucket": { "type":"string", "required": true },
    "primaryKey": { "type":"string", "required":false},
    "application": {"type":"string","required":false},
    "combineReturnCalls": {"type":"boolean","required":false},
    "returnData": {"type":"object","required":false}, 
    "properties": {
      "type":"array",
      "required":false,
      "items": propertySchema
    },
    "relations": {
      "type":"array",
      "required":false,
      "items": relationSchema
    },
    "computedProperties":{
      "type":"array",
      "required":false,
      "items":computedPropertiesSchema
    }    
  }
};

// Fetch

var APIFetchRequest = {
  "type":"object",
  "extends":baseAPIRequest,
  //"additionalProperties": false, // don't allow for extra unknown properties
  "properties": {
    "keys": { "type": ["null","array"], "required":false }, // in case of a retrieveRecords,
    "conditions": {"type":["null","string"], "required":false }, // dependencies?
    "parameters": {"type":"object", "required":false}
  }
};

// retrieveRecord
var APIRetrieveRecordRequest = {
  "type":"object",
  "extends":baseAPIRequest,
  "properties": {
    "key": { "type": ["string","number","null"], "required": true },
    "revision": {"type":["string","number","null"], "required":false }
  }
};

// createRecord
var APICreateRecordRequest = {
  "type":"object",
  "extends":baseAPIRequest,
  "properties": {
    "key": { "type": ["string","number","null"], "required": true },
    "revision": {"type":["string","number","null"], "required":false },
    "record": {"type":"object", "required":true } // no createRecord request without a record body
  }
};

// updateRecord
var APIUpdateRecordRequest = {
  "type":"object",
  "extends":baseAPIRequest,
  "properties": {
    "key": { "type": ["string","number","null"], "required": true },
    "revision": {"type":["string","number","null"], "required":false },
    "record": {"type":"object", "required":true } // no updateRecord request without a record body
  }
};

// deleteRecord
var APIDeleteRecordRequest = {
  "type":"object",
  "extends":baseAPIRequest,
  "properties": {
    "key": { "type": ["string","number","null"], "required": true },
    "revision": {"type":["string","number","null"], "required":false }
  }
};

// there will probably also need to be some API schema definitions for the different responses
var APIFetchResult = {
  "type":"object",
  "properties": {
    "bucket": { "type":"string", "required":true },
    "records": { "type":"array", "required":true },
    "returnData": { "type":"object", "required":true }
  }
};

var APIFetchRelationResult = {
  "type":"object",
  "properties": {
    "relationSet": {
      "type":"array", 
      "items": {
        "bucket": {"type":"string", "required": true },
        "keys": {"type": ["array","string","number"] },
        "propertyName": {"type":"string"},
        "data": {"type":"object"}
      }
    },
    "returnData": {"type":"object"}
  }
};
//var API      

var APIErrorReply = {
  "type":"object",
  "properties": {
    "errorCode": { "type":"number", "required": true },
    "message": { "type":"string", "required": true},
    "returnData": {"type":"object"} 
  }
};

/// Gather everything:

var APISCHEMAS = {};
APISCHEMAS[Constants.ACTION_FETCH] = APIFetchRequest;
APISCHEMAS[Constants.ACTION_REFRESH] = APIRetrieveRecordRequest;
APISCHEMAS[Constants.ACTION_CREATE] = APICreateRecordRequest;
APISCHEMAS[Constants.ACTION_UPDATE] = APIUpdateRecordRequest;
APISCHEMAS[Constants.ACTION_DELETE] = APIDeleteRecordRequest;
APISCHEMAS[Constants.ACTION_FETCH_REPLY] = APIFetchResult;
APISCHEMAS[Constants.ACTION_FETCH_RELATION_REPLY] = APIFetchRelationResult;
APISCHEMAS[Constants.ACTION_ERROR_REPLY] = APIErrorReply;

exports.APISCHEMAS = APISCHEMAS;

exports.APISUBSCHEMAS = {
  property: propertySchema,
  relation: relationSchema 
};

exports.JSV = JSV;

/*
DATA requests:
{ refreshRecord: { bucket: '', key: '', returnData: {} }} 
{ fetch: { bucket: '', conditions: '', parameters: {}, returnData: {} }}
{ createRecord: { bucket: '', record: {}, returnData: {} }}
{ updateRecord: { bucket: '', key: '', record: {}, returnData: {} }}
{ deleteRecord: { bucket: '', key: '', returnData: {} }}

{ logout: { user: '' }}
// the fetch call has the option of passing the conditions and parameters of a query
// records will be filtered based on it

// most properties are self explanatory, but returnData needs some explanation on its own.
// return data is an object that can be delivered along side the request and which is
// returned by the server in the answer to that request. This helps the client side identifying 
// what request was answered exactly.

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

errorCodes: (defined in lib/core/Constants.js)
0 - Access denied on policy
1 - Action denied on data inconsistency

*/

/*
While working on the data source it turns out that doing all the relations on the client side makes things very 
complicated. Still it feels wrong to have to define models in two different places. 
So the idea now is to send a relation graph from the client to the server to have the server reply in a few different messages
Of course it is not a complete relation graph, but just a relation graph of a specific model

The fetch request becomes something like this:

{ fetch: { bucket: '', conditions:'', parameters: '', 
relations: [ { propertyName: '', type: 'toOne', isMaster: YES, bucket: '', isChildRecord: YES}, 
            { propertyName: '', type: 'toMany', bucket: '', isChildRecord: NO }]}} // isMaster needs rethink

From this data the server can create a set of messages to be sent to the client
The client can know beforehand how many messages to receive (one for the main record data, and one for each relation)

the answer of the server will be:

- a normal fetchResult
- { fetchResult: { relationSet: [ { bucket: '', keys: [''], propertyName: '', data: {} } ], returnData: { requestKey: ''}}} 
where:
- bucket is the bucket the request belongs to
- keys is the set of keys for which the relation data is contained in data
- propertyname is the name of the toOne or toMany property
- data is the set of keys describing the relation, associative array by key
- requestKey is the key of the original request

*/

/*
the storeRequest is an object with the following layout:
{ bucket: '', 
key: '', // not used by fetch
keys: [], // used by fetch for multiple record retrieval,
primaryKey: '', // the property name containing the primary key for a certain record / model
action: '', // action performed by the request: create, update, refresh, or destroy
client: '', // all client data 
properties: [ { key: '', type: ''}],
conditions: '', // not used by the individual record functions (create,refresh,update,delete)
parameters: {}, // not used by the individual record functions (create,refresh,update,delete)
relations: [ 
{ bucket: '', type: 'toOne', propertyName: '' }, 
{ bucket: '', type: 'toMany', propertyName: ''} 
] 
} */

