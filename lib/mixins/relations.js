/*
Basic relation mixin. Contains the basic layout needed for a relation scheme

The idea of the relation mixin is that it converts the relation scheme received by the store into a 
storage paradigm.

This paradigm will depend on the actual storage engine. If a SQL back end storage is used, a junction table
approach will probably be the easiest. If Riak is used, a junction table approach will most likely not be 
the optimal approach.

The Mixin is intended to be used inside an extended Store. 

The entry point for the Store are the following functions:
  - getRelation: get the relation for a certain record and relation set
  - createRelation: create a relation between two records
  - destroyRelation: delete a relation between two records
  - updateRelation: update a relation set of a specific record. While this function will boil down to use the other functions
                    it allows the developer to do caching of relational data if required

The place where the mixin should be used is either inside the creation call of the actual store, or in the 
stores definition.

*/

var sys = require('sys');

exports.BasicRelationMixin = {
  
  getRelation: function(){
    sys.log('This is the Basic Relation mixin, this function needs an implementation');
  },
  
  createRelation: function(){
    sys.log('This is the Basic Relation mixin, this function needs an implementation');
  },
  
  updateRelation: function(){
    
  },
  
  destroyRelation: function(){
    sys.log('This is the Basic Relation mixin, this function needs an implementation');    
  }
  
};