/*
The action creators mixin contains the different actions performed by the server.
The reason is for these creators that we want to close over a few things and we want a single place 
where we can do interaction with the policies if needed. 
*/                                                      

var API = require('../API'),
		C = require('../Constants'),
		sys = require('../Tools').sys;

var StoreActionCreators = {
	
	createStoreAction: function(APIRequest,userData,callback){
		
		var AR = APIRequest, UD = userData,
				CB = callback, ret;
		
		switch(AR.get('requestType')){ // was SR.action
			case C.ACTION_FETCH: ret = this.fetchActionCreator(AR,UD,CB);  break;
			case C.ACTION_REFRESH: ret = this.refreshActionCreator(AR,UD,CB); break;
			case C.ACTION_CREATE: ret = this.createActionCreator(AR,UD,CB); break;
			case C.ACTION_UPDATE: ret = this.updateActionCreator(AR,UD,CB); break;
			case C.ACTION_DELETE: ret = this.deleteActionCreator(AR,UD,CB);break;
			default: break;
		}
		return ret;
	},
	
	getClientId: function(storeRequest){
		var userData = storeRequest.userData;
		return [userData.user,userData.sessionKey].join("_");
	},	
	
	fetchActionCreator: function(APIRequest,userData,callback){ //,requestType){
		var me = this,
		    AR = APIRequest,
		    storeRequest = API.StoreRequest.from(APIRequest,userData,callback),  		    
				source = storeRequest.get('source'),
				clientId = storeRequest.get('clientId'); 
				
		if(!storeRequest){
		  sys.log('Thoth Fetch Action creator: received an inconsistent request. Dropping...');
		  return;
		}
				
		var sendRecordData = function(records){ 
			// the policy module takes care of handling record arrays, so we can expect an array of 
			// properly adjusted records...
			// store the records and the queryinfo in the clients session (if the conditions are not there, the session function 
			// will automatically convert it into a bucket only query)
			var SR = storeRequest,
					user = SR.userData.user, sK = SR.userData.sessionKey,
					bucket = SR.bucket, conds = SR.conditions, params = SR.parameters,
					ret; 
					
			if(source === C.SOURCE_SOCKETIO){ 
			  me.sessionModule.storeRequestData(SR,records);
			}
			// send off the data
			ret = API.FetchResult.create({ 
			  bucket: bucket,
			  records: records,
			  returnData: AR.get('returnData')
			});
			callback(C.ACTION_FETCH_REPLY, ret);
			
      // ret = { 
      //  fetchResult: { 
      //    bucket: bucket, 
      //    records: records, 
      //    returnData: returnData
      //  }
      // };
      // callback(ret);
		};
    
    var sendRelationSet = function(data){
      var ret = API.RelationResult.from(data,AR.get('returnData'));
      callback(C.ACTION_FETCH_RELATION_REPLY,ret);
    };
    
		var fetchRequest = function(policyResponse){
			if(policyResponse){ // if any of YES or "retry"
				me.store.fetch(storeRequest,clientId,function(data){ 
					/*
					We need to be aware that in case of relations this function is not only called for the record results
					but also called once for every relation.
					The difference is that a normal result is an object { recordResult: [records]}
					and the relations are returned as a { relationSet: { }}
					*/
					// in case the policyResponse is "retry", we need to re-evaluate the policy
					if(data.recordResult){
						if(policyResponse === C.POLICY_REQUEST_RETRY){
							me.policyModule.checkPolicy(storeRequest,data.recordResult,sendRecordData);
						}
						else sendRecordData(data.recordResult);
					}
					if(data.relationSet){
						// in case of a relationSet, don't do policyChecks...
						sendRelationSet(data.relationSet);      
					} // end if(data.relationSet)
				});   
			} // end if(policyResponse)
			else {
				// not allowed
				callback(C.ACTION_FETCH_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY,storeRequest.get('returnData')));
				//callback(API.createErrorReply(C.ACTION_FETCH, C.ERROR_DENIEDONPOLICY,storeRequest.get('returnData')));
			}
		};
		
		return fetchRequest;		
	},
	                                
	
	//refreshActionCreator: function(storeRequest,returnData,callback,requestType){
  refreshActionCreator: function(APIRequest,userData,callback){
		var clientId = APIRequest.get('clientId');
		var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
		var AR = APIRequest,
		    me = this;

		if(!storeRequest){
		  sys.log('Thoth Refresh Action creator: received an inconsistent request. Dropping...');
		  return;
		}

		var sendRecordData = function(rec){
			if(APIRequest.get('source') === C.SOURCE_SOCKETIO){         
				me.sessionModule.storeBucketKey(userData.user,userData.sessionKey, storeRequest.get('bucket'), rec.key);					
			}
			//var ret = { refreshRecordResult: { bucket: storeRequest.bucket, key: rec.key, record: rec, returnData: returnData } };
      var ret = API.RecordReply.from(storeRequest, rec, APIRequest.get('returnData'));
			//callback(ret);
			callback(C.ACTION_REFRESH_REPLY, ret);
		};

		var refreshAction = function(policyResponse){
			if(policyResponse){ // either 'retry' or YES on first attempt
				me.store.refreshRecord(storeRequest,clientId,function(val){ 
					// this function can be called with different results: with record data and with relations
					var ret, relSet;
					if(!val){
					  //callback(API.createErrorReply(C.ACTION_REFRESH,C.ERROR_DBERROR,returnData));
					  callback(C.ACTION_REFRESH_ERROR,API.ErrorReply.from(C.ERROR_DBERROR,AR.get('returnData')));
					  return;
					}
					if(val.refreshResult){
						var rec = val.refreshResult;
						if(policyResponse === C.POLICY_REQUEST_RETRY){
							me.policyModule.checkPolicy(storeRequest,rec,sendRecordData);
						}
						else sendRecordData(rec);
					}
					if(val.relationSet){ 
					  relSet = API.RelationResult.from(val.relationSet,AR.get('returnData'));
						//relSet = (val.relationSet instanceof Array)? val.relationSet: [val.relationSet]; // make it into an array if it isn't one already
						callback(C.ACTION_REFRESH_RELATION_REPLY, relSet);
						//ret = { refreshRecordResult: { relationSet: relSet, returnData: returnData }};
						//callback(ret);
					}
				});
			}
			else {
				//callback(API.createErrorReply(C.ACTION_REFRESH, C.ERROR_DENIEDONPOLICY,returnData));
				callback(C.ACTION_REFRESH_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY,AR.get('returnData')));
			}
		};
		return refreshAction;
	},
	
	//createActionCreator: function(storeRequest,returnData,callback,requestType){
  createActionCreator: function(APIRequest,userData,callback){
		var me = this;
		//var userData = storeRequest.userData;
		//var clientId = this.getClientId(storeRequest);
		var clientId = APIRequest.get('clientId');
		var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
		
		var sendResponse = function(rec){
			if(rec){
				rec = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,rec): rec;
				// first update the original client and then update the others
				//callback({createRecordResult: {record: rec, returnData: returnData}});
				callback(C.ACTION_CREATE_REPLY, API.RecordReply.from(storeRequest,rec));
				                                                                               
				if(APIRequest.get('source') !== C.REQUESTTYPE_REST){ // not cache data with REST
					me.sessionModule.storeBucketKey(userData.user,userData.sessionKey,storeRequest.bucket,storeRequest.key);
				}                                                                                                  
				me.distributeChanges(storeRequest,userData);                      								
			}
			else {
				//sys.log('ACTION_CREATE: Data Inconsistency: response received: ' + rec);
				//callback(API.createErrorReply(C.ACTION_CREATE, C.ERROR_DATAINCONSISTENCY,returnData));
				callback(C.ACTION_CREATE_ERROR, API.ErrorReply.from(C.ERROR_DATAINCONSISTENCY, APIRequest.get('returnData')));
			}
		};
		
		return function(policyResponse){
			if(policyResponse){ // either YES or adjusted record
				var rec = (policyResponse === YES)? storeRequest.get('record'): policyResponse;
				storeRequest.record = rec;
				me.store.createRecord(storeRequest,clientId,sendResponse);
			}
			else { //not allowed
			 // callback(API.createErrorReply(C.ACTION_CREATE, C.ERROR_DENIEDONPOLICY, APIRequest.get('returnData'))); 
			 callback(C.ACTION_CREATE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, APIRequest.get('returnData')));
			}     
		};
	},
	
	//updateActionCreator: function(storeRequest, returnData, callback, requestType){
	updateActionCreator: function(APIRequest,userData,callback){  
		var me = this, clientId;
		//var clientId = this.getClientId(storeRequest);
    var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
    
    if(!storeRequest) return;
    clientId = storeRequest.get('clientId');
		
		var sendResponse = function(record){
       if(record){
        record = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,record): record;
        // the relation set is already on the record
        //var ret = {updateRecordResult: {record: record, returnData: returnData}};
        var ret = API.RecordReply.from(storeRequest,record,APIRequest.get('returnData'));
        sys.log('ThothServer: sending updateRecordResult: ' + JSON.stringify(ret));
        callback(C.ACTION_UPDATE_REPLY, ret); 
				//no need to save information on user cache? perhaps not, as ids won't change easily...
				me.distributeChanges(storeRequest,storeRequest.userData);					
      }
      else {
        //callback(API.createErrorReply(C.ACTION_UPDATE, C.ERROR_DATAINCONSISTENCY,returnData));
        callback(C.ACTION_UPDATE_ERROR, API.ErrorReply.from(C.ERROR_DATAINCONSISTENCY, APIRequest.get('returnData')));
      }
    };
		
		return function(policyResponse){
       if(policyResponse){
          me.store.updateRecord(storeRequest,clientId,sendResponse);                         
       }
       else {
          // we need to do something about this callback issue
          //callback(API.createErrorReply(C.ACTION_UPDATE, C.ERROR_DENIEDONPOLICY,returnData));
          callback(C.ACTION_UPDATE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, APIRequest.get('returnData')));
       }
    };
	},

  deleteActionCreator: function(APIRequest,userData,callback){	
	//deleteActionCreator: function(storeRequest, returnData, callback, requestType){
		var me = this, clientId,
        // bucket = storeRequest.bucket,
        // clientId = this.getClientId(storeRequest),
        // record = storeRequest.recordData,
        // userData = storeRequest.userData,
        // key = storeRequest.key;
        storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
				                                                                   
		if(!storeRequest) return;		
		clientId = storeRequest.get('clientId');
		var destroyAction = function(policyResponse){
			if(policyResponse){
				me.store.deleteRecord(storeRequest, clientId, function(val){
					me.sessionModule.deleteBucketKey(userData.user,userData.sessionKey,APIRequest.get('bucket'),APIRequest.get('key'));
					//callback({deleteRecordResult: { bucket: bucket, key: key, record: record, returnData: returnData}});
					callback(C.ACTION_DELETE_REPLY, API.RecordReply.from(storeRequest));
					me.distributeChanges(storeRequest,storeRequest.userData);
				});
			}
			else {
				//callback(API.createErrorReply(C.ACTION_DELETE, C.ERROR_DENIEDONPOLICY,returnData));
				callback(C.ACTION_DELETE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, APIRequest.get('returnData')));
			}
    };

		return destroyAction;
	}
	
		
};

exports.StoreActionCreators = StoreActionCreators;

