(function() {
    //    var socket = io('http://localhost:8080/');
    //    socket.on('connect', function() {
    //        socket.send('hi');
    //        socket.on('message', function(msg) {});
    var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
        mode: "text/x-csrc",
        styleActiveLine: true,
        lineNumbers: true,
        gutters: ["CodeMirror-linenumbers", "breakpoints"],
        viewportMargin: Infinity,
        value: "function myScript(){return 100;}\n"
    });
    editor.on("gutterClick", function(cm, n) {
        var info = cm.lineInfo(n);
        cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
    });

    function makeMarker() {
        var marker = document.createElement("div");
        marker.style.color = "gray";
        marker.innerHTML = "●";
        return marker;
    }
})();
