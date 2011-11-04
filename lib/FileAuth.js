/*globals global*/
/*
Authentication plugin for using fixture like authentication

The fixture file


*/
if(!global.SC) require('./sc/runtime/core');

var fs = require('fs');
var sys = require('sys');
var Auth = require('./core/Auth').Auth;
var Tools = require('./core/Tools');

exports.FileAuth = Auth.extend({
	fileName: '',
	// rootUser and rootPassword are not used, as they have to be defined inside the fixtures

	checkAllowedApplications: null,

	_authData: null,

  // two ways of invoking: using all the parameters
  // or by providing the auth object from ThothSC and a callback

	checkAuth: function(user,passwd,passwdIsMD5,callback,applicationName){
	  var authObj;
	  if(user && passwd && !passwdIsMD5 && !callback && !applicationName){
	    // called with ThothSC obj
	    authObj = user;
	    callback = passwd;
	    applicationName = authObj.application;
	    passwdIsMD5 = authObj.passwdIsMD5;
	    passwd = authObj.passwd;
	    user = authObj.user;
	  }
	  
	  
		if(!this._authData){
			var data = require(Tools.rootPath + '/' + this.fileName); // the data should already be in the right format
			this._authData = data.users;
		}
		// so the auth data is loaded, do a check
		var userdata = this._authData[user];
		if(userdata){
			var ret = {
				user: user,
				role: userdata.role
			};
			if(userdata.passwd == passwd){
				if(this.checkAllowedApplications){
					sys.log('checking application name : ' + applicationName);
				 	if (userdata.allowedApplications && (userdata.allowedApplications.indexOf(applicationName) !== -1)){
						callback(ret);
					}
					else callback(NO);
				}
				else {
					sys.log('no Checking application name');
					callback(ret);
				} 
			}
			else callback(NO);
		}
		else callback(NO);

	}   
});