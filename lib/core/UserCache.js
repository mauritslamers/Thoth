/*
The ThothServerCache is a kind of controller that allows the storage of record information
The issue in ThothServer is that whenever an update takes place, every connected or authenticated user 
that has some kind of interest in that particular record needs to be made aware of the change.

To that end, a server side cache is needed that contains what records the user requested.
To prevent having to copy the entire database, we only keep a subset of all information:

 - a set of bucket/key combinations of records actually requested by the user
 - a copy of the fetch requests and the corresponding query information, to check whether newly 
   created records match a previous request made by the client using a query
 - a queue of requests/messages to update the client as soon as a severed connection reconnects

The server cache may be a very useful place to do the permission checking...

The server cache is a per user cache, so should be part of the session data

This server cache could be implemented using the riak back end, but for the moment let's keep it to the
program itself


*/
var sys = require('./Tools').sys;
var Constants = require('./Constants');

exports.UserCache = SC.Object.extend({
   
   // an array [bucketname][keyname] = timestamp;
   
   _bucketKeyStore: null, 
   
   /*
    an array containing objects of the following setup:
    {  conditions: "", parameters: {}, bucket: "", queryObject: SC.Query }
    */
   _fetchQueryStore: null,
   
   // an array [bucketname][keyname] = record
   
   _requestQueue: null, // to store request information in case the connection has been severed
   // the idea here is that as soon as a connection closes and no logout has taken place
   // the requests are stored here
   
   init: function(){
      this._bucketKeyStore = {};
      this._fetchQueryStore = [];
      this._requestQueue = {};
      arguments.callee.base.apply(this, arguments);
   },
   
   indexOfQuery: function(bucket,conditions,parameters){
      var queries = this._fetchQueryStore;
      //if(!queries) this._fetchQueryStore = [];
      for(var i=0,l=queries.length;i<l;i++){
        var curQuery = queries[i];
        if((curQuery.conditions == conditions) && (curQuery.parameters == parameters) && (curQuery.bucket == bucket)){
           // conditions is a string, parameters an object
           return i;
        }
      }
      return -1; // if not found, return -1
   },

   /**
     Save a query to the interest cache.

     @param {String} the bucket of the query
     @param {String} the conditions string of the query
     @param {Object} the parameters object of the query
     @returns {Boolean} true when saved, false when not
   */
      
   storeQuery: function(bucket,conditions,parameters){
      //sys.puts(" context of this storeQuery call: " + sys.inspect(this));
      //create a query from the given conditions and parameters in case such a query doesn't exist already
      // but in a way we have to make sure there will be no double queries around
      if(bucket){ // we need a bucket to be able to store anything useful
         // first check whether a similar query already exists
         var indexOfQuery = this.indexOfQuery(bucket,conditions,parameters);
         if(indexOfQuery == -1){
            //sys.puts("Creating new query with bucket '" + bucket + "'");
            // doesn't exist, so add one
            var newQueryObj = { bucket: bucket };
            if(conditions && parameters){ // "normal query"
               //sys.puts("adding to query: conditions: " + conditions);
               //sys.puts("adding to query: parameters: " + JSON.stringify(parameters));
               newQueryObj.conditions = conditions;
               newQueryObj.parameters = parameters;
               var newquery = SC.Query.create({ conditions: conditions, parameters: parameters});
               newquery.parse();
               //sys.puts("inspecting new query object: " + sys.inspect(newquery));
               newQueryObj.queryObject = newquery;
            }
            // if no conditions and parameters are given we have a match all for a bucket, so just push
            this._fetchQueryStore.push(newQueryObj);
            //sys.puts("inspecting the queryStore: " + sys.inspect(this._fetchQueryStore));
            return true; // stored
         } else return false; // query already exists
      } else return false; // no bucket given
   },
   
   /**
     Save a bucket key relation to the interest cache.

     @param {String} the bucket of the relation
     @param {String || Array} the key or keys for this relation
     @param {Number} the timestamp (new Date().getTime())
     @returns {void}
   */
   
   storeBucketKey: function(bucket,key,timestamp){
      // if the bucket/key combination already exists, update the timestamp
      var ts = timestamp || new Date().getTime(); // assign a timestamp if no timestamp hasn't been provided...
      var keys = (key instanceof Array)? key: [key];
      
      keys.forEach(function(k){
        if(k){
          if(!this._bucketKeyStore[bucket]) this._bucketKeyStore[bucket] = {};
          this._bucketKeyStore[bucket][k] = ts;
        }
      },this);
   },
   
   storeRecords: function(bucket,primaryKey,records){
      // a short cut function to store the bucket-key combinations from an array of records
      var curkey;
      
      records.forEach(function(record){
         curkey = record[primaryKey] || record.key || record.id || record._id ; // try some defaults settings
         // only store if primaryKey has a value, this prevents undefined keys being stored...
         if(curkey) this.storeBucketKey(bucket,curkey, new Date().getTime()); 
      },this);
      //sys.puts("current users bucketkeystore after storeRecords: " + sys.inspect(this._bucketKeyStore));
   },
   
   deleteBucketKey: function(bucket,key){
      // function to delete a bucket key combination from the cache in case of a delete action
      var storedBucket = this._bucketKeyStore[bucket];
      var keys = (key instanceof Array)? key : [key];
      if(storedBucket){
         keys.forEach(function(k){
           if(this._bucketKeyStore[bucket][k]) delete this._bucketKeyStore[bucket][k];
         },this);
      } 
   },
   
   deleteRecords: function(records){
      var curbucket,curkey,me=this;
      records.forEach(function(record){
         curbucket = record.bucket;
         curkey = record.key;
         this.deleteBucketKey(curbucket,curkey);
      },this);      
   },
   
   deleteQuery: function(bucket, conditions, parameters){
     // function to delete a query 
   },
   
   shouldReceive: function(storeRequest){
      //sys.puts(" context of this shouldReceive call: " + sys.inspect(this));
      // function to check whether the current user should receive and what the match is
      // returns either NO, "bucketkey" or "query".
      // In case of the bucketkey match the user has actually requested the record in the past
      // in case of the query match the user hasn't yet requested the record, but 
      // it fits queries the client has requested.
      // This makes me think that it would be nice to have the client allow to remove server side 
      // query info, as it may not be longer interested in results from those queries... 
      // it could also be done by a timeout, but allowing the client to decide is nicer...
      
      // first thing to check is bucket and key/id
      // only check the queries if the we didn't get a result from the bucket-key check
      var bucketkeystore = this._bucketKeyStore,
          recordbucket = storeRequest.bucket,
          recordkey = storeRequest.key,
          i,queryObj;
      
      var queryMatcher = function(q){
        if(q.bucket === recordbucket){
          if(q.conditions){
            if(q.queryObject.contains(storeRequest.record)){
              return true;
            }
          }
          else return true; // match all, so distribute
        }
        return false;
      };
      
      var relationMatcher = function(r){
        var keys = (r.keys instanceof Array)? r.keys: [r.keys];
        return keys.some(function(k){
          //sys.log('relation matcher: matching bucket ' + r.bucket + ' and key: ' + k);
          if(bucketkeystore[r.bucket] && bucketkeystore[r.bucket][k]){
            //sys.log('found match...');
            return true;
          } 
          else return false;
        });
      };
      
      if(bucketkeystore[recordbucket]){
         if(bucketkeystore[recordbucket][recordkey]){
            return Constants.DISTRIBUTE_BUCKETKEY;
         }         
      }

      if(storeRequest.relations && storeRequest.relations.some(relationMatcher)) return Constants.DISTRIBUTE_BUCKETKEY;
      
      if(this._fetchQueryStore.some(queryMatcher)) return Constants.DISTRIBUTE_QUERY;
      
      
      
      
      // 
      // 
      // //sys.puts("No match found in the bucket_key_store, trying queries");
      // //sys.puts("inspecting the fetchQueryStore: " + sys.inspect(this._fetchQueryStore));
      // // if we are running here, we should check the existing queries
      // var queries = this._fetchQueryStore;
      // var numqueries = queries.length;
      // if(numqueries>0){
      //    for(i=0;i<numqueries;i++){
      //       queryObj = queries[i];
      //       // check whether the current query is for the correct bucket
      //       if(queryObj.bucket == recordbucket){
      //          // we need that it might fit, just check whether conditions are set
      //          // if they are set, they need to match
      //          if(queryObj.conditions){ // it can also be pure conditions!!!
      //             if(queryObj.queryObject.contains(storeRequest.recordData)){
      //                //sys.puts("the current query has found a match for record: " + JSON.stringify(record));
      //                return Constants.DISTRIBUTE_QUERY; 
      //             } 
      //          }
      //          else {
      //             // if the conditions are not set, we have a match all query for a bucket, so return query
      //             // as we have a match all, we can safely stop searching here
      //             //sys.puts("No conditions have been found, this means we have a all-in for a bucket, so return query");
      //             return Constants.DISTRIBUTE_QUERY;
      //          }
      //       } // query doesn't match bucket, continue
      //    } // end loop
      // }
      // return NO;
   },
   
   queueRequest: function(event,request){
      // function to queue a request
      if(!this._requestQueue || !(this._requestQueue instanceof Array)) this._requestQueue = [];
      this._requestQueue.push({ event: event, data: request});
   },
   
   retrieveRequestQueue: function(){
      // function to return all queued records for this user in such a way that 
      // it can be sent of right away, empty the queue when the function returns
      var queue;
      if(this._requestQueue){
         queue = this._requestQueue;
         this._requestQueue = [];
      }
      else {
         queue = [];
      }
      return queue;
   },
   
   from: function(sessionData){
     // setup the current object with the sessionData and return the current object
     if(sessionData){ // restore data if given
       this._bucketKeyStore = sessionData.bucketKeys;
       this._requestQueue = sessionData.requestQueue;
       var q, fq = sessionData.fetchQueries;
       var thisfq = this._fetchQueryStore;
       for(var i=0,len=fq.length;i<len;i+=1){
         fq[i].queryObject = SC.Query.create(fq[i]); // recreate the query
         thisfq.push(fq[i]); // and save in memory
       }       
     }
     return this;
   },
   
   toSessionData: function(){
      // return a json serialisable version of the current object
      var ret = {
        bucketKeys: this._bucketKeyStore, 
        fetchQueries: [],
        requestQueue: this._requestQueue 
      };
      var fq = this._fetchQueryStore;
      
      for(var i=0,len=fq.length;i<len;i+=1){
        ret.fetchQueries.push({
          conditions: fq[i].conditions,
          parameters: fq[i].parameters,
          bucket: fq[i].bucket
        });
      }
      return ret;
   }
   
});