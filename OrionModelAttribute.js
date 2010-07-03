if(!global.SC) require('./sc/runtime/core');
/*
We need a model attribute to handle both properties on the record as
relations. The attribute object is a object containing a set of functions
returning the proper object type (variable or relation) for a specific property.

On retrieve the model checks what properties are there and makes the map-red for the relations


*/

exports.attr = function(val){
   // val is a data type
   // returns an object having val as content
   return {
     content: val,
     isAttribute: true 
   };
   
};

exports.toOne = function(bucket, isMaster){
   // rel is a relation
   // return an object containing the relation data
   // we need only the containing bucket, as the keys are inside the records
   return {
      relatedTo: bucket,
      isMaster: isMaster,
      relationType: 'toOne',
      isRelation: true
   };
};

exports.toMany = function(bucket, isMaster){
   return {
      relatedTo: bucket,
      isMaster: isMaster,
      relationType: 'toMany',
      isRelation: true
   };
};
