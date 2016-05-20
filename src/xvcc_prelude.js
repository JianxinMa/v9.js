function xvcc(env_argv, env_files) {
    var Module = {
        arguments: ["-Iroot/lib", "-o", "os", "root/etc/os.c"],
        // cmd_argv.split(' ').filter(function(s) { return s !== ''; }),
        print: console.log,
        preRun: [function() {
            console.log(FS);
            FS.mkdir('root');
            FS.mkdir('root/etc');
            FS.writeFile('root/etc/os.c', 'int main() {return 0;}');
        }],
        postRun: [function() {
                     console.log(FS);
            console.log(FS.readFile('os', {encoding: 'utf8'}));
            console.log(FS.readFile('root/etc/os.d', {encoding: 'utf8'}));
        }],
    };
}
