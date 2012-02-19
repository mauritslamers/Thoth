/*globals process*/

// file to be used with fork 

var mysql = require('mysql');
var util = require('util');

var client;
var store;

var callbackCreator = function(reqKey){
  return function(err,records,fields){
    //util.log('sending back results from mysql child...');
    process.send({
      reqKey: reqKey,
      err: err,
      records: records,
      fields: fields
    });
  };
};

process.on('message',function(m,handle){
  if(m.isQuery){
    if(client){
      // { query: '', params: [], reqKey: '' }
      //util.log('receiving query in mysql child...');
      //util.log('performing query: ' + client.format(m.query,m.params));
      client.query(m.query,m.params,callbackCreator(m.reqKey));
    }
    else {
      process.send({ error: m.reqKey });
    }    
  }
  if(m.isConnect){
    //util.log('creating mysql client in mysql child...');
  	client = mysql.createClient({
  	  user      : m.user,
  	  password  : m.password,
  	  host      : m.hostname,
  	  database  : m.database
  	});    
  }

});

process.title = "Thoth NodeMySQL child";
