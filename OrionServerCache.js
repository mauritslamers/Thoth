/*
The OrionServerCache is a kind of controller that allows the storage of record information
The issue in OrionServer is that whenever an update takes place, every connected or authenticated user 
that has some kind of interest in that particular record needs to be made aware of the change.

To that end, a server side cache is needed that contains what records the user requested.
To prevent having to copy the entire database, we only keep a subset of all information:

 - a set of bucket/key combinations of records actually requested by the user
 - a copy of the fetch requests and the corresponding query information, to check whether newly 
   created records match a previous request made by the client using a query

The server cache may be a very useful place to do the permission checking...

The server cache is a per user cache.

This server cache could be implemented using the riak back end, but for the moment let's keep it to the
program itself


*/

global.OrionServerCache = SC.Object.extend({
   
   // an array [bucketname][keyname] = timestamp;
   
   _bucketKeyStore: [], 
   
   // an array: [bucketname] = query
   _fetchQueryStore: [],
   
   indexOfQuery: function(conditions,parameters){
      var queries = this._fetchQueryStore;
      for(var i=0,l=queries.length;i<l;i++){
        var curQuery = queries[i];
        if((curQuery.conditions == conditions) && (curQuery.parameters.isEqual(parameters))){
           // conditions is a string, parameters an object
           return i;
        }
      }
      return -1; // if not found, return -1
   },
   
   storeQuery: function(conditions,parameters){
      //create a query from the given conditions and parameters in case such a query doesn't exist already
      // but in a way we have to make sure there will be no double queries around
      var indexOfQuery = this.indexOfQuery(conditions,parameters);
      if(indexOfQuery == -1){
         // doesn't exist, so add one
         var query = SC.Query.create(conditions,parameters);
         query.parse();
         this._fetchQueryStore.push(query);
      }
   },
   
   storeBucketKey: function(bucket,key,timestamp){
      //function to store a bucket/key/timestamp combination
      // if the bucket/key combination already exists, update the timestamp
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
         this._bucketKeyStore[bucket] = [];
         this._bucketKeyStore[bucket][key] = timestamp;
      }
   },
   
   shouldReceive: function(record){
      // function to check whether the current user should receive
      
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
            return YES;
         }         
      }
      
      // if we are running here, we should check the existing queries
      var queries = this._fetchQueryStore;
      var numqueries = queries.length;
      if(numqueries>0){
         for(var i=0;i<numqueries;i++){
            if(queries[i].contains(record)) return YES;
         }
      }
      return NO;
   }
   
});