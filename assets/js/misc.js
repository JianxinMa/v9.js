/*jslint white:true browser:true maxlen:80 */
/*global CodeMirror, d3, $,JSZip, saveAs */
/*global createV9, xvcc, mkfs, expandedFileSuffix */

"use strict";

(function() {
    var editor, labName, labConfg, files, curFileId, breakPoints, cpu;

    labName = "xv6"; // TODO

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
            var duration, nodes, node, nodeEnter,
                nodeUpdate, nodeExit, link;
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
                    return "translate(" + source.y0 +
                        "," + source.x0 + ")";
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
                    return "translate(" + source.y +
                        "," + source.x + ")";
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

    function saveCurrentFile() {
        if (curFileId !== -1) {
            if (files[curFileId].content !== editor.getValue()) {
                cpu.forceInit();
                files[curFileId].content = editor.getValue();
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
                        "=" + cpu.readBaseType(v, t).toString()
                };
            }
            car = t.substr(0, i);
            cdr = t.substr(i, t.length - i);
            if (car === 'ptr') {
                return {
                    name: varName +
                        (showType ? (":" + t) : '') +
                        (showAddr ? ("@" + hexify(v)) : '') +
                        "=" + hexify(cpu.readBaseType(v, 'uint'))
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
                        v + i * offset, memType, showType, showAddr
                    ));
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
                    subTypes = cpu.getStructType(subTypes);
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
        return 'BAD_TYPE';
    }

    function getVarValues(defs) {
        var name, info, v, ret;
        ret = [];
        for (name in defs) {
            if (defs.hasOwnProperty(name)) {
                info = defs[name];
                v = cpu.getVirtAddr(info.space, info.offset);
                ret.push(getOneVarValue(name, v, info.type, true, true));
            }
        }
        return ret;
    }

    function asciiToHtml(ascii) {
        var i, j, c, html;
        html = '';
        j = ascii.length;
        for (i = 0; i < j; i = i + 1) {
            if (ascii[i] === '\n') {
                c = '<br>';
            } else if (ascii[i] === ' ') {
                c = '&nbsp;';
            } else {
                // This doesn't really work.
                c = ascii.charCodeAt(i);
                c = '&#' + c.toString() + ';';
            }
            html = html + c;
        }
        return html;
    }

    function printTerm(msg) {
        var termtext;
        termtext = $("#termtext");
        termtext.html(termtext.html() + asciiToHtml(msg));
    }

    function printTermDebug(msg) {
        console.log(msg.toString());
        printTerm(msg);
    }

    function clearTerm() {
        $("#termtext").text("");
    }

    function doAtCpuReady() {
        $("#viewBtn").addClass("disabled");
        $("#loadingSign").hide();
        $("#termcursor").addClass("blinking-cursor");
        $("#terminal").focus();
    }

    function doAtCpuPause(point, localDefs, globalDefs) {
        if (!point) {
            printTerm("End of program reached.");
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

    function addFileNavItem(filename) {
        var path, tail, id, eleId;
        path = filename.split('/');
        tail = path.pop();
        id = 'dirNavRoot' + path.join('_');
        eleId = id + '__' + tail;
        eleId = eleId.split('.').join('_dot_');
        $('#' + id).append('<li><a id="' + eleId + '" href="#">' +
            tail + '</a></li>');
        $('#' + eleId).click(function() {
            editFile(filename);
        });
    }

    function tryAddToFiles(newfile) {
        var found;
        found = false;
        files.forEach(function(file) {
            if (file.filename === newfile.filename) {
                found = true;
                file.encoding = newfile.encoding;
                file.content = newfile.content;
            }
        });
        if (!found) {
            files.push(newfile);
            addFileNavItem(newfile.filename);
        }
    }

    function compile(onSuccess) {
        var xvccEach, currentUser, binFiles, debugInfo, printErr;
        clearTerm();
        printErr = function(text) {
            printTermDebug(text + '\n');
        };
        xvccEach = function(result, info, expandedFile) {
            tryAddToFiles(expandedFile);
            binFiles.push(result);
            debugInfo += info;
            currentUser += 1;
            if (currentUser < labConfg.user.length) {
                xvcc(labConfg.user[currentUser], labConfg.file,
                    files, xvccEach, printErr);
            } else {
                mkfs(labConfg.disk, files, binFiles, labConfg.file,
                    function(hd) {
                        onSuccess(binFiles[0].content, hd, debugInfo);
                    }, printErr);
            }
        };
        try {
            currentUser = -1;
            binFiles = [];
            debugInfo = '';
            xvcc(labConfg.kern, labConfg.file,
                files, xvccEach, printErr);
        } catch (err) {
            console.log(err.message);
            $("#loadingSign").hide();
        }
    }

    function onCpuReady(cb) {
        $("#loadingSign").show();
        saveCurrentFile();
        if (cpu.needInit()) {
            compile(function(os, hd, de) {
                cpu.setupSoftware(os, hd, de);
                clearTerm();
                cb();
            });
        } else {
            cb();
        }
    }

    function onDirNavItemClicked(dirId) {
        var i;
        $(".dirNavItem").hide();
        $("#dirNavRoot").parent().show();
        while (true) {
            $('#' + dirId).parent().show();
            i = dirId.lastIndexOf('_');
            if (i === -1) {
                break;
            }
            dirId = dirId.substr(0, i);
        }
    }

    function buildDirNavItem(name, dir, path) {
        var f, id, eleId, metaEditFile, metaViewDir;
        metaEditFile = function(s) {
            return function() {
                editFile(s);
            };
        };
        metaViewDir = function(s) {
            return function() {
                onDirNavItemClicked(s);
            };
        };
        id = 'dirNavRoot' + path.join('_');
        $("#fileMenu").append('<li class="dirNavItem" ' +
            'style="display:none"><a href="#">' + name +
            '&nbsp;&gt;</a>' + '<ul id="' + id + '"></ul></li>');
        for (f in dir) {
            if (dir.hasOwnProperty(f)) {
                path.push(f);
                eleId = id + '__' + f;
                eleId = eleId.split('.').join('_dot_');
                $('#' + id).append('<li><a id="' + eleId + '" href="#">' +
                    f + (dir[f] === 0 ? '' : '&nbsp;&gt;') + '</a></li>');
                if (dir[f] === 0) {
                    $('#' + eleId).click(metaEditFile(path.join('/')));
                } else {
                    buildDirNavItem(f, dir[f], path);
                    $('#' + eleId).click(
                        metaViewDir('dirNavRoot' + path.join('_')));
                }
                path.pop();
            }
        }
    }

    function loadLabPage() {
        var initFileList, initV9, initButtons;
        initFileList = function() {
            buildDirNavItem(labName, labConfg.file, []);
            $("#dirNavRoot").parent().show();
            $("#fileMenu").append('<li style="float:right">' +
                '<a id="currentFile" href="#" class="disabled">' +
                '~ empty ~</a></li>');
            editFile(labConfg.kern.sources[0]);
        };
        initV9 = function() {
            var printOut;
            printOut = function(fd, msg) {
                if (fd === 1) {
                    printTerm(msg);
                } else {
                    printTermDebug(msg);
                }
            };
            cpu = createV9(printOut, breakPoints,
                labConfg.kern.sources[0] + expandedFileSuffix);
            $("#terminal").keypress(function(e) {
                var keyCode;
                keyCode = e.keyCode || e.which;
                if (0 <= keyCode && keyCode <= 0x7F) {
                    cpu.writeKbBuf(keyCode);
                }
            });
        };
        initButtons = function() {
            $("#runBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    cpu.runNonStop(doAtCpuPause);
                });
            });
            $("#stepBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    cpu.runSingleStep(doAtCpuPause);
                });
            });
            $("#contBtn").click(function() {
                onCpuReady(function() {
                    doAtCpuReady();
                    cpu.runUntilBreak(doAtCpuPause);
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
                saveCurrentFile();
                zip = new JSZip();
                files.forEach(function(file) {
                    if (!file.filename.endsWith(expandedFileSuffix)) {
                        zip.file(file.filename, file.content);
                    }
                });
                zip.file('config.json', JSON.stringify(labConfg));
                zip.generateAsync({
                    type: "blob"
                }).then(function(d) {
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
                    gutters: ["CodeMirror-linenumbers",
                        "breakPoints"
                    ]
                });
            editor.on("gutterClick", function(cm, ln) {
                var point;
                point = files[curFileId].filename + ' ' + (ln +
                    1).toString();
                if (cm.lineInfo(ln).gutterMarkers) {
                    cm.setGutterMarker(ln, "breakPoints", null);
                    delete breakPoints[point];
                } else {
                    cm.setGutterMarker(ln, "breakPoints",
                        makeMarker());
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
                        var nFiles;
                        nFiles = 0;
                        /*jslint unparam:true*/
                        zip.forEach(function(path, entry) {
                            if (!entry.dir) {
                                nFiles += 1;
                            }
                        });
                        /*jslint unparam:false*/
                        zip.forEach(function(path, entry) {
                            var onReadSuccess;
                            onReadSuccess = function(data) {
                                if (path === 'config.json') {
                                    labConfg = $.parseJSON(data);
                                } else {
                                    files.push({
                                        filename: path,
                                        encoding: 'utf8',
                                        content: data
                                    });
                                }
                                nFiles -= 1;
                                if (nFiles === 0) {
                                    loadLabPage();
                                }
                            };
                            if (!entry.dir) {
                                zip.file(path).async('string').then(
                                    onReadSuccess,
                                    function(e) {
                                        throw e;
                                    });
                            }
                        });
                    }, function(e) {
                        throw e;
                    });
            });
        };
        initEntryButtons = function() {
            var clicked;
            clicked = false;
            $('#newLabBtn').on('click', function() {
                var labPath, nFiles, fetchEachFile, fetchFiles;
                fetchEachFile = function(path, counting) {
                    if (counting) {
                        nFiles = nFiles + 1;
                    } else {
                        $.get(labPath + path, function(data) {
                            files.push({
                                filename: path,
                                encoding: 'utf8',
                                content: data
                            });
                            nFiles = nFiles - 1;
                            if (nFiles === 0) {
                                loadLabPage();
                            }
                        });
                    }
                };
                fetchFiles = function(path, dir, counting) {
                    var p;
                    for (p in dir) {
                        if (dir.hasOwnProperty(p)) {
                            if (dir[p] === 0) {
                                fetchEachFile(path + p, counting);
                            } else {
                                fetchFiles(path + p + '/', dir[p],
                                    counting);
                            }
                        }
                    }
                };
                if (!clicked) {
                    clicked = true;
                    $("#loadingSign").show();
                    labPath = "labs/" + labName + '/';
                    $.getJSON(labPath + "config.json", function(config) {
                        labConfg = config;
                        nFiles = 0;
                        files = [];
                        fetchFiles('', labConfg.file, true);
                        fetchFiles('', labConfg.file, false);
                    });
                }
            });
            $("#oldLabBtn").on('click', function() {
                if (!clicked) {
                    clicked = true;
                    $("#askForFiles").click();
                }
            });
        };
        initCodeMirror();
        initFileLoader();
        initEntryButtons();
    }

    loadEntryPage();
}());
