/* new implementation of ThothRiakStore based on the new abstracted ThothStore */

var riak = require('../riak-js/lib');
var sys = require('sys');
var JunctionMixin = require('./mixins/junctionrelations').RelationsByJunctionTable;
// using the junction mixin for the moment, should probably be done differently

var Store = require('./Store').Store;

exports.RiakStore = Store.extend(JunctionMixin,{
   primaryKey: 'key',
   
   db: new riak.getClient(),
   
   start: function(){
      return YES;
   },
   
   createObjectFromFetchData: function(rec,metadata){
      var newobj = { bucket: rec.bucket, id: rec.key, key: rec.key , vclock: rec.vclock};
      var curvals = rec.values;
      if(curvals){
         // assume for the moment curvals is an array with length 1
         var curvalobj = curvals[0];
         var curval_meta = curvalobj.metadata;
         // do the meta data conversion manually                  
         newobj.links = curval_meta["Links"];
         newobj.etag = curval_meta['X-Riak-VTag'];
         newobj.lastModified = curval_meta["X-Riak-Last-Modified"];
         newobj.meta = curval_meta["X-Riak-Meta"];
         newobj.timestamp = metadata.headers["date"];
         newobj.contentType = metadata.headers["content-type"];
         var curval_data = JSON.parse(curvalobj.data); 
         if(curval_data){
            // copy data if it is proper json
            for(var key2 in curval_data){
               newobj[key2] = curval_data[key2];
            }                                             
         }
         else {
            // just push it as text data
            newobj.data = curvalobj.data;
         }
      }
      return newobj;      
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
   
   fetchDBRecords: function(storeRequest,callback){
      // the callback expects an array of js objects, so make sure that the data has been parsed 
      var resource = storeRequest.bucket;
      var me = this;
      var fetch = this.db.map({source: 'function(value){ return [value];}'}).run(resource); // this returns a function
      fetch(function(recs,meta){
         //onsuccess
         if(meta.type == 'application/json'){
            var ret = [];
            for(var i=0,len=recs.length;i<len;i++){
               ret.push(me.createObjectFromFetchData(recs[i],meta)); // the JSON parsing is done inside this function
            }
            callback(ret);
         }
         else {
            // we need to think of something how to do binary stuff
         }
      },
      function(recs,meta){
         callback(null);
      });
   },

   refreshDBRecord: function(storeRequest,clientId,callback){
      var resource = storeRequest.bucket, key = storeRequest.key;
      // the callback expects a record
      var opts = { clientId: clientId};
      var refresh = this.db.get(resource,key,opts);
      refresh(function(rec,meta){
         rec.bucket = resource;
         rec.key = key;
         rec.id = key;
         rec.vclock = meta.headers["x-riak-vclock"];
         rec.links = [meta.headers["link"]];
         rec.etag = meta.headers["etag"]; // this is small caps for some strange reason
         rec.lastModified = meta.headers['last-modified'];
         rec.contentType = meta.headers['content-type'];
         rec.meta = meta.headers['x-riak-meta'];
         rec.timestamp = meta.date;
         if(callback) callback(rec);
      });
   },

   createDBRecord: function(storeRequest,clientId,callback){
      // the callback expects the new record
      var resource = storeRequest.bucket, key = storeRequest.key, data = storeRequest.recordData;
      if(resource && data && clientId){ // don't allow storage without a clientId
         var opts = { clientId: clientId };
         if(data.id) delete data.id;
         var create = this.db.save(resource,key,data,opts);
         create(function(rec,meta){
            // recs is empty, metadata already contains the key without having it to pry out
            // of the location header, thanks riak-node!
            // so, what we do is return the entire record and include some extra stuff
            var newRec = data;
            newRec.bucket = resource;
            newRec.key = meta.key;
            newRec.id = meta.key;
            newRec.contentType = meta.type;
            if(callback) callback(newRec);
         });
      }
   },
   
   updateDBRecord: function(storeRequest,clientId,callback){
      var resource = storeRequest.bucket, key = storeRequest.key, data = storeRequest.recordData;
      // the callback expects the updated record
      if(resource && key && data && clientId){
         var opts = {clientId: clientId};
         if(data.id) delete data.id;
         var update = this.db.save(resource,key,data,opts);
         update(function(rec,meta){
            // update doesn't return the updated record, so we need to have the original data
            // we also need to add few items, like bucket, key etc
            var returndata = data || {};
            returndata.bucket = resource;
            returndata.key = key;
            returndata.id = key;
            returndata.date = meta.date;
            if(callback) callback(returndata);
         });
      }
   },
   
   deleteDBRecord: function(storeRequest,clientId,callback){
      var resource = storeRequest.bucket, key = storeRequest.key;
      // check for callbacks.. Often it is not included!
      if(resource && key && clientId){
         var opts = { clientId: clientId };
         var deleteRec = this.db.remove(resource,key,opts);
         deleteRec(function(rec,meta){
            if(callback) callback();
         });
      }
      else {
         sys.puts("Trying to delete a record, but not enough information provided");
      }
   }
   
});