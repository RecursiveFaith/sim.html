// -------------------------------------------------
// --------------- Terminal Emulator ---------------
// -------------------------------------------------

var Colors = new Array(
    "000000", "BB0000", "00BB00", "BBBB00",
    "0000BB", "BB00BB", "00BBBB", "BBBBBB",
    "555555", "FF5555", "55FF55", "FFFF55",
    "5555FF", "FF55FF", "55FFFF", "55FFFF");

// constructor
function Terminal(rows, columns, elemId) {
    this.nrows = rows;
    this.ncolumns = columns;
    this.Table = document.getElementById(elemId);
    this.rowelements = new Array(this.nrows);
    this.cursorvisible = false;
    this.line = "";
    this.cursor = 0;
    this.escapetype = 0;
    this.escapestring = "";
    this.cursorx = 0;
    this.cursory = 0;
    this.currentcolor = 0x7;

    this.screen = new Array(this.nrows);
    this.color = new Array(this.nrows);
    for (var i = 0; i < this.nrows; i++) {
        this.screen[i] = new Array(this.ncolumns);
        this.color[i] = new Array(this.ncolumns);

        for (var j = 0; j < this.ncolumns; j++) {
            this.screen[i][j] = 0x0;
            this.color[i][j] = this.currentcolor;
        }
    }
    for (i = 0; i < rows; i++) {
        var TR = this.Table.insertRow(0);
        var TD = document.createElement("td");
        this.rowelements[i] = TD;
        TR.appendChild(TD);
    }
    this.ScreenUpdate();
    this.Blink();
}

Terminal.prototype.Blink = function() {
    this.cursorvisible = !this.cursorvisible;
	this.PlotRow(this.cursory);
    window.setTimeout(this.Blink.bind(this), 500); // update every second
};

Terminal.prototype.DeleteRow = function(row) {
    for (var j = 0; j < this.ncolumns; j++) {
        this.screen[row][j] = 0x0;
        this.color[row][j] = 0x7;
    }
    this.PlotRow(row);
};

Terminal.prototype.DeleteArea = function(row, column, row2, column2) {
    for (var i = row; i <= row2; i++) {
        for (var j = column; j <= column2; j++) {
            this.screen[i][j] = 0x0;
            this.color[i][j] = 0x7;
        }
        this.PlotRow(i);
    }
};

Terminal.prototype.PlotRow = function(row) {
    var ccolor = 0x7;
    var spanactive = false;
    var line = "";

    var colortemp = this.color[this.cursory][this.cursorx];
    if (this.cursorvisible) {
        this.color[this.cursory][this.cursorx] |= 0x600;
    }

    for (var i = 0; i < this.ncolumns; i++) {
        if (ccolor != this.color[row][i]) {
            if (spanactive) {
                line += "</span>";
            }
            ccolor = this.color[row][i];
            if (ccolor != 0x7) {
                line += "<span style=\"color:#" + Colors[ccolor & 0x1F] + ";background-color:#" + Colors[(ccolor >>> 8) & 0x1F] + "\">";
                spanactive = true;
            }
        }
        if ((this.screen[row][i] == 0x0) || (this.screen[row][i] == 0x20)) {
            line += "&nbsp;";
        }
        else {
            line += String.fromCharCode(this.screen[row][i]);
        }
    }
    if (spanactive) {
        line += "</span>";
        spanactive = false;
    }

    this.color[this.cursory][this.cursorx] = colortemp;

    this.rowelements[this.nrows - row - 1].innerHTML = line;
};

Terminal.prototype.ScreenUpdate = function() {
    for (var i = 0; i < this.nrows; i++) {
        this.PlotRow(i);
    }
};

Terminal.prototype.LineFeed = function() {
    if (this.cursory != this.nrows - 1) {
        this.cursory++;
        if (this.cursorvisible) {
            this.PlotRow(this.cursory-1); // delete old cursor position
            this.PlotRow(this.cursory); // show new cursor position
        }
        return;
    }
    for (var i = 1; i < this.nrows; i++) {
        for (var j = 0; j < this.ncolumns; j++) {
            this.screen[i - 1][j] = this.screen[i][j];
            this.color[i - 1][j] = this.color[i][j];
        }
    }
    this.DeleteRow(this.nrows - 1);
    this.ScreenUpdate();
};

Terminal.prototype.ChangeCursor = function(Numbers) {
	switch (Numbers.length) {
    case 0:
        this.cursorx = 0;
        this.cursory = 0;
        break;
    case 1:
        this.cursory = Numbers[0];
        break;
    case 2:
    default:
        // TODO check for boundaries
        this.cursory = Numbers[0];
        this.cursorx = Numbers[1];
        break;
    }
};

Terminal.prototype.ChangeColor = function(Numbers) {
    for (var i = 0; i < Numbers.length; i++) {
        switch (Number(Numbers[i])) {
        case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
            this.currentcolor = this.currentcolor & (~0x7) | (Numbers[i] - 30) & 0x7;
            break;
        case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
            this.currentcolor = this.currentcolor & (0xFF) | (((Numbers[i] - 40) & 0x7) << 8);
            break;
        case 0:
            this.currentcolor = 0x7; // reset
            break;
        case 1:
            this.currentcolor |= 10; // brighter foreground colors
            break;
        case 7:
            this.currentcolor = ((this.currentcolor & 0xF) << 8) | ((this.currentcolor >> 8)) & 0xF; // change foreground and background, no brighter colors
            break;
        case 39:
            this.currentcolor = this.currentcolor & (~0x7) | 0x7; // set standard foreground color
            break;
        case 49:
            this.currentcolor = this.currentcolor & 0xFF; // set standard background color
            break;
        case 10:
            // reset mapping ?
            break;
        default:
            DebugMessage("Color " + Numbers[i] + " not found");
            break;
        }
    }
};

