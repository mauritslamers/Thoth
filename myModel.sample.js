var OrionModel = require('./OrionModel').Model;

exports.myModel = OrionModel.extend({
   bucket: 'model',
   firstName: OrionModel.attr(String),
   inbetween: OrionModel.attr(String),
   lastname: OrionModel.attr(String)   
});