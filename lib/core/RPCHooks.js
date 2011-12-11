/*globals __filename*/
/*
ThothRPCHooks 

Sometimes you just need RPC stuff. You need some action to be taken on the server, 
like generating a PDF from a TeX file or something similar that would require loads of 
extra software to be installed by the client.

This module allows you to define a set of functions as a node module and have them called
using the RPC request.

{ rpcRequest: { function:'', parameters: { set of parameters } } }

In case policies have been defined, the RPC request will be first be presented to the 
policyModel and access can be denied.

Your callback can have two parameters. The first parameter is the value to be given back,
the second parameter is a boolean, denoting whether the value given back is a url.
The idea behind it is that the result of the RPC call could be information that is not encodable
in JSON, such as a binary file.
In that case you want to be able to get the file using a single-use request.


*/

var fs = require('fs');
var Tools = require('./Tools');
var sys = Tools.sys;

exports.RPCHooks = SC.Object.extend({
  
	classFilename: __filename,

	RPCHooksFile: null, // file name to load

	_rpcHooks: null, // object to put the loaded file to

	_rpcResult: null, // cache to save the information needed to return a specific request
	// best to be an object: 
	// { 'cachekey': { mimeType: '', filePath: '' } }

	callRPCFunction: function(functionName, params, callback){
	  var cacheKey = Tools.generateCacheKey();
	  var rpc, func, me = this;
	  
		sys.log('ThothRPCHooks: callRPCFunction called');
		if(!this._rpcHooks){
			if(!this.RPCHooksFile) sys.log("No RPCHooksFile defined on RPCHooks Module");
			else {
				rpc = require(Tools.rootPath + "/" + this.RPCHooksFile);
				if(!rpc) return NO;
				else this._rpcHooks = rpc;            
			}
		}
		func = this._rpcHooks[functionName];
		if(func){
			params.cacheKey = cacheKey; // give function access to cacheKey for tmpfile stuff
			func(params,function(result,isURL){
				//{ mimeType: '', responseObject: '', filePath: '' }
				var ret = { rpcResult: {} };
				var mimeType = result.mimeType,
				record = result.responseObject, 
				filePath = result.filePath;
				if(mimeType === 'application/json'){
					ret.rpcResult.record = record;
					callback(ret);
				}
				else {
					if(!me._rpcResult) me._rpcResult = {};
					me._rpcResult[cacheKey] = { mimeType: mimeType, filePath: filePath };
					ret.rpcResult.cacheKey = cacheKey;
					callback(ret);
				}
			});
		}
		else {
			callback({ rpcError: "Error"}); // don't let the message be too obvious...
		}
	},

	rpcRetrieve: function(cacheKey,callback){
		// function to return the file from the request
		// it should also clean up the file after the response has been completed
		// function should use the callback to notify the client
		// syntax: callback(mimeType,data);
		sys.log("ThothRPCHooks: rpcRetrieve called");
		if(!this._rpcResult) callback(null);
		var rpcResponse = this._rpcResult[cacheKey];
		var me = this; // needed by the clean up
		if(rpcResponse && rpcResponse.filePath && rpcResponse.mimeType){
			var filePath = rpcResponse.filePath, mimeType = rpcResponse.mimeType;
			sys.log("ThothRPCHooks: about to read file: " + filePath);
			fs.readFile(filePath,function(err,data){
				if(err){
					sys.log("ThothRPCHooks: Error while reading: " + err);
					callback(null);
				} 
				else {
				  sys.log("ThothRPCHooks: readFile cb: filePath: " + filePath + " mimeType: " + mimeType);
					callback(mimeType,data);
					fs.unlink(filePath);
					delete me._rpcResult[cacheKey]; 
				} 
			});
		}
		else {
			delete this._rpcResult[cacheKey]; // clean up
			callback(null);
		}
	}

});