/*jslint white:true node:true*/

'use strict';

var fs = require("fs");

function readEachFile(files, i, cb) {
    fs.readFile(files[i][0], files[i][1], function(e, d) {
        var j, k, c;

        if (e) {
            throw e;
        }
        files[i] = {
            name: files[i][0],
            data: d
        };
        c = 0;
        k = files.length;
        for (j = 0; j < k; j = j + 1) {
            if (files[j].data) {
                c = c + 1;
            }
        }
        if (c === k) {
            cb();
        }
    });
    if (i + 1 < files.length) {
        readEachFile(files, i + 1, cb);
    }
}

function serve(port) {
    var io;

    io = require('socket.io')(port);
    io.on('connection', function(socket) {
        socket.on('askdemo', function() {
            var files;

            files = [
                ['demo/os', null],
                ['demo/fs', null],
                ['demo/de', 'ascii']
            ];
            readEachFile(files, 0, function() {
                socket.emit('givedemo', {
                    files: files
                });
            });
        });
    });
}

serve(8080);
