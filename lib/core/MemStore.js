/*
MemStore: a store in memory for temporary purposes.

*/


var Tools = require('./Tools');
var sys = Tools.sys;
var junctionrels = require('./mixins/junctionrelations').RelationsByJunctionTable;
var Store = require('./Store').Store;

var API = require('./API');

exports.MemStore = Store.extend(junctionrels,{
  
  useAutoIncrementIndex: true,
  
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
        recdata = storeRequest.record;
    
    if(!this._tables[bucket]) this._tables[bucket] = {}; // create bucket if it doesn't exist
    if(this.useAutoIncrementIndex){
      if(!this._counters[bucket]) this._counters[bucket] = 0;
      this._counters[bucket] += 1;
    } 

    var newid = requestedKey || this._counters[bucket];
    recdata[primKey] = newid;
    
    this._tables[bucket][newid] = Tools.copy(recdata);

    if(callback) callback(null,recdata);
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key,
        recdata = storeRequest.record;
    
    //sys.log('Memstore: update record: recorddata: ' + sys.inspect(recdata));
    if(this.useAutoIncrementIndex && (this._counters[bucket] > key)){
      // warn but allow, and update max key to prevent overwriting existing records
      sys.log('Thoth.MemStore: trying to implicitly creating records! (Update with a primaryKey value larger than known values for this resource)');
      this._counters[bucket] = key; 
    }
    if(this._tables && this._tables[bucket]){
      this._tables[bucket][key] = Tools.copy(recdata);
      if(callback) callback(null,recdata);
    }
    else if(callback) callback(new Error("table doesn't exist in memory, create a record first before updating it"),null);
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = API.getPrimaryKey(storeRequest),
        key = storeRequest.key;
        
    //sys.log('MemStore: deleteRecord...');
        
    delete this._tables[bucket][key];
    if(callback) callback(null,true);
  },
  
  fetchDBRecords: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        i, recs = [],
        tabledata = this._tables[bucket];
    
    if(tabledata){
      for(i in tabledata){
        if(tabledata.hasOwnProperty(i)) recs.push(tabledata[i]);
      }
    }
    
    if(callback) callback(null,recs);
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        key = storeRequest.key,
        primKey = API.getPrimaryKey(storeRequest),
        bucketData = this._tables[bucket],
        rec = bucketData? bucketData[key]: null;
        
    if(rec){
      if(!rec.key) rec.key = rec[primKey];
      if(!rec.id) rec.id = rec[primKey];    
    }
    //sys.log('MemStore: rec: ' + sys.inspect(rec));
    //if(rec && callback) callback(null,rec);
    if(callback) callback(null,rec);  
  }
  
});