var tools = require('./Tools');

// This is based on the json schema validator taken from cloudheads resourcer
// https://github.com/cloudhead/resourcer
// added support for schema extends and array types

exports.JSONValidate = SC.Object.extend({

  defaultMessages: {
    optional:  "",
    pattern:   "",
    maximum:   "",
    minimum:   "",
    maxLength: "",
    minLength: "",
    requires:  "",
    unique:    ""
  },

  defaultSchema : {},

  errors: null,

  validate: function (object, schema) {
    this.errors = []; // always refresh when beginning with a new validation
    if (typeof(object) !== 'object' || typeof(schema) !== 'object') {
      throw new(TypeError)("`validate` takes two objects as arguments");
    }
    this.validateObject(object, schema);

    return { valid: !Boolean(this.errors.length), errors: this.errors };
  },

  validateObject: function (object, schema) {
    var that = this, extschema = schema['extends'];
    Object.keys(schema.properties).forEach(function (k) {
      that.validateProperty(object, k, schema.properties[k]);
    });
    if(extschema){
      Object.keys(extschema.properties).forEach(function (k) {
        that.validateProperty(object, k, extschema.properties[k]);
      });      
    }
  },

  checkType: function (val, type) {
    switch (type) {
      case 'string': return typeof(val) === 'string';
      case 'array': return Array.isArray(val);
      case 'object': return val && (typeof(val) === 'object') && !Array.isArray(val);
      case 'number': return typeof(val) === 'number';
      case 'integer': return typeof(val) === 'number' && (val % 1 === 0);
      case 'null': return val === null;
      case 'boolean': return typeof(val) === 'boolean';
      case 'any': return typeof(val) !== 'undefined';
      default: return true;
    }
  },

  validateProperty: function (object, property, schema) {
    var type, value = object[property], me = this;

    var constrain = function(name, value, assert) {
      if ((name in schema) && !assert(value, schema[name])) {
        this.error(name, property, value, schema);
      }
    };
  
    //tools.log('validating property: ' + property);
    //tools.log('value on object is ' + value);

    if (value === undefined && schema.required) {
      this.error('required', property, true, schema);
    }
    // adding support for objects
    if(value instanceof Array && schema.items){
      value.forEach(function(v){
        me.validateObject(v,schema.items);
      });
    }
    
    if (schema['enum'] && schema['enum'].indexOf(value) === -1) {
      this.error('enum', property, value, schema);
    }
    if (schema.requires && object[schema.requires] === undefined) {
      this.error('requires', property, null, schema);
    }
    if (this.checkType(value, schema.type)) {
      //tools.log('schema type: ' + (schema.type || typeof(value)));
      switch (schema.type || typeof(value)) {
        case 'string':
          constrain('minLength', value.length, function (a, e) { return a >= e; });
          constrain('maxLength', value.length, function (a, e) { return a <= e; });
          constrain('pattern',   value,        function (a, e) { return e.test(a); });
          break;
        case 'number':
          constrain('minimum',     value, function (a, e) { return a >= e; });
          constrain('maximum',     value, function (a, e) { return a <= e; });
          constrain('divisibleBy', value, function (a, e) { return a % e === 0; });
          break; 
      }
    } else {
      if(schema.required) this.error('type', property, typeof(value), schema);
    }
  },


  error: function(attribute, property, actual, schema) {
    var message = schema.messages && schema.messages[property] || "no default message";

    this.errors.push({
      attribute: attribute,
      property: property,
      expected: schema[attribute] || exports.defaultSchema[attribute],
      actual: actual,
      message: message,
      required: schema.required
    });
  }

});
