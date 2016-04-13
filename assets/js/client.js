/*jslint white:true browser:true */
/*global CodeMirror Github */

"use strict";

(function() {
    var editor, terminal, github, repo;

    editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
        mode: "text/x-csrc",
        styleActiveLine: true,
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "breakpoints"]
    });
    editor.on("gutterClick", function(cm, ln) {
        var marker;

        if (cm.lineInfo(ln).gutterMarkers) {
            cm.setGutterMarker(ln, "breakpoints", null);
        } else {
            marker = document.createElement("div");
            marker.style.color = "gray";
            marker.innerHTML = "●";
            cm.setGutterMarker(ln, "breakpoints", marker);
        }
    });

    terminal = CodeMirror.fromTextArea(document.getElementById("terminal"), {
        readOnly: true
    });

    github = new Github();
    repo = github.getRepo("JianxinMa", "v9.js");
    repo.read('master', '', function(err, data) {console.log(err); console.log(data);});
})();
