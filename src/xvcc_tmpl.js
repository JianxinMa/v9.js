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
                {
                    // Ad-hoc bugfix: it add magic debug hint to
                    // the ELF file. The hint should be added by
                    // the compiler. However, the JavaScript version
                    // of the compiler doesn't behave correctly.
                    // Though the C version works fine.

                    // Actually we already have an ad-hoc fix in xvcc.c.
                    // Here this code just serves as double-insurance.

                    var i = 16;
                    result.content[i++] = 0xff;
                    result.content[i++] = 0x17;
                    result.content[i++] = 0x20;
                    result.content[i++] = 0xff;
                    for (var s = 0; s < infile.length; s++) {
                        result.content[i++] = infile.charCodeAt(s);
                    }
                    result.content[i++] = 0;
                }
                info = FS.readFile(infofile, {
                    encoding: 'utf8'
                });
                onReturn(result, info);
            }]
        };
    }());
    /* {{emcc_stub}} */
}
