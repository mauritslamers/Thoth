/*
module to create a central spot to create all kinds of API calls,
such as storeRequest creation and the creation of API calls
*/
var Tools = require('./Tools');
var Constants = require('./Constants');
var sys = require('sys');

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
	var baseReq = {
		bucket: Tools.copy(storeRequest.bucket),
		primaryKey: Tools.copy(storeRequest.primaryKey),
		properties: Tools.copy(storeRequest.properties),
		relations: Tools.copy(storeRequest.relations),
		application: Tools.copy(storeRequest.application), // unsure whether this is needed in the API call
		returnData: Tools.copy(returnData) // not needed in all cases, such as distribution
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
		keys: Tools.copy(APIRequest.keys),
		primaryKey: Tools.copy(APIRequest.primaryKey),
		action: action,
		userData: Tools.copy(userData),
		properties: Tools.copy(APIRequest.properties),
		relations: Tools.copy(APIRequest.relations),
		computedProperties: Tools.copy(APIRequest.computedProperties),
		application: Tools.copy(APIRequest.application)
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

exports.createAuthReply = function(role,sessionKey,message){
	var ret = {};
	if(sessionKey){ //success
		ret = { authSuccess: { role: role, sessionCookie: sessionKey}};
	}
	else {
		//no success
		ret = { authFailure: { message: message }};
	}
	

};

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