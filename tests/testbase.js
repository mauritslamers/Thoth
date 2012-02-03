var vows = require('vows');
var assert = require('assert');
var Thoth = require('../lib/Thoth').Thoth;
var sys = require('util');

exports.vows = vows;
exports.assert = assert;
exports.Thoth = Thoth;
exports.log = sys.log;
exports.inspect = sys.inspect;


// test requests
exports.objectHasComputedProperty = function(prop,cacheable){
  return function(t){
    assert.isFunction(t[prop]);
    assert.isTrue(t[prop].isProperty);
    if(cacheable) assert.isTrue(t[prop].isCacheable);
    else assert.isUndefined(t[prop].isCacheable);
  };
};

exports.classHassComputedProperty = function(prop,cacheable){
  return function(t){
    assert.isFunction(t.prototype[prop]);
    assert.isTrue(t.prototype[prop].isProperty);
    if(cacheable) assert.isTrue(t.prototype[prop].isCacheable);
    else assert.isUndefined(t.prototype[prop].isCacheable);
  };
};