/*
DiskStore is the same as MemStore, but saves the information to disk every time a change has been taken place.
It doesn't do versioning or something similar, it will also not break if the writing process fails, 
only complain about it in the log

*/

var MemStore = require('./MemStore').MemStore,
    sys = require('sys'),
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
      var path = "./tmp/" + this.filename;
      //sys.log("DiskStore: saving to: " + fs.realpathSync(path)); // debugging
      fs.writeFile(path,filedata,function(err){
        if(err) sys.log('Thoth DiskStore: failed writing data file: ' + sys.inspect(err));
      });
    }
  },
  
  readDataFile: function(){
    if(this.filename){
      var path = "./tmp/" + this.filename;
      var data = require(path);
      this._tabledata = data.tables;
      this._counters = data.counters;
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