/*

OrionRPCHooks 

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

var sys = require('sys');
var fs = require('fs');

global.OrionRPCHooks = SC.Object.extend({
   
   RPCHooksFile: null, // file name to load
    
   _rpcHooks: null, // object to put the loaded file to
   
   _rpcResult: null, // cache to save the information needed to return a specific request
                     // best to be an object: 
                     // { 'cachekey': { mimeType: '', filePath: '' } }
   
   callRPCFunction: function(functionName, params, callback){
      sys.log('OrionRPCHooks: callRPCFunction called');
      if(!this._rpcHooks){
         if(!this.RPCHooksFile) sys.log("No RPCHooksFile defined on RPCHooks Module");
         else {
            var rpc = require("." + this.RPCHooksFile);
            if(!rpc) return NO;
            else this._rpcHooks = rpc;            
         }
      }
      var func = this._rpcHooks[functionName],
          me = this;
      if(func){
         var cacheKey = me.generateCacheKey();
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
      sys.log("OrionRPCHooks: rpcRetrieve called");
      var rpcResponse = this._rpcResult[cacheKey];
      var me = this; // needed by the clean up
      if(rpcResponse && rpcResponse.filePath && rpcResponse.mimeType){
         var filePath = rpcResponse.filePath, mimeType = rpcResponse.mimeType;
         sys.log("OrionRPCHooks: about to read file: " + filePath);
         fs.readFile(filePath,function(err,data){
            if(err){
               sys.log("OrionRPCHooks: Error while reading: " + err);
               callback(null);
            } 
            else {
               callback(mimeType,data);
               fs.unlink(filePath);
               delete me._rpcCache[cacheKey]; 
            } 
         });
      }
      else {
         delete this._rpcResult[cacheKey]; // clean up
         callback(null);
      }
   },
   
   generateCacheKey: function(){
      // the idea for this method was copied from the php site: 
      // http://www.php.net/manual/en/function.session-regenerate-id.php#60478
      var keyLength = 32,
          keySource = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
          keySourceLength = keySource.length + 1, // we need to add one, to make sure the last character will be used in generating the key
          ret = [],
          curCharIndex = 0;
      
      for(var i=0;i<=keyLength;i++){
         curCharIndex = Math.floor(Math.random()*keySourceLength);
         ret.push(keySource[curCharIndex]);
      }
      return ret.join('');
   }
   
});