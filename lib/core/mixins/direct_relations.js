/*
This mixin will try to look up relations using the direct approach
The junction relations mixin will also be required, as that is the only mixin calling this mixins functions
*/

var sys = require('../Tools').sys;

exports.DirectRelationResolver = {
  getDirectRelation = function(storeRequest,relation,record,callback){
    // check: is relation toOne or toMany
    if(relation.toOne){
      // we should get the record with the one id we have from the record
      // this could be used for automatic nested records...
    }
    if(relation.toMany){
      
    }
  }
};