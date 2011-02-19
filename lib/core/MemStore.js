/*
MemStore: a store in memory for temporary purposes.

*/


var Tools = require('./Tools');
var sys = require('sys');
var junctionrels = require('./mixins/junctionrelations').RelationsByJunctionTable;
var Store = require('./Store').Store;

var API = require('./API');

exports.MemStore = Store.extend(junctionrels,{
  
  _tables: null,
  
  _counters: null,
  
  _indexes: null,
    
  start: function(){ //init
    sys.log('Thoth MemStore: initialising...');
    this._tables = {};
    this._counters = {};
    this._indexes = {};
  },
  
  // This function is essential for a properly working memory store. 
  // The data needs to be copied onto a new object, because if the object itself would be stored, 
  // the relations that are merged with it later on will also magically appear in the store
  // which should not happen of course.
  
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
  
  createDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        requestedKey = storeRequest.key,
        primKey = API.getPrimaryKey(storeRequest),
        recdata = storeRequest.recordData;
    
    if(!this._tables[bucket]) this._tables[bucket] = {}; // create bucket if it doesn't exist
    if(!this._counters[bucket]) this._counters[bucket] = 0;
    
    this._counters[bucket] += 1;
    var newid = requestedKey || this._counters[bucket];
    recdata[primKey] = newid;
    
    this._tables[bucket][newid] = Tools.copy(recdata);
    
    //recdata.key = newid;  // apply id and key after saving to prevent these props leaking into memory
    //recdata.id = newid; 
    if(callback) callback(recdata);
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key,
        recdata = storeRequest.recordData;
    
    //sys.log('Memstore: update record: recorddata: ' + sys.inspect(recdata));
    if(this._counters[bucket] > key){
      this._tables[bucket][key] = Tools.copy(recdata);
      if(callback) callback(recdata);
    } 
    else {
      sys.log('Thoth.MemStore: trying to implicitly creating records! (Update with a primaryKey value larger than known values for this resource)');
      callback(null);
    }
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key;
        
    delete this._tables[bucket][key];
    if(callback) callback(YES);
  },
  
  fetchDBRecords: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        rec,i,
        recs = [],
        maxIndex = this._counters[bucket],
        tabledata = this._tables[bucket];
    
    if(tabledata){
      for(i=1;i<=maxIndex;i++){
        rec = tabledata[i];
        if(rec) recs.push(rec);
      }
    }
    
    if(callback) callback(recs);
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        key = storeRequest.key,
        primKey = API.getPrimaryKey(storeRequest),
        rec = this._tables[bucket][key];
        
    if(rec){
      if(!rec.key) rec.key = rec[primKey];
      if(!rec.id) rec.id = rec[primKey];      
    }
    //sys.log('MemStore: rec: ' + sys.inspect(rec));
    if(rec && callback) callback(rec);
  }
  
});