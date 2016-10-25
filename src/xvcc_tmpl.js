/*jslint white:true browser:true maxlen:80*/
/*global FS, cpp_js */

// "use strict";  // emcc might generate some non-strict code

function mkDirs(path, dir, mkdirImpl) {
    var p;
    for (p in dir) {
        if (dir.hasOwnProperty(p)) {
            if (dir[p] !== 0) {
                mkdirImpl(path + p);
                mkDirs(path + p + '/', dir[p], mkdirImpl);
            }
        }
    }
}

function xvcc(processed, target, dirStruct, onReturn, printOut) {
    var Module;
    (function() {
        var infofile, infile;
        infile = target + '.i';
        infofile = target + '.d';
        Module = {
            arguments: ["-o", target, infile],
            printErr: printOut,
            preRun: [function() {
                mkDirs('', dirStruct, FS.mkdir);
                FS.writeFile(infile, processed);
            }],
            postRun: [function() {
                var result, info;
                result = {
                    filename: target,
                    encoding: 'binary',
                    content: FS.readFile(target, {
                        encoding: 'binary'
                    })
                };
                info = FS.readFile(infofile, {
                    encoding: 'utf8'
                });
                onReturn(result, info);
            }]
        };
    }());
    /* {{emcc_stub}} */
}
