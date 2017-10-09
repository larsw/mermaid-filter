#! /usr/bin/env node
var pandoc=require('pandoc-filter');
var _ = require('lodash');
var tmp = require('tmp');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;
var spawnSync = require('child_process').spawnSync;
var prefix="diagram";
var cmd = externalTool("mmdc");
var inkscape = where("inkscape.exe")
var imgur = externalTool("imgur");
var counter = 0;

function mermaid(type, value, format, meta) {
    if (type != "CodeBlock") return null;
    var attrs = value[0],
        content = value[1];
    var classes = attrs[1];
    var options = {width: '500', format: 'png', loc: 'inline'};

    if (classes.indexOf('mermaid') < 0) return null;

    // console.log(attrs, content);
    attrs[2].map(item => {
        if (item.length  === 1) options[item[0]] = true;
        else options[item[0]] = item[1];
    });
    // console.log(options);
    // if (options.loc === 'inline') options.format = 'svg'
    if (!_.contains('mermaid', classes)) return null;
    counter++;
    //console.log(content);
    var tmpfileObj = tmp.fileSync();
    // console.log(tmpfileObj.name);
    fs.writeFileSync(tmpfileObj.name, content);
    var outdir = options.loc !== 'imgur' ? options.loc : path.dirname(tmpfileObj.name);
    // console.log(outdir);
    var format = options.format === 'emf' ? 'svg' : options.format
    var savePath = `${tmpfileObj.name}.${format}`;
    var newPath = path.join(outdir, `${prefix}-${counter}.${format}`);
    var fullCmd = `${cmd}  -w ${options.width} -i ${tmpfileObj.name} -o ${savePath}`
    // console.log(fullCmd, savePath)
    exec(fullCmd);
    //console.log(oldPath, newPath);
    if (options.loc == 'inline') {

        if (options.format === 'svg') {
            var data = fs.readFileSync(savePath, 'utf8')
            data = data.replace (/"/g, "'");
            // console.log(data);
            newPath = "data:image/svg+xml," + encodeURIComponent(data);
        } else  {
            var data = fs.readFileSync(savePath)
            newPath = 'data:image/png;base64,' + new Buffer(data).toString('base64');

        }
    } else if (options.loc === 'imgur')
        newPath = exec(`${imgur} ${savePath}`)
            .toString()
            .trim()
            .replace("http://", "https://");
    else {
        if (options.format === 'emf') {
            var saveEmfPath = `${tmpfileObj.name}.emf`;
            var newEmfPath = path.join(outdir, `${prefix}-${counter}.emf`);                   
            var convertCmd = `"${inkscape}" --file "${savePath}" --export-emf "${newEmfPath}"`
            exec(convertCmd);   
            newPath = newEmfPath;
        } else {
            mv(savePath, newPath);            
        }
    }

    return pandoc.Para(
        [
            pandoc.Image(
                ['', [], []],
                [],
                [newPath, ""]
            )
    ]);
}

function externalTool(command) {
    return firstExisting([
        path.resolve(__dirname, "node_modules", ".bin", command),
        path.resolve(__dirname, "..", ".bin", command)],
        function() {
            console.error("External tool not found: " + command);
            process.exit(1);
        });
}

function where(command) {
    var isWin = require('os').platform().indexOf('win') > -1;
    var where = isWin ? 'where' : 'whereis';
    // var process = require('process');
    var result = spawnSync("cmd.exe", ['/c', 'where', command], {env: process.env, stdio: 'pipe', encoding: 'utf-8'});
    if (result.output[2] === '')
        return result.output[1].trim();
    else
        return null;
}

function mv(from, to) {
    var readStream = fs.createReadStream(from)
    var writeStream = fs.createWriteStream(to);

    readStream.pipe(writeStream);

    rm(from);
}

function rm(file) {
    fs.unlinkSync(file);
}

function firstExisting(paths, error) {
    for (var i = 0; i < paths.length; i++) {
        if (fs.existsSync(paths[i])) return paths[i];
    }
    error();
}

pandoc.toJSONFilter(mermaid);
