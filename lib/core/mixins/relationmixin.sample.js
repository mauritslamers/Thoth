/*
Basic relation mixin sample. Contains the basic layout needed for a relation scheme

The idea of the relation mixin is that it converts the relation scheme received by the store into a 
storage paradigm.

This paradigm will depend on the actual storage engine. If a SQL back end storage is used, a junction table
approach will probably be the easiest. If Riak is used, a junction table approach will most likely not be 
the optimal approach.

The Mixin is intended to be used inside an extended Store. 

The entry point for the Store are the following functions:
  - fetchRelations: get the relation for a certain record and relation set
  - createRelation: create a relation between two records
  - destroyRelation: delete a relation between two records
  - updateRelation: update a relation set of a specific record. While this function will boil down to use the other functions
                    it allows the developer to do caching of relational data if required

The place where the mixin should be used is either inside the creation call of the actual store, or in the 
stores definition.

*/

var sys = require('sys');

exports.BasicRelationMixin = {
  
  fetchRelation: function(storeRequest,records,relation,callback){
    sys.log('This is the Basic Relation mixin fetchRelations function. This function needs an implementation');
  },
  
  /*
  createRelation is a function to create a set of relations with a newly created record
  createRelation gets the store request, the record it should match against (model), a relation object
  containing a property keys containing the keys it should create a relation with, and a clientId
  */
  createRelation: function(storeRequest,record,relation,clientId){
    sys.log('This is the Basic Relation mixin createRelation function. This function needs an implementation');
  },
  
  /*
  updateRelation is a function used by the updateRecord Store function to update existing relation
  This function is provided separately because it may well be the updating procedure is different
  or allows more tweaking for the specific DB.
  */
  updateRelation: function(storeRequest,record,relation,clientId,callback){
    sys.log('This is the Basic Relation mixin updateRelation function. This function needs an implementation');   
  },
  
  /*
   destroyRelation is used by Thoth.Store to destroy all relation records for a certain record
   */
  destroyRelation: function(storeRequest,relation,clientId,callback){
    sys.log('This is the Basic Relation mixin destroyRelation function. This function needs an implementation');
  }
  
};