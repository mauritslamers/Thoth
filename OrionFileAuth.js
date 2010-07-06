/*
Authentication plugin for using fixture like authentication

The fixture file


*/
if(!global.SC) require('./sc/runtime/core');

var fs = require('fs');
var sys = require('sys');
require('./OrionAuth');

global.OrionFileAuth = OrionAuth.extend({
   fileName: '',
   // rootUser and rootPassword are not used, as they have to be defined inside the fixtures
   
   _authData: null,
   
   // checkAuth has to return immediately, it should not be done using a callback
   checkAuth: function(user,passwd,passwdIsMD5){
      if(!this._authData){
         var fn = ['./',this.fileName].join('');
         var data = require(fn); // the data should already be in the right format
         this._authData = data.users;
      }
      // so the auth data is loaded, do a check
      var userdata = this._authData[user];
      if(userdata){
         if(userdata.passwd == passwd){
            return YES;
         }
         else return NO;
      }
      else return NO;
      
   }   
});