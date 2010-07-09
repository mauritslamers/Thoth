/*
At first I expected not to need a kind of Store, but while writing it turned out there needed to be a 
place in which relations between records can be combined into one single request.
Doing such a thing inside the server would be a bit of an overkill, so therefore a kind of store.

The purpose of the store is to do the actual requests to Riak.
Moreover it can handle requests and maybe in the future handle actual queries from SC.

The idea is more or less a kind of data source and not really a store in the SC sense.
It uses the same function names (fetch, retrieveRecord, createRecord, updateRecord, deleteRecord)

*/

/* a chat in the Sproutcore IRC channel made me aware of the following page: http://jacobian.org/writing/rest-worst-practices/
which describes neatly the trap I was creating for myself.

That trap is that I tried to resolve relation stuff server side. When you really think about it, you might consider it to be completely the wrong place. 
Especially when considering the ease in which SC.Store allows you to update records on the fly and the reduction in server-client traffic 
it brings along.

So...

This causes a rewrite of course, and maybe a structure overhaul.
There are a few things the server ends needs to be able to do:
- authentication (plugins: LDAP, DB)
- user system from either fixtures or db
- group system from either fixtures or db
- permission system

*/
if(!global.SC) require('./sc/runtime/core');
var riak = require('./riak-js/lib');
var sys = require('sys');

global.OrionStore = SC.Object.extend({
   
   db: new riak.getClient(),
      
   models: [],
   
   _modelsByName: [],
   
   _getModelByResourceName: function(resourcename){
      //function to get the model for a resource name
      // if it is the first time, find it and add it to the cache
      var cachedmodel = this._modelsByName[resourcename];
      if(cachedmodel){
         return cachedmodel;
      }
      else {
         var models = this.models;
         var store = this;
         models.forEach(function(key,val){
            if(val){
               if(val.resource){ // if resource exists, use it
                  if(val.resource == resourcename){
                     store._modelsByName[resourcename] = val;
                  }
               }
               else { // else use bucket name
                  if(val.bucketname == resourcename){
                     store._modelsByName[resourcename] = val;
                  }
               }
            }
         });
         return this._modelsByName[resourcename];
      }
   },
   
   fetch: function(resource,clientId,callback){      
      // function to get all records for a certain model.
      // resource should be the name of the resource to fetch, the callback is called with an array of results, 
      // or an empty array if the resource should exist but cannot be found 
      // the function returns YES if a request is actually made
      
      // this function expects the callback to be a generated function and have the servers request and response objects
      // included in it as a closure (is it called that way?), as well as some extra data as session info
      //this should also include a client id...
      if(resource && callback){
         var ret = this.db.map({source: 'function(value){ return [value];}'}).run(resource); // this returns a function
         ret(this._createRiakFetchOnSuccess(callback), this._createRiakFetchOnError(callback));
         return YES;
      }
      else return NO;
   },
   
   
   
   /*
   [
    {
       "bucket":"teacher",
       "key":"Sk4cDo9ZexkQZb1HmiHxr4x0pMc",
       "vclock":"a85hYGBgzGDKBVIsjMHcwRlMiYx5rAzC3V1H+bIA",
       "values":[
          {
             "metadata":{
                "Links":[],
                "X-Riak-VTag":"49k9VrOs1SIy7OQrYDXka3",
                "content-type":"application/json",
                "X-Riak-Last-Modified":"Mon, 14 Jun 2010 11:14:27 GMT",
                "X-Riak-Meta":[] },
             "data":"{\"firstname\":\"Maurits\",\"inbetween\":\"\",\"lastname\":\"Lamers\"}"
          }
       ]
    }] // array of these kind of objects 
   
   */
   
   _createRiakFetchOnSuccess: function(callback){
      // function to create a callback function when Riak succesfully performed a query
      // the callback function should call the callback provided with the raw data fetched from riak
      // let's process the data in such a way that it already resembles an SC record object
      // the layout of the data in recs is as described above
      
      return function(recs, metadata){
         var ret = [];
         //sys.puts("fetch recs: " + sys.inspect(recs));
         if(recs && recs instanceof Array){
            //sys.puts("RIAK onfetch success: fetch recs: " + JSON.stringify(recs));
            //sys.puts("fetch metadata: " + sys.inspect(metadata));
            if(metadata.type == 'application/json'){
               var numrecords = recs.length;
               sys.puts("fetch return num elements: " + numrecords);
               for(var i=0;i<numrecords;i++){
                  var curobj = recs[i];
                  var newobj = { type: curobj.bucket, id: curobj.key, key: curobj.key , vclock: curobj.vclock};
                  var curvals = curobj.values;
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
                  //sys.puts("About to add to ret: " + sys.inspect(newobj));
                  ret.push(newobj);
               } // end for
            }
            else {
               // we need to think of something to deal with binary data
               //newobj.binary = curvalobj.data;
            }
         } 
         //sys.puts("About to call fetchResult callback with: " + sys.inspect(ret));
         callback(ret);
      }; // end return function
   },
   
   _createRiakFetchOnError: function(callback){
      // function to create a callback function when Riak encounters an error during a query 
      return function(recs,metadata){
         callback(null);
      };
   },
   
   refreshRecord: function(resource,clientId,callback){
      // function to retrieve a record using the bucket and key on the resource object
      // the refreshRecord is a different kind of request to Riak... It can of course be done using a mapred call
      // but a direct call is much faster and essentially returns the same information
      
      var getRec = this.db.get(resource.bucket, resource.key, {clientId: clientId});
      getRec(this._createRefreshRecordCallback(resource,callback));
   },
   
   _createRefreshRecordCallback: function(resource,callback){
      return function(recs,metadata){
         //sys.puts("store refresh callback recs: " + JSON.stringify(recs));
         //sys.puts("store refresh callback metadata: " + JSON.stringify(metadata));
         var ret = {
            bucket: resource.bucket,
            key: resource.key,
            id: resource.key
            };
         // now copy the recs properties on the return object
         for(var i in recs){
            ret[i] = recs[i];
         }
         ret.vclock = metadata.headers["x-riak-vclock"];
         ret.links = [metadata.headers["link"]];
         ret.etag = metadata.headers["etag"]; // this is small caps for some strange reason
         ret.lastModified = metadata.headers['last-modified'];
         ret.contentType = metadata.headers['content-type'];
         ret.meta = metadata.headers['x-riak-meta'];
         ret.timestamp = metadata.date;
         callback(ret);         
      };
   },
   
   createRecord: function(resource,data,clientId,callback){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination 
      // this information could be retrieved from the user session, it may even be the session key...
      // or even better a username + sessionkey to keep error messages readable
      var bucket=resource.bucket;
      if(bucket){
         var createRec = this.db.save(bucket,null,data,{clientId: clientId});
         createRec(this._createCreateRecordCallback(resource,data,callback));
      }
      else sys.puts("OrionStore received a createRecord request in the wrong format... Cannot create");
   },
   
   _createCreateRecordCallback: function(resource,data,callback){
      return function(recs,metadata){
         // recs is empty, metadata already contains the key without having it to pry out
         // of the location header, thanks riak-node!
         // so, what we do is return the entire record and include some extra stuff
         //sys.puts("store create record metadata: " + JSON.stringify(metadata));
         var newRec = data;
         newRec.bucket = resource.bucket;
         newRec.key = metadata.key;
         newRec.contentType = metadata.type;
         callback(newRec);
      }
   },
   
   updateRecord: function(resource,data){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination
      
   },
   
   deleteRecord: function(resource,key){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination   
   }
   
   
});