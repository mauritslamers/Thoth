var tools = require("../Tools");

exports.FlexObject = SC.Object.extend({
  
  fieldnames: null, // fieldnames is a list of property names that this object should use
  
  // instead of the fieldnames you can also define a schema, the init will use all the properties of the properties
  
  schema: null, 
  
  _debug: false,
  
  init: function(){
    if(!this.fieldnames && this.schema){
      this.fieldnames = this._copyFieldnamesFromSchema(this.schema);
    } 
    arguments.callee.base.apply(this,arguments);
  },
    
  _copyFieldnamesFromSchema: function(schema){
    var prop = schema.properties,
        ext = schema["extends"],
        i,fieldnames = [];
    
    if(prop){
      for(i in prop){
        if(prop.hasOwnProperty(i)) fieldnames.push(i);
      }
    }
    if(this._debug) tools.log('schema extends is ' + tools.inspect(ext));
    if(ext && (SC.typeOf(ext) === 'hash')){
      fieldnames = fieldnames.concat(this._copyFieldnamesFromSchema(ext));
    }               
    return fieldnames;
  },
  
  json: function(){
    var fieldnames = this.get('fieldnames');
    var ret = {};
    var f = function(fn){
      var res = this._getJSONFor.call(this,fn);
      if(res !== undefined) ret[fn] = res; // only copy when some kind of defined...
    };
    
    if(fieldnames) fieldnames.forEach(f,this);
    return ret;
  }.property(),
  
  _getJSONFor: function(field){
    return this.get(field);
  }
});