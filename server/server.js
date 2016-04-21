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
        socket.on('getstuff', function() {
            var files;

            files = [
                ['bin/os', null],
                ['bin/fs.img', null],
                ['dsym/bin/bin2c.dsym', 'ascii'],
                ['dsym/bin/c.dsym', 'ascii'],
                ['dsym/bin/cat.dsym', 'ascii'],
                ['dsym/bin/cp.dsym', 'ascii'],
                ['dsym/bin/echo.dsym', 'ascii'],
                ['dsym/bin/edit.dsym', 'ascii'],
                ['dsym/bin/grep.dsym', 'ascii'],
                ['dsym/bin/halt.dsym', 'ascii'],
                ['dsym/bin/kill.dsym', 'ascii'],
                ['dsym/bin/ln.dsym', 'ascii'],
                ['dsym/bin/ls.dsym', 'ascii'],
                ['dsym/bin/man.dsym', 'ascii'],
                ['dsym/bin/mkdir.dsym', 'ascii'],
                ['dsym/bin/mv.dsym', 'ascii'],
                ['dsym/bin/pwd.dsym', 'ascii'],
                ['dsym/bin/rm.dsym', 'ascii'],
                ['dsym/bin/rmdir.dsym', 'ascii'],
                ['dsym/bin/sh.dsym', 'ascii'],
                ['dsym/bin/wc.dsym', 'ascii'],
                ['dsym/etc/init.dsym', 'ascii'],
                ['dsym/etc/os.dsym', 'ascii'],
                ['dsym/usr/emhello.dsym', 'ascii'],
                ['dsym/usr/euhello.dsym', 'ascii'],
                ['dsym/usr/hello.dsym', 'ascii'],
                ['dsym/usr/prseg.dsym', 'ascii'],
                ['dsym/usr/sdk.dsym', 'ascii']
            ];
            readEachFile(files, 0, function() {
                socket.emit('gotstuff', {
                    files: files
                });
            });
        });
    });
}

serve(8080);
