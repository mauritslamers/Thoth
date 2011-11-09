/*
action creators for the different store interactions from Thoth.Server
This stuff will be mixed in with Server, so we can use me = this.
*/
var API = require('../API'),
		Constants = require('../Constants'),
		sys = require('sys');

var StoreActionCreators = {
	
	createStoreAction: function(storeRequest,returnData,callback,requestType){
		
		var SR = storeRequest, RD = returnData,
				CB = callback, RT = requestType, ret;
		
		switch(SR.action){
			case Constants.ACTION_FETCH: ret = this.fetchActionCreator(SR,RD,CB,RT);  break;
			case Constants.ACTION_REFRESH: ret = this.refreshActionCreator(SR,RD,CB,RT); break;
			case Constants.ACTION_CREATE: ret = this.createActionCreator(SR,RD,CB,RT); break;
			case Constants.ACTION_UPDATE: ret = this.updateActionCreator(SR,RD,CB,RT); break;
			case Constants.ACTION_DELETE: ret = this.deleteActionCreator(SR,RD,CB,RT);break;
			default: break;
		}
		return ret;
	},
	
	getClientId: function(storeRequest){
		var userData = storeRequest.userData;
		return [userData.user,userData.sessionKey].join("_");
	},	
	
	fetchActionCreator: function(storeRequest,returnData,callback,requestType){
		var me = this,
				clientId  = this.getClientId(storeRequest);
				
		var sendRecordData = function(records){ 
			// the policy module takes care of handling record arrays, so we can expect an array of 
			// properly adjusted records...
			// store the records and the queryinfo in the clients session (if the conditions are not there, the session function 
			// will automatically convert it into a bucket only query)
			var SR = storeRequest,
					user = SR.userData.user, sK = SR.userData.sessionKey,
					bucket = SR.bucket, conds = SR.conditions, params = SR.parameters,
					ret;
			if(requestType !== Constants.REQUESTTYPE_REST){
				me.sessionModule.storeRecords(user,sK,bucket,SR.primaryKey,records);
				me.sessionModule.storeQuery(user,sK,bucket,conds,params);				
			}
			// send off the data
			//=sys.log('Sending dataset for bucket ' + bucket);
			ret = { 
				fetchResult: { 
					bucket: bucket, 
					records: records, 
					returnData: returnData
				}
			};
			callback(ret);
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
						if(policyResponse === Constants.POLICY_REQUEST_RETRY){
							me.policyModule.checkPolicy(storeRequest,data.recordResult,sendRecordData);
						}
						else {
							sendRecordData(data.recordResult);
						}
					}
					if(data.relationSet){
						// in case of a relationSet, don't do policyChecks...
						// if the policyChecks are implemented properly even the ids of the records couldn't lead to  leaking data
						sys.log('Sending relationset for bucket ' + storeRequest.bucket);
						callback({
							fetchResult: {
								relationSet: [ data.relationSet ],
								returnData: returnData
							}
						});
					} // end if(data.relationSet)
				});   
			} // end if(policyResponse)
			else {
				// not allowed
				callback(API.createErrorReply(Constants.ACTION_FETCH, Constants.ERROR_DENIEDONPOLICY,returnData));
			}
		};
		
		return fetchRequest;		
	},
	
	refreshActionCreator: function(storeRequest,returnData,callback,requestType){
		var clientId = this.getClientId(storeRequest);
		var userData = storeRequest.userData;
		var me = this;

		var sendRecordData = function(rec){
			if(!requestType === Constants.REQUESTTYPE_REST){
				me.sessionModule.storeBucketKey(userData.user,userData.sessionKey, storeRequest.bucket, rec.key);					
			}
			var ret = { refreshRecordResult: { bucket: storeRequest.bucket, key: rec.key, record: rec, returnData: returnData } };
			callback(ret);
		};

		var refreshAction = function(policyResponse){
			if(policyResponse){ // either 'retry' or YES on first attempt
				me.store.refreshRecord(storeRequest,clientId,function(val){ 
					// this function can be called with different results: with record data and with relations
					var ret, relSet;
					if(!val){
					  callback(API.createErrorReply(Constants.ACTION_REFRESH,Constants.ERROR_DBERROR,returnData));
					  return;
					}
					if(val.refreshResult){
						var rec = val.refreshResult;
						if(policyResponse === Constants.POLICY_REQUEST_RETRY){
							me.policyModule.checkPolicy(storeRequest,rec,sendRecordData);
						}
						else {
							sendRecordData(rec);
						}
					}
					if(val.relationSet){
						relSet = (val.relationSet instanceof Array)? val.relationSet: [val.relationSet]; // make it into an array if it isn't one already
						ret = { refreshRecordResult: { relationSet: relSet, returnData: returnData }};
						callback(ret);
					}
				});
			}
			else {
				callback(API.createErrorReply(Constants.ACTION_REFRESH, Constants.ERROR_DENIEDONPOLICY,returnData));
			}
		};
		return refreshAction;
	},
	
	createActionCreator: function(storeRequest,returnData,callback,requestType){
		var me = this;
		var userData = storeRequest.userData;
		var clientId = this.getClientId(storeRequest);
		
		var sendResponse = function(rec){
			if(rec){
				rec = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,rec): rec;
				// first update the original client and then update the others
				callback({createRecordResult: {record: rec, returnData: returnData}});
				if(requestType !== Constants.REQUESTTYPE_REST){ // not cache data with REST
					me.sessionModule.storeBucketKey(userData.user,userData.sessionKey,storeRequest.bucket,storeRequest.key);
				}
				me.distributeChanges(storeRequest,userData);                      								
			}
			else {
				//sys.log('ACTION_CREATE: Data Inconsistency: response received: ' + rec);
				callback(API.createErrorReply(Constants.ACTION_CREATE, Constants.ERROR_DATAINCONSISTENCY,returnData));
			}
		};
		
		return function(policyResponse){
			if(policyResponse){ // either YES or adjusted record
				var rec = (policyResponse === YES)? storeRequest.recordData: policyResponse;
				storeRequest.recordData = rec;
				me.store.createRecord(storeRequest,clientId,sendResponse);
			}
			else { //not allowed
				callback(API.createErrorReply(Constants.ACTION_CREATE, Constants.ERROR_DENIEDONPOLICY, returnData)); 
			}     
		};
	},
	
	updateActionCreator: function(storeRequest, returnData, callback, requestType){
		var me = this;
		var clientId = this.getClientId(storeRequest);
		
		var sendResponse = function(record){
       if(record){
        record = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,record): record;
        // the relation set is already on the record
        var ret = {updateRecordResult: {record: record, returnData: returnData}};
        sys.log('ThothServer: sending updateRecordResult: ' + JSON.stringify(ret));
        callback(ret); 
				//no need to save information on user cache? perhaps not, as ids won't change easily...
				me.distributeChanges(storeRequest,storeRequest.userData);					
      }
      else {
        callback(API.createErrorReply(Constants.ACTION_UPDATE, Constants.ERROR_DATAINCONSISTENCY,returnData));
      }
    };
		
		return function(policyResponse){
       if(policyResponse){
          me.store.updateRecord(storeRequest,clientId,sendResponse);                         
       }
       else {
          // we need to do something about this callback issue
          callback(API.createErrorReply(Constants.ACTION_UPDATE, Constants.ERROR_DENIEDONPOLICY,returnData));
       }
    };
	},
	
	deleteActionCreator: function(storeRequest, returnData, callback, requestType){
		var me = this,
				bucket = storeRequest.bucket,
				clientId = this.getClientId(storeRequest),
				record = storeRequest.recordData,
				userData = storeRequest.userData,
				key = storeRequest.key;
				
		var destroyAction = function(policyResponse){
			if(policyResponse){
				me.store.deleteRecord(storeRequest, clientId, function(val){
					me.sessionModule.deleteBucketKey(userData.user,userData.sessionKey,bucket,key);
					callback({deleteRecordResult: { bucket: bucket, key: key, record: record, returnData: returnData}});
					me.distributeChanges(storeRequest,userData);
				});
			}
			else {
				callback(API.createErrorReply(Constants.ACTION_DELETE, Constants.ERROR_DENIEDONPOLICY,returnData));
			}
    };

		return destroyAction;
	}
	
		
};

exports.StoreActionCreators = StoreActionCreators;

