/*
let's do this as a kind of node module, because it saves a lot on difficult file reading stuff
*/

exports.users = { 
   'root': { passwd: 'password', role: 'admin'},
   'test': { passwd: 'test', role:'user' }
};
