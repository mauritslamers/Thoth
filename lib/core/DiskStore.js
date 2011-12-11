/*
DiskStore is the same as MemStore, but saves the information to disk every time a change has been taken place.
It doesn't do versioning or something similar, it will also not break if the writing process fails, 
only complain about it in the log

*/

var MemStore = require('./MemStore').MemStore,
    Tools = require('./Tools'),
    sys = Tools.sys,
    fs = require('fs');
    

exports.DiskStore = MemStore.extend({
  
  autoRestore: null, // set to YES when you want the store to auto restore on restart
  
  filename: null, // just file name, no need for directory names
  
  writeDataFile: function(){
    // take the memstore data and write a require-able file to make import quick and easy
    if(this.filename){
      var tabledata = JSON.stringify(this._tables);
      var counterdata = JSON.stringify(this._counters);
      var filedata = "exports.tables="+tabledata+";\n"+"exports.counters="+counterdata+";";
      var path = Tools.tmpPath + '/' + this.filename;
      //sys.log("DiskStore: saving to: " + fs.realpathSync(path)); // debugging
      fs.writeFile(path,filedata,function(err){
        if(err) sys.log('Thoth DiskStore: failed writing data file: ' + sys.inspect(err));
      });
    }
  },
  
  readDataFile: function(){
    var me = this;
    if(this.filename){
      var path = Tools.tmpPath + "/" + this.filename;
      sys.log('DiskStore: loading data file from previous session');
      fs.stat(path,function(err,stat){
        var data;
        if(!err){
          try {
            data = require(path);            
          }
          catch (e){
            sys.log('DiskStore: error parsing file, resetting session data.'); 
            // perhaps renaming old file and create new one?
            data = { tables: null, counters: null };
          }
          //sys.log('loaded data: ' + sys.inspect(data,false,3));
          me._tables = data.tables? data.tables: me._tables; // only override when they actually contain data
          me._counters = data.counters? data.counters: me._counters;
        }
        else sys.log("DiskStore: could not load file, because it doesn't exist (yet)?");
      });
    }
  },
  
  start: function(){
    arguments.callee.base.apply(this, arguments); // first init the memstore
    if(this.filename && this.autoRestore) this.readDataFile();
    if(!this.filename) sys.log('DiskStore: no file name defined to store data!!! This will not save the information!');
  },
  
  createDBRecord: function(storeRequest,clientId,callback){
    // first call the super function, then save to disk
    arguments.callee.base.apply(this, arguments); // first store into memory
    this.writeDataFile();
  },
  
  updateDBRecord: function(storeRequest,clientId,callback){
    // first call the super function, then save to disk
    arguments.callee.base.apply(this, arguments); // first store into memory
    this.writeDataFile();    
  },
  
  deleteDBRecord: function(storeRequest,clientId,callback){
    // first call the super function, then save to disk
    arguments.callee.base.apply(this, arguments); // first store into memory
    this.writeDataFile();    
  }
  
  
});