var tools = require("../Tools");
var Request = require('./Request').Request;
var Relation = require('./Relation').Relation;
var StoreRequest = require('./StoreRequest').StoreRequest;
var C = require('../Constants');

var APIRequest = Request.extend({
  
  specialFields: {
    'relations': Relation
  },
  
  requestType: null,
  
  source: null, // where does this request originate, REST or somewhere else?
  
  init: function(){
    var API = require("../API");
    if(!this.requestType) throw new Error("An API Request should be inited with a request type");
    this.schema = API.APISCHEMAS[this.requestType];
    if(!this.schema) throw new Error("The API request couldn't init because the request type is invalid");
    if(!this.source) throw new Error("An API request should always have a source");
    
    arguments.callee.base.apply(this,arguments);
  },
  
  isConsistent: function(){
    var primKey = this.get('primaryKey');
    var record = this.get('record');
    var key = this.get('key');
    if(this.requestType === C.ACTION_FETCH) return true; // in fetch there is nothing to check
    if(this.requestType === C.ACTION_REFRESH) return true; // refresh can be done without the record present
    if(primKey && record && (record[primKey] === key)) return true;
    else return false;
  }.property()
  
  // _eventFor: function(action){
  //    switch(action){
  //      case C.ACTION_FETCH:          return 'fetch';
  //      case C.ACTION_REFRESH:        return 'refreshRecord';
  //      case C.ACTION_CREATE:         return 'createRecord';
  //      case C.ACTION_UPDATE:         return 'updateRecord';
  //      case C.ACTION_DELETE:         return 'deleteRecord';
  //      //case C.ACTION_RPC = 'rpc';
  //      case C.ACTION_FETCH_REPLY:    return "fetchResult";
  //      case C.ACTION_REFRESH_REPLY:  return 'refreshRecordResult';
  //      case C.ACTION_CREATE_REPLY:   return 'createRecordResult';
  //      case C.ACTION_UPDATE_REPLY:   return 'updateRecordResult';
  //      case C.ACTION_DELETE_REPLY:   return 'deleteRecordResult';
  //      case C.ACTION_FETCH_ERROR:    return 'fetchError';
  //      case C.ACTION_REFRESH_ERROR:  return 'refreshRecordError';
  //      case C.ACTION_CREATE_ERROR:   return 'createRecordError';
  //      case C.ACTION_UPDATE_ERROR:   return 'updateRecordError';
  //      case C.ACTION_DELETE_ERROR:   return 'deleteRecordError';
  //      default: return "ERROR";
  //    }
  //  },          
  
  // json: function(){
  //   var basic = arguments.callee.base.apply(this,arguments); // get the original json function 
  //   // this is probably not needed
  //   // var type = this.get('requestType');
  //   // var evt = this._eventFor(type);
  //   // var ret = {};
  //   // ret[evt] = basic;
  //   // return ret;
  // }.property() 
  
});


// create an API request from an object, either JSON or a StoreRequest

APIRequest.from = function(obj,source,requestType,skipJSVTest){  
  var json, schema,res,ret,      
      API = require("../API"),
      jsvEnv = API.JSVEnv;
  
  if(obj){
    json = (obj.instanceOf && obj.instanceOf(StoreRequest))? obj.get('json'): obj; 
    if(obj.instanceOf && obj.instanceOf(StoreRequest)){
      if(!requestType) requestType = obj.get('requestType'); // get from SR 
    }
    if((obj.instanceOf && obj.instanceOf(StoreRequest)) || skipJSVTest){
       ret = APIRequest.create(json, { source: source, requestType: requestType });
    }
    else {
      schema = API.APISCHEMAS[requestType]; 
      res = jsvEnv.validate(json,schema);
      if(res.valid){        
        ret = APIRequest.create(json, { source: source, requestType: requestType });
      }
      else {
        tools.log('request failed schema: ' + tools.inspect(res.errors));
      }            
    }  
  }
  else tools.log('APIRequest#from: no valid object given');
  return ret;
};

exports.APIRequest = APIRequest;
/*
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
*/