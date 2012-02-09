
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
  
  // this retrieves the proper records for a direct relation
  _retrieveDirectRelation: function(sR,recs,relation,callback){
    // get the keys and retrieve the records, sorting will be done against the records
    var req, relKeys, me = this;
    var bucket = relation.isMaster? sR.bucket: relation.bucket;
    var isPlural = (relation.isDirectRelation && relation.isMaster && relation.get('isToMany')); 
    var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    var relationFieldName = this.junctionKeyName(sR.bucket, sR.primaryKey, isPlural);
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
    // in a relation from student to exam, relationFieldName is student_id, oppositeFieldName is exam_id
    var mainSideFieldName = this.junctionKeyName(sR.bucket, sR.primaryKey, isPlural);
    var relationSideFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
    
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
        }, { keys: [], data: {} });
        callback(result);
      });
    }
    else {
      this._retrieveJunctionRelation(sR,recs,relation,function(data){
        var relSet = { keys: [], data: {} };
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
  
  // 
  // 
  // _sharedReducer: function(data,relation,storeRequest){
  //   var isPlural = (relation.isDirectRelation && relation.get('isToMany')); // fromMany?
  //   var relationFieldName = this.junctionKeyName(storeRequest.bucket, storeRequest.primaryKey, isPlural);
  //   var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
  //   var fp = this._filterProperty;
  //   //var ret = { keys: [], data: {} };
  //   //sys.log('_shared reducer is called....');
  //   return function(prevVal,currentVal){
  //     //sys.log('reducer called...');
  //     var recs = relation.isDirectRelation? fp(data,relation.primaryKey,currentVal): fp(data,relationFieldName,currentVal);
  //     var keys;
  //     sys.log('recs: ' + sys.inspect(recs));
  //     sys.log('currentVal: ' + currentVal);
  //     if(recs.length>0){
  //       prevVal.keys.push(currentVal);
  //       if(relation.isDirectRelation && relation.isChildRecord){
  //         prevVal.data[currentVal] = relation.get('isToOne')? recs[0]: recs;
  //       }
  //       if(relation.isDirectRelation && !relation.isChildRecord){
  //         keys = recs.filterProperty(relationFieldName).getEach(relation.primaryKey);
  //         prevVal.data[currentVal] = relation.get('isToOne')? keys[0]: keys;
  //       }
  //       if(!relation.isDirectRelation){
  //         keys = recs.getEach(oppositeFieldName);
  //         prevVal.data[currentVal] = relation.get('isToOne')? keys[0]: keys;
  //         if(relation.isChildRecord){
  //           if(!prevVal.oppKeys) prevVal.oppKeys = [];
  //           prevVal.oppKeys = prevVal.oppKeys.concat(recs.getEach(oppositeFieldName));            
  //         }
  //       }
  //     }
  //     else {
  //       prevVal.keys.push(currentVal);
  //       prevVal.data[currentVal] = relation.get('isToOne')? null: [];
  //     }
  //     return prevVal;
  //   };
  // },
  // 
  // fetchRelation: function(storeRequest,records,relation,callback){
  //   // this function can be used to get a single record or relation
  //    
  //   var relationPrimaryKeys, relStoreReq, opts, me = this;
  //   var relationTable = relation.isDirectRelation? relation.bucket: this.junctionTableName(storeRequest.bucket,relation.bucket);
  //   var mainRecords = records.isSCArray? records: [records]; //wrap as arrays, to be able to do filterProperty
  //   var mainPrimaryKeys = mainRecords.getEach(storeRequest.primaryKey).without(undefined);
  //   var relSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, data: {} };
  //   var isPlural = (relation.isDirectRelation && relation.isMaster && relation.get('isToMany'));
  //   // in a relation from student to exam
  //   // relationFieldName is student_id
  //   // oppositeFieldName is exam_id
  //   var relationFieldName = this.junctionKeyName(storeRequest.bucket, storeRequest.primaryKey, isPlural);
  //   var oppositeFieldName = this.junctionKeyName(relation.bucket, relation.primaryKey, isPlural);
  //   
  //   if(!callback){
  //     return new Error("Thoth fetchRelation called without callback?!");
  //   } 
  //   
  //   // callback when using refreshDBRecord
  //   var refreshCallback = function(err,data){
  //     if(err) callback(err);
  //     else {
  //       relSet.keys = relationPrimaryKeys;//relation.keys || data[relation.primaryKey];
  //       relSet.data[relSet.keys[0]] = data;
  //       callback(relSet);
  //     }
  //   };
  //   
  //   // callback when using fetchDBRecords
  //   var fetchCallback = function(err,data){
  //     //sys.log('fetchCallback arguments: ' + sys.inspect(arguments));
  //     var childReq,sortedData;
  // 
  //     if(relation.isDirectRelation && relation.isMaster){
  //       sortedData = relationPrimaryKeys.reduce(me._sharedReducer.call(me,data,relation,storeRequest), { keys: [], data: {} });  
  //     }
  //     else sortedData = mainPrimaryKeys.reduce(me._sharedReducer.call(me,data,relation,storeRequest), { keys: [], data: {} });  
  // 
  //     sys.log('mainPrimaryKeys: ' + mainPrimaryKeys);
  //     sys.log('sortedData: ' + sys.inspect(sortedData));
  //     relSet.keys = sortedData.keys;
  //     relSet.data = sortedData.data;
  //     
  //     if(relation.isDirectRelation){
  //       sys.log('relation is Direct... so returning data...');
  //       callback(relSet); // all data is already there
  //     }
  //     else { // jointable case
  //       sys.log('is join table case... relation ischildrecord? ' + relation.isChildRecord);
  //       if(relation.isChildRecord){      // go and get the data
  //         sys.log('relation is childrecord...');
  //         if(relation.get('isToOne')){
  //           if(sortedData.keys.length > 0){
  //             childReq = API.StoreRequest.create({
  //               requestType: C.ACTION_REFRESH,
  //               bucket: relation.bucket,
  //               key: sortedData.data[sortedData.keys[0]]
  //             });
  //             sys.log('firing off refreshDBRecord for childrecord for key: ' + childReq.key);
  //             me.refreshDBRecord(childReq,C.SOURCE_THOTH,function(err,childRec){
  //               var newRelSet = { bucket: storeRequest.bucket, 
  //                 keys: sortedData.keys, propertyName: relation.propertyName, propertyKey: relation.propertyKey, data: {} }; 
  //               if(childRec) newRelSet.data[sortedData.keys[0]] = childRec;
  //               else newRelSet.data[sortedData.keys[0]] = null; // empty object is relation exists, but target cannot be found
  //               callback(newRelSet);             
  //             });              
  //           }
  //           else {
  //             callback(relSet);
  //           }
  //         }
  //         else {
  //           sys.log('firing off fetchDBRecords for keys: ' + sortedData.oppKeys);
  //           childReq = API.StoreRequest.create({ 
  //             requestType: C.ACTION_FETCH,
  //             bucket: relation.bucket,
  //             conditions: relation.primaryKey + " in {keys}",
  //             parameters: { keys: sortedData.oppKeys },
  //             keys: sortedData.oppKeys
  //           });
  //           me.fetchDBRecords(childReq,C.SOURCE_THOTH,function(err,childRecordData){
  //             var newRelSet = { bucket: storeRequest.bucket, keys: [], propertyName: relation.propertyName, 
  //                               propertyKey: relation.propertyKey, data: {} };
  //             sys.log('second fetchDBRecords: childRecordData: ' + sys.inspect(childRecordData)); 
  //             
  //             var filterProperty = function(property,values){ // filter multiple values
  //               sys.log('filterProperty: filtering ' + property + ' against values: ' + values);
  //               return childRecordData.filter(function(val){
  //                 var recval = val[property];
  //                 return values.some(function(v){
  //                   return v === recval;
  //                 });
  //               });
  //             };
  //                              
  //             // this function takes the keys and data from sortedData, and filters the record data from 
  //             // the childRecordData fitting to the sortedData...
  //             var childDataSet = sortedData.keys.reduce(function(prevVal,curVal){
  //               var ret;
  //               prevVal.keys.push(curVal);
  //               // now data[curVal] is either a number, string or an array
  //               if(sortedData.data[curVal] instanceof Array){
  //                 ret = filterProperty(relation.primaryKey,sortedData.data[curVal]);
  //               }
  //               else {
  //                 ret = childRecordData.findProperty(relation.primaryKey,curVal);
  //               }
  //               sys.log('ret value of filtering: ' + sys.inspect(ret));
  //               prevVal.data[curVal] = ret; //(relation.isChildRecord && (ret.length === 0))? {}: ret;
  //               sys.log('result of filtering: ' + sys.inspect(prevVal.data[curVal]));
  //               return prevVal;
  //             },{ keys: [], data: {} });
  //             newRelSet.keys = childDataSet.keys;
  //             newRelSet.data = childDataSet.data;
  //             callback(newRelSet);
  //           });            
  //         }
  //       }
  //       else callback(relSet)
  //     }
  //   };
  //   
  //   // if keys are available, use them
  //   sys.log('relation.keys ' + sys.inspect(relation.keys));
  //   if(relation.keys){ 
  //     // this first part is plainly wrong... 
  //     // relation.keys contains the ids of the relation, not the primary Keys of the main records...
  //     relationPrimaryKeys = (relation.keys.length > 0)? relation.keys: [relation.keys];
  //   }
  //   else relationPrimaryKeys = mainRecords.getEach(oppositeFieldName).without(undefined);
  //   sys.log('mainRecords: ' + sys.inspect(mainRecords));
  //   sys.log('oppositeFieldName: ' + oppositeFieldName);
  //   sys.log('getEach result: ' + sys.inspect(mainRecords.getEach(oppositeFieldName)));
  //   sys.log('relationPrimaryKeys length: ' + relationPrimaryKeys.length);
  //   sys.log('relationPrimaryKeys: ' + sys.inspect(relationPrimaryKeys));
  //   
  //   if(relation.get('isToOne') && (relationPrimaryKeys.length > 0) && relation.isChildRecord && relation.isDirectRelation){
  //     // single direct relation with an id, get the direct record
  //     sys.log('direct relation and data clear, so direct refresh...');
  //     if(!relationPrimaryKeys) { // 
  //       callback(relSet);
  //     }
  //     else {
  //       relStoreReq = API.StoreRequest.create({
  //         bucket: relation.bucket,
  //         key: relationPrimaryKeys[0],
  //         requestType: C.ACTION_REFRESH
  //       });
  //       this.refreshDBRecord(relStoreReq,C.SOURCE_THOTH,refreshCallback);        
  //     }
  //   }
  //   else {       // all others, get by fetch
  //     sys.log('mainPrimaryKeys: ' + sys.inspect(mainPrimaryKeys));
  //     relStoreReq = API.StoreRequest.create({
  //       requestType: C.ACTION_FETCH,
  //       bucket: relationTable,
  //       keys: mainPrimaryKeys, 
  //       conditions : relationFieldName + " in {keys}",
  //       parameters : { keys: mainPrimaryKeys }   // keys are the primaryKey values of records
  //     });
  //     this.fetchDBRecords(relStoreReq,C.SOURCE_THOTH,fetchCallback);
  //   }
  //       
  // },
  
  
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