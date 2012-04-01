/*
The action creators mixin contains the different actions performed by the server.
The reason is for these creators that we want to close over a few things and we want a single place 
where we can do interaction with the policies if needed. 
We also don't want to do these things in the store, because that would make the Store API not reusable
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
		var me = this, AR = APIRequest, 
		    storeRequest = API.StoreRequest.from(APIRequest,userData,callback),  		    
		    returnData = APIRequest.returnData, // only close over the returnData, so we don't have to keep the AR
				source = APIRequest.get('source'),
				clientId = storeRequest.get('clientId');
				
		if(!storeRequest){
		  sys.log('Thoth Fetch Action creator: received an inconsistent request. Dropping...');
		  return;
		}

    var send = function(event,data){
      if(source === C.SOURCE_SOCKETIO){
        me.socketIO.emitTo(userData,event,data);
      }
      else callback(event,data);
    };
				
		var sendRecordData = function(records){ 
			// the policy module takes care of handling record arrays, so we can expect an array of 
			// properly adjusted records...
			// store the records and the queryinfo in the clients session (if the conditions are not there, the session function 
			// will automatically convert it into a bucket only query)
      var ret = API.FetchResult.create({ 
        bucket: storeRequest.get('bucket'),
        records: records,
        returnData: returnData
      });  
			if(source === C.SOURCE_SOCKETIO){ 
			  me.sessionModule.storeRequestData(storeRequest,records);
			}
			// send off the data
      send(C.ACTION_FETCH_REPLY, ret);
			if(me.isBenchMarking) SC.Benchmark.end(storeRequest.get('benchmarkKey','fetch'));
		};
    
    var sendRelationSet = function(data){
      var ret = API.RelationReply.from(data,returnData);
      send(C.ACTION_FETCH_RELATION_REPLY,ret);
    };
    
		var fetchRequest = function(policyResponse){

      var fetchCb = function(err,data){ 
				// This function can be called with two different types of data: record results and relationSets
        // a record result is an object { recordResult: [records]} 	and  { relationSet: { }}
				if(!data){
				  send(C.ACTION_FETCH_ERROR,API.ErrorReply.from(C.ERROR_DBERROR,returnData));
				  if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','fetch'));
				  return;					  
				}
				if(data.recordResult){
				  // in case the policyResponse is "retry", we need to re-evaluate the policy
					if(policyResponse === C.POLICY_REQUEST_RETRY){
						me.policyModule.checkPolicy(storeRequest,data.recordResult,sendRecordData);
					}
					else sendRecordData(data.recordResult);
				}
				
				if(data.relationSet) sendRelationSet(data.relationSet); 
			};

			if(policyResponse){ // if any of YES or "retry"
			  if(me.isBenchMarking){
			    SC.Benchmark.start(storeRequest.get('benchmarkKey','fetch'));
			  }
				me.store.fetch(storeRequest,clientId,fetchCb);   
			} // end if(policyResponse)
			else {
				// not allowed
				send(C.ACTION_FETCH_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY,returnData));
				//callback(API.createErrorReply(C.ACTION_FETCH, C.ERROR_DENIEDONPOLICY,storeRequest.get('returnData')));
			}
			APIRequest.destroy(); 
		};
		
		return fetchRequest;		
	},
	                                
	//TODO: update rest of actions only using callback and get rid of closing over AR in the subfunctions
	//refreshActionCreator: function(storeRequest,returnData,callback,requestType){
  refreshActionCreator: function(APIRequest,userData,callback){
		var clientId = APIRequest.get('clientId');
		var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
		var AR = APIRequest, source = AR.get('source'), returnData = AR.get('returnData'),
		    me = this;

		if(!storeRequest){
		  sys.log('Thoth Refresh Action creator: received an inconsistent request. Dropping...');
		  return;
		}
		
		var send = function(event,data){
		  if(source === C.SOURCE_SOCKETIO){
		    me.socketIO.emitTo(userData,event,data);
		  }
		  else callback(event,data);
		};

		var sendRecordData = function(err,rec){
      var ret = API.RecordReply.from(storeRequest, rec, returnData);
			if(source === C.SOURCE_SOCKETIO){         
				me.sessionModule.storeBucketKey(userData.user,userData.sessionKey, storeRequest.get('bucket'), rec.key);					
			}
      send(C.ACTION_REFRESH_REPLY,ret);
			//var ret = { refreshRecordResult: { bucket: storeRequest.bucket, key: rec.key, record: rec, returnData: returnData } };
			//callback(ret);
      if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','refresh'));
		};

		var refreshAction = function(policyResponse){
		  var ret;
      if(me.isBenchMarking)	SC.Benchmark.start(storeRequest.get('benchmarkKey','refresh'));
			if(policyResponse){ // either 'retry' or YES on first attempt
				me.store.refreshRecord(storeRequest,clientId,function(val){ 
					// this function can be called with different results: with record data and with relations
					var ret, relSet;
					if(!val){
					  //callback(API.createErrorReply(C.ACTION_REFRESH,C.ERROR_DBERROR,returnData));
					  send(C.ACTION_REFRESH_ERROR,API.ErrorReply.from(C.ERROR_DBERROR,AR.get('returnData')));
					  if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','refresh'));
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
					  relSet = API.RelationReply.from(val.relationSet,returnData);
						//relSet = (val.relationSet instanceof Array)? val.relationSet: [val.relationSet]; // make it into an array if it isn't one already
						send(C.ACTION_REFRESH_RELATION_REPLY, relSet);
						//ret = { refreshRecordResult: { relationSet: relSet, returnData: returnData }};
						//callback(ret);
					}
				});
			}
			else {
				//callback(API.createErrorReply(C.ACTION_REFRESH, C.ERROR_DENIEDONPOLICY,returnData));
				ret = API.ErrorReply.from(C.ERROR_DENIEDONPOLICY,returnData);
				send(C.ACTION_REFRESH_ERROR,ret);
			}
			APIRequest.destroy();
		};
		return refreshAction;
	},
	
	//createActionCreator: function(storeRequest,returnData,callback,requestType){
  createActionCreator: function(APIRequest,userData,callback){
		var me = this;
		//var userData = storeRequest.userData;
		//var clientId = this.getClientId(storeRequest);
		var clientId = APIRequest.get('clientId');
		var source = APIRequest.get('source');
		var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
		var returnData = APIRequest.get('returnData');
		
		var send = function(event,data){
		  if(source === C.SOURCE_SOCKETIO){
		    me.socketIO.emitTo(userData,event,data);
		  }
		  else callback(event,data);
		};
		
		var sendResponse = function(err,rec){
			if(rec){
				rec = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,rec): rec;
				// first update the original client and then update the others
				//callback({createRecordResult: {record: rec, returnData: returnData}});
				send(C.ACTION_CREATE_REPLY, API.RecordReply.from(storeRequest,rec));
				                                                                               
				if(APIRequest.get('source') !== C.REQUESTTYPE_REST){ // not cache data with REST
					me.sessionModule.storeBucketKey(userData.user,userData.sessionKey,storeRequest.bucket,storeRequest.key);
				}                                                                                                  
				me.distributeChanges(storeRequest,userData,rec); 		
			}
			else {
				//sys.log('ACTION_CREATE: Data Inconsistency: response received: ' + rec);
				//callback(API.createErrorReply(C.ACTION_CREATE, C.ERROR_DATAINCONSISTENCY,returnData));
				send(C.ACTION_CREATE_ERROR, API.ErrorReply.from(C.ERROR_DATAINCONSISTENCY, returnData));
			}
      if(this.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','create'));
		};
		
		return function(policyResponse){
      if(this.isBenchMarking)	SC.Benchmark.start(storeRequest.get('benchmarkKey','create'));
			if(policyResponse){ // either YES or adjusted record
				var rec = (policyResponse === YES)? storeRequest.get('record'): policyResponse;
				storeRequest.record = rec;
				me.store.createRecord(storeRequest,clientId,sendResponse);
			}
			else { //not allowed
			 // callback(API.createErrorReply(C.ACTION_CREATE, C.ERROR_DENIEDONPOLICY, APIRequest.get('returnData'))); 
 			  send(C.ACTION_CREATE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, returnData));
			}     
		};
	},
	
	//updateActionCreator: function(storeRequest, returnData, callback, requestType){
	updateActionCreator: function(APIRequest,userData,callback){  
		var me = this, clientId;
		//var clientId = this.getClientId(storeRequest);
    var storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
    var returnData = APIRequest.get('returnData');
    var source = APIRequest.get('source');
    if(!storeRequest) return;
    clientId = storeRequest.get('clientId');
		
		var send = function(event,data){
		  if(source === C.SOURCE_SOCKETIO){
		    me.socketIO.emitTo(userData,event,data);
		  }
		  else callback(event,data);
		};
		
		var sendResponse = function(err,record){
       if(record){
        record = (me.policyModule && me.policyModule.filterRecords)? me.policyModule.filterRecord(storeRequest,record): record;
        // the relation set is already on the record
        //var ret = {updateRecordResult: {record: record, returnData: returnData}};
        var ret = API.RecordReply.from(storeRequest,record,returnData);
        sys.log('ThothServer: sending updateRecordResult: ' + JSON.stringify(ret.get('json')));
        send(C.ACTION_UPDATE_REPLY, ret.get('json')); 
        if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','update'));
				//no need to save information on user cache? perhaps not, as ids won't change easily...
				me.distributeChanges(storeRequest,storeRequest.userData);	
      }
      else {
        //callback(API.createErrorReply(C.ACTION_UPDATE, C.ERROR_DATAINCONSISTENCY,returnData));
        if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','update'));
        send(C.ACTION_UPDATE_ERROR, API.ErrorReply.from(C.ERROR_DATAINCONSISTENCY, returnData));
      }
    };
		
		return function(policyResponse){
		  if(me.isBenchMarking)	SC.Benchmark.start(storeRequest.get('benchmarkKey','update'));
      if(policyResponse){
        me.store.updateRecord(storeRequest,clientId,sendResponse);                         
      }
      else {
        // we need to do something about this callback issue
        //callback(API.createErrorReply(C.ACTION_UPDATE, C.ERROR_DENIEDONPOLICY,returnData));
        if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','update'));
        callback(C.ACTION_UPDATE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, returnData));
      }
      APIRequest.destroy();
    };
	},

  deleteActionCreator: function(APIRequest,userData,callback){	
		var me = this, clientId, 
		    source = APIRequest.get('source'), returnData = APIRequest.get('returnData'),
        storeRequest = API.StoreRequest.from(APIRequest,userData,callback);
				  
		var send = function(event,data){
		  if(source === C.SOURCE_SOCKETIO){
		    me.socketIO.emitTo(userData,event,data);
		  }
		  else callback(event,data);
		};
						                                                                   
		if(!storeRequest) return;		
		clientId = storeRequest.get('clientId');
		var destroyAction = function(policyResponse){
		  if(me.isBenchMarking)	SC.Benchmark.start(storeRequest.get('benchmarkKey','delete'));
			if(policyResponse){
				me.store.deleteRecord(storeRequest, clientId, function(err,val){
					me.sessionModule.deleteBucketKey(userData.user,userData.sessionKey,APIRequest.get('bucket'),APIRequest.get('key'));
					//callback({deleteRecordResult: { bucket: bucket, key: key, record: record, returnData: returnData}});
					send(C.ACTION_DELETE_REPLY, API.RecordReply.from(storeRequest));
					if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','delete'));
					me.distributeChanges(storeRequest,storeRequest.userData);
				});
			}
			else {
				//callback(API.createErrorReply(C.ACTION_DELETE, C.ERROR_DENIEDONPOLICY,returnData));
				send(C.ACTION_DELETE_ERROR, API.ErrorReply.from(C.ERROR_DENIEDONPOLICY, returnData));
				if(me.isBenchMarking)	SC.Benchmark.end(storeRequest.get('benchmarkKey','update'));
			}
			APIRequest.destroy();
    };

		return destroyAction;
	}
		
};

exports.StoreActionCreators = StoreActionCreators;

