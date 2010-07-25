// the base model of a store

var sys = require('sys');
require('./sc/query');


global.OrionStore = SC.Object.extend({
   primaryKey: 'id', // put here the name of the primaryKey 
   
   
   
   
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
   createDBRecord: function(resource,key,data,clientId,callback){
      // the callback expects the new record
      console.log("Implement this function");
   },
   
   updateDBRecord: function(resource,key,data,clientId,callback){
      // the callback expects the updated record
      console.log("Implement this function");
   },
   
   deleteDBRecord: function(resource,key,clientId,callback){
      // check for callbacks.. Often it is not included!
      console.log("Implement this function");
   },
   
   fetchDBRecords: function(resource,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      console.log("Implement this function");
   },
   
   refreshDBRecord: function(resource,key,clientId,callback){
      // the callback expects a record
      console.log("Implement this function");       
   },
   
   // The remaining functions contain a standard implementation
      
   fetch: function(storeRequest,clientId,callback){  
      // callback needs to be called with an object { recordResult: [ records ]}
      var bucket = storeRequest.bucket;
      var relations = storeRequest.relations;
      var conditions = storeRequest.conditions;
      var parameters = storeRequest.parameters;
      var me = this;
      if(bucket && callback){
         this.fetchDBRecords(bucket,function(data){
            // check for conditions
            var records = conditions? me._filterRecordsByQuery(data,conditions,parameters): data;
            callback({ recordResult: records });
            // check whether there were relations in the original request
            if(relations && (relations instanceof Array)){
               var junctionInfo;
               for(var i=0,len=relations.length;i<len;i++){
                  // for every relation, get the data
                  junctionInfo = me.getJunctionInfo(bucket,relations[i].bucket);
                  me.getRelationSet(relations[i],records,junctionInfo,callback);
               }
            }
         });
      }
   },
   
   refreshRecord: function(storeRequest,clientId,callback){
      // callback needs to be called with the record object
      var bucket = storeRequest.bucket, key = storeRequest.key;
      this.refreshDBRecord(bucket,key,clientId,function(record){
         callback({ refreshResult: record });
      });
      // relations
      var relations = storeRequest.relations;
      if(relations && (relations instanceof Array)){
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
      this.createDBRecord(bucket,key,record,clientId,function(newrec){
         // the relations are created in this callback, as we need to have the
         // definite primaryKey value
         var prKeyValue = newrec[me.primaryKey];
         if(relations && (relations instanceof Array)){
            var junctionInfo;
            for(var i=0,len=relations.length;i<len;i++){
               junctionInfo = me.getJunctionInfo(bucket,relations[i].bucket);
               me.createRelation(storeRequest,newrec,relations[i],clientId); // don't do callbacks here for the moment
               newrec[relations[i].propertyName] = relations[i].keys;
            }
         }
         callback(newrec);
      });
   },
   
   updateRecord: function(storeRequest,clientId,callback){
      var bucket = storeRequest.bucket, key = storeRequest.key, record = storeRequest.recordData;
      var relations = storeRequest.relations;
      var me = this;
      this.updateDBRecord(bucket,key,record,clientId,function(data){
         // assume data is the updated record
         callback(data);
      });
      // update relations
      if(relations && (relations instanceof Array)){
         for(var i=0,l=relations.length;i<l;i++){
            me.updateRelation(storeRequest,data,relations[i],clientId); // no callback for the moment
         }
      }
   },
   
   deleteRecord: function(storeRequest,clientId,callback){
      var bucket = storeRequest.bucket, key=storeRequest.key, relations = storeRequest.relations;
      this.deleteDBRecord(bucket,key,clientId,callback);
      if(relations && (relations instanceof Array)){
         for(var i=0,len=relations.length;i<len;i++){
            this.destroyRelation(storeRequest,relations[i],clientId); // for the moment, don't provide a callback
         }
      }
   },

   // relation resolving functions (COMPUTED PROPERTIES??)
   // Feel free to override them to have your own custom behaviour.
   // The standard functions create the junction table name by taking 
   // both resource names, sort them alphabetically and then join them by 
   // putting an underscore between them

   junctionTableName: function(sideOne,sideTwo){
      return [sideOne,sideTwo].sort().join("_");
   },
   
   // function to generate a key name of a resource in the junction table
   // the standard is to take the resource name and add "_key" to it
   junctionKeyName: function(modelname){
      var prKey = this.primaryKey;
     return [modelname,prKey].join("_"); 
   },
   
   // function to generate all junction information in one go
   getJunctionInfo: function(model,relation){
      // return an object with all generated information about the relation:
      // { modelBucket: '', relationBucket: '', junctionBucket: '', modelRelationKey: '', relationRelationKey: ''}
      return {
        modelBucket: model,
        relationBucket: relation,
        junctionBucket: this.junctionTableName(model,relation),
        modelRelationKey: this.junctionKeyName(model),
        relationRelationKey: this.junctionKeyName(relation)
      };
   },



   // abstraction of the way relations are processed from junction records to relation sets belonging to a specific record
   // the issue here is that there are a few ways in which relations can be generated:
   // - as a relation set at a fetch function
   // - as a set of relation keys (for example in an update function)
   // - when creating a record the keys need to be created in the junction table
   // so the best idea seems to be to create three functions that each perform one of these tasks
   // and at the same time all use a specific set of helper functions that can be overrided

   //Function to filter out the relation keys between the record and the junctionData
   _junctionDataFor: function(record,junctionInfo,junctionData,allInfo){
      // parse the junctionData and search for the relations of the record in record
      // return an array of keys of the opposite of the relation if allInfo is false
      // if it is true, it returns the entire record
      var i, juncLen=junctionData.length;
      var modelKeyName = junctionInfo.modelRelationKey;
      var relationKeyName = junctionInfo.relationRelationKey;
      var curRecKey = record[this.primaryKey];
      var ret = [], curJuncRec;
      for(i=0;i<juncLen;i++){
         curJuncRec = junctionData[i];
         if(curJuncRec[modelKeyName] == curRecKey){
            if(allInfo){
               ret.push(curJuncRec);
            }
            else {
               ret.push(curJuncRec[relationKeyName]);
            }
         } 
      }
      return ret;
   },

   getRelationSet: function(relation,records,junctionInfo,callback){
      // retrieve the relations and add them to the records
      // the function needs a callback, because it cannot be predicted when the junction records 
      // will be returned here.
      // The callback is called with an object: { relationSet: { bucket: junctionInfo.modelBucket, keys: retkeys, propertyName: relation.propertyName, data: {} }}
      // data is an associative array with the primaryKeys as key and the relation array as value
      records = (records instanceof Array)? records: [records];
      var me = this;
      this.fetchDBRecords(junctionInfo.junctionBucket,function(junctionData){
         var i,j,recLen=records.length,junctLen=junctionData.length; // indexes and lengths
         var currec, curRecKey,relationKeys, keys = [], data={};
         for(i=0;i<recLen;i++){
            currec = records[i];
            curRecKey = currec[me.primaryKey];
            relationKeys = me._junctionDataFor(currec,junctionInfo,junctionData); 
            keys.push(curRecKey);
            data[curRecKey] = relationKeys;
         }
         var relSet = { relationSet: { bucket: junctionInfo.modelBucket, keys: keys, propertyName: relation.propertyName, data: data }};
         callback(relSet);
      });
   },
   
   getRelationKeys: function(relation,record,junctionInfo,callback){
      // this function does more or less the same as createRelationSet, but only for one record
      // so wrap createRelationSet
      var recordKey = record[this.primaryKey];
      this.getRelationSet(relation,record,junctionInfo,function(relationSet){
         var relSet = relationSet.relationSet;
         var data = relSet.data;
         callback(data[recordKey]);
      });
   },   
   
   updateRelation: function(storeRequest,record,relation,clientId,callback){
      // function to update an existing relation
      // so get all relation data for the current record and relation
      // check whether junction records need to be deleted or created
      var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
      var me = this;
      this.fetchDBRecords(junctionInfo.junctionBucket,function(junctionData){
         var relationKeys = relation.keys.copy();
         var junctionRecs = me._junctionDataFor(storeRequest,junctionInfo,junctionData,true); // get all info on the records
         var relationsIndex,curRelKey;
         for(var i=0,l=junctionRecs.length;i<l;i++){
            curRelKey = junctionRecs[i][junctionInfo.relationRelationKey];
            relationsIndex = relationKeys.indexOf(curRelKey);
            if(relationsIndex == -1){ // not found, so delete the record
               me.deleteDBRecord(junctionInfo.junctionBucket,junctionRecs[i][me.primaryKey]);
            }
            else {
               relationKeys.removeAt(relationsIndex);
            }
         }
         // now all relations that should be deleted are deleted, and relationKeys 
         // now only contains the relations that should be created
         // maybe createRelation could be used with only the keys left... but for the moment 
         // we do it manually
         var numrelations = relationKeys.length;
         var newRelRec, masterKey = storeRequest.key;
         var noKey = null; 
         for(var j=0;j<numrelations;j++){
            newRelRec = {};
            newRelRec[junctionInfo.modelRelationKey] = masterKey;
            newRelRec[junctionInfo.relationRelationKey] = relationKeys[i];
            this.createDBRecord(junctionInfo.junctionBucket,noKey,newRelRec,clientId); // don't do callbacks on relations for the moment
         }
         // it might be a nice idea to have a callback here that creates a new relationSet which can be 
         // distributed...
         if(callback) callback(YES);
      });
      
      
   },
   
   createRelation: function(storeRequest,record,relation,clientId,callback){
      // function to create a relation, keys need to be in relation.keys
      var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
      sys.puts("trying to create a set of relation records for master bucket " + storeRequest.bucket + " and related bucket: " + relation.bucket);
      sys.puts("the relation is: " + JSON.stringify(relation));
      sys.puts("the clientId is: " + clientId);
      var relationKeys = relation.keys;
      var masterKey = record[this.primaryKey];
      var newRelRec, noKey = null;
      for(var i=0,len=relationKeys.length;i<len;i++){
         newRelRec = {};
         newRelRec[junctionInfo.modelRelationKey] = masterKey;
         newRelRec[junctionInfo.relationRelationKey] = relationKeys[i];
         // now save
         this.createDBRecord(junctionInfo.junctionBucket,noKey,newRelRec,clientId); // don't do callbacks on relations for the moment
      }
      if(callback) callback(YES);
   },
   
   destroyRelation: function(storeRequest,relation,clientId,callback){
      // function to destroy the relation data from relation, used by destroyRecord
      // first fetch all junction records belonging to the current record
      // storeRequest can also be a record
      var recKey = storeRequest.key;
      var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
      var me = this;
      this.fetchDBRecords(junctionInfo.junctionBucket,function(junctionData){
         // get all junctioninfo for the current record
         var junctionRecs = me._junctionDataFor(storeRequest,junctionInfo,junctionData,true); // have it return the entire junction record
         var curJuncKey;
         for(var i=0,len=junctionRecs.length;i<len;i++){
            curJuncKey=junctionRecs[i][me.primaryKey];
            me.deleteDBRecord(junctionInfo.bucket,curJuncKey,clientId);
         }
         // in this implementation there is no error check...
         if(callback) callback(YES);
      });
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