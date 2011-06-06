/*
 File containing all global constants and error messages used in Thoth
*/

// error codes
exports.ERROR_DENIEDONPOLICY = 0;
exports.ERROR_DATAINCONSISTENCY = 1;
exports.ERROR_RPCNOTLOADED = 2;

//actions
exports.ACTION_FETCH = 'fetch';
exports.ACTION_REFRESH = 'refresh';
exports.ACTION_CREATE = 'create';
exports.ACTION_UPDATE = 'update';
exports.ACTION_DELETE = 'destroy';
exports.ACTION_RPC = 'rpc';

exports.DISTRIBUTE_QUERY = 'query';
exports.DISTRIBUTE_BUCKETKEY = 'bucketkey';

exports.REQUESTTYPE_XHR = 'xhr';
exports.REQUESTTYPE_WS = 'websocket';
exports.REQUESTTYPE_REST = 'rest';

exports.POLICY_REQUEST_ACCEPTED = YES;
exports.POLICY_REQUEST_DENIED = NO;
exports.POLICY_REQUEST_RETRY = 'retry';