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

global.OrionPolicies = SC.Object.extend({
   
   policyFile: null, // the file defining the enabled policies
   
   policyCache: null, // where the policy rule objects are cached
   
   // prevent a policy check if the users role is one of these roles, if a noPolicyCheckForRoles is defined in the
   // policy file, this will be overruled. Standard is empty to force checking for everyone
   noPolicyCheckForRoles: "".w(), 
   
   readPolicyFile: function(){
      var policyFileName = this.get('policyFile');
      if(policyFileName){
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
            this.set('policyCache', ret);
         }
      } 
   },
   
   checkPolicy: function(storeRequest,user,record,callback){
      // function to check whether the current record and storeRequest are allowed...
      var resource = storeRequest.bucket;
      var action = storeRequest.action;
      var policies = this.get('policyCache');
      var noPolCheck = this.get('noPolicyCheckForRoles');
      if(noPolCheck.indexOf(user.role) === -1){ 
         policies[resource][action](storeRequest,user,record,callback);
      } 
      else callback(YES); // if the users role is in the noPolicyCheck, just allow
   }
   
});