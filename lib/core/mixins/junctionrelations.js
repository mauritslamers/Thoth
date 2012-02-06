
// Junction table relation mixin. 
// This relation mixins doesn't cache and will retrieve all records from a junction table in order to update
// relations.
// 
// This mixin will try to resolve relations using only a junction table


var sys = require('../Tools').sys;
var API = require('../API');
var C = require('../Constants');

exports.RelationsByJunctionTable = {
  
  primaryKey: 'id',  // junction relations require some default primary key value, if you need something else, please override it!

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
  junctionKeyName: function(modelname,modelPrimaryKey,isPlural){
   var prKey = modelPrimaryKey || this.primaryKey; // use modelPrimaryKey if present
   var name = [modelname,prKey].join("_"); 
   var ret = isPlural? name + "s": name;
   return ret;
  },
  
  //three situations:
  // join table:
  // student: { id: 1 }, exam_student: { student_id: 1, exam_id: 1 }, exam: {id: 1}
  // direct relation, where student isMaster, request would be from the exam side
  // student: { id: 1, exam_id: 1 }, exam: {id: 1, student: _relation_ } 
  // direct relation where exam isMaster, request would be from the student side
  // student: { id: 1, exam: _relation_ }, exam: {id: 1, student_id: 1}
  
  _sharedReducer: function(data,relation,storeRequest){
    var isPlural = (relation.isDirectRelation && relation.get('isToMany'));
    var relationFieldName = this.junctionKeyName(storeRequest.bucket, storeRequest.primaryKey, isPlural);
    var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    
    return function(prevVal,currentVal){
      var ret = prevVal? prevVal: { keys: [], data: {} };
      var recs = data.filterProperty(relationFieldName,currentVal);
      if(recs.length>0){
        ret.keys.push(currentVal);
        if(relation.isDirectRelation && relation.isChildRecord){
          ret.data[currentVal] = recs;
        }
        if(relation.isDirectRelation && !relation.isChildRecord){
          ret.data[currentVal] = recs[relationFieldName];
        }
        if(!relation.isDirectRelation){
          ret.data[currentVal] = recs[oppositeFieldName];
          if(relation.isChildRecord){
            if(!ret.oppKeys) ret.oppKeys = [];
            ret.oppKeys.push(recs[oppositeFieldName]);            
          }
        }
      }
      return ret;
    };
  },
  
  fetchRelation: function(storeRequest,records,relation,callback){
    // this function can be used to get a single record or relation
     
    var conditions,params, primaryKeys, relStoreReq, opts, me = this;
    var relationTable = relation.isDirectRelation? relation.bucket: this.junctionTableName(storeRequest.bucket,relation.bucket);
    var mainRecords = records.isSCArray? records: [records]; //wrap as arrays, to be able to do filterProperty
    var relSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, data: {} };
    var isPlural = (relation.isDirectRelation && relation.get('isToMany'));
    var relationFieldName = this.junctionKeyName(storeRequest.bucket, storeRequest.primaryKey, isPlural);
    var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    
    if(!callback){
      return new Error("Thoth fetchRelation called without callback?!");
    } 
    
    // callback when using refreshDBRecord
    var refreshCallback = function(err,data){
      if(err) callback(err);
      else {
        relSet.keys = relation.keys;
        relSet.data[relSet.keys] = data;
        callback(relSet);
      }
    };
    
    // callback when using fetchDBRecords
    var fetchCallback = function(err,data){
      var childReq;
      var sortedData = primaryKeys.reduce(me._sharedReducer.call(me,data,relation,storeRequest));
      relSet.keys = sortedData.keys;
      relSet.data = sortedData.data;
      
      if(relation.isDirectRelation){
        sys.log('relation is Direct... so returning data...');
        callback(relSet); // all data is already there
      }
      else { // jointable case
        sys.log('is join table case... relation ischildrecord? ' + relation.isChildRecord);
        if(relation.isChildRecord){      // go and get the data
          sys.log('relation is childrecord...');
          if(relation.get('isToOne')){
            childReq = API.StoreRequest.create({
              requestType: C.ACTION_REFRESH,
              bucket: relation.bucket,
              key: sortedData.data[sortedData.keys[0]]
            });
            sys.log('firing off refreshDBRecord for childrecord for key: ' + childReq.key);
            me.refreshDBRecord(childReq,C.SOURCE_THOTH,function(err,childRec){
              var newRelSet = { bucket: storeRequest.bucket, 
                keys: sortedData.keys, propertyName: relation.propertyName, propertyKey: relation.propertyKey, data: {} }; 
              newRelSet.data[sortedData.keys[0]] = childRec;
              callback(newRelSet);             
            });
          }
          else {
            childReq = API.StoreRequest.create({ 
              requestType: C.ACTION_FETCH,
              bucket: relation.bucket,
              conditions: relation.primaryKey + " in {keys}",
              parameters: { keys: relSet.oppKeys },
              keys: relSet.oppKeys
            });
            me.fetchDBRecords(childReq,C.SOURCE_THOTH,function(err,childRecordData){
              var newRelSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, 
                                propertyKey: relation.propertyKey, data: {} };
              var childDataSet = primaryKeys.reduce(function(prevVal,curVal){
                var ret = prevVal? ret: { keys: [], data: {} };
                ret.keys.push(curVal);
                ret.data[curVal] = ret.data[curVal].map(function(val){
                  return childRecordData.findProperty(relation.primaryKey,val);
                });
                return ret;
              });
              newRelSet.keys = childDataSet.keys;
              newRelSet.data = childDataSet.data;
              callback(newRelSet);
            });            
          }
        }
        else callback(relSet)
      }
    };
    
    // if keys are available, use them
    if(relation.keys && (relation.keys.length > 0) ){
      primaryKeys = relation.keys;
    }
    else primaryKeys = mainRecords.getEach(storeRequest.primaryKey);
    
    if(relation.get('isToOne') && !(relation.keys instanceof Array) && relation.isChildRecord){
      // single direct relation with an id, get the direct record
      relStoreReq = API.StoreRequest.create({
        bucket: relation.bucket,
        key: relation.keys,
        requestType: C.ACTION_REFRESH
      });
      this.refreshDBRecord(relStoreReq,C.SOURCE_THOTH,refreshCallback);
    }
    else {       // all others, get by fetch
      relStoreReq = API.StoreRequest.create({
        requestType: C.ACTION_FETCH,
        bucket: relationTable,
        keys: primaryKeys,
        conditions : relationFieldName + " in {keys}",
        parameters : { keys: primaryKeys }   // keys are the primaryKey values of records
      });
      this.fetchDBRecords(relStoreReq,C.SOURCE_THOTH,fetchCallback);
    }
        
  },
  
  
       // 
       //   
       // fetchRelation: function(storeRequest,records,relation,callback){
       //   //sys.log('JunctionRelations fetchRelation called...');
       //   var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket,storeRequest.primaryKey,relation.primaryKey);
       //   this.getRelationSet(storeRequest,relation,records,junctionInfo,callback);
       // },
       // 
       // getRelationSet: function(storeRequest,relation,records,junctionInfo,callback){
       //    // retrieve the relations and add them to the records
       //    // the function needs a callback, because it cannot be predicted when the junction records 
       //    // will be returned here.
       //    // The callback is called with an object: { relationSet: { bucket: junctionInfo.modelBucket, keys: retkeys, propertyName: relation.propertyName, data: {} }}
       //    // data is an associative array with the primaryKeys as key and the relation array as value
       // 
       //    //sys.log('junctionRelations: getting Relation set for ' + sys.inspect(records));
       // 
       //    records = (records instanceof Array)? records: [records];
       //    var numRecs = records.length;
       //    var me = this;
       //    var relSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, data: {} };
       //    var primKey = this.primaryKey || 'id';
       //    var relCounter = 0; 
       // 
       //    var getRelationRecordCb = function(recKey){
       //      return function(err,data){
       //        if(!err){
       //          relSet.keys.push(recKey);
       //          relSet.data[recKey] = data;
       //        }
       //        relCounter+=1;
       //        if(relCounter === numRecs) callback(relSet);
       //      };
       //    };
       // 
       //    var fetchDBCb = function(err,junctionData){
       //      var rec, i, recKey, relationKeys, tSR;
       // 
       //      if(err){
       //        sys.log('trying fetching relation data for relation ' + sys.inspect(relation));
       //        sys.log('for storeRequest: ' + sys.inspect(storeRequest));
       //        sys.log('error was: ' + sys.inspect(err));
       //      }
       // 
       //      for(i=0;i<numRecs;i+=1){
       //        rec = records[i];
       //        recKey = rec[primKey] || rec.key;
       //        relationKeys = me._junctionDataFor(rec,junctionInfo,junctionData);
       //        if(relation.isChildRecord){
       //          tSR = { bucket: junctionInfo.relationBucket, keys: relationKeys };
       //          me.fetchDBRecords(tSR,"THOTH",getRelationRecordCb(recKey));
       //        }
       //        else {
       //          relSet.keys.push(recKey);
       //          relSet.data[recKey] = relationKeys;
       //        } 
       //      }
       //      if(!relation.isChildRecord) callback(relSet);
       //    };
       // 
       //    var fetchDBCbDirect = function(err,recordData){
       //      var i,rec,key;
       //      sys.log('fetchDBCbDirect...');
       // 
       //      var parseRec = function(rec){
       //        var tmp, order, sortdir, sortprop;
       //        key = rec[storeRequest.primaryKey];
       //        SC.RECDATA = recordData;
       //        // fetch all records from recorddata matching the relation key
       //        tmp = recordData.filterProperty(junctionInfo.modelRelationKey,key);
       //        if(relation.orderBy){
       //           //sys.log('relation orderBy: ' + relation.orderBy);
       //           order = relation.orderBy.split(" ");
       //           sortdir = order[0];
       //           sortprop = order[1];
       //           tmp = tmp.sortProperty(sortprop);
       //           if(sortdir === 'DESC') tmp = tmp.reverse();
       //         }   
       //        if(!relation.isChildRecord) tmp = tmp.getEach(me.primaryKey); // only get the primaryKey value
       //        relSet.keys.push(key);
       //        relSet.data[key] = tmp;
       //      };
       // 
       //      if(err){
       //        sys.log('trying fetching relation data for relation ' + sys.inspect(relation));
       //        sys.log('for storeRequest: ' + sys.inspect(storeRequest));
       //        sys.log('error was: ' + sys.inspect(err));
       //      }
       //      records.forEach(parseRec);
       //      sys.log('direct relation: sending back: ' + sys.inspect(relSet));
       //      callback(relSet);
       //    };
       // 
       //    if(relation.isDirectRelation){
       //      var conds = junctionInfo.modelRelationKey + " IN {keys}";
       //      var params = {keys:records.getEach(storeRequest.primaryKey)};
       //      this.fetchDBRecords({ bucket: junctionInfo.relationBucket, conditions: conds, parameters: params }, "THOTH", fetchDBCbDirect);
       //    }
       //    else this.fetchDBRecords({ bucket: junctionInfo.junctionBucket}, "THOTH", fetchDBCb); 
       // 
       //  // old.... 
       //    // sys.log("retrieving relation data for " + JSON.stringify(junctionInfo));
       //    // this.fetchDBRecords({bucket: junctionInfo.junctionBucket},function(junctionData){ // imitate sending a storeRequest
       //    //    var i,j,recLen=records.length,junctLen=junctionData.length; // indexes and lengths
       //    //    var currec, curRecKey,relationKeys, keys = [], data={};
       //    //    for(i=0;i<recLen;i++){
       //    //       currec = records[i];
       //    //       //sys.log("Parsing record: " + JSON.stringify(currec));
       //    //       // create the same fallback as for _junctionDataFor to "key" if the primaryKey doesn't exist on the record
       //    //       curRecKey = currec[primKey]? currec[primKey]: currec.key; 
       //    //       relationKeys = me._junctionDataFor(currec,junctionInfo,junctionData); 
       //    //       keys.push(curRecKey);
       //    //       data[curRecKey] = relationKeys;
       //    //    }
       //    //    var relSet = { relationSet: { bucket: junctionInfo.modelBucket, keys: keys, propertyName: relation.propertyName, data: data }};
       //    //    callback(relSet);
       //    // }); 
       // },
  
  
  //====
  
   // function to create a relation, keys need to be in relation.keys  
  createRelation: function(storeRequest,record,relation,clientId,callback){

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

  // function to destroy the relation data from relation, used by destroyRecord
  // first fetch all junction records belonging to the current record
  // storeRequest can also be a record  
  destroyRelation: function(storeRequest,relation,clientId,callback){

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
  

   
   // function to generate all junction information in one go
   getJunctionInfo: function(model,relation,modelPrimaryKey,relationPrimaryKey){
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
      
      // two types of relations: junction or direct
      if(relation.isDirectRelation){
        // two types of directRelation: isMaster or not
        if(relation.isMaster){
          
        }
        // else nothing, because we don't do updates of slaves
      }
      else {
        
      }
      
      // so get all relation data for the current record and relation
      // check whether junction records need to be deleted or created
      var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
      //console.log("Junction info: " + JSON.stringify(junctionInfo));
      var me = this;
      this.fetchDBRecords({bucket:junctionInfo.junctionBucket},{},function(err,junctionData){ 
        // use fetchDBRecords to retrieve relational records
         var relationKeys = relation.keys? relation.keys.copy(): [];
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