/*jslint white:true browser:true maxlen:80*/
/*global FS */

"use strict";

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

/**
 * XVCC supports only single .c file and single include directory.
 */
function xvcc(xvccOpt, dirStruct, files, onReturn, printOut) {
    var Module;
    (function() {
        var include, infile, outfile, infofile;
        include = xvccOpt.include[0];
        infile = xvccOpt.sources[0];
        outfile = xvccOpt.target;
        infofile = infile.substr(0, infile.length - 1) + 'd';
        Module = {
            arguments: ["-I" + include, "-o", outfile, infile],
            print: (printOut || console.log),
            preRun: [function() {
                mkDirs('', dirStruct, FS.mkdir);
                files.forEach(function(file) {
                    if ((file.filename === infile) ||
                        (file.filename.endsWith('.h') &&
                            file.filename.startsWith(include))) {
                        FS.writeFile(file.filename, file.content);
                    }
                });
            }],
            postRun: [function() {
                var result, info;
                result = {
                    filename: outfile,
                    encoding: 'binary',
                    content: FS.readFile(outfile, {
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
}
