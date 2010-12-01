// the base model of a store

var sys = require('sys');

exports.Store = SC.Object.extend({
   
   primaryKey: 'id', // put here the name of the primaryKey 
   
   filterBySCQuery: YES, // have SC Query filter the records if YES. The conditions and parameters are always passed on to the DB calls
   
   automaticRelations: YES, // have the store automatically parse the relations, The relations are always passed on to the DB calls
   
   // user functions
   
   /*
   the storeRequest is an object with the following layout:
   { bucket: '', 
     key: '', 
     conditions: '', 
     parameters: {}, 
     recordData: {},
     relations: [ 
        { bucket: '', type: 'toOne', propertyName: '', keys: [] }, 
        { bucket: '', type: 'toMany', propertyName: '', keys: [] } 
     ] 
   }
   
   
   */
   // functions to create, delete and fetch database records
   // use the callback function to send back the results as an array of records
   // make sure that the callback is called with an JS Array of objects and not with JSON data!
   
   // Be aware that in case you want to have automatic relations, these functions are also used to get the relation data
   // You can prevent automatic relations by not providing relation data in the request...
   
   createDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the new record
      sys.log("CreateDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      sys.log("updateDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // check for callbacks.. Often it is not included!
      sys.log("deleteDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   fetchDBRecords: function(storeRequest,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      sys.log("fetchDBRecords: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   refreshDBRecord: function(storeRequest,clientId,callback){
      // the callback expects a record
      sys.log("refreshDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   createRelation: function(){
     // the callback expects a record
     sys.log("createRelation: This function needs an implementation. If you are seeing this message, you are probably using the base or extended ThothStore without relation mixin.");     
   },
   
   destroyRelation: function(){
     // the callback expects a record
     sys.log("destroyRelation: This function needs an implementation. If you are seeing this message, you are probably using the base or extended ThothStore without relation mixin.");     
   },
   
   // this function provides a hook for starting certain things when the server starts
   // which cannot be done using the init function (constructor)
   start: function(){
      console.log("Store start: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   
   /*
     Main store functions:
     fetch: will start a fetch all of a certain type of records, or a query, depending on the information
     refreshRecord: will refresh a certain type of record from the database
     createRecord: will create a new record with the specific data
     updateRecord: will update an existing record with the given data
     deleteRecord: will delete an existing record
     
     don't override, as these functions will also take care of the appropriate updates to the relations if
     the data for these relations is provided
     
   */
   
   fetch: function(storeRequest,clientId,callback){  
      // callback needs to be called with an object { recordResult: [ records ]}
      var bucket = storeRequest.bucket;
      var relations = storeRequest.relations;
      var conditions = storeRequest.conditions;
      var parameters = storeRequest.parameters;
      var me = this;
      if(bucket && callback){
         this.fetchDBRecords(storeRequest,function(data){
            // check for conditions
            if(!data){
              callback();
              return;
            }
            var records = (conditions && me.filterBySCQuery)? me._filterRecordsByQuery(data,conditions,parameters): data;
            callback({ recordResult: records });
            // check whether there were relations in the original request
            sys.log('just had first callback stuff with data, starting relations');            
            if(me.automaticRelations && relations && (relations instanceof Array)){
              if(!me.fetchRelation) sys.log("Thoth.Store: No relation mixin or fetchRelation implementation found");
              else {
                for(var i=0,len=relations.length;i<len;i++){
                  // for every relation, get the data
                  me.fetchRelation(storeRequest,records,relations[i],callback);
                }
              }
            }
         });
      }
   },
   
   refreshRecord: function(storeRequest,clientId,callback){
      // callback needs to be called with the record object
      var bucket = storeRequest.bucket, key = storeRequest.key;
      this.refreshDBRecord(storeRequest,clientId,function(record){
         callback({ refreshResult: record });
      });
      // relations
      var relations = storeRequest.relations;
      if(this.automaticRelations && relations && (relations instanceof Array)){
         var junctionInfo;
         for(var i=0,len=relations.length;i<len;i++){
            junctionInfo = this.getJunctionInfo(bucket,relations[i].bucket);
            this.getRelationSet(relations[i],storeRequest,junctionInfo,callback);
         }
      }
   },
   
   createRecord: function(storeRequest,clientId,callback){
      var bucket = storeRequest.bucket, key = storeRequest.key, record = storeRequest.recordData;
      var relations = storeRequest.relations;
      var me = this;
      this.createDBRecord(storeRequest,clientId,function(newrec){
         // the relations are created in this callback, as we need to have the
         // definite primaryKey value
         var prKeyValue = newrec[me.primaryKey];
         if(me.automaticRelations && relations && (relations instanceof Array)){
            var junctionInfo;
            for(var i=0,len=relations.length;i<len;i++){
               junctionInfo = me.getJunctionInfo(bucket,relations[i].bucket);
               if(relations.keys && (relations.keys instanceof Array) && (relations.keys.length > 0)){
                  me.createRelation(storeRequest,newrec,relations[i],clientId); // don't do callbacks here for the moment                  
                  newrec[relations[i].propertyName] = relations[i].keys;
               }
               else {
                  newrec[relations[i].propertyName] = [];
               }
            }
         }
         if(!newrec.bucket) newrec.bucket = bucket;
         callback(newrec);
      });
   },
   
   updateRecord: function(storeRequest,clientId,callback){
      sys.log('ThothStore: updateRecord called');
      var bucket = storeRequest.bucket, key = storeRequest.key, record = storeRequest.recordData;
      var relations = storeRequest.relations;
      // first update relations, because it allows to be sending the new relation data in one go with the record,
      // which makes distributing the changes much easier. This is because it seems rather tricky to distribute the relation
      // data before they are written in the db. With this setup the changes will be distributed around the same time as 
      // the data arrives to the database.
      if(this.automaticRelations && relations && (relations instanceof Array)){
         for(var i=0,l=relations.length;i<l;i++){
            var curRel = relations[i];
            this.updateRelation(storeRequest,record,curRel,clientId); 
            // no need for a callback
         }
      }
      sys.log("ThothStore: updateRecord: relations handled");
      this.updateDBRecord(storeRequest,clientId,function(record){
         // assume data is the updated record
         // merge the relation data with the record
         var currel;
         for(var j=0,len=relations.length;j<len;j++){
            currel = relations[j];
            record[currel.propertyName] = currel.keys;
         }
         // check if key is saved on the record
         if(!record.key) record.key = key;
         if(!record.bucket) record.bucket = bucket; // this is a temporary fix.
         callback(record); // now send the record with merged relations
      });
   },
   
   deleteRecord: function(storeRequest,clientId,callback){
      var bucket = storeRequest.bucket, key=storeRequest.key, relations = storeRequest.relations;
      // first destroy relations
      if(this.automaticRelations && relations && (relations instanceof Array)){
         for(var i=0,len=relations.length;i<len;i++){
            this.destroyRelation(storeRequest,relations[i],clientId); // for the moment, don't provide a callback
         }
      }
      // now delete the actual record
      this.deleteDBRecord(storeRequest,clientId,callback);
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
            // .get on them to get the property value results in a call to the wrapper function 
            // in this case resulting in a call to the function created by the store._createRiakFetchOnSuccess function
            if(query.contains(currec)){ 
               ret.push(currec); 
            }
         }
         return ret;         
      }
   }
   
});