/*
MemStore: a store in memory for temporary purposes.

*/


var sys = require('sys');
var junctionrels = require('./mixins/junctionrelations').RelationsByJunctionTable;
var Store = require('./Store').Store;


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
  _createMemObj: function(datahash){ 
    var ret = {};
    for(var i in datahash){
      ret[i] = datahash[i];
    }
    return ret;
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
  
  createDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        //primKey = this.primaryKey || 'id',
        primKey = storeRequest.primaryKey || this.primaryKey || 'id',
        recdata = storeRequest.recordData;
    
    if(!this._tables[bucket]) this._tables[bucket] = {}; // create bucket if it doesn't exist
    if(!this._counters[bucket]) this._counters[bucket] = 0;
    
    this._counters[bucket] += 1;
    var newid = this._counters[bucket];
    recdata[primKey] = newid;
    recdata.key = newid;
    recdata.id = newid;

    this._tables[bucket][newid] = this._createMemObj(recdata);
    
    if(callback) callback(recdata);
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = storeRequest.primaryKey || this.primaryKey || 'id',
        key = storeRequest.key,
        recdata = storeRequest.recordData;
    
    //sys.log('Memstore: update record: recorddata: ' + sys.inspect(recdata));
        
    this._tables[bucket][key] = this._createMemObj(recdata);
    
    callback(recdata);
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        primKey = storeRequest.primaryKey || this.primaryKey || 'id',
        key = storeRequest.key;
        
    delete this._tables[bucket][key];
    if(callback) callback(YES);
  },
  
  fetchDBRecords: function(storeRequest,callback){
    var bucket = storeRequest.bucket,
        rec,i,
        recs = [],
        maxIndex = this._counters[bucket],
        tabledata = this._tables[bucket];
    
    if(tabledata){
      for(i=0;i<maxIndex;i++){
        rec = tabledata[i];
        if(rec) recs.push(rec);
      }
    }
    
    callback(recs);
  },
  
  refreshDBRecord: function(storeRequest,clientId,callback){
    var bucket = storeRequest.bucket,
        key = storeRequest.key,
        rec = this._tables[bucket][key];
        
    //sys.log('MemStore: rec: ' + sys.inspect(rec));
    if(rec) callback(rec);
  }
  
});