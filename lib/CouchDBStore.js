/*
An attempt at writing a CouchDB store adapter for Thoth
*/

var CouchDB = require('./node-couchdb');
var sys = require('./core/Tools').sys;

var Store = require('./core/Store').Store;


exports.CouchDBStore = Store.extend({
  
  host: null,
  
  port: 5984,
  
  primaryKey: '_id',
  
  relationDesignName: 'ThothRelation', 
  
  automaticallyCreateDatabase: YES, 
  // maybe null for cascading purposes? (class var now instead of instance var)
  
  automaticallyCreateRelationViews: YES,  
  
  debug: NO, // set to yes to have node-couchDB show the actual HTTP calls it performs in the Thoth Log.
      
  getClient: function(){
    return CouchDB.createClient(this.port, this.host,null,null,this.debug);
  },

  start: function(){
    return true; // we don't need the start function for the moment...
  },
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
  
  /*
  node-couchdb examples:
  db
    .saveDoc('my-doc', {awesome: 'couch fun'}, function(er, ok) {
      if (er) throw new Error(JSON.stringify(er));
      sys.puts('Saved my first doc to the couch!');
    });

  db
    .getDoc('my-doc', function(er, doc) {
      if (er) throw new Error(JSON.stringify(er));
      sys.puts('Fetched my new doc from couch:');
      sys.p(doc);
    });
  */
  
  fetchDBRecords: function(storeRequest,clientId,callback){  
    /*
    db.allDocs(query)

    Wrapper for GET /db-name/_all_docs. query allows to specify options for this view.
    */
    sys.log('CouchDB fetchDBRecords');
    var bucket = storeRequest.bucket;
    var db = this.getClient().db(bucket);
    var me = this;
    db.allDocs({include_docs:true},function(er,result){
      if(er){ 
        sys.log('Error while fetching from CouchDB: ' + sys.inspect(er));
        if((er.error == "not_found") && me.automaticallyCreateDatabase){
          db.create();
        }
        callback(er,[]);
      }
      else {
        var ret = me.fetchDocsFromResult(result);
        sys.log('calling callback for ' + bucket + ' with result: ' + sys.inspect(ret,false,10));
        callback(er,ret);
      }
    });
    sys.log('ending couchdb fetchDBRecords');
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    //we are doing a fetch all here... probably needs something different
    db.getDoc(storeRequest.key, function(er,result){
      if(er){
        sys.log('Error while retrieving from CouchDB: ' + sys.inspect(er));
        if(callback) callback(er);
      } 
      else {
        sys.log('calling refresh callback with result: ' + sys.inspect(result));        
        if(callback) callback(null,result); 
      } 
    });    
  },
  
  /*
  db.getDoc(id)
  Wrapper for GET /db-name/doc-id. Fetches a document with a given id from the database.

  db.saveDoc(id, doc)
  Wrapper for PUT /db-name/doc-id. Saves a json doc with a given id.

  db.saveDoc(doc)
  Same as the above, but the id can either a property of doc, or omitted to let CouchDB generate a uuid for this new document.

  db.removeDoc(id, rev)
  Deletes document id with rev from the db.
  */
  // need to think about a way to get the clientId in the request
  createDBRecord: function(storeRequest,clientId,callback){
    var me = this;
    var db = this.getClient().db(storeRequest.bucket);
    var saveFunc = function(db){
      return function(){
        db.saveDoc(storeRequest.recordData, function(err,result){
          if(err){
            if(err.error == 'not_found'){
              sys.log('CouchDB: even while db.exists says the db should exist, CouchDB reports not_found. Retrying...');
              saveFunc(db)(); // retry
            } 
            callback(err);
            sys.log('Error while creating in CouchDB: ' + sys.inspect(err));
          }
          else {
            sys.log('calling create callback with result: ' + sys.inspect(result));
            var ret = storeRequest.recordData;
            ret[me.primaryKey] = result[me.primaryKey];
            ret.key = result.id; // force a key to be available on the record
            ret.id = result.id; // quick hack for SC?
            ret._rev = result.rev; // force a revision to be available on the record
            callback(err,ret); // does couchdb give my record back? no, so use the original data with id and rev data
          }
        });
      };
    };
    
    db.exists(function(val){
      if(!val && me.automaticallyCreateDatabase) db.create(saveFunc(db));
      else saveFunc(db)();
    });
        
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    db.saveDoc(storeRequest.key, storeRequest.recordData, function(err,result){
      if(err){
        sys.log('Error while creating in CouchDB: ' + err);
        callback(err);
      } 
      else {
        sys.log('calling update callback with result: ' + sys.inspect(result));
        var ret = storeRequest.recordData;
        ret._rev = result.rev;
        callback(err,ret); // does couchdb give my record back? don't rely on it, just get the _rev
      }
    });
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    var db = this.getClient().db(storeRequest.bucket);
    var rev = storeRequest.recordData._rev;
    db.removeDoc(storeRequest.key, rev, function(err,result){
      if(err){
        sys.log('Error while deleting in CouchDB: ' + sys.inspect(err));
        callback(err);
      } 
      else {
        sys.log('calling delete callback with result: ' + sys.inspect(result)); 
        callback(err,YES); 
      }
    });
  },
  
  /*
  me.createRelation(storeRequest,newrec,relations[i],clientId);
  createRelation gets the store request, the record it should match against (model), a relation object
  containing a property keys containing the keys it should create a relation with, and a clientId
  */
  
  createRelation: function(storeRequest,record,relation,clientId){
    var recKey = storeRequest.key,
        relKeys = relation.keys,
        me = this,
        primKey = this.primaryKey,
        junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket),
        mK = junctionInfo.modelRelationKey,
        rK = junctionInfo.relationRelationKey,
        db = this.getClient().db(junctionInfo.junctionBucket);
        
        var createRels = function(db){
          return function(){
            var cb = function(er,result){
              if(er) sys.log('Error creating a relation for ' + junctionInfo.modelBucket + ': ' + sys.inspect(er));
            };
            var doc = {};
            doc[mK] = recKey;
            relKeys.forEach(function(key){
              doc[rK] = key;
              db.saveDoc(doc,cb);
            });            
          };
        };
        
        db.exists(function(val){
          if(!val) db.create(createRels(db)); // needed as parameter
          else createRels(db)(); // needed as func
        });
  },
  
  
  /*
  updateRelation is a function used by the updateRecord Store function to update existing relation
  This function is provided separately because it may well be the updating procedure is different
  or allows more tweaking for the specific DB.
  In addition it allows for caching of relations
  */
  
  updateRelation: function(storeRequest,record,relation,clientId,callback){
    var recKey = storeRequest.key,
        me = this,
        relKeys = relation.keys? relation.keys.copy() : null,
        primKey = this.primaryKey,
        junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket),
        modelBucket = storeRequest.bucket,
        junctionBucket = junctionInfo.junctionBucket,
        db = this.getClient().db(junctionBucket),
        mK = junctionInfo.modelRelationKey,
        rK = junctionInfo.relationRelationKey;

    if(!relKeys){
      sys.log("CouchDBStore: the application is trying to set relations, but the relation keys are null. This shouldn't happen!");
      if(callback) callback(null);
      return;
    } 
    
    var cb = function(er,result){
      if(er) sys.log('Error creating a relation for ' + jI.modelBucket + ': ' + sys.inspect(er));
    };    
    
    var updateRels = function(db){
      return function(){          
        var newDoc = {}, toRemove = [];
        db.view(me.relationDesignName,modelBucket,null,function(er,result){
          if(er){
            if(er.error = "not_found" && me.automaticallyCreateRelationViews){
              me.createRelationDesign(junctionInfo,updateRels);
            }
            else sys.log('CouchDB updateRelation error with ' + junctionBucket + ' :' + sys.inspect(er));
          }
          else {
            result.rows.forEach(function(item){
              var index = relKeys.indexOf(item._id);
              if(index == -1) toRemove.push(item);
              else relKeys.removeAt(index);
            });
            // now delete all in toRemove
            toRemove.forEach(function(item){
              db.removeDoc(item._id, item._rev);
            });
            newDoc[mK] = recKey;
            // and create all left in relKeys
            relKeys.forEach(function(item){
              newDoc[rK] = item;
              db.saveDoc(newDoc,cb);
            });
          } 
        });
      };
    };
    
    // we need to check both for the relation db as for the design for the relation
    db.exists(function(val){
      if(!val) db.create(updateRels(db));
      else updateRels(db)();
    }); 
  },
  
  /*
  destroyRelation is used by Thoth.Store to destroy all relation records for a certain record
  */
  
  destroyRelation: function(storeRequest,relation,clientId,callback){
    // function to delete a relation in the database from the storeRequests bucket and key to the relations bucket
    // so find the relations and destroy them. Uncertain whether relation contains a keys property 
    var recKey = storeRequest.key,
        me = this,
        primKey = this.primaryKey,
        junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket),
        db = this.getClient().db(junctionInfo.junctionBucket),
        querydata = { include_docs: true};
        
        db.exists(function(val){ // first check the junctionBucket exists
          if(val){
            db.view(me.relationDesignName,junctionInfo.modelBucket,querydata,function(er,result){
              if(er) sys.log('CouchDB destroyRelation error: ' + sys.inspect(er));
              else { // start destroying
                result.rows.forEach(function(item){
                  db.removeDoc(item.doc._id, item.doc._rev);
                });
              }
            });
          }// if the junctiondb doesn exist we cannot destroy a relation so don't do anything
        });
        
  },
  
  // function to generate all junction information in one go
  getJunctionInfo: function(model,relation){
     // return an object with all generated information about the relation:
     // { modelBucket: '', relationBucket: '', junctionBucket: '', modelRelationKey: '', relationRelationKey: ''}
     
     if(!model || !relation){
        sys.log("CouchDB: getJunctionInfo: SOMETHING FISHY IS GOING ON, relations without two sides??");
        sys.log("CouchDB: getJunctionInfo: Model is " + model + " and relation is " + relation);
     }
     
     return {
       modelBucket: model,
       relationBucket: relation,
       junctionBucket: this.junctionTableName(model,relation),
       modelRelationKey: this.junctionKeyName(model),
       relationRelationKey: this.junctionKeyName(relation)
     };
  },
  
  createRelationDesign: function(junctionInfo,callback){
    /*
    {"views":{
      modelBucket:{ 
        "map":"function(doc){ emit(doc.side1key,doc.side2key); }"
      },
      relationBucket:{
        "map":"function(doc){ emit(doc.side2key,doc.side1key); }"
      }
    } */
    
    /*
    installation layout: [junctionBucket]/_design/[this.relationDesignName]
    retrieval layout: [junctionBucket]/_design/[this.relationDesignName]/_view/[sideOne]
    
    */

    var modelBucket = junctionInfo.modelBucket,
        relBucket = junctionInfo.relationBucket,
        modelKey = junctionInfo.modelRelationKey,
        relKey = junctionInfo.relationRelationKey;

    var createMapFunc = function(modelKey, relationKey){
      var fH = "function(doc){";
      var mK = "var mK=doc." + modelKey + ";";
      var rK = "var rK=doc." + relationKey + ";";
      var fB = "if(mK && rK){emit(mK,rK);}}";
      var ret = [fH,mK,rK,fB].join("");
      //sys.log("createMapFunc: " + ret);
      return ret;
    };
    
    var view = { views: {} };
    view.views[modelBucket] = { map: createMapFunc(modelKey,relKey) };
    view.views[relBucket] = { map: createMapFunc(relKey,modelKey) };

    sys.log('CouchDB: trying to create relation design: ' + sys.inspect(view));
    var db = this.getClient().db(junctionInfo.junctionBucket);
    var me = this;
    // create saveDesign function creator, as we need twice the same function
    var saveDesign = function(db){
      return function(){
        db.saveDesign(me.relationDesignName,view,function(er,result){
          if(er){ 
            if(er.error = 'conflict') callback(); // ignore conflicts, and just do the callback
            else sys.log('createRelDesign error: ' + sys.inspect(er));
          }
          else {
            sys.log('createRelDesign success: ' + sys.inspect(result));
            callback();
          } 
        });        
      };
    };
    
    // first make sure the bucket exists, if it does, just call the result from saveDesign,
    // else first create, then call the result from saveDesign
    db.exists(function(val){
      if(!val) db.create(saveDesign(db));
      else saveDesign(db)();
    });
    
  },
  
  fetchDocsFromResult: function(result){
    var ret = [];
    if(result && result.rows && result.rows.forEach){
      var rec;
      var me = this;
      result.rows.forEach(function(item){
        rec = item.doc;
        if(rec && !rec.key) rec.key = rec[me.primaryKey];
        ret.push(rec);
      });
    }
    return ret;
  },
  
  fetchRelation: function(storeRequest,records,relation,callback){
    // relation is an object: { bucket: '', type: 'toOne', propertyName: '', keys: [] }, 
    //                        { bucket: '', type: 'toMany', propertyName: '', keys: [] } 
    //var relSet = { relationSet: { bucket: junctionInfo.modelBucket, keys: keys, propertyName: relation.propertyName, data: data }};
    
    // let's try a different approach here than for the junction stuff. the junction stuff retrieves everything and parses it in JS.
    // let's try to make it in such a way that we can use the mapreduce functions of couch
    // it is still implemented as a junction method though!!
    
    // stuff needed: 
    // - records to know for what records we need to retrieve relations
    // - relation for which to retrieve data
    // - callback for sending the relation set
    // - the original Store request for extra info
    // - a db 
    sys.log('CouchDB FetchRelation started...');
    var junctionInfo = this.getJunctionInfo(storeRequest.bucket,relation.bucket);
    var db = this.getClient().db(junctionInfo.junctionBucket);
    
    // it seems to be a nice idea to install views for the relational stuff
    // automatically on junction tables...  
    // the best way seems to just retrieve the view and when there is an error, install one and retry
    var me = this,
        modelBucket = junctionInfo.modelBucket,
        modelRelKey = junctionInfo.modelRelationKey;
    
    //view(design,view,query,cb)
    var querydata = { include_docs: true};
    //querydata[modelRelKey] = 
    
    var getData = function(db){
      return function(){
        db.view(me.relationDesignName,modelBucket,modelRelKey, function(er,result){
          if(er){
            if(er.error = 'not_found'){
              sys.log('CouchDB: fetchRelation after design creation: not found... let\'s retry...');
              getData(db)(); // retry
            } 
            else sys.log("fetchRelation error after design creation: " + sys.inspect(er));
          } 
          else {
            var ret = me.fetchDocsFromResult(result);
            //sys.log('fetchRelation result for ' + modelBucket + ' in ' + junctionInfo.junctionBucket + ': ' + sys.inspect(ret));
            callback(ret);
          } 
        });                              
      };
    };
    
    db.view(this.relationDesignName,modelBucket,querydata,function(er,result){
      if(er){
        sys.log("fetchRelation error: " + sys.inspect(er));
        if(me.automaticallyCreateRelationViews && (er.error == "not_found")){
          sys.log('starting creating relation design');
          me.createRelationDesign(junctionInfo,function(){
            // redo the call for data
            getData(db)();
          });
        }
      } 
      else {
        sys.log('fetchRelation result for ' + modelBucket + ' in ' + junctionInfo.junctionBucket + ': ' + sys.inspect(result));
        getData(db)();
      } 
    });
    
  },
  
  junctionTableName: function(sideOne,sideTwo){
     return [sideOne,sideTwo].sort().join("_"); 
  },
  
  // function to generate a key name of a resource in the junction table
  // the standard is to take the resource name and add "_key" to it
  junctionKeyName: function(modelname){
     var prKey = this.primaryKey;
    return [modelname,prKey].join(""); // primary key is already _id
  }
  

  
});