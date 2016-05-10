/*jslint white:true maxlen:80 */
/*global Buffer, ArrayBuffer, Uint8Array */

'use strict';

module.exports = {
    toArrayBuffer: function(buffer) {
        var ab, view, i;
        ab = new ArrayBuffer(buffer.length);
        view = new Uint8Array(ab);
        for (i = 0; i < buffer.length; i += 1) {
            view[i] = buffer[i];
        }
        return ab;
    },
    toBuffer: function(ab) {
        var buffer, view, i;
        buffer = new Buffer(ab.byteLength);
        view = new Uint8Array(ab);
        for (i = 0; i < buffer.length; i += 1) {
            buffer[i] = view[i];
        }
        return buffer;
    }
};