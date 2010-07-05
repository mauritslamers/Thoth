var sys = require('sys');
if(!global.SC) require('./sc/runtime/core');

var ModelAttribute = require('./OrionModelAttribute');

// OrionServer Model

/*
originally the idea of this model was to have both server side as client side models, mainly to do relation stuff.
Due to a conversation in the sc channel it became clear that trying to do server side models that have to know about
other models would become a major hassle.

It also became clear that is would be much wiser to do the putting together of the relation data in the data source at client side.

THis model doesn't have a real purpose anymore for relations.
Nevertheless, having a model server side could turn out to be very useful, especially with regards to 
serverside data checking, and permission stuff

Record attributes don't have to know about relations anymore, but could be a kind of data check, validator stuff
*/

exports.Model = SC.Object.extend({
   bucket: '', // what bucket the data is in
   
   resource: '', // what resource identifier should be reserved for this type, if not set, the bucket name is used
   
   id: '',
   
   returnPermissions: false, // flag to determine whether permissions on this model are allowed to be returned on the json to the app
   
   permissions: {
         owner: '', // bucket-key combination, like 'user/1'
         group: '', // bucket-key combination, like 'usergroups/1', actually a toOne relation, 
         mode: '' // an octal, UNIX style, '777'
      }, // for the moment the permissions are implemented on the complete record
      // it might be interesting to do permissions on properties (attributes and relations)
   
  getRecord: function(){
     // function to parse the current object to build a riak query
     // problem: where does this exactly point to?
     sys.puts('getRecord for Model with bucket ' + this.bucket);
  },
  
  attributes: function(){
     // return only the records attributes and values
     var ret = {};
     this.forEach(function(key,value){
        if(value && value.isAttribute){
           ret[key] = value;
        }
     });
     return ret;
  },
  
  _attributes: function(){
     // get all properties that are record attributes
     var ret = [];
     var prot = this.prototype;
     for(var i in prot){
        var val = prot[i];
        if(val && val.isAttribute) ret.push(val);
     }
     return ret;
  }.property().cacheable(),
  
  _relations: function(){
     //get all relations that are record attributes
     var ret = [];
     var prot = this.prototype;
     for(var i in prot){
        var val = prot[i];
        if(val && val.isRelation) ret.push(val);
     }
     return ret;
  }.property().cacheable(),
  
  _masterRelations: function(){
     var ret = [];
     var relations = this._relations();
     var numrel = relations.length;
     for(var i=0;i<numrel;i++){
        var currel = relations[i];
        if(currel.isMaster) ret.push(currel);
     }
     return ret;
  }.property().cacheable()
});


exports.Model.attr = ModelAttribute.attr;
exports.Model.toOne = ModelAttribute.toOne;
exports.Model.toMany = ModelAttribute.toMany;


