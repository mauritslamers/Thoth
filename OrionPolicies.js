/*

OrionPolicies is a system to both filter data and to allow or deny access 
to certain types of data depending on the role of the client.

The system is set up around resource and user roles and the idea that users of ONR need to be able to completely customise their system.
The user is allowed to change the record information and force the system to use the adjusted record. In this way the user can implement
a system in which the permissions are saved per record or where certain record fields are filtered by default or based on the users role.
(It also allows for content checking...)

As it is to be expected that users will want to do database lookups in there policy system, the system is designed around using callbacks.

The system works as follows: whenever a request is received from a client, it is passed to the appropriate function defined for that particular resource.
That function determines what needs to happen and calls the given callback with either a kind of permission, a request to retry later 
(as with get requests it can depend on what is actually in the record itself, and that can only be known after the request has been made to the database) 
or a changed record with certain information filtered out or changed.

*/
if(!global.SC) require('./sc/runtime/core');
//require('./OrionPolicyModel');
var sys=require('sys');

global.OrionPolicies = SC.Object.extend({
   
   policyFile: null, // the file defining the enabled policies
   
   filterRecords: NO, // whether a record should be filtered by the server when creating a new record or updating an existing one 
   
   policyCache: null, // where the policy rule objects are cached
   
   // prevent a policy check if the users role is one of these roles, if a noPolicyCheckForRoles is defined in the
   // policy file, this will be overruled. Standard is empty to force checking for everyone
   noPolicyCheckForRoles: "".w(), 
   
   readPolicyFile: function(){
      var policyFileName = this.get('policyFile');
      sys.log("OrionPolicy: readPolicyFile: policyFileName = " + this.policyFile);
      if(policyFileName){
         sys.log('OrionPolicy: Reading policies file');
         var policyFile = require(policyFileName);
         var enabledPolicies = policyFile.enabledPolicies; 
         var policyDir = policyFile.policyPath;
         var noPolCheck = policyFile.noPolicyCheckForRoles;
         if(noPolCheck) this.set('noPolicyCheckForRoles', noPolCheck); // override existing setting if defined in the policy file
         if(policyDir && enabledPolicies && (enabledPolicies instanceof Array)){
            policyDir = (policyDir[(policyDir.length-1)] === '/')? policyDir: [policyDir,'/'].join(''); // add trailing slash if missing
            // load the policy objects
            var ret = {}, tmpPol, path, curPolName;
            for(var i=0,len=enabledPolicies.length;i<len;i++){
               curPolName = enabledPolicies[i];
               path = [policyDir,curPolName].join('');
               tmpPol = require(path);
               if(tmpPol && tmpPol[curPolName]) ret[curPolName] = tmpPol[curPolName];
            }
            // set the policy cache
            sys.log('OrionPolicy: Setting policyCache');
            this.policyCache = ret;
         }
      } 
   },
   
   _tmpRecordCache: {},
   _tmpRecordCacheCount: {},
   
   // this seems a bit complicated, but we have to be aware that multiple requests can coincide, so we have to separate 
   // all different requests, for which we use cache keys. the function expects the checkPolicy function to 
   // create the array on the _tmpRecordCache first
   // it is even more complicated than I thought at first
   createPolicyCheckCallback: function(record,cacheKey,callback){
      var me = this;
      return function(val){
         if(val === YES){ // no changes to the record
            me._tmpRecordCache[cacheKey].push(record);
         }
         if(val && val !== 'retry') me._tmpRecordCache[cacheKey].push(val); // anything else, not being NO or retry, so push the updated record
         me._tmpRecordCacheCount[cacheKey]--;
         if(me._tmpRecordCacheCount[cacheKey] === 0){
            // if this is the last record, send the entire array to the callback
            var records = me._tmpRecordCache[cacheKey];
            delete me._tmpRecordCache[cacheKey]; // delete the old contents
            delete me._tmpRecordCacheCount[cacheKey];
            callback(records);
         }
      };
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
   },
   
   checkPolicy: function(storeRequest,record,callback){
      // function to check whether the current record and storeRequest are allowed...
      if(!this.policyCache) this.readPolicyFile(); // load if not already done...
      var resource = storeRequest.bucket;
      var action = storeRequest.action;
      var policies = this.policyCache;
      // load policies if not yet loaded
      var noPolCheck = this.noPolicyCheckForRoles;
      if(noPolCheck.indexOf(storeRequest.userData.role) === -1){ 
         // we need to catch requests for which there is no policy
         if(!policies[resource]){
            sys.log("OrionPolicies: You have been trying to perform a " + action + " action on " + resource + " but no policies have been defined for this resource");
            callback(NO);
            return;
         }
         
         // check whether record happens to be an array, we have to pass all records through the policy check
         // which is kind of difficult, and most importantly, ALL policy checks MUST call the callback, otherwise 
         // the data will never arrive at the client!!
         if(record instanceof Array){
            sys.log('running checkPolicy: inside array stuff');
            var me = this, cacheKey = this.generateCacheKey();
            var curRec, polCheck;
            
            if(record.length !== 0){
               this._tmpRecordCache[cacheKey]=[];
               this._tmpRecordCacheCount[cacheKey]=record.length;
               for(var i=0,len=record.length;i<len;i++){
                  curRec = record[i];
                  polCheck = policies[resource][action];
                  polCheck(storeRequest,storeRequest.userData,curRec,this.createPolicyCheckCallBack(curRec,cacheKey,callback));
               }               
            }
         }
         else {
            sys.log('OrionPolicy: request not an array request...')
            policies[resource][action](storeRequest,storeRequest.userData,record,callback);   
         }
      } 
      else callback(YES); // if the users role is in the noPolicyCheck, just allow. Otherwise the policy settings take over (which is default not to send anything).
   },
   
   filterRecord: function(storeRequest,record){
      var resource = storeRequest.bucket, action = storeRequest.action;
      var policies = this.get('policyCache');
      return policies[resource][action](storeRequest, storeRequest.userData,record);
   }
   
});