/* a standard model to create a Policy from */

// ALL policy checks MUST call the callback, otherwise 
// the data will never arrive at the client

exports.PolicyModel = SC.Object.extend({

	// deny access by default, override to have the functions return anything else by default
	defaultResponse: NO,

	/*
	This function is only called once, before the actual db request. 
	Accepted return value is either YES, NO or a filtered record.
	*/
	create: function(storeRequest,userData,record,callback){
		callback(this.defaultResponse);
	},

	/*
	This function is only called once, before the actual db request
	Accepted return value is either YES, NO or a filtered record.
	*/
	update: function(storeRequest,userData,record,callback){
		callback(this.defaultResponse);
	},

	/*
	This function can be called twice, once before the db request and once after the db request.
	The difference can be detected by the record value being undefined on the storeRequest.
	This will happen when the record is retrieved by id for the first time for a specific client.
	Whether it is called after the db request depends on the return value of the first call.
	Accepted callback value is either YES, NO, 'retry' or a filtered record
	*/
	refresh: function(storeRequest,userData,record,callback){
		callback(this.defaultResponse);
	},

	/*
	This function is only called once, before the actual db request
	Accepted return value is either YES or NO.
	*/
	destroy: function(storeRequest,userData,record,callback){
		callback(this.defaultResponse);
	},

	/* 
	This function can be used by the other functions above, but also needs to be
	available separately to be able to filter data.
	In contrast with the other functions, this function should return immediately
	*/
	filter: function(storeRequest,userData,record){
		return record;
	}
});