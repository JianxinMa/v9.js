/*jslint white:true*/

'use strict';

function serve(port) {
    var io;

    io = require('socket.io')(port);
    io.on('connection', function(socket) {
        socket.on('connect', function() {});
        socket.on('connect', function() {});
        socket.on('message', function() {});
        socket.on('disconnect', function() {});
    });
}

serve(8080);
