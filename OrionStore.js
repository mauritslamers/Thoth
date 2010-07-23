// the base model of a store

var sys = require('sys');
require('./sc/query');

global.OrionStore = SC.Object.extend({
   // user functions
   
   fetch: function(storeRequest,clientId,callback){  
      // callback needs to be called with an object { recordResult: [ records ]}
      callback("Implement this function!");   
   },
   
   refreshRecord: function(storeRequest,clientId,callback){
      // callback needs to be called with the record object
      callback("Implement this function!");      
   },
   
   createRecord: function(storeRequest,clientId,callback){
      callback("Implement this function!");
   },
   
   updateRecord: function(storeRequest,clientId,callback){
      callback("Implement this function!");      
   },
   
   deleteRecord: function(storeRequest,clientId,callback){
      callback("Implement this function!");
   },

// some very useful helper functions:

   // this function allows you to filter results by just feeding a set of records, 
   // an SC.Query conditions string and parameters object
   _filterRecordsByQuery: function(records,conditions,parameters){
      // function to filter a set of records to the conditions and parameters given
      // it creates a temporary query object
      if(records){
         var query = SC.Query.create({conditions: conditions, parameters: parameters});
         query.parse();
         var currec, ret = [];
         for(var i=0,len=records.length;i<len;i++){
            currec = records[i];
            // WARNING: the query language should not get the property using .get() as the
            // records the query object is called with are NOT SC.Record objects and calling 
            // .get on them to get the property value results in a call to the function overhead
            // in this case resulting in a call to the function created by the store._createRiakFetchOnSuccess function
            if(query.contains(currec)){ 
               ret.push(currec); 
            }
         }
         return ret;         
      }
   }
   
});