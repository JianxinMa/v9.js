/*jslint white:true browser:true maxlen:80 bitwise:true */
/*global FS, mkDirs */

"use strict";

function mkfs(diskRoot, files, binFiles, dirStruct, onReturn, printOut) {
    var Module;
    (function() {
        var diskImg;
        diskImg = diskRoot + '.img';
        Module = {
            arguments: [diskImg, diskRoot],
            print: (printOut || console.log),
            preRun: [function() {
                var saveFile;
                saveFile = function(file) {
                    FS.writeFile(file.filename, file.content, {
                        encoding: file.encoding
                    });
                };
                mkDirs('', dirStruct, FS.mkdir);
                files.forEach(saveFile);
                binFiles.forEach(saveFile);
            }],
            postRun: [function() {
                var img;
                img = FS.readFile(diskImg, {
                    encoding: 'binary'
                });
                onReturn(img);
            }]
        };
    }());
}
