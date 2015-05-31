var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    args = require('minimist')(process.argv.slice(2));


var SECTION_SEPARATOR = '==========',
    KIDNEL_NEWLINE = '\r\n',
    METADATA_PARSER = /^(?:-\s*)(.*?)(?:(?:\s*on Page\s*)(\d+)(?:\s*\|))?(?:(?:\s*Loc\.\s*)(\d+(?:-\d+)?)(?:\s*\|)?)?(?:\s*Added on )(.*?)$/;

function getFileContent(path) {
    return fs.readFileSync(path, {encoding: 'utf8'});
}

function parseSection(section){
    // Bűbájos bajok (Terry Pratchett)
    //- Highlight on Page 13 | Loc. 186-1  | Added on Monday, 21 April 14 17:34:53 GMT+02:01
    var lines = section.trim().split(KIDNEL_NEWLINE),
        metaData = lines[1].match(METADATA_PARSER),
        page = metaData[2],
        location = metaData[3],
        locationStart = location ? location.split('-')[0] : undefined,
        time = new Date(metaData[4]);

    return {
        title: lines[0],
        type: metaData[1],
        page: page,
        location: location,
        time: time,
        order: parseInt(_.dropWhile([page, locationStart, time.getTime()], isNaN)[0], 10),
        content: lines.splice(2).join('\n').trim()
    }
}

function orderByPosition(books){
    return _.sortBy(books, 'order');
}

function JSONFormatter(book){
    book.fileType = 'json';
    book.formatted = JSON.stringify(book, null, 3);
}

function kindleFormatter(book, title){
    book.fileType = 'txt';
    book.formatted = _.template(
        '<% _.each(sections, function(book){ %>' +
            '<%= title %>' + KIDNEL_NEWLINE +
            '- <%= book.type %> <%= book.page ? " on Page " + book.page + " | " : "" %><%= book.location ? " Loc. " + book.location + " | " : "" %>Added on <%= book.time %>' + KIDNEL_NEWLINE +
            '<%= book.content.replace("\\n", "\\r\\n") %>' + KIDNEL_NEWLINE + SECTION_SEPARATOR + KIDNEL_NEWLINE +
        '<% });%>')({title: title, sections: book});
}

function htmlFormatter(book, title){
    book.fileType = 'html';
    book.formatted = _.template('<!DOCTYPE html><html><head><meta charset="UTF-8"><title><%= title %></title></head><body>' +
    '<h1><%= title %></h1>' +
    '<% _.each(sections, function(book){ %>' +
        '<small>' +
            '<%= book.type %> | ' +
            '<%= book.page ? "page: " + book.page + " | " : "" %>' +
            '<%= book.location ? "location: " + book.location + " | " : "" %>' +
            '<%= book.time %>' +
        '</small>' +
        '<p><%= book.content.replace("\\n", "<br>") %></p>' +
        '<hr>' +
    '<% });%></body></html>')({title: title, sections: book});
}

function format(format){
    switch (format){
        case 'json': return JSONFormatter;
        case 'kindle': return kindleFormatter;
        case 'html': return htmlFormatter;
        default: throw new Error('Invalid formatter: ' + format);
    }
}

function saveBook(targetDir){
    if (!fs.existsSync(targetDir)){
        fs.mkdirSync(targetDir);
    }
    return function (book, title) {
        fs.writeFileSync(path.join(targetDir, title + '.' + book.fileType), book.formatted, {encoding : 'utf8'});
    }
}

function main() {
    var clippingFile = path.join(args._[0] || args.input || 'My Clippings.txt'),
        targetDir = path.join(args.o || args.output || './books/'),
        formatter = (args.f || args.formatter || 'html').toLowerCase();

    if (args.h || args.help){
        console.log(
            'Kindle Clipper - Parse and sort Kindle "My Clippings.txt" file\n\n' +
            '\tklipper -[hof] [inputFile]\n\n' +
            '\t -h --help                This help text\n' +
            '\t -o --output              Output folder (default: "./books/")\n' +
            '\t -f --formatter=[FORMAT]  Output formatter (html, json, kindle) (default: "html")\n' +
            '\t [inputFile]              Kindle "My Clipping" file (default: "./My clippings.txt")\n\n'
        );
        process.exit(0);
    }

    _(getFileContent(clippingFile))
        .split(SECTION_SEPARATOR)
        .initial()
        .map(parseSection)
        .groupBy('title')
        .each(orderByPosition)
        .each(format(formatter))
        .each(saveBook(targetDir))
        .value();
}

main();