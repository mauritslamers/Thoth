/*
let's do this as a kind of node module, because it saves a lot on difficult file reading stuff
*/

exports.users = { 
   'root': { passwd: 'password', isRoot: true},
   'test': { passwd: 'test', isRoot: false }
};
