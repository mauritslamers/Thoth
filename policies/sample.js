/* policies file */


/* 
The format of this policy file is

exports.resource = OrionPolicyModel.create({
   action: function(storeRequest,user,record,callback){
   
   }
})

where resource is the name of your database table or bucket
and action is either 'create','update','refresh', 'destroy' or 'filter'
the ONR fetch action will use the refresh action

The return value of every function can be:
- YES:      Access of this action type to the record or resource is allowed
- NO:       Access of this action type to the record or resource is not allowed
- "retry":  Access of this action type to the record or resource can not be 
            determined at this moment because of lack of record data. The system is asked this way to retry later when more data is available.
            (this case is purely available for the refresh action)
- a record: Access of this action type to the record is allowed, and needs to use the record returned as it has modifications

These functions are NOT called if the users role is one of the predefined roles in either the myPolicies file or
in the created OrionPolicies object. The policy module will check this before calling these functions.

*/

exports.sample = OrionPolicyModel.create({
   
   // deny access by default, override to have the functions return anything else by default
   defaultResponse: NO,
   
   /*
      This function is only called once, before the actual db request. 
      Accepted return value is either YES, NO or a filtered record.
   */
   create: function(storeRequest,user,record,callback){
      callback(this.defaultResponse);
   },
   
   /*
      This function is only called once, before the actual db request
      Accepted return value is either YES, NO or a filtered record.
   */
   update: function(storeRequest,user,record,callback){
      callback(this.defaultResponse);
   },
   
   /*
      This function can be called twice, once before the db request and once after the db request.
      The difference can be detected by the record value being undefined.
      Whether it is called after the db request depends on the return value of the first call.
      Accepted callback value is either YES, NO or a filtered record
   */
   refresh: function(storeRequest,user,record,callback){
      callback(this.defaultResponse);
   },
   
   /*
      This function is only called once, before the actual db request
      Accepted return value is either YES or NO.
   */
   destroy: function(storeRequest,user,record,callback){
      callback(this.defaultResponse);
   },
   
   /* 
      This function can be used by the other functions above, but also needs to be
      available separately to be able to filter data.
   */
   filter: function(storeRequest,user,record,callback){
      callback(record);
   }
});