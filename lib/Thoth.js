/*globals global SC */
var sys = require('sys') || require('util'); 
var tools = require('./core/Tools');

var rootPath = tools.getRootPath();
//checking if we are running from tests...
var pathLib = require('path');
if(pathLib.basename(rootPath) === 'tests') rootPath = pathLib.dirname(rootPath);

var libPath = rootPath + '/lib';
var corePath = libPath + '/core';

if(!global.SC){
	require(corePath + '/sc/thoth_sc');
} 

// some global enhancements
Array.prototype.toSCArray = function(){
  return SC.$A(this);
};

SC.mixin(Array.prototype,SC.Enumerable);

//create main object
var Thoth = SC.Object.create({
	NAMESPACE: 'Thoth',
	VERSION: '0.1.0'
});

// require other basic classes
Thoth.SocketListener = require(corePath + '/SocketListener').SocketListener;
Thoth.UserCache = require(corePath + '/UserCache').UserCache;
Thoth.Auth = require(corePath + '/Auth').Auth;
Thoth.FileAuth = require(libPath + '/FileAuth').FileAuth;
Thoth.Session = require(corePath + '/Session').Session;
Thoth.Store = require(corePath + '/Store').Store;
Thoth.WrapperStore = require(corePath + '/WrapperStore').WrapperStore;
Thoth.ApplicationStore = require(corePath + '/ApplicationStore').ApplicationStore;
Thoth.MemStore = require(corePath + '/MemStore').MemStore;
Thoth.DiskStore = require(corePath + '/DiskStore').DiskStore;
Thoth.Server = require(corePath + '/Server').Server;
Thoth.RPCHooks = require(corePath + '/RPCHooks').RPCHooks;
Thoth.Policies = require(corePath + '/Policies').Policies;
Thoth.PolicyModel = require(corePath + '/PolicyModel').PolicyModel;

// add some nice functions from sys
Thoth.log = sys.log;
Thoth.inspect = sys.inspect;
Thoth.copy = tools.copy;
Thoth.getRootPath = tools.getRootPath;

if(!global.Thoth) global.Thoth = Thoth;
exports.Thoth = Thoth;

//for profiling?
