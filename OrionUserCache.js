/*
The OrionServerCache is a kind of controller that allows the storage of record information
The issue in OrionServer is that whenever an update takes place, every connected or authenticated user 
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
var sys = require('sys');

global.OrionUserCache = SC.Object.extend({
   
   // an array [bucketname][keyname] = timestamp;
   
   _bucketKeyStore: {}, 
   
   /*
    an array containing objects of the following setup:
    {  conditions: "", parameters: {}, bucket: "", queryObject: SC.Query }
    */
   _fetchQueryStore: [],
   
   // an array [bucketname][keyname] = record
   
   _requestQueue: [], // to store request information in case the connection has been severed
   // the idea here is that as soon as a connection closes and no logout has taken place
   // the requests are stored here
   
   indexOfQuery: function(bucket,conditions,parameters){
      var queries = this._fetchQueryStore;
      for(var i=0,l=queries.length;i<l;i++){
        var curQuery = queries[i];
        if((curQuery.conditions == conditions) && (curQuery.parameters == parameters) && (curQuery.bucket == bucket)){
           // conditions is a string, parameters an object
           return i;
        }
      }
      return -1; // if not found, return -1
   },
   
   storeQuery: function(bucket,conditions,parameters){
      //create a query from the given conditions and parameters in case such a query doesn't exist already
      // but in a way we have to make sure there will be no double queries around
      if(bucket){ // we need a bucket to be able to store anything useful
         // first check whether a similar query already exists
         var indexOfQuery = this.indexOfQuery(bucket,conditions,parameters);
         if(indexOfQuery == -1){
            sys.puts("Creating new query with bucket '" + bucket + "'");
            // doesn't exist, so add one
            var newQueryObj = { bucket: bucket };
            if(conditions && parameters){ // "normal query"
               newQueryObj.conditions = conditions;
               newQueryObj.parameters = parameters;
               var newquery = SC.Query.create({ conditions: conditions, parameters: parameters});
               newquery.parse();
               newQueryObj.queryObject = newquery;
            }
            // if no conditions and parameters are given we have a match all for a bucket, so just push
            this._fetchQueryStore.push(newQueryObj);
            return YES; // stored
         } else return NO; // query already exists
      } else return NO; // no bucket given
   },
   
   storeBucketKey: function(bucket,key,timestamp){
      //function to store a bucket/key/timestamp combination
      // if the bucket/key combination already exists, update the timestamp
      // the time stamp seems to be unnessary, but let's keep it for the moment
      var storedBucket = this._bucketKeyStore[bucket];
      if(storedBucket){
         var storedTimeStamp = storedBucket[key];
         if(storedTimeStamp){
            // a timestamp is already here, overwrite
            this._bucketKeyStore[bucket][key] = timestamp;
         }
         else {
            // bucket found, but not the key
            this._bucketKeyStore[bucket][key] = timestamp;
         }
      }
      else { // if the bucket doesn't exist, create it
         this._bucketKeyStore[bucket] = {};
         this._bucketKeyStore[bucket][key] = timestamp;
      }
   },
   
   storeRecords: function(records){
      // a short cut function to store the bucket-key combinations from an array of records
      var curbucket,curkey,me=this;
      records.forEach(function(record){
         //sys.puts("storeRecords: " + JSON.stringify(record));
         curbucket = record.bucket;
         curkey = record.key;
         me.storeBucketKey(curbucket,curkey, new Date().getTime());
      });
      //sys.puts("current users bucketkeystore after storeRecords: " + sys.inspect(this._bucketKeyStore));
   },
   
   deleteBucketKey: function(bucket,key){
      // function to delete a bucket key combination from the cache in case of a delete action
      var storedBucket = this._bucketKeyStore[bucket];
      if(storedBucket){
         if(storedBucket[key]) delete storedBucket[key];
      } 
   },
   
   deleteRecords: function(records){
      var curbucket,curkey,me=this;
      records.forEach(function(record){
         curbucket = record.bucket;
         curkey = record.key;
         me.deleteBucketKey(curbucket,curkey);
      });      
   },
   
   deleteQuery: function(bucket, conditions, parameters){
     // function to delete a query 
   },
   
   shouldReceive: function(record){
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
          recordbucket = record.bucket,
          recordkey = record.key;
          
      if(bucketkeystore[recordbucket]){
         if(bucketkeystore[recordbucket][recordkey]){
            // the key exists, check the timestamp..
            // thinking of it, is that actually necessary? whenever this function is called 
            // the timestamp will always be in the past...
            return "bucketkey";
         }         
      }
      
      // if we are running here, we should check the existing queries
      var queries = this._fetchQueryStore;
      var numqueries = queries.length;
      var queryObj;
      if(numqueries>0){
         for(var i=0;i<numqueries;i++){
            queryObj = queries[i];
            // check whether the current query is for the correct bucket
            if(queryObj.bucket == recordbucket){
               // we need that it might fit, just check whether conditions are set
               // if they are set, they need to match
               if(queryObj.conditions && queryObj.parameters){
                  if(queryObj.queryObject.contains(record)){
                     return "query"; 
                  } 
                  else { // conditions exist, but the record doesn't match those conditions
                     return NO;
                  }
               }
               else {
                  // if the conditions are not set, we have a match all query for a bucket, so return query
                  return "query";
               }
            } // query doesn't match bucket, continue
         } // end loop
      }
      return NO;
   },
   
   queueRequest: function(request){
      // function to queue a request
      this._requestQueue.push(request);
   },
   
   retrieveRequestQueue: function(){
      // function to return all queued records for this user in such a way that 
      // it can be sent of right away, empty the queue when the function returns
      var queue = this._requestQueue;
      this._requestQueue = [];
      return queue;
   }
   
   
   
});