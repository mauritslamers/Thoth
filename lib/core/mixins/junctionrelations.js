
// Junction table relation mixin. 
// This relation mixins doesn't cache and will retrieve all records from a junction table in order to update
// relations.
// 
// This mixin will try to resolve relations using only a junction table

var Tools = require('../Tools');
var sys = Tools.sys;
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
  
  // this retrieves the proper records for a direct relation
  _retrieveDirectRelation: function(sR,recs,relation,callback){
    // get the keys and retrieve the records, sorting will be done against the records
    var req, relKeys, me = this;
    var bucket = relation.isMaster? sR.bucket: relation.bucket;
    var isPlural = (relation.isDirectRelation && relation.isMaster && relation.get('isToMany')); 
    var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    var relationFieldName = relation.relationKey || this.junctionKeyName(sR.bucket, sR.primaryKey, isPlural); 
    var isSingleRec = (relation.get('isToOne') && (recs.length === 1));
    
    var cb = function(err,data){
      var ret;
      if(!err){
        ret = (data instanceof Array)? me._filterRecordsByQuery(data, req.conditions, req.parameters): [data];
        callback(ret);
      }
    };
    
    // if isMaster we have the ids in the main record, otherwise we have to search against the record primaryKeys
    if(relation.isMaster){
      if(relation.isChildRecord){ 
        relKeys = recs.getEach(oppositeFieldName).flatten();
        if(isSingleRec){
          req = API.StoreRequest.create({
            bucket: relation.bucket,
            key: relKeys[0],
            requestType: C.ACTION_REFRESH
          });
        }
        else {
          req = API.StoreRequest.create({ 
            bucket: bucket,
            requestType: C.ACTION_FETCH,
            keys: relKeys,
            conditions: relation.primaryKey + " ANY {keys}",
            parameters: {keys: relKeys}
          }); 
        }
      }
      else sys.log('trying to retrieve a key that is already present on the record');
    }
    else {
      req = API.StoreRequest.create({
        bucket: bucket,
        requestType: C.ACTION_FETCH,
        conditions: relationFieldName + " ANY {keys}",
        parameters: {keys: recs.getEach(sR.primaryKey) } 
        // check relationFieldName against all the primarykey values of the main record
      });
    }  
    
    if(req.requestType === C.ACTION_REFRESH) this.refreshDBRecord(req,C.SOURCE_THOTH,cb);
    else this.fetchDBRecords(req,C.SOURCE_THOTH,cb);
  },
  
  _filterProperty: function(data,property,values){ // filter multiple values
    //sys.log('filterProperty: filtering ' + property + ' against values: ' + values);
    var mult = function(val){
      return values.contains(val[property]);
    };
    
    return (values instanceof Array)? data.filter(mult): data.filterProperty(property,values);
  },
  
  _retrieveJunctionRelation: function(sR,recs,relation,callback){
    var me = this;
    var isPlural = (relation.isDirectRelation && relation.isMaster && relation.get('isToMany'));
    // in a relation from student to exam, relationFieldName is student_id, oppositeFieldName is exam_id
    var mainSideFieldName = this.junctionKeyName(sR.bucket, sR.primaryKey, isPlural);
    var relationSideFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    
    var mainPrimaryKeys = recs.getEach(sR.primaryKey);
    
    var req = API.StoreRequest.create({
      requestType: C.ACTION_FETCH,
      bucket: this.junctionTableName(sR.bucket, relation.bucket), 
      conditions : mainSideFieldName + " ANY {keys}",
      parameters : { keys: mainPrimaryKeys }   // keys are the primaryKey values of records
    });
    
    this.fetchDBRecords(req,C.SOURCE_THOTH,function(err,data){ // junction table records
      if(!err){
        callback(me._filterRecordsByQuery(data,req.conditions,req.parameters));
      }
    });
    
  },
  
  _retrieveJunctionChildren: function(sR,relation,junctionRecs,relSet,callback){
    // in a relation from student to exam, relationFieldName is student_id, oppositeFieldName is exam_id
    var mainSideFieldName = this.junctionKeyName(sR.bucket, sR.primaryKey, false);
    var relationSideFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, false); 
    var me = this;   
    
    var relationIds = junctionRecs.getEach(relationSideFieldName);
    var req;
    if(junctionRecs.length === 1){ // single record, use refreshDBRecord
      req = API.StoreRequest.create({
        requestType: C.ACTION_REFRESH,
        bucket: relation.bucket,
        key: relationIds[0]
      });
      this.refreshDBRecord(req,C.SOURCE_THOTH,function(err,data){
        relSet.keys = relationIds[0];
        relSet.data[relationIds[0]] = data || null;
        callback(relSet);
      });
    }
    else { // otherwise use fetchDBRecords
      req = API.StoreRequest.create({
        requestType: C.ACTION_FETCH,
        bucket: relation.bucket,
        keys: relationIds,
        conditions: relation.primaryKey + " ANY {keys}",
        parameters: { keys: relationIds }
      });
      this.fetchDBRecords(req,C.SOURCE_THOTH,function(err,data){
        var childrecs = me._filterRecordsByQuery(data,req.conditions,req.parameters);
        var childrecmap = {};
        childrecs.forEach(function(rec){
          var pk = rec[relation.primaryKey];
          childrecmap[pk] = rec;
        });
        //sys.log('childrecmap: ' + sys.inspect(childrecmap));
        // parse relSet and replace the ids of the relations with the actual object
        relSet.keys.forEach(function(key){
          var relpks = relSet.data[key];
          if(relpks instanceof Array){
            relSet.data[key] = relpks.map(function(k){
              return childrecmap[k];
            }).without(undefined); // filter out unwanted stuff
          }
          else relSet.data[key] = childrecmap[relpks] || null; // if toOne
        });
        callback(relSet);
      });
    }
  },
  
  fetchRelation: function(sR,records,relation,callback){
    var me = this;
    var mainPrimaryKey = sR.primaryKey;
    var recs = (records instanceof Array)? records: [records];
    var isPlural = (relation.isDirectRelation && relation.isMaster && relation.get('isToMany'));
    // in a relation from student to exam, mainSideFieldName is student_id, relationSideFieldName is exam_id
    // relation.relationKey can override the mainSideFieldName
    var mainSideFieldName = relation.relationKey || this.junctionKeyName(sR.bucket, sR.primaryKey, isPlural);
    var relationSideFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    var relSetTemplate = { keys: [], data: {}, propertyName: relation.propertyName, propertyKey: relation.propertyKey };
    
    if(relation.isDirectRelation){
      this._retrieveDirectRelation(sR,recs,relation,function(data){
        // data contains a set of records, now we have to match them against the recs
        var result = recs.reduce(function(ret,rec){
          var recdata, pk = rec[mainPrimaryKey];
          ret.keys.push(pk);
          if(relation.isMaster){
            recdata = me._filterProperty(data,relation.primaryKey,rec[relationSideFieldName]); // exam.id === student.exam_id
          }
          else {
            recdata = me._filterProperty(data,mainSideFieldName,pk); // exam.student_id === student.id
          }
          recdata = relation.isChildRecord? recdata: recdata.getEach(relation.primaryKey);
          ret.data[pk] = relation.get('isToOne')? recdata[0] || null: recdata;
          return ret;
        },relSetTemplate);
        callback(result);
      });
    }
    else {
      this._retrieveJunctionRelation(sR,recs,relation,function(data){
        var relSet = relSetTemplate;
        data.forEach(function(jrec){
          var mainPk = jrec[mainSideFieldName];
          var relPk = jrec[relationSideFieldName];
          if(!relSet.keys.contains(mainPk)) relSet.keys.push(mainPk);
          if(relation.get('isToOne')){ // only take the last of the relation records in case of toOne
            relSet.data[mainPk] = relPk;
          }
          else {
            if(!relSet.data[mainPk]) relSet.data[mainPk] = [];
            relSet.data[mainPk].push(relPk);
          }
        });
        if(!relation.isChildRecord) callback(relSet);
        else {
          //sys.log('relation: ' + sys.inspect(relation));
          //sys.log('indirect childrecords: relSet: ' + sys.inspect(relSet));
          me._retrieveJunctionChildren(sR,relation,data,relSet,function(newRelSet){
            callback(newRelSet);
          });
        }
      });
    }
  },
    
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
         var relationKeys = relation.keys? Tools.copy(relation.keys): [];
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