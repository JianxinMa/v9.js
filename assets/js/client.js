/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, $, createV9, io */

"use strict";

(function() {
    var editor, files, curFileId, breakPoints, v9Cpu;

    function makeMarker() {
        var marker;
        marker = document.createElement("div");
        marker.style.color = "gray";
        marker.innerHTML = "●";
        return marker;
    }

    function saveCurrentFile() {
        if (curFileId !== -1) {
            if (files[curFileId].content !== editor.getValue()) {
                files[curFileId].content = editor.getValue();
                return true;
            }
        }
        return false;
    }

    function editFile(name, line) {
        if (curFileId === -1 || files[curFileId].name !== name) {
            files.forEach(function(file, i) {
                var point, items;
                if (file.filename === name) {
                    saveCurrentFile();
                    curFileId = i;
                    editor.setValue(file.content);
                    items = $("#files").children();
                    items.removeClass("active");
                    items.each(function() {
                        if ($(this).text() === name) {
                            $(this).addClass("active");
                        }
                    });
                    for (point in breakPoints) {
                        if (breakPoints.hasOwnProperty(point)) {
                            if (point.startsWith(name + ' ')) {
                                editor.setGutterMarker(
                                    Number(point.split(' ')[1]) - 1,
                                    "breakPoints",
                                    makeMarker());
                            }
                        }
                    }
                }
            });
        }
        if (line) {
            editor.setCursor(line - 1);
        }
        $("#edpanel").focus();
    }

    function findMatched(s, l) {
        var lv, r;
        if (s[l] !== '(') {
            console.log('In findMatched: bad s[l]', s[l]);
            return -1;
        }
        lv = 1;
        r = l;
        while (lv) {
            r = r + 1;
            if (s[r] === '(') {
                lv = lv + 1;
            } else if (s[r] === ')') {
                lv = lv - 1;
            }
        }
        return r;
    }

    function getOneVarValue(v, t, arrSz, stLev) {
        var hexify, len, l, car, cdr, x;
        hexify = function(x) {
            if (typeof(x) === 'number') {
                return '0x' + ('00000000' + x.toString(16)).substr(-8);
            }
            return x;
        };
        len = t.length;
        if (findMatched(t, 0) === len - 1) {
            t = t.substr(1, len - 2);
            l = t.indexOf('(');
            if (l === -1) {
                return {
                    addr: v,
                    type: t,
                    val: v9Cpu.readBaseType(v, t).toString()
                };
            } else {
                car = t.substr(0, l);
                cdr = t.substr(l, l.length - l);
                if (car === 'ptr') {
                    return hexify(v9Cpu.readBaseType(v, 'uint'));
                } else if (car === 'array') {
                    x = {
                        addr: hexify(v),
                        type: t
                    };
                    if (arrSz) {
                        console.log('arrSz not implemented');
                    }
                    return x;
                } else if (car === 'struct') {
                    x = {
                        addr: v,
                        type: t
                    };
                    if (stLev) {
                        console.log('stLev not implemented');
                    }
                    return x;
                }
            }
        }
        console.log('In readTypedVal: bad type', t);
        return 'BAD_TYPE';
    }

    function getVarValues(defs) {
        var name, info, v, ret;
        ret = {};
        for (name in defs) {
            if (defs.hasOwnProperty(name)) {
                info = defs[name];
                v = v9Cpu.getVirtAddr(info.space, info.offset);
                ret[name] = getOneVarValue(v, info.type);
            }
        }
        return ret;
    }

    function doAtCpuReady() {
        $("#termpanel").focus();
        $("#termcursor").addClass("blinking-cursor");
    }

    function doAtCpuPause(point, localDefs, globalDefs) {
        var varVals;
        if (!point) {
            $("#termtext").text("End of program reached.");
        } else {
            point = point.split(' ');
            editFile(point[0], Number(point[1]));
            varVals = {
                locals: getVarValues(localDefs),
                globals: getVarValues(globalDefs)
            };
            console.log(varVals);
        }
        $("#termcursor").removeClass("blinking-cursor");
    }

    function onCpuReady(cb) {
        var sk;
        if (saveCurrentFile() || v9Cpu.needInit()) {
            sk = io('http://localhost:8080');
            sk.emit('saveFiles', files);
            sk.on('filesSaved', function() {
                sk.emit('compileFiles');
                sk.on('filesCompiled', function(compiled) {
                    sk.disconnect();
                    v9Cpu.setupSoftware(compiled.os, compiled.hd, compiled.de);
                    $("#termtext").text("");
                    cb();
                });
            });
        } else {
            cb();
        }
    }

    function main() {
        var initPanels, initEditor, initV9, fetchFiles, initButtons;
        initPanels = function() {
            $(".panel").focus(function() {
                $(".panel").removeClass("panel-primary");
                $(".panel").addClass("panel-default");
                $(this).removeClass("panel-default");
                $(this).addClass("panel-primary");
            });
        };
        initEditor = function() {
            curFileId = -1;
            breakPoints = {};
            editor = CodeMirror.fromTextArea(
                document.getElementById("editor"), {
                    mode: "text/x-csrc",
                    styleActiveLine: true,
                    lineNumbers: true,
                    gutters: ["CodeMirror-linenumbers", "breakPoints"]
                });
            editor.on("focus", function() {
                $("#edpanel").focus();
            });
            editor.on("gutterClick", function(cm, ln) {
                var point;
                point = files[curFileId].filename + ' ' + (ln + 1).toString();
                if (cm.lineInfo(ln).gutterMarkers) {
                    cm.setGutterMarker(ln, "breakPoints", null);
                    delete breakPoints[point];
                } else {
                    cm.setGutterMarker(ln, "breakPoints", makeMarker());
                    breakPoints[point] = true;
                }
            });
        };
        initV9 = function() {
            var printOut;
            printOut = function(fd, msg) {
                var termtext;
                if (fd === 2) {
                    console.log(msg);
                }
                msg = msg.replace(/\t/g, '&nbsp;&nbsp;');
                msg = msg.replace(/\n/g, '<br/>');
                termtext = $("#termtext");
                termtext.html(termtext.html() + msg);
            };
            v9Cpu = createV9(printOut, breakPoints);
            $("#termpanel").keypress(function(e) {
                var keyCode;
                keyCode = e.keyCode || e.which;
                if (0 <= keyCode && keyCode <= 0x7F) {
                    v9Cpu.writeKbBuf(keyCode);
                }
            });
        };
        fetchFiles = function() {
            var sk;
            sk = io('http://localhost:8080');
            sk.emit('fetchFiles');
            sk.on('filesSent', function(fetchedFiles) {
                sk.disconnect();
                $("#fetchingfiles").remove();
                files = fetchedFiles;
                files.forEach(function(file, i) {
                    $("#files").append(
                        "<li id='file" + i.toString() + "'>" +
                        "<a href='#'>" + file.filename + "</a>" +
                        "</li>"
                    );
                });
                $("#files").children().click(function() {
                    editFile($(this).text());
                });
                editFile("root/etc/os.c");
            });
        };
        initButtons = function() {
            var runBtn, stepBtn, contBtn;
            runBtn = $("#runBtn");
            runBtn.click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runNonStop(doAtCpuPause);
                });
            });
            stepBtn = $("#stepBtn");
            stepBtn.click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runSingleStep(doAtCpuPause);
                });
            });
            contBtn = $("#contBtn");
            contBtn.click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runUntilBreak(doAtCpuPause);
                });
            });
        };
        initPanels();
        initEditor();
        initV9();
        fetchFiles();
        initButtons();
    }
    main();
}());