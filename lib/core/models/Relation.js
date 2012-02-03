var tools = require("../Tools");
var FlexObject = require("./FlexObject").FlexObject;
var API = require("../API");

exports.Relation = FlexObject.extend({
  
  //fieldnames: "type isNested isChildRecord isDirectRelation isMaster orderBy bucket primaryKey propertyName".w()
  schema: null,
  
  init: function(){ 
    // this needs to be done to prevent circular requires...
    var API = require('../API');
    this.schema = API.APISUBSCHEMAS.relation;
    arguments.callee.base.apply(this,arguments);
  },
  
  isToOne: function(){
    return this.type === 'toOne';
  }.property(),
  
  isToMany: function(){
    return this.type === 'toMany';
  }.property(),
  
  isRetrievable: function(){
    if(this.isNested) return false;
    if(this.isDirectRelation && this.isMaster && !this.isChildRecord) return false;
    return true;
  }.property(),
  
  isCreatable: function(){
    if(this.isNested) return false;
    if(!this.isMaster) return false;
    if(this.isDirectRelation && !this.isChildRecord) return false;
    return true;
  }.property(),
  
  isUpdatable: function(){
    if(this.isNested) return false;
    if(!this.isMaster) return false; // don't update when not master
    if(this.isMaster && !this.keys) return false;
    if(this.isMaster && this.keys && this.keys instanceof Array && this.keys.length === 0) return false; 
    return true;
  }.property(),
  
  isDeletable: function(){
    if(this.isNested) return false;
    if(!this.isMaster) return false;
    if(this.isDirectRelation && this.isMaster && !this.isChildRecord) return false;
    return true;
  }.property()
  
  
});