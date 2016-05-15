/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, d3, $, createV9, io, JSZip, saveAs */

"use strict";

(function() {
    var editor, files, curFileId, breakPoints, v9Cpu;

    function renderTreeView(root, level) {
        var m, w, h, i, tree, diagonal, vis;

        function toggle(d) {
            if (d.children) {
                d.hChildren = d.children;
                d.children = null;
            } else {
                d.children = d.hChildren;
                d.hChildren = null;
            }
        }

        function update(source) {
            var duration, nodes, node, nodeEnter, nodeUpdate, nodeExit, link;
            duration = (d3.event && d3.event.altKey ? 1500 : 150);
            nodes = tree.nodes(root).reverse();
            nodes.forEach(function(d) {
                d.y = d.depth * 180;
            });
            node = vis.selectAll("g.node")
                .data(nodes, function(d) {
                    if (!d.id) {
                        i = i + 1;
                        d.id = i;
                    }
                    return d.id;
                });
            nodeEnter = node.enter().append("svg:g")
                .attr("class", "node")
                .attr("transform", function() {
                    return "translate(" + source.y0 + "," + source.x0 + ")";
                })
                .on("click", function(d) {
                    toggle(d);
                    update(d);
                });
            nodeEnter.append("svg:circle")
                .attr("r", 1e-6)
                .style("fill", function(d) {
                    return d.hChildren ? "lightsteelblue" : "#fff";
                });
            nodeEnter.append("svg:text")
                .attr("x", function(d) {
                    return d.children || d.hChildren ? -10 : 10;
                })
                .attr("dy", ".35em")
                .attr("text-anchor", function(d) {
                    return d.children || d.hChildren ? "end" : "start";
                })
                .text(function(d) {
                    return d.name;
                })
                .style("fill-opacity", 1e-6);
            nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function(d) {
                    return "translate(" + d.y + "," + d.x + ")";
                });
            nodeUpdate.select("circle")
                .attr("r", 4.5)
                .style("fill", function(d) {
                    return d.hChildren ? "lightsteelblue" : "#fff";
                });
            nodeUpdate.select("text")
                .style("fill-opacity", 1);
            nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function() {
                    return "translate(" + source.y + "," + source.x + ")";
                })
                .remove();
            nodeExit.select("circle")
                .attr("r", 1e-6);
            nodeExit.select("text")
                .style("fill-opacity", 1e-6);
            link = vis.selectAll("path.link")
                .data(tree.links(nodes), function(d) {
                    return d.target.id;
                });
            link.enter().insert("svg:path", "g")
                .attr("class", "link")
                .attr("d", function() {
                    var o = {
                        x: source.x0,
                        y: source.y0
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });
                })
                .transition()
                .duration(duration)
                .attr("d", diagonal);
            link.transition()
                .duration(duration)
                .attr("d", diagonal);
            link.exit().transition()
                .duration(duration)
                .attr("d", function() {
                    var o = {
                        x: source.x,
                        y: source.y
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });
                })
                .remove();
            nodes.forEach(function(d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        function closeAll(d) {
            if (d.children) {
                d.children.forEach(closeAll);
                toggle(d);
            }
        }

        function toggleUntil(d, level) {
            if (level) {
                toggle(d);
                if (d.children) {
                    d.children.forEach(function(ele) {
                        toggleUntil(ele, level - 1);
                    });
                }
            }
        }

        m = [20, 120, 20, 120];
        w = 1280 - m[1] - m[3];
        h = 800 - m[0] - m[2];
        i = 0;
        tree = d3.layout.tree()
            .size([h, w]);
        diagonal = d3.svg.diagonal()
            .projection(function(d) {
                return [d.y, d.x];
            });
        d3.select("#treeView").html("");
        vis = d3.select("#treeView").append("svg:svg")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2])
            .append("svg:g")
            .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
        root.x0 = h / 2;
        root.y0 = 0;
        closeAll(root);
        toggleUntil(root, level);
        update(root);
    }

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

    function renderBreakPoints() {
        var point, name;
        name = files[curFileId].filename;
        editor.clearGutter("breakPoints");
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

    function editFile(name, line) {
        if (curFileId === -1 || files[curFileId].filename !== name) {
            files.forEach(function(file, i) {
                if (file.filename === name) {
                    saveCurrentFile();
                    curFileId = i;
                    editor.setValue(file.content);
                    $("#currentFile").text('~ ' + name + ' ~');
                    renderBreakPoints();
                }
            });
        }
        if (line) {
            editor.setCursor(line - 1);
        }
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
        $("#viewBtn").addClass("disabled");
        $("#loadingSign").hide();
        $("#termcursor").addClass("blinking-cursor");
        $("#terminal").focus();
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
            }, 2);
            $("#viewBtn").removeClass("disabled");
        }
        $("#termcursor").removeClass("blinking-cursor");
    }

    function onCpuReady(cb) {
        var sk;
        $("#loadingSign").show();
        // TODO: need check non-current files as well.
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
        var initFileList, initV9, initButtons;
        initFileList = function() {
            files.forEach(function(file, i) {
                $('#files' + file.filename.substr(5, 3).toUpperCase()).append(
                    "<li id='file" + i.toString() + "'>" +
                    "<a href='#'>" + file.filename + "</a>" +
                    "</li>"
                );
                $("#file" + i.toString()).click(function() {
                    editFile($(this).text());
                });
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
                // TODO: many other ASCII chars to be converted.
                msg = msg.replace(/\t/g, '&nbsp;&nbsp;');
                msg = msg.replace(/\n/g, '<br/>');
                termtext = $("#termtext");
                termtext.html(termtext.html() + msg);
            };
            v9Cpu = createV9(printOut, breakPoints);
            $("#terminal").keypress(function(e) {
                var keyCode;
                keyCode = e.keyCode || e.which;
                if (0 <= keyCode && keyCode <= 0x7F) {
                    v9Cpu.writeKbBuf(keyCode);
                }
            });
        };
        initButtons = function() {
            $("#runBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runNonStop(doAtCpuPause);
                });
            });
            $("#stepBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runSingleStep(doAtCpuPause);
                });
            });
            $("#contBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    v9Cpu.runUntilBreak(doAtCpuPause);
                });
            });
            $("#viewBtn").click(function() {
                $("#inspectPage").fadeIn('fast');
            });
            $("#closeInspectBtn").click(function() {
                $("#inspectPage").fadeOut('fast');
            });
            $("#downloadBtn").click(function() {
                var zip;
                zip = new JSZip();
                files.forEach(function(file) {
                    zip.file(file.filename, file.content);
                });
                zip.generateAsync({
                    type: "blob"
                }).then(function(d) {
                    saveCurrentFile();
                    saveAs(d, "lab.zip");
                });
            });
        };
        $('#entryPage').fadeOut('slow');
        $("#labPage").fadeIn('slow');
        initFileList();
        initV9();
        initButtons();
        $("#loadingSign").hide();
    }

    function loadEntryPage() {
        var initCodeMirror, initFileLoader, initEntryButtons;
        initCodeMirror = function() {
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
            editor.on("change", renderBreakPoints);
        };
        initFileLoader = function() {
            $("#askForFiles").on("change", function(event) {
                files = [];
                JSZip
                    .loadAsync(event.target.files[0])
                    .then(function(zip) {
                        var numTask, finished;
                        numTask = 0;
                        zip.forEach(function(path, entry) {
                            if (!entry.dir) {
                                numTask += 1;
                                if (!(path.endsWith('.c') ||
                                        path.endsWith('.h') ||
                                        path.endsWith('.txt'))) {
                                    console.log('Unexpected extension : ' +
                                        path);
                                }
                            }
                        });
                        finished = 0;
                        zip.forEach(function(path, entry) {
                            if (!entry.dir) {
                                zip.file(path).async('string').then(
                                    function(d) {
                                        files.push({
                                            // TODO: path separator on windows.
                                            filename: path,
                                            encoding: 'utf8',
                                            content: d
                                        });
                                        finished += 1;
                                        if (finished === numTask) {
                                            loadLabPage();
                                        }
                                    },
                                    function(e) {
                                        console.log("Error extracting file " +
                                            path + " : " + e.message);
                                    });
                            }
                        });
                    }, function(e) {
                        console.log("Error reading file : " + e.message);
                    });
            });
        };
        initEntryButtons = function() {
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
            $("#oldLabBtn").on('click', function() {
                $("#askForFiles").click();
            });
        };
        initCodeMirror();
        initFileLoader();
        initEntryButtons();
    }

    loadEntryPage();
}());