Terminal.prototype.HandleEscapeSequence = function() {
    //DebugMessage("Escape sequence:'" + this.escapestring+"'");
    var i = 0;
    if (this.escapestring == "[J") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        this.DeleteArea(this.cursory + 1, 0., this.nrows - 1, this.ncolumns - 1);
        return;
    }
    // erase from start till cursor
    else if (this.escapestring == "[1K") {
        this.DeleteArea(this.cursory, 0., this.cursory, this.cursorx);
        return;
    }
    // erase from cursor till end
    else if (this.escapestring == "[K") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        return;
    }

    // Testing for [x;y;z
    var s = this.escapestring;
    if (s.charAt(0) != "[") {
        return; // the short escape sequences must be handled earlier
    }
    s = s.substr(1); // delete first sign
    var lastsign = s.substr(s.length - 1); // extract command
    s = s.substr(0, s.length - 1); // remove command
    var numbers = s.split(";"); // if there are multiple numbers, split them
    if (numbers[0].length == 0) {
        numbers = [];
    }
    // the array must contain of numbers and not strings. Make this sure
    for (i=0; i<numbers.length; i++) {
        numbers[i] = Number(numbers[i]);
    }
    switch(lastsign) {
        case 'm': // colors
            this.ChangeColor(numbers);
            return;

        case 'C': // move cursor right
            if (numbers.length == 0) {
                this.cursorx++;
            }
            else this.cursorx += numbers[0];
            return;
    
        case 'D': // move cursor left
            if (numbers.length == 0) {
                this.cursorx--;
            }
            else this.cursorx -= numbers[0];
            return;
    
        case 'G': // change cursor column
            this.cursorx = numbers[0];
            return;

        case 'r': // set scrolling region
            // ignore
            return;
        
        case 'X': // erase only number of characters in current line    
            for (var j = this.cursorx; j < this.cursorx + numbers[0]; j++) {
                this.screen[this.cursory][j] = 0x0;
            }
            this.PlotRow(this.cursory);
            // this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.cursorx+numbers[0]);
            // this.DeleteArea(this.cursory, 0, this.cursory, numbers[0]);
        break;
    }

    // Now test the part which can change the y position of the cursor
    var oldcursory = this.cursory;

    switch(lastsign) {
    case 'H': // cursor
    case 'd':
        this.ChangeCursor(numbers);
        break;
    
    case 'A': // move cursor up
        if (numbers.length == 0) {
            this.cursory--;
        }
        else this.cursory -= numbers[0];
        break;
    
    // move cursor down
    case 'E':
        if (numbers.length == 0) {
            this.cursory++;
        }
        else this.cursory += numbers[0];
        break;

        default:
        DebugMessage("Escape sequence unknown:'" + this.escapestring + "'");

    }

    if (this.cursorvisible) {
        this.PlotRow(oldcursory); // delete old cursor position
    }

};

Terminal.prototype.PutChar = function(c) {
    var i = 0;
    //DebugMessage("Char:" + c + " " +  String.fromCharCode(c));
    // escape sequence (CS)
    if (this.escapetype == 2) {
        this.escapestring += String.fromCharCode(c);
        if ((c >= 64) && (c <= 126)) {
            this.HandleEscapeSequence();
            this.escapetype = 0;
        }
        return;
    }

    // escape sequence
    if ((this.escapetype == 0) && (c == 0x1B)) {
        this.escapetype = 1;
        this.escapestring = "";
        return;
    }

    // starting escape sequence
    if (this.escapetype == 1) {
        this.escapestring += String.fromCharCode(c);
        // Control Sequence Introducer ([)
        if (c == 0x5B) {
            this.escapetype = 2;
            return;
        }
        this.HandleEscapeSequence();
        this.escapetype = 0;
        return;
    }
    switch (c) {
    case 0xA:
        // line feed
        this.LineFeed();
        return;
        break;
    case 0xD:
        // carriage return
        this.cursorx = 0;
        return;
        break;
    case 0x7:
        // beep
        return;
        break;

    case 0x8:
        // back space
        this.cursorx--;
        if (this.cursorx < 0) {
            this.cursorx = 0;
        }
        this.PlotRow(this.cursory);
        return;
        break;

    case 0x9:
        // horizontal tab
        do
        {
            if (this.cursorx >= this.ncolumns) {
                this.PlotRow(this.cursory);
                this.LineFeed();
                this.cursorx = 0;
            }
            this.screen[this.cursory][this.cursorx] = 32;
            this.color[this.cursory][this.cursorx] = this.currentcolor;	
            this.cursorx++;
        } while((this.cursorx%8) != 0);
        this.PlotRow(this.cursory);
        return;
        break;


    case 0x00:  case 0x01:  case 0x02:  case 0x03:
    case 0x04:  case 0x05:  case 0x06:  case 0x0B:
    case 0x0C:  case 0x0E:  case 0x0F:
    case 0x10:  case 0x11:  case 0x12:  case 0x13:
    case 0x14:  case 0x15:  case 0x16:  case 0x17:
    case 0x18:  case 0x19:  case 0x1A:  case 0x1B:
    case 0x1C:  case 0x1D:  case 0x1E:  case 0x1F:
        DebugMessage("unknown character " + hex8(c));
        return;
        break;
    }

    if (this.cursorx >= this.ncolumns) {
        this.LineFeed();
        this.cursorx = 0;
    }

    var cx = this.cursorx;
    var cy = this.cursory;
    this.screen[cy][cx] = c;
    this.color[cy][cx] = this.currentcolor;
    this.cursorx++;
    this.PlotRow(this.cursory);
};
