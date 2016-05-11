/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, $, createV9, io, renderTreeView */

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
        if (curFileId === -1 || files[curFileId].filename !== name) {
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
            console.log('In findMatched: bad s[l]', s, s[l]);
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

    function getOneVarValue(varName, v, t, showType, showAddr) {
        var hexify, i, j, k, name, offset, car, cdr, subTypes, memType;
        hexify = function(k, pad) {
            if (typeof k === 'number') {
                return '0x' + ((pad ? '00000000' : '') +
                    k.toString(16)).substr(-8);
            }
            return k;
        };
        i = t.length;
        if (findMatched(t, 0) === i - 1) {
            t = t.substr(1, i - 2);
            i = t.indexOf('(');
            j = t.indexOf('<');
            if (i === -1 || (j !== -1 && j < i)) {
                i = j;
            }
            if (i === -1) {
                return {
                    name: varName +
                        (showType ? (":" + t) : '') +
                        (showAddr ? ("@" + hexify(v)) : '') +
                        "=" + v9Cpu.readBaseType(v, t).toString()
                };
            }
            car = t.substr(0, i);
            cdr = t.substr(i, t.length - i);
            if (car === 'ptr') {
                return {
                    name: varName +
                        (showType ? (":" + t) : '') +
                        (showAddr ? ("@" + hexify(v)) : '') +
                        "=" + hexify(v9Cpu.readBaseType(v, 'uint'))
                };
            }
            if (car === 'array') {
                k = {
                    name: varName +
                        (showType ? (":" + t) : '') +
                        (showAddr ? ("@" + hexify(v)) : ''),
                    children: []
                };
                memType = cdr.substr(1, cdr.length - 2);
                i = memType.indexOf('|');
                j = Number(memType.substr(0, i));
                memType = memType.substr(i + 1);
                i = memType.indexOf('(');
                offset = Number(memType.substr(0, i));
                memType = memType.substr(i);
                for (i = 0; i < j; i = i + 1) {
                    k.children.push(getOneVarValue('[' + i.toString() + ']',
                        v + i * offset, memType, showType, showAddr));
                }
                return k;
            }
            if (car === 'struct') {
                k = {
                    name: varName +
                        (showType ? (":" + t) : '') +
                        (showAddr ? ("@" + hexify(v)) : ''),
                    children: []
                };
                subTypes = cdr.substr(1, cdr.length - 2);
                if (cdr[0] === '<' && cdr[cdr.length - 1] === '>') {
                    subTypes = v9Cpu.getStructType(subTypes);
                }
                i = subTypes.indexOf('|');
                subTypes = subTypes.substr(i + 1);
                subTypes = subTypes.substr(0, subTypes.length - 1);
                while (subTypes.length > 0) {
                    i = findMatched(subTypes, 0);
                    memType = subTypes.substr(1, i - 1);
                    subTypes = subTypes.substr(i + 1);
                    i = memType.indexOf(':');
                    name = memType.substr(0, i);
                    memType = memType.substr(i + 1);
                    i = memType.indexOf(':');
                    offset = Number(memType.substr(0, i));
                    memType = memType.substr(i + 1);
                    k.children.push(getOneVarValue('.' + name, v + offset,
                        memType, showType, showAddr));
                }
                return k;
            }
        }
        console.log('In readTypedVal: bad type', t);
        return 'BAD_TYPE';
    }

    function getVarValues(defs) {
        var name, info, v, ret;
        ret = [];
        for (name in defs) {
            if (defs.hasOwnProperty(name)) {
                info = defs[name];
                v = v9Cpu.getVirtAddr(info.space, info.offset);
                ret.push(getOneVarValue(name, v, info.type, true, true));
            }
        }
        return ret;
    }

    function doAtCpuReady() {
        $("#termpanel").focus();
        $("#termcursor").addClass("blinking-cursor");
    }

    function doAtCpuPause(point, localDefs, globalDefs) {
        if (!point) {
            $("#termtext").text("End of program reached.");
        } else {
            point = point.split(' ');
            editFile(point[0], Number(point[1]));
            renderTreeView({
                    name: "Scope",
                    children: [{
                        name: "Local",
                        children: getVarValues(localDefs)
                    }, {
                        name: "Global",
                        children: getVarValues(globalDefs)
                    }]
                },
                2);
        }
        $("#termcursor").removeClass("blinking-cursor");
    }

    function onCpuReady(cb) {
        var sk;
        // TODO:
        //   Checking only current file is not enough.
        //   What if I change a file, switch to another file and run?
        if (saveCurrentFile() || v9Cpu.needInit()) {
            sk = io();
            sk.emit('compileFiles', files);
            sk.on('filesCompiled', function(compiled) {
                sk.disconnect();
                if (compiled.error) {
                    console.log(compiled.error);
                } else {
                    v9Cpu.setupSoftware(compiled.os, compiled.hd, compiled.de);
                    $("#termtext").text("");
                    cb();
                }
            });
        } else {
            cb();
        }
    }

    function loadLabPage() {
        var initPanels, initEditor, initV9, initButtons;
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
            $("#editor").show();
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
        $('#entryPage').fadeOut('slow');
        $("#labPage").fadeIn('slow');
        initPanels();
        initEditor();
        initV9();
        initButtons();
        $("#loadingSign").hide();
    }

    function loadEntryPage() {
        $('#newLabBtn').on('click', function() {
            var sk;
            $("#loadingSign").show();
            sk = io();
            sk.emit('fetchFiles');
            sk.on('filesSent', function(fetchedFiles) {
                sk.disconnect();
                files = fetchedFiles;
                loadLabPage();
            });
        });
        // TODO: $("#oldLabBtn).on('click', ...)
    }

    loadEntryPage();
}());