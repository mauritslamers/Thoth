// the base model of a store
if(!SC.Query) require('./sc/query');

var sys = require('sys');
var API = require('./API');
var Constants = require('./Constants');
var computedPropertyCalculator = require('./mixins/computed_property_calculator').ComputedPropertyCalculator;

exports.Store = SC.Object.extend(computedPropertyCalculator,{
   
   primaryKey: null, // put here the name of the primaryKey 
   
   filterBySCQuery: YES, // have SC Query filter the records if YES. The conditions and parameters are always passed on to the DB calls
   
   automaticRelations: YES, // have the store automatically parse the relations, The relations are always passed on to the DB calls
   
   propertyBasedRetrieval: null, // have the store automatically filter the properties retrieved
   
   computeComputedProperties: null, // have computed properties that are sent here computed, also something for the policies?
   
   combineReturnCalls: NO, // let Thoth return all data (relations, computed properties etc) in one go instead of separate messages
   
   debug: false,
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
      // syntax of callback: callback(err,recordData);
      sys.log("CreateDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the updated record
      // syntax of callback: callback(err,updatedRecordData);
      sys.log("updateDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      // check for callbacks.. Often it is not included!
      // syntax of callback: callback(err);
      sys.log("deleteDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   fetchDBRecords: function(storeRequest,clientId,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      // fetch can be a fetch all, a limited fetch by keys (provided in storeRequest.keys) or a limited fetch by query
      // syntax of callback: callback(err,arrayOfRecords);
      sys.log("fetchDBRecords: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   refreshDBRecord: function(storeRequest,clientId,callback){
      // the callback expects a record
      // syntax of callback: callback(err,refreshedRecord)
      sys.log("refreshDBRecord: This function needs an implementation. If you are seeing this message, you are probably using the base ThothStore instead of a store having a DB-implementation.");
   },
   
   createRelation: function(storeRequest,record,relation,clientId,callback){
     // the callback expects a record
     sys.log("createRelation: This function needs an implementation. If you are seeing this message, you are probably using the base or extended ThothStore without relation mixin.");     
   },
   
   destroyRelation: function(storeRequest,relation,clientId,callback){
     // the callback doesn't expect a confirmation
     sys.log("destroyRelation: This function needs an implementation. If you are seeing this message, you are probably using the base or extended ThothStore without relation mixin.");     
   },

   fetchRelation: function(storeRequest,record,relation,clientId,callback){
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
    var me = this,
        sR = storeRequest,
        cpsData = sR.computedProperties,
        cpsResult,
        recordData,
        relationData = [],
        relationsDidMerge = false,
        shouldCalculateProperties = (this.computeComputedProperties && cpsData && (cpsData.length > 0)),
        cpsCalculators = shouldCalculateProperties? this.getComputedPropertiesComputer(storeRequest): null;
        
    // state: computed properties give back records with computed data
    // 
    
    var merge = function(records,relSets){
      relSets.map(function(relSet){
        var rec = records.findProperty(sR.primaryKey,relSet.key);
        if(rec){
          rec[relSet.propertyName] = relSet.data;
        }
      });
      relationsDidMerge = true;
      return records;
    };

    var finishFetch = function(){
      var records;
      
      if(me.combineReturnCalls){ 
        records = (!relationsDidMerge)? merge(recordData,relationData): recordData;
        callback({ recordResult: recordData }); // all relation data and CPS merged onto the data
        //gather everything and send back
      }
      else {
        if(shouldCalculateProperties){
          // just send back the calculated properties, the rest has already been sent
          //var relSet = { relationSet: { bucket: junctionInfo.modelBucket, keys: keys, propertyName: relation.propertyName, data: data }};
          callback({ computedPropertyResult: { bucket: storeRequest.bucket, keys: cpsResult.keys, data: cpsResult.data }});
        }
      }
    };

    var calculateCPS = function(){
      var recs = merge(recordData,relationData);
      if(me.combineReturnCalls) recordData = cpsCalculators.hasRelationsComputer(recs);
      else cpsResult = cpsCalculators.hasRelations(recs,true);
      finishFetch();
    };
    
    var relationCb = function(relIndex){
      return function(data){
        if(!me.combineReturnCalls) callback(data); // first give back the info
        relationData[relIndex] = data;
        if(relationData.length === sR.relations.length){
          if(shouldCalculateProperties) calculateCPS();
          else finishFetch();
        }
      };
    };

    var handleRelations = function(records){
      if(!me.fetchRelation) sys.log("Thoth.Store: No relation mixin or fetchRelation implementation found");
      else {
        for(var i=0,len=sR.relations.length;i<len;i++){  // for every relation, get the data      
          me.fetchRelation(storeRequest,records,sR.relations[i],relationCb(i));
        }
      }
    };

    var fetchDBCallback = function(err,recArray){
      var records;

      if(!recArray) callback(null);         
      else {
        records = me._filterFetchRecords(storeRequest,recArray);
        records = (cpsCalculators && cpsCalculators.hasNoRelationsComputer)? cpsCalculators.hasNoRelationsComputer(records): records; // cps phase one
        if(shouldCalculateProperties || me.combineReturnCalls) recordData = recArray; // save data for cps or in case of combineReturnCalls
        if(!me.combineReturnCalls) callback({ recordResult: recArray });
        if(me.automaticRelations && sR.relations && (sR.relations instanceof Array)) handleRelations(recArray);
      }
    };
    

  },
/*
   fetch: function(storeRequest,clientId,callback){  
      // callback needs to be called with an object { recordResult: [ records ]}
      var bucket = storeRequest.bucket,
          relations = storeRequest.relations,
          conditions = storeRequest.conditions,
          parameters = storeRequest.parameters,
          me = this, cpsCalculators,
          recordData, // closure for property calculators
          relationData = [];
      var shouldCalculateProperties = (this.computeComputedProperties && storeRequest.computedProperties && (storeRequest.computedProperties.length > 0));
      sys.log('shouldCalculateProperties for bucket ' + bucket + ": " + shouldCalculateProperties);
      //sys.log('computedProperties are: ' + sys.inspect(storeRequest.computedProperties));
      if(shouldCalculateProperties) cpsCalculators = this.getComputedPropertiesComputer(storeRequest);
      if(shouldCalculateProperties) this.calculateDependencyTree(storeRequest.computedProperties,relations,storeRequest.properties);
      if(bucket && callback){
         this.fetchDBRecords(storeRequest,clientId,function(err,data){
            // check for conditions
            if(!data){
              callback(null);
              return;
            }
            var records = me._filterFetchRecords(storeRequest,data);
            if(shouldCalculateProperties) recordData = records; // save in closure in case we need it for computation
            callback({ recordResult: records }); // need the wrapper to allow the callback to differentiate between relations and records 
            // check whether there were relations in the original request        
            if(me.automaticRelations && relations && (relations instanceof Array)){
              if(!me.fetchRelation) sys.log("Thoth.Store: No relation mixin or fetchRelation implementation found");
              else {
                
                
                for(var i=0,len=relations.length;i<len;i++){  // for every relation, get the data
                  
                  
                  me.fetchRelation(storeRequest,records,relations[i],function(data){
                    callback(data); // first give back the info
                    if(shouldCalculateProperties){
                      relationData.push(data);
                      if(relationData.length === relations.length){
                        
                        if(cpsCalculators.hasRelationsComputer) cps
                      }
                    }
                  });
                }
              }
            }
         });
      }
   }, */
   
   refreshRecord: function(storeRequest,clientId,callback){
      // callback needs to be called with the record object
      var bucket = storeRequest.bucket, key = storeRequest.key, me = this;
      this.refreshDBRecord(storeRequest,clientId,function(err,record){
        record = me.propertyBasedRetrieval? me._filterRecordByProperties(record): record;
        callback({ refreshResult: record });  
        // do relations
        var relations = storeRequest.relations;
        if(me.automaticRelations && relations && (relations instanceof Array)){
           for(var i=0,len=relations.length;i<len;i++){
              //this.getRelationSet(relations[i],storeRequest,junctionInfo,callback);
              me.fetchRelation(storeRequest,[record],relations[i],callback);
           }
        }
      });
   },
   
   createRecord: function(storeRequest,clientId,callback){
      var bucket = storeRequest.bucket, key = storeRequest.key, record = storeRequest.recordData;
      var relations = storeRequest.relations;
      var primKey = API.getPrimaryKey(storeRequest);
      var me = this;
      this.createDBRecord(storeRequest,clientId,function(err,newrec){
         // the relations are created in this callback, as we need to have the
         // definite primaryKey value
         var i,len,curRelation;
         if(me.automaticRelations && relations && (relations instanceof Array) && newrec){
            //var junctionInfo;
            for(i=0,len=relations.length;i<len;i++){
              curRelation = relations[i];
               //junctionInfo = me.getJunctionInfo(bucket,relations[i].bucket);
               if(curRelation.keys && (curRelation.keys instanceof Array) && (curRelation.keys.length > 0)){
                  me.createRelation(storeRequest,newrec,curRelation,clientId); // don't do callbacks here for the moment                  
                  newrec[curRelation.propertyName] = curRelation.keys;
               }
               else {
                  newrec[curRelation.propertyName] = [];
               }
            }
         }
         
         //if(!newrec.id && newrec[primKey]) newrec.id = newrec[primKey]; // fix to allow relations to work properly
         //if(!newrec.bucket) newrec.bucket = bucket; // don't add bucket to the record
         if(callback) callback(newrec);
      });
   },
   
   updateRecord: function(storeRequest,clientId,callback){
      if(this.debug) sys.log('ThothStore: updateRecord called');
      var bucket = storeRequest.bucket, key = storeRequest.key, record = storeRequest.recordData;
      var relations = storeRequest.relations, me = this;
      // first update relations, because it allows to be sending the new relation data in one go with the record,
      // which makes distributing the changes much easier. This is because it seems rather tricky to distribute the relation
      // data before they are written in the db. With this setup the changes will be distributed around the same time as 
      // the data arrives to the database.
      
      // There is a kind of a design decision to make here: do we want to have relations changed when the update itself may 
      // not be applied due to a certain error, for example a update conflict; or do we want to hold the relation saving until the 
      // update itself was successfull.
      
      if(this.automaticRelations && relations && (relations instanceof Array)){
         for(var i=0,l=relations.length;i<l;i++){
            this.updateRelation(storeRequest,record,relations[i],clientId); 
            // no need for a callback
         }
      }
      if(this.debug) sys.log("ThothStore: updateRecord: relations handled");
      this.updateDBRecord(storeRequest,clientId,function(err,record){
         // assume data is the updated record
         // merge the relation data with the record
         if(me.automaticRelations && record && relations){
           var currel;
           for(var j=0,len=relations.length;j<len;j++){
              currel = relations[j];
              record[currel.propertyName] = currel.keys;
           }           
         }
         // check if key is saved on the record
         //if(storeRequest.primaryKey && !record[storeRequest.primaryKey]) record[storeRequest.primaryKey] = storeRequest.key;
         //if(!storeRequest.primaryKey && !record.key) record.key = key;
         //if(!record.key) record.key = key;
         //if(!record.bucket) record.bucket = bucket; // this is a temporary fix.
         if(callback) callback(record); // now send the record with merged relations, and null if error
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
   _filterFetchRecords: function(storeRequest, records){
     var props = storeRequest.properties,
         conds = storeRequest.conditions,
         params = storeRequest.parameters,
         ret;
     
     
     //properties first
     if(this.propertyBasedRetrieval){
       ret = this._filterRecordsByProperties(records,props);
     }
     else ret = records;
     ret = (conds && this.filterBySCQuery)? this._filterRecordsByQuery(ret,conds,params): ret;
     return ret;
   },
   
   _filterRecordsByProperties: function(records,properties){
     var i,j,obj,
         ret = [],
         i_len = records.length,
         j_len = properties.length;
         
     for(i=0;i<i_len;i++){
       obj = {};
       for(j=0;j<j_len;j++){
         obj[properties[j].key] = records[i][properties[j].key]; //set obj[propname] to value of currec[propname]
       }
       ret.push(obj);
     }
     return ret;
   },

   _filterRecordByProperties: function(record,properties){
     var i,
         i_len = properties.length,
         ret = {};
         
     for(i=0;i<i_len;i++){
       ret[properties[i].key] = record[properties[i].key];
     } 
     return ret;
   },

   // this function allows you to filter results by just feeding a set of records, 
   // an SC.Query conditions string and parameters object
   _filterRecordsByQuery: function(records,conditions,parameters){
      // function to filter a set of records to the conditions and parameters given
      // it creates a temporary query object
      if(this.debug) sys.log('conditions: ' + conditions);
      if(this.debug) sys.log('parameters: ' + parameters);
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