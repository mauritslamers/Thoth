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
   
   fetch: function(resource,clientid,callback){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination
      
      // function to get all records for a certain model.
      // resource should be the name of the resource to fetch, the callback is called with an array of results, 
      // or an empty array if the resource should exist but cannot be found 
      // the function returns YES if a request is actually made
      
      // this function expects the callback to be a generated function and have the servers request and response objects
      // included in it as a closure (is it called that way?), as well as some extra data as session info
      
      if(resource && clientid && callback){
         var ret = this.db.map({source: 'function(value){ return [value];}'}).run(resource); // this returns a function
         ret(this._createRiakFetchOnSuccess(callback), this._createRiakFetchOnError(callback));
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
         if(recs && recs instanceof Array){
            var numrecords = recs.length;
            for(var i=0;i<numrecords;i++){
               var curobj = recs[i];
               var newobj = { type: curobj.bucket, id: curobj.key, vclock: curobj.vclock};
               var curvals = curobj.values;
               if(curvals){
                  // assume curvals has length 1
                  var curvalobj = curvals[0];
                  var curval_meta = curvalobj.metadata;
                  var curval_data = JSON.parse(curvalobj.data);
                  for(var key1 in curval_meta){
                     newobj[key1] = curval_meta[key1];
                  }
                  for(var key2 in curval_data){
                     newobj[key2] = curval_data[key2];
                  }
               }
               ret.push(newobj);
            }
         }
         callback(ret);
      };
   },
   
   _createRiakFetchOnError: function(callback){
      // function to create a callback function when Riak encounters an error during a query 
      return function(recs,metadata){
         callback(null);
      };
   },
   
   retrieveRecord: function(resource){
      
   },
   
   createRecord: function(resource, data){
      
   },
   
   updateRecord: function(resource,data){
      
      
   },
   
   deleteRecord: function(resource,key){
      
   }
   
   
});