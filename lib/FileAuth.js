/*
Authentication plugin for using fixture like authentication

The fixture file


*/
if(!global.SC) require('./sc/runtime/core');

var fs = require('fs');
var sys = require('sys');
var Auth = require('./core/Auth').Auth;

exports.FileAuth = Auth.extend({
   fileName: '',
   // rootUser and rootPassword are not used, as they have to be defined inside the fixtures
   
   _authData: null,
   
   checkAuth: function(user,passwd,passwdIsMD5,callback){
      if(!this._authData){
         var data = require('.'+this.fileName); // the data should already be in the right format
         this._authData = data.users;
      }
      // so the auth data is loaded, do a check
      var userdata = this._authData[user];
      if(userdata){
         var ret = {
            user: user,
            role: userdata.role
         }
         if(userdata.passwd == passwd){
            callback(ret);
         }
         else callback(NO);
      }
      else callback(NO);
      
   }   
});