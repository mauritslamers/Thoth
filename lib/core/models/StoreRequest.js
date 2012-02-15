var tools = require("../Tools");
var Request = require('./Request').Request;
var Relation = require('./Relation').Relation;
var C = require('../Constants');

var StoreRequest = Request.extend({
  
  specialFields: {
    'relations': Relation
  },
  
  requestType: null, // what type of request this storeRequest belongs to
  
  userData: null, // the userData of the client requesting the request,
  
  callback: null, // the callback function
  
  clientId: function(){
    var userData = this.get('userData');
    if(userData) return [userData.user,userData.sessionKey].join("_");
  }.property('userData'),
  
  init: function(){
    var API = require("../API");
    if(!this.requestType) throw new Error("A store Request should be inited with a request type");
    this.schema = API.APISCHEMAS[this.requestType];
    if(!this.schema) throw new Error("The store request couldn't init because the request type is invalid");
    arguments.callee.base.apply(this,arguments);
    // now init the relations as SC objects in place
    // if(this.relations && this.relations instanceof Array){
    //   this.relations = this.relations.map(function(r){
    //     return Relation.create(r);
    //   });
    // }
  },
  
  //compatibility
  recordData: function(){
    return this.get('record'); 
  }.property(),
  
  isConsistent: function(){
    var primKey = this.get('primaryKey');
    var record = this.get('record');
    var key = this.get('key');
    if(this.requestType === C.ACTION_FETCH) return true; // in fetch there is nothing to check
    if(this.requestType === C.ACTION_REFRESH) return true; // refresh can be done without the record present
    if(primKey && record && (record[primKey] === key)) return true;
    else return false;
  }.property(),
  
  benchmarkKey: function(){
    var userData = this.userData;
    var bucket = this.bucket || this.resource;
    var ret = "";
    if(userData) ret = [userData.user,userData.sessionKey,bucket].join("_");
    else ret = new Date().getTime(); // get time stamp instead.
    return ret;
  }.property().cacheable()
  
});

StoreRequest.from = function(APIrequest,userData,callback){
  var data = APIrequest.get('json'); 
  //tools.log("converting APIrequest to StoreRequest, json is:  " + tools.inspect(data));
  var ret = StoreRequest.create(data, { 
    requestType: APIrequest.get('requestType'),
    userData: userData, 
    callback: callback });
  if(ret.get('isConsistent')) return ret; 
  else tools.log('Not returning store request, because it is inconsistent!!!');
};

exports.StoreRequest = StoreRequest;


/*
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


exports.hasInconsistency = function(storeRequest,store){
	var primKey = getPrimaryKey(storeRequest,store),
	rec = storeRequest.recordData;
	// we just have to check whether the storeRequest.key value and the records data primaryKey match

	if(!rec) return NO; // no use checking when no record is in the request

	if(storeRequest.key !== rec[primKey]) return YES;
	else return NO;
};
*/