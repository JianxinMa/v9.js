/*jslint white:true browser:true maxlen:80*/
/*global FS, cpp_js */

"use strict";

var xvccCore;

var expandedFileSuffix = '.xpd.c';

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

function xvcc(xvccOpt, dirStruct, files, onReturn, printOut) {
    var searchInclude, xvccCaller, cPreProcessor;
    /*jslint unparam:true*/
    searchInclude = function(header, is_global, resumer) {
        var i, j, include, tryMatch, matched;
        tryMatch = function(file) {
            if (!matched) {
                if (file.filename === include + header) {
                    matched = true;
                    resumer(file.content);
                }
            }
        };
        matched = false;
        if (header.endsWith('.c')) {
            include = '';
            files.forEach(tryMatch);
        }
        if (!matched) {
            j = xvccOpt.include.length;
            for (i = 0; i < j; i = i + 1) {
                include = xvccOpt.include[i];
                if (!include.endsWith('/')) {
                    include = include + '/';
                }
                files.forEach(tryMatch);
                if (matched) {
                    break;
                }
            }
        }
        if (!matched) {
            resumer(null);
        }
    };
    /*jslint unparam:false*/
    xvccCaller = function(processed) {
        xvccCore(xvccOpt.sources[0] + expandedFileSuffix, processed,
            xvccOpt.target, dirStruct, onReturn, printOut);
    };
    cPreProcessor = cpp_js({
        signal_char: '#',
        warn_func: printOut,
        error_func: printOut,
        include_func: searchInclude,
        completion_func: xvccCaller
    });
    cPreProcessor.run((function() {
        var i, j, ret;
        ret = '';
        j = xvccOpt.sources.length;
        for (i = 0; i < j; i = i + 1) {
            ret += '#include <';
            ret += xvccOpt.sources[i];
            ret += '>\n';
        }
        return ret;
    }()));
}

xvccCore = function(infile, processed, target,
    dirStruct, onReturn, printOut) {
    var Module;
    (function() {
        var infofile;
        infofile = infile.substr(0, infile.length - 1) + 'd';
        Module = {
            arguments: ["-o", target, infile],
            print: (printOut || console.log),
            preRun: [function() {
                mkDirs('', dirStruct, FS.mkdir);
                FS.writeFile(infile, processed);
            }],
            postRun: [function() {
                var result, info, source;
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
                source = {
                    filename: infile,
                    encoding: 'utf8',
                    content: processed
                };
                onReturn(result, info, source);
            }]
        };
    }());
};
