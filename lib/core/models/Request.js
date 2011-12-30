
// A request is the basic form of interprocess communication within Thoth.
// Both the API request and the store request are forms of this request.
// A request will by default copy the information in the properties named in the _fieldnames list.
// A request will copy the properties mixed in its creation process,
// It will not use the SC copy machine, but the Thoth copy, which is a full copy of the object
var tools = require('../Tools');
var FlexObject = require('./FlexObject').FlexObject;

exports.Request = FlexObject.extend({
  
  // specialFields is an object containing a name field and a model,
  // if the special field is an array, every hash inside it will be created from that model
  specialFields: null, 
  
  _copyFields: function(){
    var fieldnames = this.get('fieldnames');
    var specialfields = this.get('specialFields');
    if(SC.typeOf(fieldnames) === 'array'){
      fieldnames.forEach(function(fn){
        var modelmapper = function(d){
          return specialfields[fn].create(d);
        };
        var data = tools.copy(this[fn]);
        if((SC.typeOf(specialfields) === 'hash') && specialfields[fn]){ // field is a special field?
          // if array, map the model onto the data
          if(data.forEach) this[fn] = data.map(modelmapper);
          else this[fn] = specialfields[fn].create(data); // else create a single model with the data
        }
        else this[fn] = tools.copy(data); // if not special field, just copy the data
      },this);     
    }   
    
  },
  
  init: function(){
    // this init replaces the original init, by really deep copying data
    arguments.callee.base.apply(this,arguments); // call super first
    if(this.fieldnames) this._copyFields();
  }
  
});