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

On a later notion, and after a reread of the url mentioned above, it is stated that the back end has to magically know about
the relations... 
In writing this node backend a few thoughts about the relation resolving crossed my mind:
Doing all relations on the client side has a few consequences, one of which is that the client has to have access to all
data. This causes loads of traffic and sending data to the client it shouldn't have access to. This also causes privacy concerns.
It therefore makes sense to do at least a part of the relations on the server side. In many systems this forces the developer to
create a duplicate set of models. This is not really necessary, unless you tell the server what the relations are. This
enables the server to pull apart the model into the different resources needed and construct the model of the data needed by
the client. In order for this to work, the client needs to know from what resources the model is actually constructed and therefore the 
models need to be created containing that data.
In order to make OrionNodeRiak more modular, this also requires the renaming of some variables in the future, but the most important
element to make it work is to move all the query stuff into the store. This allows different data stores to be used and different ways of 
resolving the relations
*/

if(!global.SC) require('./sc/runtime/core');
var riak = require('./riak-js/lib');
var sys = require('sys');
require('./sc/query');

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
   
   
   
   fetch: function(storeRequest,clientId,callback){      
      // function to get all records for a certain model.
      // resource should be the name of the resource to fetch, the callback is called with an array of results, 
      // or an empty array if the resource should exist but cannot be found 
      // the function returns YES if a request is actually made
      
      /*
       the storeRequest is an object with the following layout:
       { bucket: '', 
         conditions: '', 
         parameters: {}, 
         relations: [ 
            { bucket: '', type: 'toOne', propertyName: '' }, 
            { bucket: '', type: 'toMany', propertyName: ''} 
         ] 
       }
      */ 
      // in case of relations, the following is attempted: 
      // first the normal request is processed
      // then relations are being resolved one by one
      // the given callback is called for the normal request, and once for every relation.
      
      // this function expects the callback to be a generated function and have the servers request and response objects
      // included in it as a closure (is it called that way?), as well as some extra data as session info
      //this should also include a client id...
      var bucket = storeRequest.bucket;
      if(bucket && callback){
         var ret = this.db.map({source: 'function(value){ return [value];}'}).run(bucket); // this returns a function
         ret(this._createRiakFetchOnSuccess(storeRequest,callback), this._createRiakFetchOnError(storeRequest,callback));
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
   
   _createObjectFromFetchData: function(rec,metadata){
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
   
   _filterRecordsByQuery: function(records,storeRequest){
      // function to filter a set of records to the conditions and parameters given
      // it creates a temporary query object
      if(records){
         var query = SC.Query.create({conditions: storeRequest.conditions, parameters: storeRequest.parameters});
         query.parse();
         var currec, ret = [];
         for(var i=0,len=records.length;i<len;i++){
            currec = records[i];
            // WARNING: the query language should not get the property using .get() as the
            // records the query object is called with are NOT SC.Record objects and calling 
            // .get on them to get the property value results in a call to the function overhead
            // in this case resulting in a call to the function created by the store._createRiakFetchOnSuccess function
            if(query.contains(currec)){ 
               ret.push(currec); 
            }
         }
         return ret;         
      }
   },
  /*
  - a normal fetchResult
  - { fetchResult: { relationSet: [ { bucket: '', keys: [''], propertyName: '', data: {} } ], returnData: { requestKey: ''}}} 
     where:
        - bucket is the bucket the request belongs to
        - keys is the set of keys for which the relation data is contained in data
        - propertyname is the name of the toOne or toMany property
        - data is the set of keys describing the relation, associative array by key
        - requestKey is the key of the original request
  */ 
   _fetchRelation: function(storeRequest,relationIndex,records,callback){
      // this function is different from the normal fetch in the sense that it only needs to 
      // get the keys of the relations... Unsure how much extra information the toMany arrays in 
      // SC can handle
      
      var modelBucket = storeRequest.bucket;
      var relation = storeRequest.relations[relationIndex];
      var relationBucket = relation.bucket;
      // build junctionBucketname, by taking model and relation,sort them alphabetically and join them with _
      var junctionBucket = [modelBucket,relationBucket].sort().join("_");
      var modelRelationKey = [modelBucket,"key"].join("_"); // generate the key name inside the junction table
      var relationRelationKey = [relationBucket,"key"].join("_"); // generate the key name of the opposite model
      var junctionRecsRequest = this.db.map({source: 'function(value){ return [value];}'}).run(junctionBucket); // this returns a function
      junctionRecsRequest(function(junctionRecs,meta){ // success
         var curquery, currec, curkey, curConditions = relationKey + " = {relKey}", curParameters;
         var retkeys = [], retdata = {};
         // we need to go through all records and all junctionRecs to create a set of relations
         var i,j, recordslen, junctreclen; // indexes
         var curjunctrec;
         for(i=0,len=records.length;i<len;i++){
            currec = records[i];
            curkey = currec.key;
            curParameters = { relKey: curkey };
            curquery = SC.Query.create({ conditions: curConditions, parameters: curParamters});
            curquery.parse();
            var data = [];
            // query set up, now start parsing the records
            for(j=0,junctreclen=junctionRecs.length;j<junctreclen;j++){
               curjunctrec = junctionRecs[j].values[0]; // assume values has only one element
               if(curquery.contains(curjunctrec)){ 
                  data.push(curjunctrec[relationRelationKey]);
               }
            }
            retkeys.push(curkey);
            retdata[curkey] = data;
         }
         // parsed all records and all junction info
         // now call the callback with the info
         var relSet = { bucket: modelBucket, keys: retkeys, propertyName: relation.propertyName, data: retdata };
         callback({ relationSet: relSet });
      }, 
      function(junctionRecs,meta){ // some error, assemble an empty relation set
         var keys = [], data = {}, currec, curkey;
         for(var i=0,len=records.length;i<len;i++){
            currec = records[i];
            curkey = currec.key;
            keys.push(curkey);
            data[curkey] = [];
         }
         var curRelSet = { 
            bucket: modelBucket, 
            keys: keys, 
            propertyName: relation.propertyName,
            data: data
         };
         callback({ relationSet: curRelSet });
      });
            
      

   },
   
   _createRiakFetchOnSuccess: function(storeRequest,callback){
      // function to create a callback function when Riak succesfully performed a query
      // the callback function should call the callback provided with the raw data fetched from riak
      // let's process the data in such a way that it already resembles an SC record object
      // the layout of the data in recs is as described above
      
      // as we are moving the query stuff inside the store, there are a few things to add to the current version
      // - filtering
      // - relations
      
      var me = this;
      return function(recs, metadata){
         //sys.puts("Store onFetchSuccess run");
         var ret = [];
         if(recs && recs instanceof Array){
            if(metadata.type == 'application/json'){
               var numrecords = recs.length;
               for(var i=0;i<numrecords;i++){
                  var newobj = me._createObjectFromFetchData(recs[i],metadata);
                  ret.push(newobj);
               } // end for
            }
            else {
               // we need to think of something to deal with binary data
               //newobj.binary = curvalobj.data;
            }
         } 
         ret = storeRequest.conditions? me._filterRecordsByQuery(ret,storeRequest): ret;
         if(storeRequest.relations && (storeRequest.relations instanceof Array)){
            for(var rel_i=0,len=storeRequest.relations.length;rel_i<len;rel_i++){
               me._fetchRelation(storeRequest,rel_i,ret,callback);
            }
         }
         callback({ recordResult: ret }); 
      }; // end return function
   },
   
   _createRiakFetchOnError: function(storeRequest,callback){
      // function to create a callback function when Riak encounters an error during a query 
      return function(recs,metadata){
         callback(null);
      };
   },
   
   refreshRecord: function(resource,clientId,callback){
      // function to retrieve a record using the bucket and key on the resource object
      // the refreshRecord is a different kind of request to Riak... It can of course be done using a mapred call
      // but a direct call is much faster and essentially returns the same information
      var opts = {clientId: clientId};
      var getRec = this.db.get(resource.bucket, resource.key, opts);
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
         // I couldn't find why there seems to be no error callback. so atm I wrote none... 
         // but there should be a kind of error callback...
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
      };
   },
   
   updateRecord: function(resource,data,clientId,callback){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination
      var bucket=resource.bucket;
      var key = resource.key;
      var opts = clientId? { clientId: clientId }: null;
      if(bucket && key && opts){
         var updateRec = this.db.save(bucket,key,data,opts);
         updateRec(this._createUpdateRecordCallback(resource,data,callback));
      }
   },
   
   // we may need to include some other nice things, like json detection...?
   _createUpdateRecordCallback: function(resource,data,callback){
      return function(recs,metadata){
         // update doesn't return the updated record, so we need to have the original data
         // we also need to add few items, like bucket, key etc
         var returndata = data;
         returndata.bucket = resource.bucket;
         returndata.key = resource.key;
         returndata.date = metadata.date;
         callback(data);
      };
   },
   
   deleteRecord: function(resource,clientId,callback){
      // we need a client id to identify the actions for Riak, we would like a riak bucket/key combination
      var bucket = resource.bucket,
          key = resource.key,
          opts = { clientId: clientId};
      var delRec = this.db.remove(bucket,key,opts);
      delRec(this._createDeleteRecordCallback(callback));
   },
   
   _createDeleteRecordCallback: function(callback){
      return function(recs,meta){
        callback();
      };
   }
   
   
   
   
});