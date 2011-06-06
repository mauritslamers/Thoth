/*
Junction table relation mixin. 
This relation mixins doesn't cache and will retrieve all records from a junction table in order to update
relations.

This mixin will try to resolve relations using only a junction table
*/

var sys = require('sys');

exports.RelationsByJunctionTable = {
  
  createRelation: function(storeRequest,record,relation,clientId,callback){
     // function to create a relation, keys need to be in relation.keys
     var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
     //sys.puts("trying to create a set of relation records for master bucket " + storeRequest.bucket + " and related bucket: " + relation.bucket);
     //sys.puts("the relation is: " + JSON.stringify(relation));
     //sys.puts("the clientId is: " + clientId);
     var relationKeys = relation.keys;
     var masterKey = record[this.primaryKey] || 'id';
     var newRelRec, noKey = null;
     for(var i=0,len=relationKeys.length;i<len;i++){
        newRelRec = {};
        newRelRec[junctionInfo.modelRelationKey] = masterKey;
        newRelRec[junctionInfo.relationRelationKey] = relationKeys[i];
        // now save by making up a storeRequest
        this.createDBRecord({bucket:junctionInfo.junctionBucket,key:noKey,recordData:newRelRec},clientId); // don't do callbacks on relations for the moment
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
     var primKey = this.primaryKey || 'id';
     this.fetchDBRecords(junctionInfo.junctionBucket,function(err,junctionData){
        // get all junctioninfo for the current record
        var junctionRecs = me._junctionDataFor(storeRequest,junctionInfo,junctionData,true); // have it return the entire junction record
        var curJuncKey;
        for(var i=0,len=junctionRecs.length;i<len;i++){
           curJuncKey=junctionRecs[i][primKey];
           me.deleteDBRecord({bucket:junctionInfo.junctionBucket,key:curJuncKey},clientId); // fake a storeRequest
        }
        // in this implementation there is no error check...
        if(callback) callback(YES);
     });
  },
  
  // relation resolving functions
   // Feel free to override them to have your own custom behaviour.
   // The standard functions create the junction table name by taking 
   // both resource names, sort them alphabetically and then join them by 
   // putting an underscore between them


   junctionTableName: function(sideOne,sideTwo){
      return [sideOne,sideTwo].sort().join("_");
   },
   
   // function to generate a key name of a resource in the junction table
   // the standard is to take the resource name and add "_key" to it
   junctionKeyName: function(modelname,modelPrimaryKey){
     var prKey = this.primaryKey; // use modelPrimaryKey if present
     return [modelname,prKey].join("_"); 
   },
   
   // function to generate all junction information in one go
   getJunctionInfo: function(model,relation,modelPrimaryKey,relationPrimaryKey){
      // return an object with all generated information about the relation:
      // { modelBucket: '', relationBucket: '', junctionBucket: '', modelRelationKey: '', relationRelationKey: ''}
      return {
        modelBucket: model,
        relationBucket: relation,
        junctionBucket: this.junctionTableName(model,relation),
        modelRelationKey: this.junctionKeyName(model,modelPrimaryKey),
        relationRelationKey: this.junctionKeyName(relation,relationPrimaryKey)
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
   // parse the junctionData and search for the relations of the record in record
   // return an array of keys of the opposite of the relation if allInfo is false
   // if it is true, it returns the entire record
   _junctionDataFor: function(record,junctionInfo,junctionData,allInfo){
      var i, juncLen=junctionData.length;
      var modelKeyName = junctionInfo.modelRelationKey;
      var relationKeyName = junctionInfo.relationRelationKey;
      // create a fallback to "key" if the id doesn't exist. Necessary for refreshRecord requests, in that case record is the request information
      var curRecKey = record[this.primaryKey]? record[this.primaryKey]: record.key; 
      
      var ret = [], curJuncRec;
      for(i=0;i<juncLen;i++){
         curJuncRec = junctionData[i];
         //sys.log("Parsing junction record: " + JSON.stringify(curJuncRec));
         if(curJuncRec[modelKeyName] == curRecKey){
            if(allInfo) ret.push(curJuncRec);
            else ret.push(curJuncRec[relationKeyName]);
         } 
      }
      return ret;
   },
   
   fetchRelation: function(storeRequest,records,relation,callback){
     //sys.log('JunctionRelations fetchRelation called...');
     var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket,storeRequest.primaryKey,relation.primaryKey);
     this.getRelationSet(storeRequest,relation,records,junctionInfo,callback);
   },

   getRelationSet: function(storeRequest,relation,records,junctionInfo,callback){
      // retrieve the relations and add them to the records
      // the function needs a callback, because it cannot be predicted when the junction records 
      // will be returned here.
      // The callback is called with an object: { relationSet: { bucket: junctionInfo.modelBucket, keys: retkeys, propertyName: relation.propertyName, data: {} }}
      // data is an associative array with the primaryKeys as key and the relation array as value

      //sys.log('junctionRelations: getting Relation set for ' + sys.inspect(records));
      
      records = (records instanceof Array)? records: [records];
      var numRecs = records.length;
      var me = this;
      var relSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, data: {} };
      var primKey = this.primaryKey || 'id';
      var relCounter = 0; 
      
      var getRelationRecordCb = function(recKey){
        return function(err,data){
          if(!err){
            relSet.keys.push(recKey);
            relSet.data[recKey] = data;
          }
          relCounter+=1;
          if(relCounter === numRecs) callback(relSet);
        };
      };
      
      var fetchDBCb = function(err,junctionData){
        var rec, i, recKey, relationKeys, tSR;
        
        if(err){
          sys.log('trying fetching relation data for relation ' + sys.inspect(relation));
          sys.log('for storeRequest: ' + sys.inspect(storeRequest));
          sys.log('error was: ' + sys.inspect(err));
        }
        
        for(i=0;i<numRecs;i+=1){
          rec = records[i];
          recKey = rec[primKey] || rec.key;
          relationKeys = me._junctionDataFor(rec,junctionInfo,junctionData);
          if(relation.isChildRecord){
            tSR = { bucket: junctionInfo.relationBucket, keys: relationKeys };
            me.fetchDBRecords(tSR,"THOTH",getRelationRecordCb(recKey));
          }
          else {
            relSet.keys.push(recKey);
            relSet.data[recKey] = relationKeys;
          } 
        }
        if(!relation.isChildRecord) callback(relSet);
      };
      
      var fetchDBCbDirect = function(err,recordData){
        var i,rec,key;
        sys.log('fetchDBCbDirect...');
        if(err){
          sys.log('trying fetching relation data for relation ' + sys.inspect(relation));
          sys.log('for storeRequest: ' + sys.inspect(storeRequest));
          sys.log('error was: ' + sys.inspect(err));
        }

        records.forEach(function(rec){
          var tmp;
          key = rec[storeRequest.primaryKey];
          tmp = recordData.filterProperty(junctionInfo.modelRelationKey,key);
          if(!relation.isChildRecord) tmp = tmp.getEach(me.primaryKey);
          relSet.keys.push(key);
          relSet.data[key] = tmp;
        });
        //sys.log('direct relation: sending back: ' + sys.inspect(relSet));
        callback(relSet);
      };
      
      if(relation.isDirectRelation){
        var conds = junctionInfo.modelRelationKey + " IN {keys}";
        var params = {keys:records.getEach(storeRequest.primaryKey)};
        this.fetchDBRecords({ bucket: junctionInfo.relationBucket, conditions: conds, parameters: params }, "THOTH", fetchDBCbDirect);
      }
      else this.fetchDBRecords({ bucket: junctionInfo.junctionBucket}, "THOTH", fetchDBCb); 
      
/*      
      sys.log("retrieving relation data for " + JSON.stringify(junctionInfo));
      this.fetchDBRecords({bucket: junctionInfo.junctionBucket},function(junctionData){ // imitate sending a storeRequest
         var i,j,recLen=records.length,junctLen=junctionData.length; // indexes and lengths
         var currec, curRecKey,relationKeys, keys = [], data={};
         for(i=0;i<recLen;i++){
            currec = records[i];
            //sys.log("Parsing record: " + JSON.stringify(currec));
            // create the same fallback as for _junctionDataFor to "key" if the primaryKey doesn't exist on the record
            curRecKey = currec[primKey]? currec[primKey]: currec.key; 
            relationKeys = me._junctionDataFor(currec,junctionInfo,junctionData); 
            keys.push(curRecKey);
            data[curRecKey] = relationKeys;
         }
         var relSet = { relationSet: { bucket: junctionInfo.modelBucket, keys: keys, propertyName: relation.propertyName, data: data }};
         callback(relSet);
      }); */
   },
   
   getRelationKeys: function(relation,record,junctionInfo,callback){
      // this function does more or less the same as getRelationSet, but only for one record
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
      //console.log("Junction info: " + JSON.stringify(junctionInfo));
      var me = this;
      this.fetchDBRecords({bucket:junctionInfo.junctionBucket},{},function(err,junctionData){ 
        // use fetchDBRecords to retrieve relational records
         var relationKeys = relation.keys.copy();
         var junctionRecs = me._junctionDataFor(storeRequest,junctionInfo,junctionData,true); // get all info on the records
         var relationsIndex,curRelKey;
         for(var i=0,l=junctionRecs.length;i<l;i++){
            curRelKey = junctionRecs[i][junctionInfo.relationRelationKey];
            relationsIndex = relationKeys.indexOf(curRelKey);
            if(relationsIndex == -1){ // not found, so delete the record
               me.deleteDBRecord({bucket: junctionInfo.junctionBucket, key:junctionRecs[i][me.primaryKey]}, clientId);
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
         var newRelRec, masterKey = storeRequest.key? storeRequest.key: record.key;
         var noKey = null; 
         //console.log('creating new relation records for ' + JSON.stringify(relationKeys));
         for(var j=0;j<numrelations;j++){
            newRelRec = {};
            newRelRec[junctionInfo.modelRelationKey] = masterKey;
            newRelRec[junctionInfo.relationRelationKey] = relationKeys[j];
            me.createDBRecord({bucket:junctionInfo.junctionBucket,key:noKey,recordData:newRelRec},clientId); // don't do callbacks on relations for the moment
         }
         // it might be a nice idea to have a callback here that creates a new relationSet which can be 
         // distributed...
         if(callback) callback(relation);
      });
   }
  
};