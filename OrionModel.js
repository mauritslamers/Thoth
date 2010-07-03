var sys = require('sys');
if(!global.SC) require('./sc/runtime/core');

var ModelAttribute = require('./OrionModelAttribute');

// OrionServer Model

   /*
    define a standard thing for models, that allows SC model generating
    moreover, it allows for automatic relations
   
    we need a toOne and toMany relation
    toOne can be achieved by using a link
    toMany can be achieved either by a link (and therefore equals a mapreduce call)
    or, if the other side also happens to be a toMany, a kind of junction table
    of which the appropriate keys can be obtained using a another mapred
   
    what if every relation can automatically be turned into a junction table?
    most of the times the actual data is not adjusted, only the relation between that data
   
    There is also the case of a nested record... Riak supports nested records easily, 
    for example the admission exam model could easily be one nested model, containing all 
    questions, and even more important nested categories. (categories, subcategories, subsubcategories etc...)
    this could be done using links..
   
    In Sproutcore though a nested record could easily be read out using computed properties
    but writing a nested record seems much more difficult and the structure of the framework doesn't really
    feel like it would be able to handle it with ease...
    so in a sense it makes sense to allow for nested records
   
    For the moment though, it seems wise to only go with standard toOne and toMany for the following reasons
    - it is easier and more straight forward to implement
    - nested records can be created using mapred functions
    - they can always be added later
   
   */
   
   /*
     So, when we're building, what is actually needed?
     - record properties
     - toOne 
     - toMany
     
     - record properties can be standard types, or we could create a kind of Record.Attribute clone
     - we need to know how to think on OneToOne, OneToMany, ManyToOne, ManyToMany
     - we may need to think about permission stuff. That is that some users will only have read permission on some records
       and others read/write permissions. We could try to have a Unix style permission system, maybe even using bucket properties?
       Or maybe even better: use links stored with the records, so you can have a permission per record
       Even better seems to be a special permissions object stored in each record. As permissions can be best controlled at the
       server, the permissions can be kept in check by the server and never have to be published towards the client, except perhaps
       for a root access application.
       
     - We also need to think of object versus prototype. What functionality should be on the prototype? It seems to be sensible to do as much on the prototype 
       als possible. How to achieve that exactly using the CommonJS import system is a bit of finding out...
       
   */
   
   /* bucket: in which bucket is the information to be stored? */
/*
export.HAS_TO_ONE = 1;

export.HAS_TO_MANY = 2;
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


